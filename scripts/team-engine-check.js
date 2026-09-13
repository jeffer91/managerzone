const assert=require('assert');
const base=require('../src/engine.js');
const spatial=require('../src/spatial-engine.js');
spatial.install(base);
const team=require('../src/team-engine.js');
team.install(base);

const make=(uid,a)=>{const p={uid,name:uid,age:24,ve:5,res:5,intel:5,pa:5,rem:5,ca:5,at:1,ctrl:5,en:5,pl:5,bp:1,exp:5,ef:7,...a};p.ratings=base.ratePlayer(p);return p;};

const five=[
 {role:'POR',x:50,y:91},
 {role:'DEF',x:12,y:69},{role:'DEF',x:30,y:77},{role:'DEF',x:50,y:80},{role:'DEF',x:70,y:77},{role:'DEF',x:88,y:69},
 {role:'VOL',x:28,y:48},{role:'VOL',x:50,y:54},{role:'VOL',x:72,y:48},
 {role:'DEL',x:38,y:20},{role:'DEL',x:62,y:20}
];
assert.equal(base.slotCode(five[1],five),'CAI','el extremo de una defensa de cinco debe ser carrilero');
assert.equal(base.slotCode(five[2],five),'DFC','el segundo defensor de una línea de cinco debe ser central');
assert.equal(base.slotCode(five[3],five),'DFC','el defensor central de una línea de cinco debe ser central');
assert.equal(base.slotCode(five[4],five),'DFC','el cuarto defensor de una línea de cinco debe ser central');
assert.equal(base.slotCode(five[5],five),'CAD','el extremo derecho de una defensa de cinco debe ser carrilero');

const creator=make('creador',{pa:10,ctrl:10,intel:9,rem:7,en:4,res:7,ve:6});
const helper=make('apoyo',{pa:7,ctrl:7,intel:6,en:7,res:8,ve:6});
const wing=make('banda',{pa:6,ctrl:7,intel:5,en:5,res:8,ve:9});
const gk=make('gk',{at:9,intel:6,res:7});
const cb1=make('cb1',{en:9,intel:8,ca:7,res:8,ve:6});
const cb2=make('cb2',{en:8,intel:7,ca:7,res:8,ve:7});
const fb1=make('fb1',{en:7,ve:9,res:9,pa:7,pl:8,ctrl:7});
const fb2=make('fb2',{en:7,ve:8,res:8,pa:7,pl:7,ctrl:7});
const st1=make('st1',{rem:9,ctrl:8,pa:6,ve:7,intel:7,ca:7});
const st2=make('st2',{rem:8,ctrl:8,pa:7,ve:8,intel:6,ca:5});
const extra=make('extra',{pa:6,ctrl:6,intel:5,en:6,res:7,ve:7});

const fourFourTwo=[
 {role:'POR',x:50,y:91},{role:'DEF',x:18,y:73},{role:'DEF',x:39,y:78},{role:'DEF',x:61,y:78},{role:'DEF',x:82,y:73},
 {role:'VOL',x:17,y:49},{role:'VOL',x:50,y:58},{role:'VOL',x:50,y:39},{role:'VOL',x:83,y:49},
 {role:'DEL',x:38,y:20},{role:'DEL',x:62,y:20}
];
const lineupCentral=[gk,fb1,cb1,cb2,fb2,wing,helper,creator,extra,st1,st2];
const lineupCreatorWide=[gk,fb1,cb1,cb2,fb2,creator,helper,wing,extra,st1,st2];
const centralAnalysis=base.analyzeTeam(fourFourTwo,lineupCentral);
const wideAnalysis=base.analyzeTeam(fourFourTwo,lineupCreatorWide);
assert(centralAnalysis.score>wideAnalysis.score,'un organizador claramente superior debe rendir mejor conectado por el centro que aislado en banda');
assert(centralAnalysis.components.connection>wideAnalysis.components.connection,'la conexión entre líneas debe mejorar cuando el mejor pasador ocupa el centro');

const closeSlots=[
 {role:'POR',x:50,y:91},{role:'DEF',x:18,y:73},{role:'DEF',x:39,y:78},{role:'DEF',x:61,y:78},{role:'DEF',x:82,y:73},
 {role:'VOL',x:38,y:48},{role:'VOL',x:50,y:42},{role:'VOL',x:62,y:48},{role:'VOL',x:83,y:49},
 {role:'DEL',x:38,y:20},{role:'DEL',x:62,y:20}
];
const farSlots=closeSlots.map((s,i)=>i===5?{...s,x:15}:i===7?{...s,x:85}:{...s});
const creator2=make('creador2',{pa:9,ctrl:9,intel:9,rem:6,en:4,res:7,ve:6});
const pairLineup=[gk,fb1,cb1,cb2,fb2,creator2,helper,creator,extra,st1,st2];
assert(base.analyzeTeam(closeSlots,pairLineup).components.cohesion>base.analyzeTeam(farSlots,pairLineup).components.cohesion,'dos organizadores similares sin gran velocidad deben beneficiarse de estar conectados');

const fast1=make('rapido1',{pa:7,ctrl:8,intel:6,ve:10,res:9,en:5});
const fast2=make('rapido2',{pa:7,ctrl:8,intel:6,ve:10,res:9,en:5});
const speedLineup=[gk,fb1,cb1,cb2,fb2,fast1,helper,fast2,extra,st1,st2];
assert(base.analyzeTeam(farSlots,speedLineup).components.attack>base.analyzeTeam(closeSlots,speedLineup).components.attack,'dos mediocampistas muy rápidos deben ganar valor ofensivo cuando pueden abrir el campo');

const a=base.analyzeTeam(fourFourTwo,lineupCentral);
assert(a&&a.components&&['positional','cohesion','connection','attack','defense'].every(k=>Number.isFinite(a.components[k])),'el análisis debe devolver las cinco notas del equipo');
assert(a.attackPlan&&a.defensePlan,'el motor debe explicar cómo atacar y cómo defender');

const compared=base.compareFormations({'4-4-2':fourFourTwo,'5-3-2':five},[gk,fb1,cb1,cb2,fb2,creator,helper,wing,extra,st1,st2,creator2,fast1,fast2]);
assert(compared.every(x=>x.analysis?.components),'el ranking de formaciones debe conservar el análisis colectivo');
assert(compared.every(x=>Number.isFinite(x.score)),'cada formación completa debe recibir una nota colectiva');
console.log('✓ Team cohesion, line connection, attack and defense engine OK');