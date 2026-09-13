(function(root,factory){
'use strict';
const base=typeof module==='object'&&module.exports?require('./engine.js'):root.MZEngine;
const api=factory(base);
if(typeof module==='object'&&module.exports)module.exports=api;
else{api.install(base);root.MZSpatial=api;}
})(typeof globalThis!=='undefined'?globalThis:this,function(base){
'use strict';
if(!base)throw new Error('MZEngine requerido');
const clamp=(n,min=0,max=10)=>Math.max(min,Math.min(max,Number(n)||0));
const norm=weights=>{const sum=Object.values(weights).reduce((a,b)=>a+b,0)||1;return Object.fromEntries(Object.entries(weights).map(([k,v])=>[k,v/sum]));};
const attr=(p,k)=>clamp(p?.[k],0,10);
const sideInfo=slot=>{const x=Number(slot?.x)||50,y=Number(slot?.y)||50;const centrality=1-clamp(Math.abs(x-50)/42,0,1);return{x,y,centrality,width:1-centrality};};
function spatialProfile(slot,slots=[]){
 const {x,y,centrality:c,width:w}=sideInfo(slot);
 if(slot?.role==='POR')return{type:'GK',role:'POR',primary:'at',gate:.15,weights:{at:.60,intel:.15,exp:.10,res:.10,ve:.05},requirements:[['at',7]]};
 if(slot?.role==='DEF'){
  const central={en:.43,intel:.18,ca:.13,res:.10,exp:.08,ctrl:.05,ve:.03};
  const wide={en:.30,ve:.20,res:.15,pa:.12,pl:.10,ctrl:.07,intel:.06};
  const weights=norm(Object.fromEntries([...new Set([...Object.keys(central),...Object.keys(wide)])].map(k=>[k,(central[k]||0)*c+(wide[k]||0)*w])));
  return{type:c>.62?'CB':'FB',role:'DEF',primary:'en',gate:.09,weights,requirements:c>.62?[['en',7]]:[['en',7],['ve',6]]};
 }
 if(slot?.role==='VOL'){
  const defensive=clamp((y-43)/20,0,1),attacking=clamp((49-y)/18,0,1);
  const weights=norm({
   pa:.24+.08*c,ctrl:.17+.07*c,intel:.13+.05*c,en:.06+.17*defensive,
   res:.08+.07*defensive,rem:.05+.11*attacking,ve:.05+.07*w,pl:.05+.04*w
  });
  let type='CM',requirements=[['pa',7],['ctrl',6]];
  if(w>.62){type='WM';requirements=[['pa',7],['ve',6]];}
  else if(defensive>.55){type='DM';requirements=[['pa',7],['en',6]];}
  else if(attacking>.45){type='AM';requirements=[['pa',7],['ctrl',6]];}
  return{type,role:'VOL',primary:'pa',gate:.05,weights,requirements,centrality:c,defensive,attacking};
 }
 if(slot?.role==='DEL'){
  const advanced=clamp((38-y)/25,0,1);
  const weights=norm({
   rem:.42+.10*c+.04*advanced,pa:.14+.06*w,ctrl:.15+.05*w,ve:.11+.05*w,
   intel:.08,ca:.05+.05*c,exp:.05
  });
  const wide=w>.48;
  return{type:wide?'WF':'ST',role:'DEL',primary:'rem',gate:.10,weights,requirements:wide?[['rem',7],['pa',6]]:[['rem',8]],centrality:c,advanced};
 }
 return base.slotProfile?base.slotProfile(slot,slots):{type:'CM',role:slot?.role||'VOL',weights:{pa:1},requirements:[['pa',7]]};
}
function slotCode(slot,slots=[]){
 const p=spatialProfile(slot,slots),x=Number(slot?.x)||50;
 if(p.type==='GK')return'POR';if(p.type==='CB')return'DFC';if(p.type==='FB')return x<50?'LI':'LD';
 if(p.type==='DM')return'MCD';if(p.type==='AM')return'MCO';if(p.type==='WM')return x<50?'MI':'MD';if(p.type==='CM')return'MC';
 if(p.type==='WF')return x<50?'EI':'ED';return'DC';
}
function slotLabel(slot,slots=[]){
 const c=slotCode(slot,slots);return({POR:'Portero',DFC:'Defensa central',LI:'Lateral izquierdo',LD:'Lateral derecho',MCD:'Mediocentro defensivo',MC:'Mediocentro',MCO:'Mediocentro ofensivo',MI:'Volante izquierdo',MD:'Volante derecho',EI:'Extremo izquierdo',ED:'Extremo derecho',DC:'Delantero centro'})[c]||c;
}
function footBonus(player,slot){
 const foot=String(player?.foot||player?.pie||'').toLowerCase();if(!foot)return 0;
 const x=Number(slot?.x)||50;if(x>40&&x<60)return 0;
 const right=/diestro|derecho|right/.test(foot),left=/zurdo|izquierdo|left/.test(foot);if(!right&&!left)return 0;
 const natural=(x<50&&left)||(x>50&&right);
 if(slot.role==='DEL')return natural?.05:0;
 return natural?.12:-.04;
}
function aerialBonus(player,slot){
 if(!['DEF','DEL'].includes(slot?.role))return 0;
 const {centrality}=sideInfo(slot);if(centrality<.55)return 0;
 const h=Number(player?.heightCm||player?.height||0);if(h<180)return 0;
 const size=clamp((h-180)/15,0,1),heading=attr(player,'ca')/10;return size*heading*centrality*.12;
}
function coordinatorBonus(player,slot,profile){
 if(slot?.role!=='VOL')return 0;
 const creator=(attr(player,'pa')*.45+attr(player,'ctrl')*.35+attr(player,'intel')*.20)/10;
 const c=profile.centrality??sideInfo(slot).centrality,def=profile.defensive||0;
 return Math.max(0,creator-.60)*.70*c*(1-def*.35);
}
function slotRating(player,slot,slots=[]){
 if(!player||!slot)return 0;const profile=spatialProfile(slot,slots);let score=0;
 for(const[k,w]of Object.entries(profile.weights||{}))score+=attr(player,k)*w;
 if(profile.primary&&profile.gate)score=score*(1-profile.gate)+attr(player,profile.primary)*profile.gate;
 score+=footBonus(player,slot)+aerialBonus(player,slot)+coordinatorBonus(player,slot,profile);
 return clamp(score,0,10);
}
function slotRequirements(player,slot,slots=[]){
 const p=spatialProfile(slot,slots);return(p.requirements||[]).map(([key,floor])=>{const current=attr(player,key);return{key,label:base.ATTR_LABELS?.[key]||key,current,minimum:Math.min(10,Math.max(Number(floor)||0,Math.ceil(current+1)))}});
}
function slotUtility(player,slot,slots=[]){
 const total=Array.isArray(slots)&&slots.length?slots.length:11;const rating=slotRating(player,slot,slots);let u=rating;
 if(rating<base.CONFIG.WEAK_PLAYER_THRESHOLD)u-=base.CONFIG.WEAK_PLAYER_PENALTY*total;
 if(slot.role==='POR'&&rating<base.CONFIG.GK_THRESHOLD)u-=(base.CONFIG.GK_THRESHOLD-rating)*base.CONFIG.GK_PENALTY_PER_POINT*total;
 return u;
}
function tacticScore(slots,lineup){
 if(!Array.isArray(slots)||!Array.isArray(lineup)||lineup.length!==slots.length||lineup.some(p=>!p))return null;
 const values=lineup.map((p,i)=>slotRating(p,slots[i],slots));let avg=values.reduce((a,b)=>a+b,0)/values.length;
 avg-=values.filter(v=>v<base.CONFIG.WEAK_PLAYER_THRESHOLD).length*base.CONFIG.WEAK_PLAYER_PENALTY;
 const g=slots.findIndex(s=>s.role==='POR');if(g>=0&&values[g]<base.CONFIG.GK_THRESHOLD)avg-=(base.CONFIG.GK_THRESHOLD-values[g])*base.CONFIG.GK_PENALTY_PER_POINT;
 return clamp(avg,0,10);
}
function optimize(slots,roster,partial){
 const S=slots.length,target=partial?Math.min(roster.length,S):S;if(!partial&&roster.length<S)return{lineup:new Array(S).fill(null),assigned:roster.length,utility:-Infinity,rawTotal:0,average:0,score:null};
 if(!target)return{lineup:new Array(S).fill(null),assigned:0,utility:0,rawTotal:0,average:0,score:null};
 const max=1<<S;let u=new Array(max).fill(-Infinity),raw=new Array(max).fill(-Infinity),paths=new Array(max).fill(null);u[0]=0;raw[0]=0;paths[0]=[];
 roster.forEach((player,pi)=>{const nu=u.slice(),nr=raw.slice(),np=paths.map(p=>p?p.slice():null);for(let mask=0;mask<max;mask++){if(u[mask]===-Infinity)continue;for(let si=0;si<S;si++){if(mask&(1<<si))continue;const nm=mask|(1<<si),util=u[mask]+slotUtility(player,slots[si],slots),rt=raw[mask]+slotRating(player,slots[si],slots);if(util>nu[nm]+base.CONFIG.TIE_EPSILON||(Math.abs(util-nu[nm])<=base.CONFIG.TIE_EPSILON&&rt>nr[nm]+base.CONFIG.TIE_EPSILON)){nu[nm]=util;nr[nm]=rt;np[nm]=[...paths[mask],{slotIndex:si,playerIndex:pi}]}}}u=nu;raw=nr;paths=np;});
 let bm=-1,bu=-Infinity,br=-Infinity;for(let mask=0;mask<max;mask++){let bits=mask,count=0;while(bits){bits&=bits-1;count++;}if(count!==target||u[mask]===-Infinity)continue;if(u[mask]>bu+base.CONFIG.TIE_EPSILON||(Math.abs(u[mask]-bu)<=base.CONFIG.TIE_EPSILON&&raw[mask]>br+base.CONFIG.TIE_EPSILON)){bm=mask;bu=u[mask];br=raw[mask];}}
 const lineup=new Array(S).fill(null);(paths[bm]||[]).forEach(({slotIndex,playerIndex})=>lineup[slotIndex]=roster[playerIndex]);const assigned=lineup.filter(Boolean).length;
 return{lineup,assigned,utility:bu,rawTotal:Math.max(0,br),average:assigned?Math.max(0,br)/assigned:0,score:assigned===S?tacticScore(slots,lineup):null};
}
const bestAssignment=(slots,roster)=>optimize(slots,roster,false);const bestPartialAssignment=(slots,roster)=>optimize(slots,roster,true);
function lineupMetrics(slots,lineup){const v=lineup.map((p,i)=>p?slotRating(p,slots[i],slots):0).sort((a,b)=>a-b),bottom=v.slice(0,Math.min(3,v.length));return{weakest:v[0]||0,bottom3:bottom.length?bottom.reduce((a,b)=>a+b,0)/bottom.length:0};}
function compareFormations(formations,roster){
 const order=Object.keys(formations);return Object.entries(formations).map(([name,slots])=>{const a=bestAssignment(slots,roster),m=lineupMetrics(slots,a.lineup);return{name,slots,lineup:a.lineup,score:a.score,rawTotal:a.rawTotal,weakest:m.weakest,bottom3:m.bottom3}}).sort((a,b)=>{if(Math.abs((b.score||0)-(a.score||0))>base.CONFIG.TIE_EPSILON)return(b.score||0)-(a.score||0);if(Math.abs(b.weakest-a.weakest)>base.CONFIG.TIE_EPSILON)return b.weakest-a.weakest;if(Math.abs(b.bottom3-a.bottom3)>base.CONFIG.TIE_EPSILON)return b.bottom3-a.bottom3;return order.indexOf(a.name)-order.indexOf(b.name);});
}
function simulateCandidate(slots,baseline,candidate){
 const before=(baseline||[]).slice(0,slots.length),beforeScore=tacticScore(slots,before);if(!Number.isFinite(beforeScore))return{beforeScore:null,afterScore:null,gain:0,enters:false,afterLineup:before,candidateIndex:-1,displaced:null,currentAtSlot:null};
 const pool=new Map();before.filter(Boolean).forEach(p=>pool.set(p.uid,p));pool.set(candidate.uid,candidate);const after=bestAssignment(slots,[...pool.values()]),candidateIndex=after.lineup.findIndex(p=>p?.uid===candidate.uid),enters=candidateIndex>=0;
 const beforeIds=new Set(before.filter(Boolean).map(p=>p.uid)),afterIds=new Set(after.lineup.filter(Boolean).map(p=>p.uid)),displaced=before.find(p=>p&&beforeIds.has(p.uid)&&!afterIds.has(p.uid))||null;
 return{beforeScore,afterScore:after.score,gain:Number.isFinite(after.score)?after.score-beforeScore:0,enters,afterLineup:after.lineup,candidateIndex,displaced,currentAtSlot:candidateIndex>=0?before[candidateIndex]||null:null};
}
function coordinatorScore(player){return clamp(attr(player,'pa')*.45+attr(player,'ctrl')*.35+attr(player,'intel')*.20,0,10);}
function penaltyScore(player,slot){return clamp(attr(player,'rem')*.50+attr(player,'bp')*.20+attr(player,'exp')*.15+attr(player,'intel')*.10+attr(player,'ctrl')*.05+(slot?.role==='DEL'?1:0),0,10);}
function freeKickScore(player){return clamp(attr(player,'bp')*.45+attr(player,'rem')*.20+attr(player,'pa')*.15+attr(player,'intel')*.10+attr(player,'exp')*.10,0,10);}
function captainScore(player,slot,slots){return clamp(attr(player,'exp')*.40+attr(player,'intel')*.30+slotRating(player,slot,slots)*.20+clamp((Number(player?.age)||18)/30,0,1)*1,0,10);}
function install(target){Object.assign(target,{slotProfile:spatialProfile,slotCode,slotLabel,slotRating,slotRequirements,slotUtility,tacticScore,bestAssignment,bestPartialAssignment,lineupMetrics,compareFormations,simulateCandidate});return target;}
return{install,spatialProfile,slotCode,slotLabel,slotRating,slotRequirements,slotUtility,tacticScore,bestAssignment,bestPartialAssignment,lineupMetrics,compareFormations,simulateCandidate,coordinatorScore,penaltyScore,freeKickScore,captainScore,sideInfo};
});