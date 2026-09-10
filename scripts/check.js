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
  'src/market-parser.js',
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
const scriptOrder = ['engine.js','app.js','parser-patch.js','core-audit.js','tactics-visibility.js','needs-minimal.js','market-parser.js','youth-scout.js'];
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

const marketParser = require(path.join(root, 'src/market-parser.js'));
const marketFixture = `
**20:34:39**
Jugadores locales: **43**
Saldo disponible: **946 242 USD**
Activos del equipo: **1 130 366 USD**
Valor del Equipo: **12 175 680 USD**
Búsqueda general / filtros / ruido que debe ignorarse
## [image](x) [Sérgio Maldini](https://www.managerzone.com/?p=players\\&pid=233854665)id: 233854665
| Edad: | **19** |
| Temp: | **Temporada 80** |
| Peso: | **67 kg** |
| Altura: | **160 cm** |
| Pie: | **Diestro** |
| Total de atributos: | **40** |
| Velocidad | [Velocidad: 5](x) | (5) |
| Resistencia | [Resistencia: 8](x) | (8) |
| Inteligencia | [Inteligencia: 0](x) | (0) |
| Pases | [Pases: 3](x) | (3) |
| Remates | [Remates: 1](x) | (1) |
| Cabezazos**1** | [Cabezazos: 8](x) | (8) |
| Atajando**2** | [Atajando: 1](x) | (1) |
| Control de balón**2** | [Control de balón: 3](x) | (3) |
| Entradas**1** | [Entradas: 10](x) | (10) |
| Pases Largos | [Pases Largos: 0](x) | (0) |
| Balón Parado | [Balón Parado: 1](x) | (1) |
| Experiencia | [Experiencia: 3](x) | (3) |
| Estado físico | [Estado físico: 9](x) | (9) |
| Valor: | **611 045 USD** | Sueldo: **11 473 USD** |
| Club | [**Vila Belmiro**](x) |
| Fecha límite | **09-09-2026 20:36** |
| Precio base | **0 USD** |
| Última oferta: | **10 612 USD** |
## [image](x) [齐峰迪](https://www.managerzone.com/?p=players\\&pid=231721660)id: 231721660
| Edad: | **21** |
| Velocidad | [Velocidad: 9](x) | (9) |
| Resistencia | [Resistencia: 9](x) | (9) |
| Inteligencia | [Inteligencia: 2](x) | (2) |
| Pases | [Pases: 2](x) | (2) |
| Remates**1** | [Remates: 9](x) | (9) |
| Cabezazos | [Cabezazos: 3](x) | (3) |
| Atajando**2** | [Atajando: 1](x) | (1) |
| Control de balón | [Control de balón: 7](x) | (7) |
| Entradas | [Entradas: 2](x) | (2) |
| Pases Largos**2** | [Pases Largos: 4](x) | (4) |
| Balón Parado | [Balón Parado: 1](x) | (1) |
| Experiencia | [Experiencia: 5](x) | (5) |
| Estado físico | [Estado físico: 9](x) | (9) |
| Valor: | **834 011 USD** | Sueldo: **8 753 USD** |
| Club | [**东方曙光**](x) |
| Fecha límite | **09-09-2026 20:35** |
| Precio base | **836 884 USD** |
| Última oferta: | **0 USD** |
`;
const marketParsed = marketParser.parseMarketPage(marketFixture, 123456789);
assert(marketParsed.snapshot.hasAvailableBalance && marketParsed.snapshot.availableBalance === 946242, 'El parser detecta el saldo disponible de la página completa');
assert(marketParsed.snapshot.teamAssets === 1130366 && marketParsed.snapshot.teamValue === 12175680, 'El parser detecta activos y valor del equipo');
assert(marketParsed.candidates.length === 2, 'El parser separa múltiples jugadores aunque haya ruido de la página');
const maldini = marketParsed.candidates.find(player => player.pid === '233854665');
const chinese = marketParsed.candidates.find(player => player.pid === '231721660');
assert(maldini?.name === 'Sérgio Maldini' && chinese?.name === '齐峰迪', 'El parser conserva nombres internacionales y PID reales');
assert(maldini?.en === 10 && maldini?.ca === 8 && maldini?.completeStats, 'Los marcadores **1**/**2** no contaminan los valores de atributos');
assert(maldini?.priceCurrent === 10612 && chinese?.priceCurrent === 836884, 'Precio actual usa max(precio base, última oferta)');
assert(maldini?.club === 'Vila Belmiro' && maldini?.deadlineAt, 'El parser extrae club y fecha límite');

const coreSource = fs.readFileSync(path.join(root, 'src/core-audit.js'), 'utf8');
const needsSource = fs.readFileSync(path.join(root, 'src/needs-minimal.js'), 'utf8');
const youthSource = fs.readFileSync(path.join(root, 'src/youth-scout.js'), 'utf8');
const boardSource = fs.readFileSync(path.join(root, 'src/tactics-visibility.js'), 'utf8');
const marketSource = fs.readFileSync(path.join(root, 'src/market-parser.js'), 'utf8');

assert(!/switchView\s*=\s*function/.test(coreSource + needsSource + youthSource), 'Los módulos ya no encadenan sobrescrituras de switchView');
assert(/registerView\(['"]needs['"]/.test(needsSource), 'Qué comprar usa el router central');
assert(/registerView\(['"]youth['"]/.test(youthSource) && /registerView\(['"]market['"]/.test(youthSource), 'Juveniles y scouting usan el router central');
assert(/MZBoard\.renderBoard/.test(youthSource), 'Juveniles reutiliza el renderer táctico principal');
assert(/safePosition/.test(boardSource) && /role === 'DEF'.*76/s.test(boardSource), 'El renderer aplica separación segura entre defensa y portero');
assert(/getActiveMainLineup\(\)/.test(youthSource), 'Juveniles toma como fuente el XI principal activo');
assert(/getMainLineup\(formationName\)/.test(needsSource), 'Qué comprar usa el XI configurado de la formación');
assert(/getMainLineup\(formationName\)/.test(youthSource), 'El scout compara contra el XI configurado');
assert(/MZMarketParser\.parseMarketPage/.test(youthSource), 'Jugadores a comprar usa el parser de página completa');
assert(/NO COMPRAR AHORA/.test(youthSource) && /hasAvailableBalance/.test(youthSource), 'El scout separa mejora deportiva de disponibilidad presupuestaria');
assert(/Mejor calidad\/precio/.test(youthSource) && /Saldo después/.test(youthSource), 'El scout muestra calidad/precio y saldo restante');
assert(/findPlayerHeaders/.test(marketSource) && /priceCurrent/.test(marketSource), 'El parser dedicado identifica jugadores y precio actual');
assert(/MÍNIMO OBLIGATORIO/.test(needsSource) && /Recomendado, no obligatorio/.test(needsSource), 'Qué comprar separa requisitos obligatorios de recomendaciones');

if (failures.length) {
  console.error(`\nAUDITORÍA FALLIDA: ${failures.length} problema(s).`);
  process.exit(1);
}
console.log('\nAUDITORÍA OK: estructura, precisión, tácticas, juveniles, mercado completo, presupuesto e integración validados.');