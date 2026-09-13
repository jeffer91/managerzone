const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const parser = require('../src/finance-parser.js');
const engine = require('../src/finance-engine.js');

const root = path.resolve(__dirname, '..');
const fixture = `
Total 374 694 USD
Ingresos 934 457 USD
Recompensa de Logro 791 228 USD
Recaudación por instalaciones 4 379 USD
Ingreso por venta de entradas 44 080 USD
Ingresos por espónsors 94 770 USD
Gastos 559 763 USD
Construcción del estadio 129 321 USD
Compra de jugadores 184 124 USD
Gastos por instalaciones 1 185 USD
Gastos por el estadio 13 360 USD
Sueldos de jugadores 184 680 USD
Juveniles 46 000 USD
Sueldos de empleados 1 093 USD
Cálculo de gastos semanales.
Sueldos de jugadores 184 680 USD
Sueldos de empleados 1 093 USD
Gastos por el estadio 13 680 USD
Gastos por instalaciones 1 422 USD
Juveniles 46 000 USD
Total 246 875 USD
Partidos generadores de ingresos
Partidos locales de Liga Senior 1 1
Partidos locales de Ligas Juveniles 0 0
Partidos Amistosos de local 0 / 2 0 / 2
`;

for (const file of ['src/finance-parser.js','src/finance-engine.js','src/finance-view.js']) {
  assert(fs.existsSync(path.join(root,file)),`${file} debe existir`);
  execFileSync(process.execPath,['--check',path.join(root,file)],{stdio:'pipe'});
}
assert(fs.existsSync(path.join(root,'src/finance.css')),'src/finance.css debe existir');

const html = fs.readFileSync(path.join(root,'src/index.html'),'utf8');
assert(html.includes('href="finance.css"'),'index.html carga finance.css');
assert(html.includes('id="view-finance"'),'Existe la vista Finanzas');
assert(html.includes('data-view="finance"'),'Existe navegación a Finanzas');
let previous=-1;
for (const script of ['market-parser.js','finance-parser.js','finance-engine.js','finance-view.js']) {
  const current=html.indexOf(`src="${script}"`);
  assert(current>previous,`${script} debe cargarse en el orden correcto`);
  previous=current;
}

const viewSource=fs.readFileSync(path.join(root,'src/finance-view.js'),'utf8');
assert(viewSource.includes('registerResetHandler(resetModule)'),'Finanzas participa en el reinicio general');
assert(viewSource.includes('p.warnings'),'La vista financiera muestra observaciones del parser');
assert(viewSource.includes('snapshotStatus'),'La vista valida la antigüedad del saldo');
assert(viewSource.includes('financeReady=p.complete&&p.warnings.length===0'),'Un reporte con observaciones no se guarda como reporte válido');

const parsed = parser.parseFinanceReport(fixture, 123456);
assert.equal(parsed.valid, true);
assert.equal(parsed.complete, true);
assert.equal(parsed.warnings.length,0);
assert.equal(parsed.report.income.total, 934457);
assert.equal(parsed.report.expenses.total, 559763);
assert.equal(parsed.report.accountingResult, 374694);
assert.equal(parsed.report.weeklyCosts.total, 246875);
assert.equal(parsed.report.weeklyCosts.players, 184680);
assert.equal(parsed.report.matches.seniorLeagueHome.current, 1);
assert.equal(parsed.report.matches.friendliesHome.current, 0);
assert.equal(parsed.report.matches.friendliesHome.maximum, 2);

const inconsistent = parser.parseFinanceReport(fixture.replace('Ingresos 934 457 USD','Ingresos 999 999 USD'),123456);
assert(inconsistent.warnings.some(item=>item.includes('ingresos')),'El parser advierte si el detalle de ingresos no coincide');

const players = [
  {uid:'a',name:'Titular',salary:20000,value:500000,age:25,ratings:{bestRole:'DEL',bestScore:8.2}},
  {uid:'b',name:'Suplente caro',salary:18000,value:400000,age:29,ratings:{bestRole:'VOL',bestScore:5.5}},
  {uid:'c',name:'Suplente barato',salary:5000,value:200000,age:20,ratings:{bestRole:'DEF',bestScore:6.5}}
];
const result = engine.analyze(parsed.report,{players,lineup:[players[0]],availableBalance:1000000,reserveWeeks:4});
assert.equal(result.accountingResult,374694);
assert.equal(result.extraordinaryIncome,791228);
assert.equal(result.ordinaryIncome,143229);
assert.equal(result.operatingResult,-103646);
assert.equal(result.weeklyCost,246875);
assert.equal(result.safeBudget,12500);
assert(result.recommendations.some(item=>item.title.includes('gastos fijos')));
assert(result.saleCandidates.some(item=>item.uid==='b'));

const hour=60*60*1000;
const snapshot={hasAvailableBalance:true,availableBalance:946242,capturedAt:100000};
const fresh=engine.snapshotStatus(snapshot,100000+23*hour);
const stale=engine.snapshotStatus(snapshot,100000+25*hour);
assert.equal(fresh.fresh,true,'Un saldo menor a 24 horas se considera vigente');
assert.equal(stale.stale,true,'Un saldo mayor a 24 horas se considera desactualizado');
assert.equal(stale.balance,946242,'La antigüedad no altera el valor guardado del saldo');

console.log('✓ Finance parser, engine and UI integration OK');
