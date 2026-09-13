const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {execFileSync}=require('child_process');
const engine=require('../src/engine.js');
require('../src/spatial-engine.js').install(engine);
require('../src/team-engine.js').install(engine);
require('../src/team-engine-tuning.js').install(engine);
const D=require('../src/team-decisions-engine.js');
const make=(name,a={})=>{const p={uid:name,name,age:24,value:500000,salary:8000,ve:6,res:7,intel:6,pa:6,rem:4,ca:5,at:1,ctrl:6,en:6,pl:4,bp:1,exp:5,ef:7,...a};p.ratings=engine.ratePlayer(p);return p;};
const slots=[
 {role:'POR',x:50,y:91},{role:'DEF',x:18,y:73},{role:'DEF',x:39,y:78},{role:'DEF',x:61,y:78},{role:'DEF',x:82,y:73},
 {role:'VOL',x:17,y:49},{role:'VOL',x:50,y:58},{role:'VOL',x:50,y:39},{role:'VOL',x:83,y:49},{role:'DEL',x:38,y:20},{role:'DEL',x:62,y:20}
];
const lineup=[
 make('gk',{at:9}),make('lb',{en:8,ve:8,res:8}),make('cb1',{en:9,intel:8,ca:7}),make('cb2',{en:9,intel:8,ca:7}),make('rb',{en:8,ve:8,res:8}),
 make('lm',{ve:8,pa:7,ctrl:7}),make('shield',{en:8,intel:8,res:9,pa:6}),make('weakCreator',{pa:2,ctrl:3,intel:3,en:4,ve:5}),make('rm',{ve:8,pa:7,ctrl:7}),
 make('st1',{rem:9,ctrl:8,ve:7,pa:6}),make('st2',{rem:8,ctrl:7,ve:8,pa:6})
];
const creatorBackup=make('creatorBackup',{pa:9,ctrl:9,intel:9,ve:6,salary:12000});
const coverBackup=make('coverBackup',{en:8,intel:7,res:8,ve:7,salary:11000});
const gkBackup=make('gkBackup',{at:7,intel:6,salary:7000});
const wideBackup=make('wideBackup',{ve:9,res:8,pa:7,ctrl:7,salary:9000});
const finishBackup=make('finishBackup',{rem:8,ctrl:7,ve:7,salary:10000});
const spare=make('spare',{pa:3,ctrl:3,intel:3,en:3,ve:4,rem:3,salary:15000});
const roster=[...lineup,creatorBackup,coverBackup,gkBackup,wideBackup,finishBackup,spare];
const needs=D.rankNeeds(slots,lineup,roster);
assert(needs.length===11,'debe evaluar los once puestos');
assert(needs[0].role==='VOL','un mediocampista claramente débil debe emerger como prioridad colectiva');
assert(needs[0].gain>0,'la mejora recomendada debe aumentar la nota del equipo');
assert.equal(needs[0].kind,'starter','una mejora real del XI debe clasificarse como titular');
assert(Object.keys(needs[0].deltas).includes('connection'),'la recomendación debe explicar cambios por componente');
assert.equal(D.classifyNeed(.01,.8,0),'depth','sin mejora del XI pero sin relevo debe ser necesidad de profundidad');
assert.equal(D.classifyNeed(.01,.1,0),'monitor','sin mejora ni problema de relevo no debe forzar una compra');
const coverageBench=D.functionalBench(roster,lineup);
assert.equal(coverageBench.length,5,'la cobertura funcional interna debe mantener cinco funciones');
assert.equal(new Set(coverageBench.map(x=>x.player.uid)).size,coverageBench.length,'la cobertura funcional no debe repetir jugadores');
const mzBench=D.selectMzBench(roster,lineup);
assert.equal(mzBench.length,5,'el banco MZ debe tener cinco plazas cuando hay jugadores suficientes');
assert.deepEqual(mzBench.map(x=>x.slotRole),['POR','DEF','VOL','DEL','COM'],'el banco debe respetar POR → DEF → VOL → DEL → comodín');
assert.equal(new Set(mzBench.map(x=>x.player.uid)).size,mzBench.length,'el banco MZ no debe repetir jugadores');
const forms={'4-4-2':slots};
const ev=D.saleEvaluation(forms,roster,creatorBackup,lineup);
assert(ev.protected,'el único organizador suplente fuerte debe quedar protegido de venta');
assert(ev.protectedFunction==='Organizador','la protección debe explicar la función crítica');
const evSpare=D.saleEvaluation(forms,roster,spare,lineup);
assert(!evSpare.protected,'un suplente caro sin función crítica puede ser vendible');
const tiny=D.meaningfulSimulation(slots,lineup,make('candidate',{pa:7,ctrl:7,intel:7}),()=>({beforeScore:7,afterScore:7.02,gain:.02,enters:true,afterLineup:lineup,analysis:engine.analyzeTeam(slots,lineup)}));
assert.equal(tiny.gain,0,'una mejora táctica mínima no debe justificar cambiar el XI');
assert.equal(tiny.rawGain,.02,'se debe conservar la mejora bruta para explicarla');
const html=fs.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');
assert(html.includes('team-decisions-engine.js')&&html.includes('team-decisions-ui.js'),'los módulos de decisiones deben cargarse en la app');
assert(html.indexOf('team-decisions-engine.js')<html.indexOf('app.js'),'el motor de decisiones debe estar disponible antes de la app');
assert(html.indexOf('team-tactics-ui.js')<html.indexOf('team-decisions-ui.js'),'la integración de decisiones debe ser la capa final de UI');
for(const rel of ['src/team-decisions-engine.js','src/team-decisions-ui.js','src/slot-integration.js'])execFileSync(process.execPath,['--check',path.join(__dirname,'..',rel)],{stdio:'pipe'});
const ui=fs.readFileSync(path.join(__dirname,'../src/team-decisions-ui.js'),'utf8');
const market=fs.readFileSync(path.join(__dirname,'../src/slot-integration.js'),'utf8');
assert(ui.includes('CUELLO DE BOTELLA')&&ui.includes('Orden MZ: POR')&&ui.includes('saleCandidates'),'la UI debe integrar necesidad, banco MZ y ventas');
assert(ui.includes('la app no estima potencial futuro'),'juveniles no debe afirmar potencial que no conoce');
assert(ui.includes('Impacto al vender')&&ui.includes('scoreDrop'),'finanzas debe explicar el impacto táctico de una venta');
assert(market.includes('function financePolicy')&&market.includes('Presupuesto seguro')&&market.includes('safeBudgetAfter'),'mercado debe decidir con presupuesto seguro y mostrar la reserva');
assert(market.includes("target?.needKind==='depth'")&&market.includes("SÍ · RELEVO"),'mercado debe distinguir compra titular de compra de relevo');
console.log('✓ Team needs, safe-budget market, MZ bench, sale explanation and youth wording OK');
