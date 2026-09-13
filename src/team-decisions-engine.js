(function(root,factory){
'use strict';
if(typeof module==='object'&&module.exports){
  const base=require('./engine.js');
  require('./spatial-engine.js').install(base);
  require('./team-engine.js').install(base);
  require('./team-engine-tuning.js').install(base);
  module.exports=factory(base);
}else root.MZTeamDecisionsEngine=factory(root.MZEngine);
})(typeof globalThis!=='undefined'?globalThis:this,function(engine){
'use strict';
if(!engine)throw new Error('MZEngine requerido');
const clamp=(n,min=0,max=10)=>Math.max(min,Math.min(max,Number(n)||0));
const avg=a=>a.length?a.reduce((s,v)=>s+(Number(v)||0),0)/a.length:0;
const attr=(p,k)=>clamp(p?.[k],0,10);
const COMPONENT_LABELS={positional:'Calidad en puestos',cohesion:'Cohesión del equipo',connection:'Conexión entre líneas',attack:'Creación ofensiva',defense:'Protección defensiva'};
const COMPONENT_SHORT={positional:'Puestos',cohesion:'Cohesión',connection:'Conexión',attack:'Ataque',defense:'Defensa'};

function componentDeltas(before,after){
 const out={};for(const k of Object.keys(COMPONENT_LABELS))out[k]=(Number(after?.components?.[k])||0)-(Number(before?.components?.[k])||0);return out;
}
function diagnoseBottleneck(analysis){
 const c=analysis?.components||{};
 const keys=['connection','cohesion','attack','defense','positional'];
 const key=keys.slice().sort((a,b)=>(Number(c[a])||0)-(Number(c[b])||0))[0]||'positional';
 const value=Number(c[key])||0;
 const detail={
   positional:'Hay puestos donde la calidad individual limita la estructura.',
   cohesion:'Los jugadores no se complementan suficientemente dentro de sus líneas.',
   connection:'La principal pérdida está en el enlace defensa → medio → ataque.',
   attack:'El equipo necesita crear o finalizar más y mejores ocasiones.',
   defense:'La estructura necesita más cobertura, recuperación o protección de espacios.'
 }[key];
 return{key,label:COMPONENT_LABELS[key],short:COMPONENT_SHORT[key],value,detail};
}
function virtualUpgrade(player,slot,slots,index=0){
 const source=player||{name:'Vacante',age:24};const profile=engine.slotProfile(slot,slots);const weights=profile?.weights||{};
 const p={...source,id:`virtual-${index}`,uid:`virtual-${index}-${source.uid||source.name||'player'}`,name:`Mejora ${engine.slotCode(slot,slots)}`};
 for(const[key,w]of Object.entries(weights)){
   const cur=attr(source,key);const floor=(profile.requirements||[]).find(x=>x[0]===key)?.[1]||0;
   const step=w>=.18?1.8:w>=.12?1.4:w>=.08?1.0:.7;
   p[key]=clamp(Math.max(cur+step,floor+(w>=.12?1:0)),0,10);
 }
 p.age=Math.min(Number(source.age)||24,28);p.salary=Number(source.salary)||0;p.value=Number(source.value)||0;p.ef=Math.max(attr(source,'ef'),7);
 p.ratings=engine.ratePlayer(p);return p;
}
function benchDepth(roster,lineup,slot,slots){
 const used=new Set((lineup||[]).filter(Boolean).map(p=>p.uid));
 const scores=(roster||[]).filter(p=>!used.has(p.uid)).map(p=>engine.slotRating(p,slot,slots)).sort((a,b)=>b-a);return scores[0]||0;
}
function targetAttributes(candidate,slot,slots){
 const profile=engine.slotProfile(slot,slots),weights=profile.weights||{};
 return Object.entries(weights).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([key])=>({key,label:engine.ATTR_LABELS?.[key]||key,minimum:Math.max(1,Math.min(10,Math.ceil(attr(candidate,key)))),value:attr(candidate,key)}));
}
function rankNeeds(slots,lineup,roster=[]){
 if(!Array.isArray(slots)||!Array.isArray(lineup)||lineup.length!==slots.length||lineup.some(p=>!p))return[];
 const baseline=engine.analyzeTeam(slots,lineup),bottleneck=diagnoseBottleneck(baseline),used=new Set(lineup.map(p=>p.uid));
 return slots.map((slot,index)=>{
   const current=lineup[index],candidate=virtualUpgrade(current,slot,slots,index);
   const pool=lineup.filter((_,i)=>i!==index).concat(candidate);const assigned=engine.bestAssignment(slots,pool);const after=assigned.analysis||engine.analyzeTeam(slots,assigned.lineup);
   const gain=(Number(after.score)||0)-(Number(baseline.score)||0),deltas=componentDeltas(baseline,after),depth=benchDepth(roster,lineup,slot,slots);
   const depthGap=clamp((6.4-depth)/6.4,0,1),agePressure=(Number(current.age)||0)>=33?1:(Number(current.age)||0)>=30?.55:0;
   const bottleneckGain=Math.max(0,Number(deltas[bottleneck.key])||0);
   const impact=Math.max(0,gain)+bottleneckGain*.30+depthGap*.05+agePressure*.04;
   const currentRating=engine.slotRating(current,slot,slots);const targetRating=engine.slotRating(candidate,slot,slots);
   return{index,slot,role:slot.role,code:engine.slotCode(slot,slots),position:engine.slotLabel(slot,slots),player:current,currentRating,targetRating,candidate,baseline,after,gain,deltas,depth,depthGap,agePressure,bottleneck,bottleneckGain,impact,requirements:targetAttributes(candidate,slot,slots)};
 }).sort((a,b)=>b.impact-a.impact||b.gain-a.gain||a.currentRating-b.currentRating);
}
function functionDefinitions(){return[
 {key:'gk',label:'Portero',score:p=>attr(p,'at')*.62+attr(p,'intel')*.15+attr(p,'exp')*.10+attr(p,'res')*.08+attr(p,'ve')*.05},
 {key:'cover',label:'Defensa / cobertura',score:p=>attr(p,'en')*.42+attr(p,'intel')*.22+attr(p,'res')*.18+attr(p,'ve')*.10+attr(p,'ca')*.08},
 {key:'creator',label:'Organizador',score:p=>typeof engine.creatorScore==='function'?engine.creatorScore(p):attr(p,'pa')*.45+attr(p,'ctrl')*.35+attr(p,'intel')*.20},
 {key:'wide',label:'Banda / amplitud',score:p=>attr(p,'ve')*.35+attr(p,'res')*.22+attr(p,'pa')*.20+attr(p,'ctrl')*.18+attr(p,'en')*.05},
 {key:'finisher',label:'Rematador',score:p=>attr(p,'rem')*.52+attr(p,'ctrl')*.18+attr(p,'ve')*.12+attr(p,'intel')*.10+attr(p,'ca')*.08}
];}
function functionalScores(player){return Object.fromEntries(functionDefinitions().map(f=>[f.key,clamp(f.score(player),0,10)]));}
function functionalBench(roster,lineup){
 const starters=new Set((lineup||[]).filter(Boolean).map(p=>p.uid));const remaining=(roster||[]).filter(p=>!starters.has(p.uid));const used=new Set(),out=[];
 for(const f of functionDefinitions()){
   const best=remaining.filter(p=>!used.has(p.uid)).map(p=>({player:p,score:clamp(f.score(p),0,10)})).sort((a,b)=>b.score-a.score)[0];
   if(best){used.add(best.player.uid);out.push({...best,key:f.key,label:f.label});}
 }
 return out;
}
function functionalCoverage(roster,lineup){
 const bench=functionalBench(roster,lineup);return Object.fromEntries(bench.map(x=>[x.key,x]));
}
function bestFormation(formations,roster){return engine.compareFormations(formations,roster)[0]||null;}
function saleEvaluation(formations,roster,player,activeLineup=null){
 const full=bestFormation(formations,roster);if(!full)return null;
 const starters=new Set((activeLineup||full.lineup||[]).filter(Boolean).map(p=>p.uid));
 if(starters.has(player.uid))return{player,starter:true,protected:true,scoreDrop:Infinity,coverageDrop:Infinity,reason:'Titular del XI actual.'};
 const without=(roster||[]).filter(p=>p.uid!==player.uid),next=bestFormation(formations,without);const scoreDrop=Math.max(0,(Number(full.score)||0)-(Number(next?.score)||0));
 const coverage=functionalCoverage(roster,activeLineup||full.lineup),coverageWithout=functionalCoverage(without,activeLineup||full.lineup);
 let protectedFunction=null,coverageDrop=0;
 for(const f of functionDefinitions()){
   if(coverage[f.key]?.player?.uid!==player.uid)continue;
   const drop=Math.max(0,(coverage[f.key]?.score||0)-(coverageWithout[f.key]?.score||0));if(drop>coverageDrop){coverageDrop=drop;protectedFunction=f.label;}
 }
 const protectedPlayer=scoreDrop>=.10||coverageDrop>=1.0;
 const reason=protectedPlayer?(protectedFunction?`Es la cobertura funcional de ${protectedFunction}; venderlo debilita el banco.`:`Al quitarlo, la mejor estructura cae ${scoreDrop.toFixed(2)} puntos.`):`Su salida apenas cambia la mejor estructura (${scoreDrop.toFixed(2)}) y existe cobertura funcional.`;
 return{player,starter:false,protected:protectedPlayer,scoreDrop,coverageDrop,protectedFunction,reason,next};
}
function saleCandidates(formations,roster,activeLineup=null,limit=3){
 const list=(roster||[]).map(p=>saleEvaluation(formations,roster,p,activeLineup)).filter(x=>x&&!x.starter&&!x.protected);
 const salaries=(roster||[]).map(p=>Number(p.salary)||0).sort((a,b)=>a-b),median=salaries.length?salaries[Math.floor(salaries.length/2)]:0;
 return list.filter(x=>(Number(x.player.salary)||0)>=median).sort((a,b)=>(Number(b.player.salary)||0)-(Number(a.player.salary)||0)||a.scoreDrop-b.scoreDrop).slice(0,limit).map(x=>({uid:x.player.uid,name:x.player.name,role:x.player.ratings?.bestRole||'—',rating:x.player.ratings?.bestScore||0,salary:Number(x.player.salary)||0,value:Number(x.player.value)||0,age:Number(x.player.age)||0,scoreDrop:x.scoreDrop,reason:x.reason}));
}
function meaningfulSimulation(slots,baseline,candidate,simulate){
 const before=engine.analyzeTeam(slots,baseline),sim=simulate(slots,baseline,candidate),after=sim.analysis||((sim.afterLineup||[]).length===slots.length?engine.analyzeTeam(slots,sim.afterLineup):null);
 const rawGain=Number(sim.gain)||0,meaningfulGain=rawGain>=.05?rawGain:0;
 return{...sim,rawGain,gain:meaningfulGain,componentDeltas:after?componentDeltas(before,after):{},beforeAnalysis:before,afterAnalysis:after};
}
return{COMPONENT_LABELS,COMPONENT_SHORT,componentDeltas,diagnoseBottleneck,virtualUpgrade,rankNeeds,functionDefinitions,functionalScores,functionalBench,functionalCoverage,bestFormation,saleEvaluation,saleCandidates,meaningfulSimulation};
});
