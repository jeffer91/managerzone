(() => {
  'use strict';
  if(!window.MZSlotIntegration)return;

  function syncYouthWeakness(){
    const view=document.getElementById('view-youth');
    if(!view||!view.classList.contains('active'))return;
    const cards=[...view.querySelectorAll('#youth-pitch-slots .slot:not(.empty)')];
    if(cards.length!==11)return;
    const weak=cards.map(card=>({
      name:card.querySelector('.slot-player')?.textContent?.trim()||'',
      code:card.querySelector('.slot-pos')?.textContent?.trim()||'',
      score:Number(card.querySelector('.slot-rating-value')?.textContent)||0
    })).sort((a,b)=>a.score-b.score)[0];
    const text=view.querySelector('.tactic-score-box small');
    if(!text||!weak?.name)return;
    const next=`Punto más débil: ${weak.name} como ${weak.code} (${weak.score.toFixed(1)}).`;
    if(text.textContent!==next)text.textContent=next;
  }

  const youth=document.getElementById('view-youth');
  if(youth){
    let queued=false;
    new MutationObserver(()=>{
      if(queued)return;queued=true;
      requestAnimationFrame(()=>{queued=false;syncYouthWeakness();});
    }).observe(youth,{childList:true,subtree:true,characterData:true});
  }

  const baseMarket=window.MZSlotIntegration.renderMarket;
  function renderMarketSynced(){
    baseMarket();
    const target=window.MZMarketTarget;
    const select=document.getElementById('scout-formation');
    if(target?.formationName&&FORMATIONS[target.formationName]&&select&&select.value!==target.formationName){
      select.value=target.formationName;
      select.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }
  window.MZSlotIntegration.renderMarket=renderMarketSynced;
  registerView('market',VIEW_META.market,renderMarketSynced);
})();

(() => {
'use strict';
if (!window.MZEngine) return;

const usdSigned = n => {
  const value = Number(n) || 0;
  const body = new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Math.abs(value));
  return value > 0 ? `+${body}` : value < 0 ? `-${body}` : body;
};
const esc2 = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const spatialCompare = MZEngine.compareFormations;
MZEngine.compareFormations = function compareFormationsWithBench(formations, roster){
  const order = Object.keys(formations || {});
  const results = spatialCompare(formations, roster).map(result => ({
    ...result,
    complete: (result.lineup || []).filter(Boolean).length === (result.slots || []).length,
    bench: typeof MZEngine.benchStrength === 'function' ? MZEngine.benchStrength(roster || [], result.lineup || []) : 0
  }));
  results.sort((a,b)=>{
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    const scoreA = Number.isFinite(a.score) ? a.score : -Infinity;
    const scoreB = Number.isFinite(b.score) ? b.score : -Infinity;
    if (Math.abs(scoreB-scoreA) > (MZEngine.CONFIG?.TIE_EPSILON || 1e-9)) return scoreB-scoreA;
    if (Math.abs((b.weakest||0)-(a.weakest||0)) > 1e-9) return (b.weakest||0)-(a.weakest||0);
    if (Math.abs((b.bottom3||0)-(a.bottom3||0)) > 1e-9) return (b.bottom3||0)-(a.bottom3||0);
    if (Math.abs((b.bench||0)-(a.bench||0)) > 1e-9) return (b.bench||0)-(a.bench||0);
    return order.indexOf(a.name)-order.indexOf(b.name);
  });
  return results;
};

if (typeof parseRoster === 'function') {
  const baseParseRoster = parseRoster;
  parseRoster = function parseRosterPreservingProfiles(text){
    const byId = new Map((players || []).filter(p=>p?.id).map(p=>[String(p.id),p]));
    const byName = new Map((players || []).filter(p=>p?.name).map(p=>[String(p.name).trim().toLowerCase(),p]));
    return baseParseRoster(text).map(player=>{
      const old = byId.get(String(player.id || '')) || byName.get(String(player.name || '').trim().toLowerCase());
      if (!old) return player;
      for (const key of ['foot','pie','heightCm','height','weightKg','weight']) {
        if (old[key] !== undefined && old[key] !== null && old[key] !== '') player[key] = old[key];
      }
      return player;
    });
  };
}

function tolerantEnrichProfiles(raw){
  const text = String(raw || '');
  if (!text.trim() || typeof players === 'undefined') return {updated:0,found:0};
  let updated=0,found=0;
  const lower=text.toLowerCase();
  for (const p of players) {
    const name=String(p.name||'').trim();
    if(!name) continue;
    const idx=lower.indexOf(name.toLowerCase());
    if(idx<0) continue;
    found++;
    const sample=text.slice(Math.max(0,idx-120),idx+900);
    let foot=sample.match(/Pie\s*[:\-]?\s*(Diestro|Zurdo|Ambidiestro|Derecho|Izquierdo)/i);
    if(!foot) foot=sample.match(/\b(Diestro|Zurdo|Ambidiestro)\b/i);
    const cm=sample.match(/\b(1\d{2}|2\d{2})\s*cm\b/i);
    const meters=sample.match(/\b([12])\s*[,.]\s*(\d{2})\s*m\b/i);
    const kg=sample.match(/\b(\d{2,3})\s*kg\b/i);
    let changed=false;
    if(foot){const v=foot[1];if(p.foot!==v){p.foot=v;changed=true;}}
    const h=cm?Number(cm[1]):meters?(Number(meters[1])*100+Number(meters[2])):0;
    if(h>=140&&h<=230&&p.heightCm!==h){p.heightCm=h;changed=true;}
    if(kg){const w=Number(kg[1]);if(w>=40&&w<=180&&p.weightKg!==w){p.weightKg=w;changed=true;}}
    if(changed) updated++;
  }
  if(updated){ savePlayers(); if(typeof renderAll==='function') renderAll(); }
  return {updated,found};
}

document.addEventListener('click',e=>{
  if(e.target?.id!=='profile-enrich-btn') return;
  e.stopImmediatePropagation();
  const input=document.getElementById('profile-enrich-input');
  const msg=document.getElementById('profile-enrich-msg');
  const out=tolerantEnrichProfiles(input?.value||'');
  if(msg){
    msg.textContent=out.updated?`${out.updated} jugador(es) actualizados.`:out.found?'Los perfiles ya estaban actualizados.':'No encontré jugadores de tu plantilla en el texto.';
    msg.className=`profile-enrich-msg ${out.updated?'ok':''}`;
  }
},true);

if (typeof openPlayer === 'function') {
  const baseOpenPlayer = openPlayer;
  openPlayer = function openPlayerWithProfile(uid){
    baseOpenPlayer(uid);
    const p=(players||[]).find(x=>x.uid===uid);
    if(!p) return;
    const parts=[];
    if(p.foot||p.pie) parts.push(`Pie ${p.foot||p.pie}`);
    if(p.heightCm||p.height) parts.push(`${p.heightCm||p.height} cm`);
    if(p.weightKg||p.weight) parts.push(`${p.weightKg||p.weight} kg`);
    if(!parts.length) return;
    const head=document.querySelector('#modal-content .player-modal-head p');
    if(head && !head.dataset.profileExtra){head.dataset.profileExtra='1';head.innerHTML += ` · <b>${parts.map(esc2).join(' · ')}</b>`;}
  };
}

function lineupContext(){
  if(typeof FORMATIONS==='undefined'||typeof selectedFormation==='undefined'||typeof resolveLineup!=='function') return null;
  const slots=FORMATIONS[selectedFormation]||[],lineup=resolveLineup();
  if(!slots.length||lineup.length!==slots.length||lineup.some(p=>!p)) return null;
  return {slots,lineup};
}
const avg2=(arr,key)=>arr.length?arr.reduce((s,p)=>s+(Number(p?.[key])||0),0)/arr.length:0;
function tacticalRecommendation(){
  const ctx=lineupContext();if(!ctx)return null;
  const {slots,lineup}=ctx;
  const pass=(avg2(lineup,'pa')+avg2(lineup,'ctrl'))/2;
  const shortPassing=pass>=5.5
    ? {label:'Pases cortos',reason:`Preferencia base y compatible con Pase/Control ${pass.toFixed(1)}/10.`}
    : {label:'Pases cortos · con cautela',reason:`Es tu preferencia, pero Pase/Control ${pass.toFixed(1)}/10 no la favorece claramente.`};
  const atk=[],def=[];
  slots.forEach((slot,i)=>{const score=MZEngine.slotRating(lineup[i],slot,slots);if(slot.role==='DEL')atk.push(score);if(slot.role==='DEF'||slot.role==='POR')def.push(score);});
  const attack=atk.length?atk.reduce((a,b)=>a+b,0)/atk.length:0;
  const defense=def.length?def.reduce((a,b)=>a+b,0)/def.length:0;
  let style='Normal',styleReason='El XI está relativamente equilibrado.';
  if(attack>defense+.8){style='Más ofensivo';styleReason='Tu frente de ataque es claramente más fuerte que tu bloque defensivo.';}
  else if(defense>attack+.8){style='Más conservador';styleReason='Tu bloque defensivo es claramente más fuerte que tu ataque.';}
  const tackling=avg2(lineup,'en'),stamina=avg2(lineup,'res'),fitness=avg2(lineup,'ef');
  let aggression='Normal',aggressionReason='Mantén una presión equilibrada.';
  if(tackling>=7&&stamina>=7&&fitness>=6.5){aggression='Subir un nivel';aggressionReason='Entradas, resistencia y estado físico permiten más intensidad.';}
  else if(tackling<5.5||stamina<5.5||fitness<5.5){aggression='Bajar un nivel';aggressionReason='Evita exigir de más a un XI con menor capacidad para sostener intensidad.';}
  return {shortPassing,style,styleReason,aggression,aggressionReason};
}
function patchTacticalAdvice(){
  const advice=tacticalRecommendation();if(!advice)return;
  const cards=[...document.querySelectorAll('#view-tactics .spatial-advice .spatial-item')];
  if(cards.length<4)return;
  const tactic=cards[2],style=cards[3];
  const tb=tactic.querySelector('b'),ts=tactic.querySelector('small');
  if(tb)tb.textContent=advice.shortPassing.label;if(ts)ts.textContent=advice.shortPassing.reason;
  const sb=style.querySelector('b'),ss=style.querySelector('small');
  if(sb)sb.textContent=`${advice.style} · ${advice.aggression}`;
  if(ss)ss.textContent=`${advice.styleReason} ${advice.aggressionReason}`;
}
if(typeof renderTactics==='function'){
  const previousRenderTactics=renderTactics;
  renderTactics=function renderTacticsPolished(){previousRenderTactics();patchTacticalAdvice();};
}
document.addEventListener('mz:main-lineup-changed',()=>setTimeout(patchTacticalAdvice,0));
document.addEventListener('mz:roster-changed',()=>setTimeout(patchTacticalAdvice,0));

function currentFinanceReport(box){
  const title=box?.querySelector('h3')?.textContent||'';
  if(/Vista previa/i.test(title)){
    const input=document.getElementById('fin-input');
    const parsed=window.MZFinanceParser?.parseFinanceReport?.(input?.value||'');
    return parsed?.report||null;
  }
  const history=window.MZFinance?.history?.()||[];
  return history.length?history.slice().sort((a,b)=>b.savedAt-a.savedAt)[0].report:null;
}
function patchFinanceVisuals(){
  document.querySelectorAll('#view-finance .fi-box').forEach(box=>{
    const report=currentFinanceReport(box);if(!report)return;
    const context={players:typeof players==='undefined'?[]:players,lineup:typeof getActiveMainLineup==='function'?getActiveMainLineup():[],availableBalance:null,reserveWeeks:Number(localStorage.getItem('mz_tactical_lab_finance_reserve_weeks_v1'))||4};
    const analysis=window.MZFinanceEngine?.analyze?.(report,context);if(!analysis)return;
    const row=[...box.querySelectorAll('.fi-row')].find(r=>/Déficit\/superávit operativo|Resultado operativo/i.test(r.querySelector('span')?.textContent||''));
    if(!row)return;
    const value=Number(analysis.operatingResult)||0;
    row.classList.toggle('negative',value<0);row.classList.toggle('positive',value>0);
    const label=row.querySelector('span');if(label)label.textContent='Resultado operativo';
    const amount=row.querySelector('b');if(amount)amount.textContent=usdSigned(value);
  });
}
const polishStyle=document.createElement('style');
polishStyle.textContent='.fi-row.negative>b{color:#ff7b7b}.fi-row.negative i{background:#ff6b6b!important}.fi-row.positive>b{color:var(--green)}.fi-row.positive i{background:var(--green)!important}.player-modal-head p b{color:#b8d9c1}';
document.head.appendChild(polishStyle);
document.addEventListener('click',e=>{if(['fin-analyze','fin-save'].includes(e.target?.id))setTimeout(patchFinanceVisuals,20);});
const financeView=document.getElementById('view-finance');if(financeView)new MutationObserver(()=>setTimeout(patchFinanceVisuals,0)).observe(financeView,{childList:true,subtree:true});

window.MZSpatialPolish={tolerantEnrichProfiles,tacticalRecommendation,patchFinanceVisuals};
if(typeof renderAll==='function')renderAll();
setTimeout(()=>{patchTacticalAdvice();patchFinanceVisuals();},0);
})();
