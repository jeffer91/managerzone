const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const failures = [];
const ok = message => console.log(`✓ ${message}`);
const fail = message => { failures.push(message); console.error(`✗ ${message}`); };

function exists(rel) {
  const full = path.join(root, rel);
  if (fs.existsSync(full)) ok(`${rel} existe`);
  else fail(`${rel} no existe`);
}

const jsFiles = [
  'electron/main.js',
  'electron/preload.js',
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
if (pkg.scripts?.start === 'electron .') ok('npm start abre Electron');
else fail('package.json no tiene "start": "electron ."');

const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
const scriptOrder = [
  'app.js',
  'parser-patch.js',
  'core-audit.js',
  'tactics-visibility.js',
  'needs-minimal.js'
];
let lastIndex = -1;
for (const script of scriptOrder) {
  const idx = html.indexOf(`src="${script}"`);
  if (idx < 0) fail(`index.html no carga ${script}`);
  else if (idx <= lastIndex) fail(`${script} está en un orden de carga incorrecto`);
  else { ok(`${script} se carga en el orden correcto`); lastIndex = idx; }
}

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
if (!duplicates.length) ok('No hay IDs HTML duplicados');
else fail(`IDs HTML duplicados: ${[...new Set(duplicates)].join(', ')}`);

const appSource = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const formationMatch = appSource.match(/const FORMATIONS\s*=\s*({[\s\S]*?});\s*\n\s*let players/);
if (!formationMatch) {
  fail('No se pudo localizar FORMATIONS en src/app.js');
} else {
  try {
    const formations = vm.runInNewContext(`(${formationMatch[1]})`);
    const validRoles = new Set(['POR','DEF','VOL','DEL']);
    for (const [name, slots] of Object.entries(formations)) {
      if (slots.length !== 11) fail(`${name} tiene ${slots.length} jugadores en vez de 11`);
      else ok(`${name} tiene 11 posiciones`);
      const keepers = slots.filter(s => s.role === 'POR').length;
      if (keepers !== 1) fail(`${name} tiene ${keepers} porteros en vez de 1`);
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
  if (rows.length === 20) ok('DEMO_DATA contiene 20 jugadores');
  else fail(`DEMO_DATA contiene ${rows.length} jugadores en vez de 20`);
  for (const row of rows) {
    const cols = row.split('|').slice(1, -1).map(x => x.trim());
    if (cols.length !== 19) fail(`Fila demo ${cols[0] || '?'} tiene ${cols.length} columnas en vez de 19`);
  }
} else {
  fail('No se encontró DEMO_DATA');
}

const needsSource = fs.readFileSync(path.join(root, 'src/needs-minimal.js'), 'utf8');
if (/script\.src\s*=\s*['"]youth-scout\.js['"]/.test(needsSource)) ok('Qué comprar carga el módulo de juveniles y scouting');
else fail('needs-minimal.js no carga youth-scout.js');

const youthSource = fs.readFileSync(path.join(root, 'src/youth-scout.js'), 'utf8');
if (/Number\(p\.age\)\s*<=\s*18/.test(youthSource)) ok('Juveniles limita la edad a 18 años');
else fail('Juveniles no aplica correctamente el límite de 18 años');
if (/allYouth\.filter\(p\s*=>\s*!mainIds\.has\(p\.uid\)\)/.test(youthSource)) ok('Juveniles excluye jugadores utilizados en el XI principal');
else fail('Juveniles no excluye el XI principal');
if (/SÍ COMPRAR/.test(youthSource) && /NO COMPRAR/.test(youthSource)) ok('Scout de mercado entrega decisión binaria de compra');
else fail('Scout de mercado no entrega SÍ/NO COMPRAR');
if (/bestAssignment\(slots, \[\.\.\.players, candidate\]\)/.test(youthSource)) ok('Scout simula cada candidato dentro del XI actual');
else fail('Scout no simula al candidato contra la plantilla actual');
if (/mz-ball/.test(youthSource) && /Mínimo a comprar/.test(youthSource)) ok('Qué comprar representa mínimos con balones estilo ManagerZone');
else fail('Qué comprar no incluye la nueva visualización con balones');

if (failures.length) {
  console.error(`\nAUDITORÍA FALLIDA: ${failures.length} problema(s).`);
  process.exit(1);
}

console.log('\nAUDITORÍA OK: estructura, scripts, formaciones, juveniles, scouting y datos demo validados.');