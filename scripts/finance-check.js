const assert = require('assert');
const parser = require('../src/finance-parser.js');
const engine = require('../src/finance-engine.js');

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

const parsed = parser.parseFinanceReport(fixture, 123456);
assert.equal(parsed.valid, true);
assert.equal(parsed.complete, true);
assert.equal(parsed.report.income.total, 934457);
assert.equal(parsed.report.expenses.total, 559763);
assert.equal(parsed.report.accountingResult, 374694);
assert.equal(parsed.report.weeklyCosts.total, 246875);
assert.equal(parsed.report.weeklyCosts.players, 184680);
assert.equal(parsed.report.matches.seniorLeagueHome.current, 1);
assert.equal(parsed.report.matches.friendliesHome.current, 0);
assert.equal(parsed.report.matches.friendliesHome.maximum, 2);

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
console.log('✓ Finance parser and engine OK');
