const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const failures = [];
const ok = message => console.log(`✓ ${message}`);
const fail = message => { failures.push(message); console.error(`✗ ${message}`); };
const assert = (condition, message) => condition ? ok(message) : fail(message);

function exists(rel) {
  const full = path.join(root, rel);
  if (fs.existsSync(full)) ok(`${rel} existe`);
  else fail(`${rel} no existe`);
}

const jsFiles = [
  'electron/main.js',
  'electron/preload.js',
  'src/engine.js',
  'src/app.js',
  'src/parser-patch.js',
  'src/core-audit.js',
  'src/tactics-visibility.js',
  'src/needs-minimal.js',
  'src/youth-scout.js'
];

for (const file of jsFiles) {
  exists(file);
  try {
    execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
    ok(`${file} pasa validación de sintaxis`);
  } catch (error) {
    fail(`${file} tiene error de sintaxis: ${error.stderr?.toString().trim() || error.message}`);
  }
}

exists('src/index.html');
exists('src/styles.css');
exists('src/tactics-visibility.css');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert(pkg.scripts?.start === 'electron .', 'npm start abre Electron');
assert(pkg.scripts?.check === 'node scripts/check.js', 'npm run check ejecuta la auditoría');

const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
const scriptOrder = ['engine.js','app.js','parser-patch.js','core-audit.js','tactics-visibility.js','needs-minimal.js','youth-scout.js'];
let lastIndex = -1;
for (const script of scriptOrder) {
  const idx = html.indexOf(`src="${script}"`);
  if (idx < 0) fail(`index.html no carga ${script}`);
  else if (idx <= lastIndex) fail(`${script} está en un orden de carga incorrecto`);
  else { ok(`${script} se carga en el orden correcto`); lastIndex = idx; }
}

for (const view of ['dashboard','import','squad','tactics','youth','needs','market']) {
  assert(html.includes(`id="view-${view}"`), `Existe la vista ${view}`);
  assert(html.includes(`data-view="${view}"`), `Existe navegación para ${view}`);
}

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
assert(!duplicates.length, `No hay IDs HTML duplicados${duplicates.length ? `: ${[...new Set(duplicates)].join(', ')}` : ''}`);

const appSource = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const formationMatch = appSource.match(/const FORMATIONS\s*=\s*({[\s\S]*?});\s*\n\s*let players/);
if (!formationMatch) {
  fail('No se pudo localizar FORMATIONS en src/app.js');
} else {
  try {
    const formations = vm.runInNewContext(`(${formationMatch[1]})`);
    const validRoles = new Set(['POR','DEF','VOL','DEL']);
    for (const [name, slots] of Object.entries(formations)) {
      assert(slots.length === 11, `${name} tiene 11 posiciones`);
      assert(slots.filter(slot => slot.role === 'POR').length === 1, `${name} tiene un portero`);
      for (const slot of slots) {
        if (!validRoles.has(slot.role)) fail(`${name} contiene rol inválido ${slot.role}`);
        if (!(slot.x >= 0 && slot.x <= 100 && slot.y >= 0 && slot.y <= 100)) fail(`${name} tiene coordenadas fuera de cancha`);
      }
    }
  } catch (error) {
    fail(`FORMATIONS no se pudo evaluar: ${error.message}`);
  }
}

const demoMatch = appSource.match(/const DEMO_DATA=`([\s\S]*?)`;/);
if (demoMatch) {
  const rows = demoMatch[1].split(/\r?\n/).filter(line => /^\|\s*\d+\s*\|/.test(line));
  assert(rows.length === 20, 'DEMO_DATA contiene 20 jugadores');
  for (const row of rows) {
    const cols = row.split('|').slice(1, -1).map(value => value.trim());
    if (cols.length !== 19) fail(`Fila demo ${cols[0] || '?'} tiene ${cols.length} columnas en vez de 19`);
  }
} else fail('No se encontró DEMO_DATA');

const engine = require(path.join(root, 'src/engine.js'));
assert(engine.CONFIG.YOUTH_MAX_AGE === 18, 'El motor central fija juveniles en máximo 18 años');
assert(engine.CONFIG.BUY_MIN_TACTIC_GAIN > 0, 'El motor define mejora mínima de compra');

function mock(uid, scores, age = 20) {
  return { uid, name: uid, age, ratings: { POR:0, DEF:0, VOL:0, DEL:0, bestRole:'DEF', bestScore:0, ...scores } };
}

