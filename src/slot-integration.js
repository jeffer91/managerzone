(() => {
  'use strict';
  if (!window.MZEngine) throw new Error('MZEngine debe cargarse antes de slot-integration.js');

  const usd = n => new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n)||0);
  const esc = s => String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const decisionRank = d => d==='buy'?3:d==='later'?2:1;
  const marketState = { input:'', parsed:null, results:[], filter:'all', position:'ALL' };

  function exactSlotItems(formationName, lineup) {
    const slots = FORMATIONS[formationName] || [];
    return slots.map((slot,index)=>({
      slot,index,player:lineup?.[index]||null,
      code:MZEngine.slotCode(slot,slots),
      position:MZEngine.slotLabel(slot,slots),
      score:lineup?.[index]?MZEngine.slotRating(lineup[index],slot,slots):0
    }));
  }

  function exactWeakest(formationName, lineup) {
    return exactSlotItems(formationName,lineup).filter(x=>x.player).sort((a,b)=>a.score-b.score)[0]||null;
  }

  const baseDashboard = renderDashboard;
  renderDashboard = function renderDashboardSlotAware(){
    baseDashboard();
    if(!players.length||!formationResults.length)return;
    const formationName=formationResults[0].name;
    const weak=exactWeakest(formationName,getMainLineup(formationName));
    if(!weak)return;
    const title=document.getElementById('metric-need');
    const detail=document.getElementById('metric-need-detail');
    if(title)title.textContent=`${weak.code} · ${weak.position}`;
    if(detail)detail.textContent=`Fortaleza actual ${weak.score.toFixed(1)}/10`;
  };

  const baseTactics = renderTactics;
  renderTactics = function renderTacticsSlotAware(){
    baseTactics();
    if(!players.length||!FORMATIONS[selectedFormation])return;
    const weak=exactWeakest(selectedFormation,resolveLineup());
    const el=document.getElementById('current-tactic-explanation');
    if(el&&weak)el.textContent=`Punto más débil: ${weak.player.name} como ${weak.code} · ${weak.position} (${weak.score.toFixed(1)}).`;
  };

  function patchYouthExplanation(){
    const view=document.getElementById('view-youth');
    if(!view)return;
    const cards=[...view.querySelectorAll('#youth-pitch-slots .slot:not(.empty)')];
    if(cards.length!==11)return;
    const weakest=cards.map(card=>({
      name:card.querySelector('.slot-player')?.textContent?.trim()||'',
      code:card.querySelector('.slot-pos')?.textContent?.trim()||'',
      score:Number(card.querySelector('.slot-rating-value')?.textContent)||0
    })).sort((a,b)=>a.score-b.score)[0];
    const text=view.querySelector('.tactic-score-box small');
    if(text&&weakest?.name)text.textContent=`Punto más débil: ${weakest.name} como ${weakest.code} (${weakest.score.toFixed(1)}).`;
  }

  if(window.MZYouthScout?.renderYouth){
    const originalYouth=window.MZYouthScout.renderYouth;
    const youthRenderer=()=>{originalYouth();patchYouthExplanation();};
    window.MZYouthScout.renderYouth=youthRenderer;
    registerView('youth',VIEW_META.youth,youthRenderer);
  }

  function positionalSaleCandidates(list,lineup){
    const roster=(list||[]).filter(Boolean);
    const starters=new Set((lineup||[]).filter(Boolean).map(p=>p.uid));
    const slots=FORMATIONS[selectedFormation]||[];
    if(!slots.length)return [];
    const salaryMedian=window.MZFinanceEngine?.median?MZFinanceEngine.median(roster.map(p=>p.salary)):0;
    const ranked=roster.map(player=>{
      const best=slots.map(slot=>({slot,score:MZEngine.slotRating(player,slot,slots)})).sort((a,b)=>b.score-a.score)[0];
      return {player,best};
    });
    const avg=ranked.length?ranked.reduce((s,x)=>s+x.best.score,0)/ranked.length:0;
    return ranked.filter(x=>!starters.has(x.player.uid)&&Number(x.player.salary||0)>=salaryMedian&&x.best.score<=avg+.25)
      .map(x=>({
        uid:x.player.uid,name:x.player.name,role:MZEngine.slotCode(x.best.slot,slots),position:MZEngine.slotLabel(x.best.slot,slots),
        rating:x.best.score,salary:Number(x.player.salary)||0,value:Number(x.player.value)||0,age:Number(x.player.age)||0,
        reason:'Suplente con sueldo relevante y aporte posicional por debajo del promedio de la plantilla.'
      }))
      .sort((a,b)=>b.salary-a.salary||a.rating-b.rating).slice(0,3);
  }

  if(window.MZFinanceEngine?.analyze){
    const baseAnalyze=MZFinanceEngine.analyze;
    MZFinanceEngine.analyze=function analyzeSlotAware(report,context={}){
      const out=baseAnalyze(report,context);
      return {...out,saleCandidates:positionalSaleCandidates(context.players,context.lineup)};
    };
  }

  function targetForFormation(formationName){
    const target=window.MZMarketTarget;
    if(!target||target.formationName!==formationName)return null;
    const slots=FORMATIONS[formationName]||[];
    const slot=slots[target.slotIndex];
    return slot?{...target,slot,slots}:null;
  }

  function targetFit(candidate,formationName){
    const target=targetForFormation(formationName);
    if(!target)return null;
    const reqs=(target.requirements?.length?target.requirements:[{key:target.mainKey,label:target.mainLabel,minimum:target.minimumMain}]).filter(r=>r?.key);
    const details=reqs.map(r=>({key:r.key,label:r.label||MZEngine.ATTR_LABELS[r.key]||r.key,minimum:Number(r.minimum)||0,value:Number(candidate[r.key])||0}));
    const rating=MZEngine.slotRating(candidate,target.slot,target.slots);
    const meetsAttributes=details.every(r=>r.value>=r.minimum);
    const meetsRating=rating>=Number(target.minimumRating||0);
    return {rating,details,meetsAttributes,meetsRating,meets:meetsAttributes&&meetsRating};
  }

  function fallbackSlot(candidate,slots){
    return slots.map((slot,index)=>({slot,index,score:MZEngine.slotRating(candidate,slot,slots)})).sort((a,b)=>b.score-a.score)[0]||null;
  }

  function evaluateCandidate(candidate,formationName,baseline,snapshot){
    const slots=FORMATIONS[formationName];
    const sim=MZEngine.simulateCandidate(slots,baseline,candidate);
    const target=targetForFormation(formationName);
    let slotIndex=sim.candidateIndex;
    if(slotIndex<0&&target)slotIndex=target.slotIndex;
    if(slotIndex<0)slotIndex=fallbackSlot(candidate,slots)?.index??-1;
    const slot=slotIndex>=0?slots[slotIndex]:null;
    const compare=sim.currentAtSlot||(slotIndex>=0?baseline[slotIndex]:null)||null;
    const candidateRating=slot?MZEngine.slotRating(candidate,slot,slots):candidate.ratings.bestScore;
    const compareRating=compare&&slot?MZEngine.slotRating(compare,slot,slots):0;
    const roleDelta=candidateRating-compareRating;
    const sporting=Boolean(sim.enters&&sim.gain>=MZ_CONFIG.BUY_MIN_TACTIC_GAIN);
    const budgetKnown=Boolean(snapshot?.hasAvailableBalance);
    const balance=Number(snapshot?.availableBalance)||0;
    const priceNow=Math.max(Number(candidate.priceBase)||0,Number(candidate.lastOffer)||0);
    const affordable=!budgetKnown||priceNow<=balance;
    const decision=sporting?(affordable?'buy':'later'):'no';
    const fit=targetFit(candidate,formationName);
    return {
      candidate,formationName,slots,baseline,...sim,slot,slotIndex,compare,candidateRating,compareRating,roleDelta,
      code:slot?MZEngine.slotCode(slot,slots):candidate.ratings.bestRole,
      position:slot?MZEngine.slotLabel(slot,slots):candidate.ratings.bestRole,
      sporting,budgetKnown,balance,affordable,decision,targetFit:fit,budgetAfter:budgetKnown?balance-priceNow:null,
      efficiency:sporting?(sim.gain*100000)/Math.max(priceNow,1000):0,priceNow
    };
  }

  function profileKeys(result){
    if(!result.slot)return [];
    return Object.entries(MZEngine.slotProfile(result.slot,result.slots).weights||{}).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([key])=>key);
  }

  function attrRows(person,result){
    if(!person)return '<div class="empty-state">Sin jugador comparable.</div>';
    return `<div class="attr-compare">${profileKeys(result).map(key=>`<div class="attr-row"><span>${esc(MZEngine.ATTR_LABELS[key]||key)}</span><span>${window.MZBallStrip?MZBallStrip(person[key]):person[key]}</span><b>${Number(person[key])||0}</b></div>`).join('')}</div>`;
  }

  function marketDeadline(c){
    if(!c.deadlineAt)return c.deadlineText||'No detectada';
    const delta=c.deadlineAt-Date.now();if(delta<=0)return'Finalizada';
    const mins=Math.floor(delta/60000);if(mins<60)return`Termina en ${Math.max(1,mins)} min`;
    const hours=Math.floor(mins/60);if(hours<24)return`Termina en ${hours} h ${mins%60} min`;
    return`Termina en ${Math.floor(hours/24)} d ${hours%24} h`;
  }

  function decisionLabel(result){return result.decision==='buy'?'SÍ COMPRAR':result.decision==='later'?'NO COMPRAR AHORA':'NO COMPRAR';}

  function renderTargetBanner(formationName){
    const wrap=document.getElementById('scout-target');if(!wrap)return;
    const target=targetForFormation(formationName);
    if(!target){wrap.innerHTML='';return;}
    const reqs=(target.requirements||[]).map(r=>`${r.label||MZEngine.ATTR_LABELS[r.key]||r.key} ${r.minimum}+`).join(' · ');
    wrap.innerHTML=`<div class="scout-target">Prioridad detectada en “Qué comprar”: <b>${esc(target.position)}</b> · <b>${esc(reqs||`${target.mainLabel} ${target.minimumMain}+`)}</b> · <b>${Number(target.minimumRating).toFixed(1)}/10+ en este puesto</b>.</div>`;
  }

  function marketCard(result,index){
    const c=result.candidate,compare=result.compare,fit=result.targetFit;
    const remaining=result.budgetKnown?usd(Math.max(0,result.budgetAfter)):'—';
    let reason;
    if(!result.sporting)reason=`${esc(c.name)} no mejora suficientemente la nota de tu XI en una posición exacta.`;
    else if(result.decision==='later')reason=`${esc(c.name)} sí mejora deportivamente tu XI, pero su precio actual supera el saldo detectado.`;
    else reason=`${esc(c.name)} entra como ${esc(result.code)} · ${esc(result.position)} y mejora la táctica ${result.beforeScore.toFixed(2)} → ${result.afterScore.toFixed(2)}.`;
    return `<article class="candidate-card ${result.decision}${index===0&&result.decision==='buy'?' open':''}">
      <div class="candidate-head">
        <div class="candidate-name"><strong>${esc(c.name)}</strong><small>${c.age} años · ${esc(c.club||'Club no detectado')} · PID ${esc(c.pid||c.id)}</small></div>
        <div class="candidate-role">${esc(result.code)} · ${result.candidateRating.toFixed(1)}</div>
        <div class="candidate-vs">vs. <b>${compare?esc(compare.name):'Sin comparable'}</b>${compare?` · ${result.compareRating.toFixed(1)}`:''}</div>
        <div class="candidate-gain ${result.sporting?'positive':''}">${result.gain>=0?'+':''}${result.gain.toFixed(2)} táctica</div>
        <div class="decision ${result.decision}">${decisionLabel(result)}</div>
      </div>
      <div class="candidate-detail">
        <div class="comparison-grid">
          <div class="compare-person"><h4>Tu jugador actual</h4><p>${compare?`${esc(compare.name)} · ${esc(result.code)} ${result.compareRating.toFixed(1)}/10`:'No hay titular comparable'}</p>${attrRows(compare,result)}</div>
          <div class="compare-person"><h4>Candidato</h4><p>${esc(c.name)} · ${esc(result.position)} · ${result.candidateRating.toFixed(1)}/10</p>${attrRows(c,result)}</div>
        </div>
        <div class="candidate-foot">
          <span>Entra al XI: <b>${result.enters?'Sí':'No'}</b></span><span>Táctica: <b>${result.beforeScore.toFixed(2)} → ${result.afterScore.toFixed(2)}</b></span>
          <span>Diferencia en puesto: <b>${result.roleDelta>=0?'+':''}${result.roleDelta.toFixed(2)}</b></span>
          ${result.displaced&&result.enters?`<span>Reemplaza: <b>${esc(result.displaced.name)}</b></span>`:''}
          ${fit?`<span class="fit">Cumple “Qué comprar”: <b>${fit.meets?'Sí':'No'}</b></span>`:''}
        </div>
        ${fit?`<div class="candidate-foot">${fit.details.map(r=>`<span>${esc(r.label)}: <b>${r.value}/${r.minimum}+</b></span>`).join('')}<span>Nota posicional: <b>${fit.rating.toFixed(1)}/${Number(window.MZMarketTarget.minimumRating).toFixed(1)}+</b></span></div>`:''}
        <div class="market-detail">
          <div><span>Precio base</span><b>${usd(c.priceBase||0)}</b></div><div><span>Última oferta</span><b>${usd(c.lastOffer||0)}</b></div>
          <div><span>Precio actual</span><b>${usd(result.priceNow)}</b><small>${result.budgetKnown?(result.affordable?'Dentro del presupuesto':'Fuera del presupuesto'):'Sin saldo detectado'}</small></div>
          <div><span>Saldo después</span><b>${remaining}</b></div><div><span>Valor MZ</span><b>${usd(c.value||0)}</b></div><div><span>Sueldo</span><b>${usd(c.salary||0)}</b></div>
          <div><span>Fecha límite</span><b>${esc(marketDeadline(c))}</b></div><div><span>Puesto evaluado</span><b>${esc(result.code)} · ${esc(result.position)}</b></div>
        </div><div class="candidate-reason"><b>Conclusión:</b> ${reason}</div>
      </div></article>`;
  }

  function filteredMarket(){
    return marketState.results.filter(r=>{
      if(marketState.filter==='buy'&&r.decision!=='buy')return false;
      if(marketState.filter==='later'&&r.decision!=='later')return false;
      if(marketState.filter==='no'&&r.decision!=='no')return false;
      if(marketState.position!=='ALL'&&r.code!==marketState.position)return false;
      return true;
    });
  }

  function renderMarketResults(){
    const wrap=document.getElementById('scout-results');if(!wrap)return;
    if(!marketState.parsed||!marketState.results.length){wrap.innerHTML='';return;}
    const snapshot=marketState.parsed.snapshot;
    const buy=marketState.results.filter(r=>r.decision==='buy');
    const sporting=marketState.results.filter(r=>r.sporting).sort((a,b)=>b.gain-a.gain);
    const value=buy.filter(r=>r.gain>0).sort((a,b)=>b.efficiency-a.efficiency)[0]||null;
    const positions=[...new Set(marketState.results.map(r=>r.code))].sort();
    const shown=filteredMarket();
    const counts={all:marketState.results.length,buy:buy.length,later:marketState.results.filter(r=>r.decision==='later').length,no:marketState.results.filter(r=>r.decision==='no').length};
    wrap.innerHTML=`<div class="market-snapshot">
      <div class="snapshot-card"><span>Saldo disponible</span><strong>${snapshot.hasAvailableBalance?usd(snapshot.availableBalance):'No detectado'}</strong></div>
      <div class="snapshot-card best"><span>Mejor compra</span><strong>${buy[0]?esc(buy[0].candidate.name):'Ninguna'}</strong><small>${buy[0]?`${esc(buy[0].code)} · +${buy[0].gain.toFixed(2)} · ${usd(buy[0].priceNow)}`:'Ningún candidato mejora y entra en presupuesto.'}</small></div>
      <div class="snapshot-card"><span>Mayor mejora deportiva</span><strong>${sporting[0]?esc(sporting[0].candidate.name):'Ninguna'}</strong><small>${sporting[0]?`${esc(sporting[0].position)} · +${sporting[0].gain.toFixed(2)}`:'Nadie mejora suficientemente el XI.'}</small></div>
      <div class="snapshot-card"><span>Mejor calidad/precio</span><strong>${value?esc(value.candidate.name):'Ninguna'}</strong><small>${value?`+${value.efficiency.toFixed(2)} de táctica por $100k`:'Sin opción positiva dentro del presupuesto.'}</small></div></div>
      <div class="scout-filters">${[['all','Todos'],['buy','Sí comprar'],['later','No comprar ahora'],['no','No comprar']].map(([k,l])=>`<button class="scout-filter ${marketState.filter===k?'active':''}" data-filter="${k}">${l} · ${counts[k]}</button>`).join('')}
      <select id="scout-role-filter" class="scout-role-filter"><option value="ALL">Todas las posiciones</option>${positions.map(p=>`<option value="${esc(p)}" ${marketState.position===p?'selected':''}>${esc(p)}</option>`).join('')}</select></div>
      <div class="candidate-list">${shown.length?shown.map(marketCard).join(''):'<div class="scout-empty">No hay jugadores que coincidan con estos filtros.</div>'}</div>`;
    wrap.querySelectorAll('.candidate-head').forEach(h=>h.addEventListener('click',()=>h.closest('.candidate-card').classList.toggle('open')));
    wrap.querySelectorAll('.scout-filter').forEach(b=>b.addEventListener('click',()=>{marketState.filter=b.dataset.filter;renderMarketResults();}));
    document.getElementById('scout-role-filter')?.addEventListener('change',e=>{marketState.position=e.target.value;renderMarketResults();});
  }

  function analyzeMarket(){
    const input=document.getElementById('scout-input'),msg=document.getElementById('scout-msg');
    if(!input||!msg)return;
    if(!players.length){msg.textContent='Carga primero tu plantilla para poder comparar.';msg.className='scout-msg error';return;}
    marketState.input=input.value;
    const parsed=MZYouthScout.parseMarketPage(input.value,Date.now());
    if(!parsed.candidates.length){msg.textContent='No pude detectar jugadores. Pega la página de Transferencias completa.';msg.className='scout-msg error';return;}
    const formationName=document.getElementById('scout-formation')?.value||selectedFormation;
    const baseline=getMainLineup(formationName);
    if(baseline.length!==11||baseline.some(p=>!p)){msg.textContent='No hay un XI completo para esta formación.';msg.className='scout-msg error';return;}
    marketState.parsed=parsed;
    marketState.results=parsed.candidates.map(c=>evaluateCandidate(c,formationName,baseline,parsed.snapshot)).sort((a,b)=>{
      if(decisionRank(b.decision)!==decisionRank(a.decision))return decisionRank(b.decision)-decisionRank(a.decision);
      if(Boolean(b.targetFit?.meets)!==Boolean(a.targetFit?.meets))return Number(Boolean(b.targetFit?.meets))-Number(Boolean(a.targetFit?.meets));
      if(Math.abs(b.gain-a.gain)>1e-9)return b.gain-a.gain;
      if(Math.abs(b.roleDelta-a.roleDelta)>1e-9)return b.roleDelta-a.roleDelta;
      return a.priceNow-b.priceNow;
    });
    marketState.filter='all';marketState.position='ALL';
    const sporting=marketState.results.filter(r=>r.sporting).length,buy=marketState.results.filter(r=>r.decision==='buy').length;
    msg.textContent=`${parsed.candidates.length} jugadores analizados · ${sporting} mejoran tu XI · ${buy} comprables ahora${parsed.snapshot.hasAvailableBalance?` · saldo ${usd(parsed.snapshot.availableBalance)}`:' · saldo no detectado'}`;
    msg.className='scout-msg ok';renderMarketResults();
  }

  function cloneWithValue(node){
    if(!node)return null;const value=node.value;const clone=node.cloneNode(true);node.replaceWith(clone);clone.value=value;return clone;
  }

  function renderMarketSlotAware(){
    MZYouthScout.renderScout();
    const input=cloneWithValue(document.getElementById('scout-input'));
    const analyze=cloneWithValue(document.getElementById('scout-analyze'));
    const clear=cloneWithValue(document.getElementById('scout-clear'));
    const select=cloneWithValue(document.getElementById('scout-formation'));
    if(marketState.input&&input)input.value=marketState.input;
    const formationName=select?.value||selectedFormation;renderTargetBanner(formationName);
    analyze?.addEventListener('click',analyzeMarket);
    clear?.addEventListener('click',()=>{marketState.input='';marketState.parsed=null;marketState.results=[];marketState.filter='all';marketState.position='ALL';if(input)input.value='';const r=document.getElementById('scout-results');if(r)r.innerHTML='';const m=document.getElementById('scout-msg');if(m){m.textContent='';m.className='scout-msg';}});
    select?.addEventListener('change',()=>{renderTargetBanner(select.value);if(input?.value.trim())analyzeMarket();});
    input?.addEventListener('input',()=>{marketState.input=input.value;const msg=document.getElementById('scout-msg');if(!msg)return;if(!input.value.trim()){msg.textContent='';msg.className='scout-msg';return;}const p=MZMarketParser.parseMarketPage(input.value);msg.textContent=p.candidates.length?`✓ ${p.candidates.length} jugadores detectados${p.snapshot.hasAvailableBalance?` · saldo ${usd(p.snapshot.availableBalance)}`:''}`:'Aún no detecto jugadores completos.';msg.className=p.candidates.length?'scout-msg ok':'scout-msg';});
    if(marketState.results.length)renderMarketResults();
  }

  if(window.MZYouthScout?.renderScout){
    registerView('market',VIEW_META.market,renderMarketSlotAware);
    window.MZSlotIntegration={renderMarket:renderMarketSlotAware,evaluateCandidate,targetFit,positionalSaleCandidates,exactWeakest};
  }

  if(players?.length){renderDashboard();renderTactics();}
})();
