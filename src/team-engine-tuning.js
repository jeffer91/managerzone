(function(root,factory){
'use strict';
let base;
if(typeof module==='object'&&module.exports){base=require('./engine.js');require('./spatial-engine.js').install(base);require('./team-engine.js').install(base);}else base=root.MZEngine;
const api=factory(base);
if(typeof module==='object'&&module.exports)module.exports=api;else{api.install(base);root.MZTeamTuning=api;}
})(typeof globalThis!=='undefined'?globalThis:this,function(base){
'use strict';
if(!base?.analyzeTeam)throw new Error('MZTeamEngine requerido');
const clamp=(n,min=0,max=10)=>Math.max(min,Math.min(max,Number(n)||0));
const original={analyzeTeam:base.analyzeTeam,bestAssignment:base.bestAssignment,bestPartialAssignment:base.bestPartialAssignment,lineupMetrics:base.lineupMetrics,slotRating:base.slotRating};

function speedWidthBonus(slots,lineup){
 const mids=slots.map((slot,i)=>slot.role==='VOL'&&lineup[i]?{slot,player:lineup[i]}:null).filter(Boolean);
 if(mids.length<2)return{bonus:0,names:[],spread:0};
 const ranked=mids.map(x=>({...x,speed:base.speedProfile(x.player)})).sort((a,b)=>b.speed-a.speed).slice(0,2);
 const speed=(ranked[0].speed+ranked[1].speed)/2;if(speed<8.1)return{bonus:0,names:ranked.map(x=>x.player.name),spread:0};
 const spread=Math.abs((ranked[0].slot.x||50)-(ranked[1].slot.x||50));
 const normalized=clamp(spread/70,0,1);
 const bonus=clamp((normalized-.35)*1.5,-.35,1.0);
 return{bonus,names:ranked.map(x=>x.player.name),spread};
}
function analyzeTeam(slots,lineup){
 const a=original.analyzeTeam(slots,lineup);if(!a)return a;
 const sw=speedWidthBonus(slots,lineup);if(!sw.bonus)return{...a,speedWidth:sw};
 const attack=clamp(a.components.attack+sw.bonus,0,10);
 const cohesion=clamp(a.components.cohesion+Math.max(0,sw.bonus)*.20,0,10);
 const delta=(attack-a.components.attack)*.15+(cohesion-a.components.cohesion)*.20;
 const strengths=[...(a.strengths||[])];
 if(sw.bonus>.25)strengths.push(`${sw.names.join(' y ')} pueden separarse para aprovechar su velocidad y dar amplitud.`);
 return{...a,score:clamp(a.score+delta,0,10),components:{...a.components,attack,cohesion},strengths,speedWidth:sw};
}
function tacticScore(slots,lineup){return analyzeTeam(slots,lineup)?.score??null;}
function refine(slots,roster,lineup){
 if(!Array.isArray(lineup)||lineup.some(p=>!p))return lineup;let current=lineup.slice(),score=tacticScore(slots,current)||0;
 for(let pass=0;pass<3;pass++){
   const used=new Set(current.map(p=>p.uid));const bench=roster.filter(p=>!used.has(p.uid)).map(p=>({p,max:Math.max(...slots.map(s=>original.slotRating(p,s,slots)))})).sort((a,b)=>b.max-a.max).slice(0,10).map(x=>x.p);
   let best=null,bestScore=score;
   for(let i=0;i<current.length;i++)for(let j=i+1;j<current.length;j++){const next=current.slice();[next[i],next[j]]=[next[j],next[i]];const s=tacticScore(slots,next);if(s>bestScore+.02){bestScore=s;best=next;}}
   for(let i=0;i<current.length;i++)for(const p of bench){const next=current.slice();next[i]=p;if(new Set(next.map(x=>x.uid)).size!==next.length)continue;const s=tacticScore(slots,next);if(s>bestScore+.02){bestScore=s;best=next;}}
   if(!best)break;current=best;score=bestScore;
 }
 return current;
}
function bestAssignment(slots,roster){
 const seed=original.bestAssignment(slots,roster);if(seed.assigned!==slots.length)return seed;const lineup=refine(slots,roster,seed.lineup),analysis=analyzeTeam(slots,lineup);return{...seed,lineup,score:analysis.score,analysis,rawTotal:lineup.reduce((s,p,i)=>s+original.slotRating(p,slots[i],slots),0)};
}
function compareFormations(formations,roster){
 const order=Object.keys(formations),results=Object.entries(formations).map(([name,slots])=>{const a=bestAssignment(slots,roster),m=original.lineupMetrics(slots,a.lineup),bench=typeof base.benchStrength==='function'?base.benchStrength(roster,a.lineup):0;return{name,slots,lineup:a.lineup,score:a.score,rawTotal:a.rawTotal,weakest:m.weakest,bottom3:m.bottom3,bench,complete:a.assigned===slots.length,analysis:a.analysis||analyzeTeam(slots,a.lineup)};});
 results.sort((a,b)=>{if(a.complete!==b.complete)return a.complete?-1:1;if(Math.abs((b.score||0)-(a.score||0))>base.CONFIG.TIE_EPSILON)return(b.score||0)-(a.score||0);if(Math.abs(b.weakest-a.weakest)>base.CONFIG.TIE_EPSILON)return b.weakest-a.weakest;if(Math.abs(b.bottom3-a.bottom3)>base.CONFIG.TIE_EPSILON)return b.bottom3-a.bottom3;if(Math.abs((b.bench||0)-(a.bench||0))>base.CONFIG.TIE_EPSILON)return(b.bench||0)-(a.bench||0);return order.indexOf(a.name)-order.indexOf(b.name);});return results;
}
function simulateCandidate(slots,baseline,candidate){
 const before=(baseline||[]).slice(0,slots.length),beforeScore=tacticScore(slots,before);if(!Number.isFinite(beforeScore))return{beforeScore:null,afterScore:null,gain:0,enters:false,afterLineup:before,candidateIndex:-1,displaced:null,currentAtSlot:null};
 const pool=new Map();before.filter(Boolean).forEach(p=>pool.set(p.uid,p));pool.set(candidate.uid,candidate);const after=bestAssignment(slots,[...pool.values()]),candidateIndex=after.lineup.findIndex(p=>p?.uid===candidate.uid),afterIds=new Set(after.lineup.filter(Boolean).map(p=>p.uid)),displaced=before.find(p=>p&&!afterIds.has(p.uid))||null;
 return{beforeScore,afterScore:after.score,gain:Number.isFinite(after.score)?after.score-beforeScore:0,enters:candidateIndex>=0,afterLineup:after.lineup,candidateIndex,displaced,currentAtSlot:candidateIndex>=0?before[candidateIndex]||null:null,analysis:after.analysis};
}
function install(target){Object.assign(target,{analyzeTeam,tacticScore,bestAssignment,compareFormations,simulateCandidate});return target;}
return{install,analyzeTeam,tacticScore,bestAssignment,compareFormations,simulateCandidate,speedWidthBonus};
});