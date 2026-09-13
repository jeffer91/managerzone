(() => {
'use strict';
if(!window.MZEngine)return;
MZEngine.compareFormations=function compareSpatialFormations(formations,roster){
 const order=Object.keys(formations);
 const results=Object.entries(formations).map(([name,slots])=>{
   const assigned=MZEngine.bestAssignment(slots,roster),metrics=MZEngine.lineupMetrics(slots,assigned.lineup);
   return{name,slots,lineup:assigned.lineup,score:assigned.score,rawTotal:assigned.rawTotal,weakest:metrics.weakest,bottom3:metrics.bottom3,bench:MZEngine.benchStrength(roster,assigned.lineup),complete:assigned.assigned===slots.length};
 });
 results.sort((a,b)=>{
   if(a.complete!==b.complete)return a.complete?-1:1;
   const sa=Number.isFinite(a.score)?a.score:-Infinity,sb=Number.isFinite(b.score)?b.score:-Infinity;
   if(Math.abs(sb-sa)>MZEngine.CONFIG.TIE_EPSILON)return sb-sa;
   if(Math.abs(b.weakest-a.weakest)>MZEngine.CONFIG.TIE_EPSILON)return b.weakest-a.weakest;
   if(Math.abs(b.bottom3-a.bottom3)>MZEngine.CONFIG.TIE_EPSILON)return b.bottom3-a.bottom3;
   if(Math.abs(b.bench-a.bench)>MZEngine.CONFIG.TIE_EPSILON)return b.bench-a.bench;
   return order.indexOf(a.name)-order.indexOf(b.name);
 });
 return results;
};
})();