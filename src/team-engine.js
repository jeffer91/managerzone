(function(root,factory){
'use strict';
const base=typeof module==='object'&&module.exports?require('./engine.js'):root.MZEngine;
const spatial=typeof module==='object'&&module.exports?require('./spatial-engine.js'):root.MZSpatial;
const api=factory(base,spatial);
if(typeof module==='object'&&module.exports)module.exports=api;
else{api.install(base);root.MZTeamEngine=api;}
})(typeof globalThis!=='undefined'?globalThis:this,function(base,spatial){
'use strict';
if(!base)throw new Error('MZEngine requerido');
const clamp=(n,min=0,max=10)=>Math.max(min,Math.min(max,Number(n)||0));
const avg=a=>a.length?a.reduce((s,v)=>s+(Number(v)||0),0)/a.length:0;
const attr=(p,k)=>clamp(p?.[k],0,10);
const norm=w=>{const sum=Object.values(w).reduce((a,b)=>a+b,0)||1;return Object.fromEntries(Object.entries(w).map(([k,v])=>[k,v/sum]));};
const sideInfo=slot=>{const x=Number(slot?.x)||50,y=Number(slot?.y)||50;const centrality=1-clamp(Math.abs(x-50)/42,0,1);return{x,y,centrality,width:1-centrality};};
const distance=(a,b)=>Math.hypot((Number(a?.x)||50)-(Number(b?.x)||50),(Number(a?.y)||50)-(Number(b?.y)||50));

function defenderType(slot,slots=[]){
 const defs=(slots||[]).filter(s=>s.role==='DEF').slice().sort((a,b)=>(a.x||50)-(b.x||50));
 const i=defs.indexOf(slot),n=defs.length;
 if(n>=5)return(i===0||i===n-1)?'WB':'CB';
 if(n===4)return(i===0||i===3)?'FB':'CB';
 if(n===3)return'CB';
 return sideInfo(slot).centrality>.62?'CB':'FB';
}
function slotProfile(slot,slots=[]){
 if(slot?.role!=='DEF')return spatial?.spatialProfile?spatial.spatialProfile(slot,slots):base.slotProfile(slot,slots);
 const type=defenderType(slot,slots),{centrality:c}=sideInfo(slot);
 if(type==='CB')return{type:'CB',role:'DEF',primary:'en',gate:.10,weights:norm({en:.43,intel:.18,ca:.13,res:.10,exp:.08,ctrl:.05,ve:.03}),requirements:[['en',7]]};
 if(type==='WB')return{type:'WB',role:'DEF',primary:'en',gate:.06,weights:norm({en:.22,ve:.22,res:.18,pa:.14,pl:.10,ctrl:.08,intel:.06}),requirements:[['en',6],['ve',7],['res',6]],centrality:c};
 return{type:'FB',role:'DEF',primary:'en',gate:.08,weights:norm({en:.30,ve:.20,res:.15,pa:.12,pl:.10,ctrl:.07,intel:.06}),requirements:[['en',7],['ve',6]],centrality:c};
}
function slotCode(slot,slots=[]){
 const p=slotProfile(slot,slots),x=Number(slot?.x)||50;
 if(p.type==='CB')return'DFC';if(p.type==='WB')return x<50?'CAI':'CAD';if(p.type==='FB')return x<50?'LI':'LD';
 return spatial?.slotCode?spatial.slotCode(slot,slots):(base.slotCode?base.slotCode(slot,slots):slot?.role||'—');
}
function slotLabel(slot,slots=[]){
 const c=slotCode(slot,slots);return({POR:'Portero',DFC:'Defensa central',LI:'Lateral izquierdo',LD:'Lateral derecho',CAI:'Carrilero izquierdo',CAD:'Carrilero derecho',MCD:'Mediocentro defensivo',MC:'Mediocentro',MCO:'Mediocentro ofensivo',MI:'Volante izquierdo',MD:'Volante derecho',EI:'Extremo izquierdo',ED:'Extremo derecho',DC:'Delantero centro'})[c]||c;
}
function footBonus(player,slot){
 const foot=String(player?.foot||player?.pie||'').toLowerCase();if(!foot)return 0;
 const x=Number(slot?.x)||50;if(x>40&&x<60)return 0;
 const right=/diestro|derecho|right/.test(foot),left=/zurdo|izquierdo|left/.test(foot);if(!right&&!left)return 0;
 const natural=(x<50&&left)||(x>50&&right);if(slot.role==='DEL')return natural?.05:0;return natural?.12:-.04;
}
function aerialBonus(player,slot){
 if(!['DEF','DEL'].includes(slot?.role))return 0;const c=sideInfo(slot).centrality;if(c<.55)return 0;
 const h=Number(player?.heightCm||player?.height||0);if(h<180)return 0;return clamp((h-180)/15,0,1)*(attr(player,'ca')/10)*c*.12;
}
function creatorScore(player){return clamp(attr(player,'pa')*.45+attr(player,'ctrl')*.35+attr(player,'intel')*.20,0,10);}
function speedProfile(player){return clamp(attr(player,'ve')*.60+attr(player,'res')*.20+attr(player,'ctrl')*.20,0,10);}
function coordinatorBonus(player,slot,profile){
 if(slot?.role!=='VOL')return 0;const c=profile.centrality??sideInfo(slot).centrality,def=profile.defensive||0;
 return Math.max(0,creatorScore(player)-6)*.07*c*(1-def*.35);
}
function slotRating(player,slot,slots=[]){
 if(!player||!slot)return 0;const profile=slotProfile(slot,slots);let score=0;
 for(const[k,w]of Object.entries(profile.weights||{}))score+=attr(player,k)*w;
 if(profile.primary&&profile.gate)score=score*(1-profile.gate)+attr(player,profile.primary)*profile.gate;
 score+=footBonus(player,slot)+aerialBonus(player,slot)+coordinatorBonus(player,slot,profile);
 return clamp(score,0,10);
}
function slotRequirements(player,slot,slots=[]){
 const p=slotProfile(slot,slots);return(p.requirements||[]).map(([key,floor])=>{const current=attr(player,key);return{key,label:base.ATTR_LABELS?.[key]||key,current,minimum:Math.min(10,Math.max(Number(floor)||0,Math.ceil(current+1)))}});
}
function slotUtility(player,slot,slots=[]){
 const total=slots?.length||11,r=slotRating(player,slot,slots);let u=r;
 if(r<base.CONFIG.WEAK_PLAYER_THRESHOLD)u-=base.CONFIG.WEAK_PLAYER_PENALTY*total;
 if(slot.role==='POR'&&r<base.CONFIG.GK_THRESHOLD)u-=(base.CONFIG.GK_THRESHOLD-r)*base.CONFIG.GK_PENALTY_PER_POINT*total;
 return u;
}

function itemize(slots,lineup){return slots.map((slot,i)=>({slot,player:lineup[i],index:i,score:lineup[i]?slotRating(lineup[i],slot,slots):0,info:sideInfo(slot),code:slotCode(slot,slots)}));}
function organizerLogic(mids){
 if(!mids.length)return{score:3,main:null,second:null,mode:'none',text:'No hay una línea media suficiente para organizar el juego.'};
 const ranked=mids.map(x=>({...x,creator:creatorScore(x.player),speed:speedProfile(x.player)})).sort((a,b)=>b.creator-a.creator);
 const main=ranked[0],second=ranked[1]||null,gap=second?main.creator-second.creator:3;
 let score=5+main.creator*.20+main.info.centrality*2.2;
 let mode='single',text=`${main.player.name} es el principal organizador y debe recibir por el centro.`;
 if(main.info.centrality<.55)score-=2.2*(.55-main.info.centrality)/.55;
 if((slotProfile(main.slot,mids.map(x=>x.slot)).defensive||0)>.65)score-=.7;
 if(second&&main.creator>=7&&second.creator>=7&&Math.abs(main.creator-second.creator)<=1.1){
   const dx=Math.abs(main.info.x-second.info.x),dy=Math.abs(main.info.y-second.info.y),fast=avg([main.speed,second.speed])>=8.1;
   if(fast){
     mode='dual-wide';const spread=clamp(dx/55,0,1);score+=spread*1.2;text=`${main.player.name} y ${second.player.name} pueden repartir la creación y abrirse para aprovechar velocidad.`;
   }else{
     mode='dual-close';const closeness=1-clamp(Math.hypot(dx,dy)/50,0,1);score+=closeness*1.5;text=`${main.player.name} y ${second.player.name} tienen nivel creativo parecido: conviene mantenerlos conectados.`;
   }
 }else if(gap>=1){score+=.7*main.info.centrality;}
 return{score:clamp(score,0,10),main,second,mode,text};
}
function lineCohesion(items){
 const defs=items.filter(x=>x.slot.role==='DEF'),mids=items.filter(x=>x.slot.role==='VOL'),atts=items.filter(x=>x.slot.role==='DEL');
 let defScore=6,midScore=5,attScore=5;
 if(defs.length){
   const xs=defs.map(x=>x.info.x).sort((a,b)=>a-b),gaps=xs.slice(1).map((x,i)=>x-xs[i]);
   const irregular=gaps.length?Math.max(...gaps)-Math.min(...gaps):0;defScore+=clamp(1-irregular/25,0,1);
   const centers=defs.filter(x=>x.code==='DFC');if(defs.length===5)defScore+=centers.length===3?1.2:-1.6;
   if(defs.length===3)defScore+=centers.length===3?.8:-1;
   const wings=defs.filter(x=>['CAI','CAD','LI','LD'].includes(x.code));if(wings.length){const wingFit=avg(wings.map(x=>(attr(x.player,'ve')+attr(x.player,'res')+attr(x.player,'en'))/3));defScore+=(wingFit-5.5)*.18;}
 }
 const org=organizerLogic(mids);midScore=org.score;
 if(mids.length>=2){
   const defMid=mids.map(x=>({x,shield:(attr(x.player,'en')*.45+attr(x.player,'intel')*.30+attr(x.player,'res')*.25)})).sort((a,b)=>b.shield-a.shield)[0];
   if(defMid&&defMid.shield>=6)midScore+=.45;
 }
 if(atts.length){
   const central=atts.slice().sort((a,b)=>b.info.centrality-a.info.centrality)[0],finish=attr(central.player,'rem');attScore=4.3+finish*.35+central.info.centrality*1.3;
   if(atts.length>=2){const pair=atts.slice(0,2),d=distance(pair[0].slot,pair[1].slot);attScore+=clamp(1-Math.abs(d-25)/35,0,1)*.7;const support=avg(pair.map(x=>(attr(x.player,'pa')+attr(x.player,'ctrl')+attr(x.player,'ve'))/3));attScore+=(support-5)*.08;}
 }
 const misuse=items.filter(x=>x.player&&x.player.ratings).reduce((sum,x)=>{const broad=base.roleRating?base.roleRating(x.player,x.slot.role):x.score;const gap=(x.player.ratings.bestScore||0)-broad;return sum+Math.max(0,gap-1.2);},0);
 const score=clamp(avg([defScore,midScore,attScore])-misuse*.12,0,10);
 return{score,defense:clamp(defScore,0,10),midfield:clamp(midScore,0,10),attack:clamp(attScore,0,10),organizer:org,misuse};
}
function serviceScore(mids,atts){
 if(!mids.length||!atts.length)return 2;
 const values=atts.map(a=>{
   const links=mids.map(m=>{const passing=(attr(m.player,'pa')*.5+attr(m.player,'ctrl')*.3+attr(m.player,'intel')*.2);const d=distance(m.slot,a.slot);const proximity=clamp(1-d/85,.15,1);const central=0.7+sideInfo(m.slot).centrality*.3;return passing*proximity*central;}).sort((x,y)=>y-x).slice(0,2);
   return avg(links);
 });return clamp(avg(values),0,10);
}
function interlineConnection(items,cohesion){
 const defs=items.filter(x=>x.slot.role==='DEF'),mids=items.filter(x=>x.slot.role==='VOL'),atts=items.filter(x=>x.slot.role==='DEL');
 if(!mids.length)return{score:2,service:2,defMid:2,text:'El equipo queda partido porque falta una conexión real en mediocampo.'};
 const meanY=a=>avg(a.map(x=>x.info.y));const dg=defs.length?meanY(defs)-meanY(mids):25,ag=atts.length?meanY(mids)-meanY(atts):30;
 const gapScore=avg([clamp(10-Math.abs(dg-24)*.25,0,10),clamp(10-Math.abs(ag-29)*.22,0,10)]);
 const service=serviceScore(mids,atts);
 const shield=mids.map(x=>(attr(x.player,'en')*.4+attr(x.player,'intel')*.3+attr(x.player,'res')*.3)*(0.65+clamp((x.info.y-40)/25,0,.35))).sort((a,b)=>b-a)[0]||2;
 const score=clamp(gapScore*.35+service*.40+cohesion.organizer.score*.15+shield*.10,0,10);
 return{score,service,defMid:clamp(shield,0,10),gapScore,text:service>=6.5?'El mediocampo tiene rutas claras para alimentar a los delanteros.':'Los delanteros corren riesgo de quedar aislados del mediocampo.'};
}
function widthScore(items){
 const wide=items.filter(x=>['VOL','DEL'].includes(x.slot.role)&&x.info.width>.55);
 if(!wide.length)return 4.5;
 const quality=avg(wide.map(x=>(attr(x.player,'ve')*.45+attr(x.player,'pa')*.25+attr(x.player,'ctrl')*.20+attr(x.player,'res')*.10)));
 const sides=new Set(wide.map(x=>x.info.x<50?'L':'R')).size;return clamp(quality*.75+(sides===2?2:1),0,10);
}
function attackScore(items,connection,cohesion){
 const atts=items.filter(x=>x.slot.role==='DEL'),mids=items.filter(x=>x.slot.role==='VOL');if(!atts.length)return 2;
 const finishing=avg(atts.map(x=>attr(x.player,'rem')*.65+x.score*.35));const width=widthScore(items);const organizer=cohesion.organizer.score;
 const score=clamp(finishing*.35+connection.service*.35+organizer*.18+width*.12,0,10);
 const main=cohesion.organizer.main?.player?.name;
 const finisher=atts.slice().sort((a,b)=>attr(b.player,'rem')-attr(a.player,'rem'))[0]?.player?.name;
 return{score,finishing,width,text:main&&finisher?`La salida ofensiva debe pasar por ${main} para abastecer a ${finisher} y al resto del ataque.`:'El ataque depende de crear servicio suficiente antes del remate.'};
}
function defenseScore(items,connection,cohesion){
 const defs=items.filter(x=>x.slot.role==='DEF'),gk=items.find(x=>x.slot.role==='POR');if(!defs.length)return{score:2,text:'No hay estructura defensiva suficiente.'};
 const defending=avg(defs.map(x=>attr(x.player,'en')*.42+attr(x.player,'intel')*.25+attr(x.player,'res')*.18+attr(x.player,'ve')*.10+attr(x.player,'ca')*.05));
 const keeper=gk?attr(gk.player,'at'):0;const recovery=avg(defs.map(x=>attr(x.player,'ve')));
 const score=clamp(defending*.45+connection.defMid*.20+cohesion.defense*.20+keeper*.10+recovery*.05,0,10);
 return{score,defending,recovery,text:connection.defMid>=6?'Hay un mediocampista capaz de proteger la defensa y reducir espacios entre líneas.':'La defensa queda demasiado expuesta porque falta protección delante de los centrales.'};
}
function analyzeTeam(slots,lineup){
 if(!Array.isArray(slots)||!Array.isArray(lineup)||lineup.length!==slots.length||lineup.some(p=>!p))return null;
 const items=itemize(slots,lineup),positional=avg(items.map(x=>x.score)),cohesion=lineCohesion(items),connection=interlineConnection(items,cohesion),attack=attackScore(items,connection,cohesion),defense=defenseScore(items,connection,cohesion);
 let score=positional*.30+cohesion.score*.20+connection.score*.20+attack.score*.15+defense.score*.15;
 const weak=items.filter(x=>x.score<base.CONFIG.WEAK_PLAYER_THRESHOLD).length;score-=weak*base.CONFIG.WEAK_PLAYER_PENALTY*.35;
 const gk=items.find(x=>x.slot.role==='POR');if(gk&&gk.score<base.CONFIG.GK_THRESHOLD)score-=(base.CONFIG.GK_THRESHOLD-gk.score)*base.CONFIG.GK_PENALTY_PER_POINT*.35;
 score=clamp(score,0,10);
 const strengths=[],warnings=[];
 if(cohesion.organizer.main){const o=cohesion.organizer.main;const central=o.info.centrality>=.62;if(central)strengths.push(`${o.player.name} queda en una zona central para organizar.`);else warnings.push(`${o.player.name} es el mejor creador pero está demasiado abierto.`);if(cohesion.organizer.mode==='dual-close')strengths.push(cohesion.organizer.text);if(cohesion.organizer.mode==='dual-wide')strengths.push(cohesion.organizer.text);}
 if(connection.service>=6.5)strengths.push('Los delanteros reciben buen suministro desde el mediocampo.');else warnings.push('El ataque tiene poco suministro desde el mediocampo.');
 if(cohesion.misuse>.8)warnings.push('La formación obliga a utilizar jugadores lejos de su función más fuerte.');
 if(defense.score>=6.5)strengths.push('La estructura defensiva tiene cobertura y protección suficiente.');else warnings.push('La estructura defensiva deja espacios o depende demasiado de los defensores.');
 return{score,components:{positional:clamp(positional,0,10),cohesion:cohesion.score,connection:connection.score,attack:attack.score,defense:defense.score},lines:{defense:cohesion.defense,midfield:cohesion.midfield,attack:cohesion.attack},organizer:cohesion.organizer,service:connection.service,attackPlan:attack.text,defensePlan:defense.text,strengths,warnings,items};
}
function tacticScore(slots,lineup){return analyzeTeam(slots,lineup)?.score??null;}

function seedAssignment(slots,roster,partial=false){
 const S=slots.length,target=partial?Math.min(roster.length,S):S;if(!partial&&roster.length<S)return{lineup:new Array(S).fill(null),assigned:roster.length,utility:-Infinity,rawTotal:0,average:0,score:null};
 if(!target)return{lineup:new Array(S).fill(null),assigned:0,utility:0,rawTotal:0,average:0,score:null};
 const max=1<<S;let u=new Array(max).fill(-Infinity),raw=new Array(max).fill(-Infinity),paths=new Array(max).fill(null);u[0]=0;raw[0]=0;paths[0]=[];
 roster.forEach((player,pi)=>{const nu=u.slice(),nr=raw.slice(),np=paths.map(p=>p?p.slice():null);for(let mask=0;mask<max;mask++){if(u[mask]===-Infinity)continue;for(let si=0;si<S;si++){if(mask&(1<<si))continue;const nm=mask|(1<<si),util=u[mask]+slotUtility(player,slots[si],slots),rt=raw[mask]+slotRating(player,slots[si],slots);if(util>nu[nm]+base.CONFIG.TIE_EPSILON||(Math.abs(util-nu[nm])<=base.CONFIG.TIE_EPSILON&&rt>nr[nm]+base.CONFIG.TIE_EPSILON)){nu[nm]=util;nr[nm]=rt;np[nm]=[...paths[mask],{slotIndex:si,playerIndex:pi}]}}}u=nu;raw=nr;paths=np;});
 let bm=-1,bu=-Infinity,br=-Infinity;for(let mask=0;mask<max;mask++){let bits=mask,count=0;while(bits){bits&=bits-1;count++;}if(count!==target||u[mask]===-Infinity)continue;if(u[mask]>bu+base.CONFIG.TIE_EPSILON||(Math.abs(u[mask]-bu)<=base.CONFIG.TIE_EPSILON&&raw[mask]>br+base.CONFIG.TIE_EPSILON)){bm=mask;bu=u[mask];br=raw[mask];}}
 const lineup=new Array(S).fill(null);(paths[bm]||[]).forEach(({slotIndex,playerIndex})=>lineup[slotIndex]=roster[playerIndex]);const assigned=lineup.filter(Boolean).length;
 return{lineup,assigned,utility:bu,rawTotal:Math.max(0,br),average:assigned?Math.max(0,br)/assigned:0,score:assigned===S?tacticScore(slots,lineup):null};
}
function refineLineup(slots,roster,lineup){
 if(lineup.some(p=>!p))return lineup;let current=lineup.slice(),currentScore=tacticScore(slots,current)||0;
 for(let pass=0;pass<4;pass++){
   const used=new Set(current.map(p=>p.uid));const bench=roster.filter(p=>!used.has(p.uid)).map(p=>({p,max:Math.max(...slots.map(s=>slotRating(p,s,slots)))})).sort((a,b)=>b.max-a.max).slice(0,12).map(x=>x.p);
   let bestScore=currentScore,best=null;
   for(let i=0;i<current.length;i++)for(let j=i+1;j<current.length;j++){const next=current.slice();[next[i],next[j]]=[next[j],next[i]];const s=tacticScore(slots,next);if(s>bestScore+.025){bestScore=s;best=next;}}
   for(let i=0;i<current.length;i++)for(const p of bench){const next=current.slice();next[i]=p;const ids=next.map(x=>x.uid);if(new Set(ids).size!==ids.length)continue;const s=tacticScore(slots,next);if(s>bestScore+.025){bestScore=s;best=next;}}
   if(!best)break;current=best;currentScore=bestScore;
 }
 return current;
}
function bestAssignment(slots,roster){
 const seed=seedAssignment(slots,roster,false);if(seed.assigned!==slots.length)return seed;const lineup=refineLineup(slots,roster,seed.lineup),analysis=analyzeTeam(slots,lineup);return{...seed,lineup,score:analysis.score,rawTotal:lineup.reduce((s,p,i)=>s+slotRating(p,slots[i],slots),0),average:avg(lineup.map((p,i)=>slotRating(p,slots[i],slots))),analysis};
}
function bestPartialAssignment(slots,roster){return seedAssignment(slots,roster,true);}
function lineupMetrics(slots,lineup){const v=lineup.map((p,i)=>p?slotRating(p,slots[i],slots):0).sort((a,b)=>a-b),bottom=v.slice(0,Math.min(3,v.length));return{weakest:v[0]||0,bottom3:avg(bottom)};}
function compareFormations(formations,roster){
 const order=Object.keys(formations);const results=Object.entries(formations).map(([name,slots])=>{const a=bestAssignment(slots,roster),m=lineupMetrics(slots,a.lineup),bench=typeof base.benchStrength==='function'?base.benchStrength(roster,a.lineup):0;return{name,slots,lineup:a.lineup,score:a.score,rawTotal:a.rawTotal,weakest:m.weakest,bottom3:m.bottom3,bench,complete:a.assigned===slots.length,analysis:a.analysis||analyzeTeam(slots,a.lineup)};});
 results.sort((a,b)=>{if(a.complete!==b.complete)return a.complete?-1:1;if(Math.abs((b.score||0)-(a.score||0))>base.CONFIG.TIE_EPSILON)return(b.score||0)-(a.score||0);if(Math.abs(b.weakest-a.weakest)>base.CONFIG.TIE_EPSILON)return b.weakest-a.weakest;if(Math.abs(b.bottom3-a.bottom3)>base.CONFIG.TIE_EPSILON)return b.bottom3-a.bottom3;if(Math.abs((b.bench||0)-(a.bench||0))>base.CONFIG.TIE_EPSILON)return(b.bench||0)-(a.bench||0);return order.indexOf(a.name)-order.indexOf(b.name);});return results;
}
function simulateCandidate(slots,baseline,candidate){
 const before=(baseline||[]).slice(0,slots.length),beforeScore=tacticScore(slots,before);if(!Number.isFinite(beforeScore))return{beforeScore:null,afterScore:null,gain:0,enters:false,afterLineup:before,candidateIndex:-1,displaced:null,currentAtSlot:null};
 const pool=new Map();before.filter(Boolean).forEach(p=>pool.set(p.uid,p));pool.set(candidate.uid,candidate);const after=bestAssignment(slots,[...pool.values()]),candidateIndex=after.lineup.findIndex(p=>p?.uid===candidate.uid),enters=candidateIndex>=0;const afterIds=new Set(after.lineup.filter(Boolean).map(p=>p.uid)),displaced=before.find(p=>p&&!afterIds.has(p.uid))||null;
 return{beforeScore,afterScore:after.score,gain:Number.isFinite(after.score)?after.score-beforeScore:0,enters,afterLineup:after.lineup,candidateIndex,displaced,currentAtSlot:candidateIndex>=0?before[candidateIndex]||null:null,analysis:after.analysis};
}
function install(target){Object.assign(target,{slotProfile,slotCode,slotLabel,slotRating,slotRequirements,slotUtility,tacticScore,bestAssignment,bestPartialAssignment,lineupMetrics,compareFormations,simulateCandidate,analyzeTeam,creatorScore,speedProfile,defenderType});return target;}
return{install,slotProfile,slotCode,slotLabel,slotRating,slotRequirements,slotUtility,tacticScore,bestAssignment,bestPartialAssignment,lineupMetrics,compareFormations,simulateCandidate,analyzeTeam,creatorScore,speedProfile,defenderType};
});