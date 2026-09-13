(() => {
'use strict';
if(!window.MZTeamDecisionsEngine||!window.MZEngine)return;
const D=window.MZTeamDecisionsEngine;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));
const usd=n=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n)||0);
let needFormation='';
const simulationCache=new Map();

function ensureStyles(){
 if(document.getElementById('team-decisions-styles'))return;
 const s=document.createElement('style');s.id='team-decisions-styles';s.textContent=`
 .decision-summary{display:grid;grid-template-columns:1.1fr 1fr;gap:10px;margin-bottom:12px}.decision-box{padding:13px;border:1px solid #203629;border-radius:10px;background:#08140d}.decision-box span{display:block;color:#789080;font-size:8px;text-transform:uppercase;font-weight:900;letter-spacing:.07em}.decision-box strong{display:block;margin-top:5px;font-size:17px;color:#eef7f0}.decision-box p{margin:5px 0 0;color:#91a596;font-size:9px;line-height:1.45}.decision-deltas{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.decision-deltas b{padding:6px 8px;border:1px solid #23402c;border-radius:999px;font-size:8.5px;color:#a9baac}.decision-deltas b.up{color:var(--green);border-color:#2d5f3d}.decision-deltas b.down{color:#ef9c8f;border-color:#5a342e}.team-buy-card{max-width:960px;margin:0 auto;padding:20px;border:1px solid var(--line);border-radius:13px;background:linear-gradient(180deg,#0e1b13,#0a1710);box-shadow:var(--shadow)}.team-buy-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.team-buy-head h2{margin:5px 0 4px;font-size:27px}.team-buy-head p{margin:0;color:#8fa596;font-size:10px;line-height:1.5}.team-buy-score{text-align:right}.team-buy-score span{display:block;color:#789080;font-size:8px;font-weight:900}.team-buy-score strong{display:block;color:var(--green);font-size:29px}.team-buy-req{margin-top:14px;padding:13px;border:1px solid #2b5036;border-radius:10px;background:#08140d}.team-buy-req>span{display:block;color:#789080;font-size:8px;text-transform:uppercase;font-weight:900}.team-buy-attrs{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.team-buy-attrs b{padding:7px 9px;border:1px solid #284431;border-radius:999px;color:#dce9df;font-size:9px}.team-buy-action{margin-top:14px;width:100%}.bench-item .bench-function{display:block;color:#78a283;font-size:7.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.market-team-delta{margin-top:8px;padding-top:8px;border-top:1px solid #1d3325;display:flex;gap:6px;flex-wrap:wrap}.market-team-delta span{padding:5px 7px;border:1px solid #23402c;border-radius:999px;font-size:8px;color:#9fb0a3}.market-team-delta span.up{color:var(--green)}.market-team-delta span.note{color:#e7c96b}.youth-functions{margin-top:12px}.youth-function-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:9px}.youth-function-card{padding:10px;border:1px solid #203629;border-radius:9px;background:#08140d}.youth-function-card span{display:block;color:#78a283;font-size:8px;font-weight:900}.youth-function-card strong{display:block;margin-top:4px;font-size:10px}.youth-function-card small{display:block;margin-top:3px;color:#849889;font-size:8.5px}.team-sale-reason{display:block!important;margin-top:4px!important;color:#8fa596!important;line-height:1.35!important;white-space:normal!important}.team-sale-reason b{color:var(--green)}@media(max-width:900px){.decision-summary{grid-template-columns:1fr}.team-buy-head{flex-direction:column}.team-buy-score{text-align:left}.youth-function-grid{grid-template-columns:1fr 1fr}}
 `;document.head.appendChild(s);
}
function currentFormation(){return needFormation&&FORMATIONS[needFormation]?needFormation:(formationResults?.[0]?.name||selectedFormation||Object.keys(FORMATIONS)[0]);}
function decision(name=currentFormation()){
 const slots=FORMATIONS[name],lineup=getMainLineup(name);if(!slots||!lineup||lineup.some(p=>!p))return null;
 const analysis=MZEngine.analyzeTeam(slots,lineup),bottleneck=D.diagnoseBottleneck(analysis),needs=D.rankNeeds(slots,lineup,players);return{name,slots,lineup,analysis,bottleneck,needs,first:needs[0]||null};
}
function deltaHtml(deltas){return Object.entries(deltas||{}).filter(([,v])=>Math.abs(v)>=.02).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,5).map(([k,v])=>`<b class="${v>0?'up':'down'}">${esc(D.COMPONENT_SHORT[k]||k)} ${v>=0?'+':''}${v.toFixed(2)}</b>`).join('');}
function priorityPercent(item){if(item.kind==='monitor')return 20;return Math.round(clamp((item.kind==='depth'?25:40)+item.impact*(item.kind==='depth'?90:115),0,99));}
function marketTarget(item,name){
 const reqs=item.requirements||[],primary=reqs[0]||{key:'pa',label:'Atributo',minimum:0};
 window.MZMarketTarget={formationName:name,role:item.role,position:item.position,slotIndex:item.index,slotCode:item.code,mainKey:primary.key,mainLabel:primary.label,minimumMain:primary.minimum,requirements:reqs,minimumRating:item.targetRating,playerUid:item.player.uid,current:item.currentRating,teamBottleneck:item.bottleneck.key,expectedTeamGain:item.gain,needKind:item.kind,needLabel:item.kindLabel};
}
function renderNeedsTeam(){
 ensureStyles();const view=document.getElementById('view-needs');if(!view)return;
 if(!players.length){view.innerHTML='<div class="panel empty-state large">Carga primero tu plantilla.</div>';return;}
 const d=decision();if(!d||!d.first){view.innerHTML='<div class="panel empty-state large">No pude calcular una necesidad colectiva.</div>';return;}
 const n=d.first,options=Object.keys(FORMATIONS).map(x=>`<option value="${x}" ${x===d.name?'selected':''}>${x}${x===formationResults?.[0]?.name?' · mejor automática':''}</option>`).join('');
 const starter=n.kind==='starter',depth=n.kind==='depth';
 const interventionText=starter?`Mejorar este perfil produce la mayor ganancia colectiva estimada dentro de ${esc(d.name)}.`:depth?'El XI titular no exige un reemplazo claro aquí; la prioridad es disponer de un relevo funcional.':'No aparece una compra urgente. Este es el punto que conviene vigilar primero.';
 const cardKicker=starter?'MEJORA DEL XI':depth?'RELEVO / PROFUNDIDAD':'VIGILAR · SIN COMPRA URGENTE';
 const intro=starter?`No se recomienda por ser simplemente el más débil, sino por cuánto puede cambiar el funcionamiento del XI.`:depth?'La recomendación nace de la falta de profundidad o de la necesidad de preparar un relevo, no de sustituir al titular por obligación.':'La plantilla no muestra una mejora inmediata suficientemente fuerte como para justificar una compra por sistema.';
 const fallback=depth?'<b>Prioridad de profundidad · no implica cambiar al titular</b>':'<b>No hay una mejora colectiva significativa detectada</b>';
 view.innerHTML=`<div class="needs-toolbar"><div><span class="eyebrow">PLAN DE CONTRATACIONES</span><h2>¿Qué jugador debo comprar?</h2><p>La app separa una mejora real del XI de una necesidad de relevo o profundidad.</p></div><label class="needs-select">Analizar para<select id="needs-formation">${options}</select></label></div>
 <div class="decision-summary"><div class="decision-box"><span>CUELLO DE BOTELLA</span><strong>${esc(d.bottleneck.label)} · ${d.bottleneck.value.toFixed(1)}/10</strong><p>${esc(d.bottleneck.detail)}</p></div><div class="decision-box"><span>${esc(n.kindLabel)}</span><strong>${esc(n.code)} · ${esc(n.position)}</strong><p>${interventionText}</p></div></div>
 <article class="team-buy-card"><div class="team-buy-head"><div><span class="eyebrow">${cardKicker} · ${esc(d.name)}</span><h2>${esc(n.position)}</h2><p>Referencia actual: ${esc(n.player.name)} · ${n.currentRating.toFixed(1)}/10. ${intro}</p></div><div class="team-buy-score"><span>PRIORIDAD</span><strong>${priorityPercent(n)}%</strong></div></div>
 <div class="decision-deltas">${deltaHtml(n.deltas)||fallback}</div>
 <div class="team-buy-req"><span>PERFIL MÍNIMO A BUSCAR</span><div class="team-buy-attrs">${n.requirements.map(r=>`<b>${esc(r.label)} ${r.minimum}+</b>`).join('')}<b>Nota ${n.targetRating.toFixed(1)}/10+</b></div></div>
 <button id="team-buy-market" class="ghost-btn team-buy-action">${depth?'Buscar relevo en el mercado':starter?'Buscar candidatos del mercado':'Revisar mercado opcionalmente'}</button></article>`;
 document.getElementById('needs-formation')?.addEventListener('change',e=>{needFormation=e.target.value;renderNeedsTeam();});
 document.getElementById('team-buy-market')?.addEventListener('click',()=>{marketTarget(n,d.name);switchView('market');});
}
function patchDashboard(){
 if(!players.length||!formationResults?.length)return;const d=decision(formationResults[0].name);if(!d?.first)return;
 const t=document.getElementById('metric-need'),s=document.getElementById('metric-need-detail');if(t)t.textContent=d.bottleneck.label;if(s)s.textContent=d.first.kind==='starter'?`${d.first.code} · ${d.first.position} · mejora XI ${d.first.gain>=0?'+':''}${d.first.gain.toFixed(2)}`:d.first.kind==='depth'?`${d.first.code} · ${d.first.position} · prioridad de relevo`:`${d.first.code} · ${d.first.position} · sin compra urgente`;
}
function renderFunctionalBench(lineup){
 const wrap=document.getElementById('bench-list');if(!wrap)return;const bench=D.selectMzBench(players,lineup);
 wrap.innerHTML=bench.length?bench.map((x,i)=>`<div class="bench-item"><span class="bench-function">${i+1} · ${esc(x.label)}</span><strong>${esc(x.player.name)}</strong><span>${x.score.toFixed(1)}/10 · cobertura funcional</span></div>`).join(''):'<div class="empty-state">No quedan jugadores suficientes.</div>';
 const help=wrap.closest('.bench-panel')?.querySelector('.help');if(help)help.textContent='Orden MZ: POR → DEF → VOL → DEL → Comodín, elegido por la función que mejor cubre.';
}
function patchFinance(){
 if(!window.MZFinanceEngine?.analyze||MZFinanceEngine.analyze.__teamDecision)return;const prev=MZFinanceEngine.analyze;
 const wrapped=function(report,context={}){const out=prev(report,context);if(typeof FORMATIONS==='undefined'||!context.players?.length)return out;const sale=D.saleCandidates(FORMATIONS,context.players,context.lineup||[],3);return{...out,saleCandidates:sale};};wrapped.__teamDecision=true;MZFinanceEngine.analyze=wrapped;
}
function financeAnalysis(){
 try{const h=window.MZFinance?.history?.()||[],latest=h.slice().sort((a,b)=>(Number(b.savedAt)||0)-(Number(a.savedAt)||0))[0];if(!latest?.report)return null;const state=MZFinanceEngine.snapshotStatus(window.MZFinance?.snapshot?.()||null),reserveWeeks=Number(localStorage.getItem('mz_tactical_lab_finance_reserve_weeks_v1'))||4;return MZFinanceEngine.analyze(latest.report,{players,lineup:getActiveMainLineup(),availableBalance:state.fresh?state.balance:null,reserveWeeks});}catch{return null;}
}
function decorateFinance(){
 const view=document.getElementById('view-finance');if(!view)return;const a=financeAnalysis();if(!a?.saleCandidates?.length)return;const byName=new Map(a.saleCandidates.map(x=>[x.name,x]));
 view.querySelectorAll('.fin-player').forEach(row=>{if(row.dataset.teamSale==='1')return;const name=row.querySelector('span>b')?.textContent?.trim(),c=byName.get(name);if(!c)return;const holder=row.querySelector('span');if(holder){const note=document.createElement('small');note.className='team-sale-reason';note.innerHTML=`Impacto al vender: <b>−${Number(c.scoreDrop||0).toFixed(2)}</b> táctica · ahorro ${usd(c.salary)}/sem · ${esc(c.reason)}`;holder.appendChild(note);row.dataset.teamSale='1';}});
}
function patchCandidateSimulation(){
 if(MZEngine.simulateCandidate?.__teamDecision)return;const prev=MZEngine.simulateCandidate.bind(MZEngine);
 const wrapped=function(slots,baseline,candidate){const r=D.meaningfulSimulation(slots,baseline,candidate,prev);if(candidate?.name)simulationCache.set(candidate.name,r);if(candidate?.uid)simulationCache.set(candidate.uid,r);return r;};wrapped.__teamDecision=true;MZEngine.simulateCandidate=wrapped;
}
function decorateMarket(){
 const view=document.getElementById('view-market');if(!view)return;
 view.querySelectorAll('.candidate-card').forEach(card=>{if(card.dataset.teamDecisions==='1')return;const name=card.querySelector('.candidate-name strong')?.textContent?.trim(),sim=simulationCache.get(name);if(!sim)return;const foot=card.querySelector('.candidate-detail')||card;const box=document.createElement('div');box.className='market-team-delta';
 const parts=Object.entries(sim.componentDeltas||{}).filter(([,v])=>Math.abs(v)>=.02).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,4);box.innerHTML=parts.map(([k,v])=>`<span class="${v>0?'up':''}">${esc(D.COMPONENT_SHORT[k]||k)} ${v>=0?'+':''}${v.toFixed(2)}</span>`).join('')+(sim.rawGain>0&&sim.gain===0?`<span class="note">Mejora total +${sim.rawGain.toFixed(2)}: demasiado pequeña para justificar cambiar el XI</span>`:'');foot.appendChild(box);card.dataset.teamDecisions='1';});
}
function patchYouth(){
 const view=document.getElementById('view-youth');if(!view||view.querySelector('.youth-functions')||!players.length)return;const ctx=MZEngine.eligibleYouth(players,getActiveMainLineup(),MZ_CONFIG.YOUTH_MAX_AGE);const list=(ctx?.eligible||[]).map(p=>{const scores=D.functionalScores(p),best=Object.entries(scores).sort((a,b)=>b[1]-a[1])[0];const def=D.functionDefinitions().find(f=>f.key===best?.[0]);return{p,label:def?.label||'Perfil',score:best?.[1]||0};}).sort((a,b)=>b.score-a.score).slice(0,4);if(!list.length)return;
 const panel=document.createElement('article');panel.className='panel youth-functions';panel.innerHTML=`<div class="panel-head"><div><span class="eyebrow">PERFIL FUNCIONAL ACTUAL</span><h3>Qué función cubre hoy cada juvenil</h3></div></div><div class="youth-function-grid">${list.map(x=>`<div class="youth-function-card"><span>${esc(x.label)}</span><strong>${esc(x.p.name)}</strong><small>${x.score.toFixed(1)}/10 · compatibilidad actual; la app no estima potencial futuro</small></div>`).join('')}</div>`;view.appendChild(panel);
}
function installUI(){
 ensureStyles();patchCandidateSimulation();patchFinance();
 if(typeof renderDashboard==='function'&&!renderDashboard.__teamDecision){const prev=renderDashboard;renderDashboard=function(){prev();patchDashboard();};renderDashboard.__teamDecision=true;}
 if(typeof renderBench==='function')renderBench=renderFunctionalBench;
 registerView('needs',['Qué comprar','Distingue mejora del XI de relevo y profundidad.'],renderNeedsTeam);
 if(window.MZYouthScout?.renderYouth){const prev=window.MZYouthScout.renderYouth;const wrapped=()=>{prev();patchYouth();};window.MZYouthScout.renderYouth=wrapped;registerView('youth',VIEW_META.youth,wrapped);}
 const market=document.getElementById('view-market');if(market)new MutationObserver(()=>decorateMarket()).observe(market,{childList:true,subtree:true});
 const finance=document.getElementById('view-finance');if(finance)new MutationObserver(()=>decorateFinance()).observe(finance,{childList:true,subtree:true});
 document.addEventListener('mz:main-lineup-changed',()=>{needFormation='';setTimeout(()=>{patchDashboard();patchYouth();decorateMarket();decorateFinance();},0);});
 document.addEventListener('mz:roster-changed',()=>{needFormation='';simulationCache.clear();setTimeout(()=>{patchDashboard();patchYouth();decorateFinance();},0);});
 setTimeout(()=>{patchDashboard();patchYouth();decorateMarket();decorateFinance();},0);
}
installUI();
window.MZTeamDecisionsUI={renderNeeds:renderNeedsTeam,patchDashboard,renderFunctionalBench,decorateMarket,decorateFinance,patchYouth,decision};
})();