const precisionSlots = [{ role:'DEF', x:50, y:50 }];
const preciseA = mock('A',{DEF:6.84});
const preciseB = mock('B',{DEF:6.76});
const precisePick = engine.bestAssignment(precisionSlots,[preciseB,preciseA]);
assert(precisePick.lineup[0]?.uid === 'A', 'El optimizador conserva precisión interna para desempatar jugadores');
assert(Math.abs(precisePick.score - 6.84) < 1e-9, 'La nota táctica no se redondea a un decimal internamente');

const youthRoster = [mock('u16',{DEF:2},16),mock('u18-main',{DEF:4},18),mock('u19',{DEF:9},19)];
const youth = engine.eligibleYouth(youthRoster,[youthRoster[1]]);
assert(youth.allYouth.length === 2, 'La elegibilidad juvenil incluye 18 años y excluye 19');
assert(youth.eligible.length === 1 && youth.eligible[0].uid === 'u16', 'Un juvenil usado en el XI principal queda excluido');

const elevenDefSlots = Array.from({length:11},(_,index)=>({role:'DEF',x:(index+1)*8,y:50}));
const baseline = Array.from({length:11},(_,index)=>mock(`base-${index}`,{DEF:5+index/100}));
const candidate = mock('candidate',{DEF:8});
const simulation = engine.simulateCandidate(elevenDefSlots,baseline,candidate);
assert(simulation.enters, 'Un candidato claramente mejor entra en la simulación del XI');
assert(simulation.gain > 0, 'La simulación reporta mejora táctica positiva');
assert(new Set(simulation.afterLineup.map(player=>player.uid)).size === 11, 'La simulación nunca repite jugadores');

const weakSlots = Array.from({length:11},(_,index)=>({role:index===0?'POR':'DEF',x:50,y:50}));
const weakRoster = [mock('gk',{POR:3.9}),...Array.from({length:10},(_,i)=>mock(`d-${i}`,{DEF:5.2}))];
const weakResult = engine.bestAssignment(weakSlots,weakRoster);
assert(Math.abs(weakResult.score - engine.tacticScore(weakSlots,weakResult.lineup)) < 1e-12, 'El optimizador y la nota final usan la misma función de utilidad');

const coreSource = fs.readFileSync(path.join(root, 'src/core-audit.js'), 'utf8');
const needsSource = fs.readFileSync(path.join(root, 'src/needs-minimal.js'), 'utf8');
const youthSource = fs.readFileSync(path.join(root, 'src/youth-scout.js'), 'utf8');
const boardSource = fs.readFileSync(path.join(root, 'src/tactics-visibility.js'), 'utf8');

assert(!/switchView\s*=\s*function/.test(coreSource + needsSource + youthSource), 'Los módulos ya no encadenan sobrescrituras de switchView');
assert(/registerView\(['"]needs['"]/.test(needsSource), 'Qué comprar usa el router central');
assert(/registerView\(['"]youth['"]/.test(youthSource) && /registerView\(['"]market['"]/.test(youthSource), 'Juveniles y scouting usan el router central');
assert(/MZBoard\.renderBoard/.test(youthSource), 'Juveniles reutiliza el renderer táctico principal');
assert(/safePosition/.test(boardSource) && /role === 'DEF'.*76/s.test(boardSource), 'El renderer aplica separación segura entre defensa y portero');
assert(/getActiveMainLineup\(\)/.test(youthSource), 'Juveniles toma como fuente el XI principal activo');
assert(/getMainLineup\(formationName\)/.test(needsSource), 'Qué comprar usa el XI configurado de la formación');
assert(/getMainLineup\(formationName\)/.test(youthSource), 'El scout compara contra el XI configurado');
assert(/precio no forma parte|precio no se pondera/i.test(youthSource), 'El scout aclara que SÍ/NO es una decisión deportiva');
assert(/MÍNIMO OBLIGATORIO/.test(needsSource) && /Recomendado, no obligatorio/.test(needsSource), 'Qué comprar separa requisitos obligatorios de recomendaciones');

if (failures.length) {
  console.error(`\nAUDITORÍA FALLIDA: ${failures.length} problema(s).`);
  process.exit(1);
}
console.log('\nAUDITORÍA OK: estructura, precisión, tácticas, juveniles, scouting e integración validados.');