(() => {
  'use strict';

  const ROLE_NAMES={POR:'Portero',DEF:'Defensa',VOL:'Volante',DEL:'Delantero'};
  const ROLE_ATTRS={POR:['at','intel','res','exp'],DEF:['en','res','intel','ve'],VOL:['pa','ctrl','intel','res','en'],DEL:['rem','ctrl','ve','intel','ca']};
  const ATTR_NAME={ve:'Velocidad',res:'Resistencia',intel:'Inteligencia',pa:'Pases',rem:'Remates',ca:'Cabezazos',at:'Atajando',ctrl:'Control de balón',en:'Entradas',pl:'Pases Largos',bp:'Balón Parado',exp:'Experiencia',ef:'Estado físico'};
  let youthFormation='';
  let youthLineupStates=Object.create(null);
  let candidateResults=[];
  let scoutFormation='';
  let scoutInputCache='';

  function ensureStyles(){
    if(document.getElementById('youth-scout-styles'))return;
    const style=document.createElement('style');style.id='youth-scout-styles';style.textContent=`
      .youth-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px}.youth-stat{padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:#0b1710}.youth-stat span{display:block;color:#7f9585;font-size:8px;text-transform:uppercase;letter-spacing:.08em;font-weight:900}.youth-stat strong{display:block;margin-top:5px;font-size:18px;color:#eef7f0}.youth-stat small{display:block;margin-top:3px;color:#8ba08f;font-size:9px}
      .youth-excluded-title{margin:16px 0 8px;font-size:8px;color:#789080;text-transform:uppercase;letter-spacing:.08em;font-weight:900}.youth-excluded{display:flex;flex-direction:column;gap:6px;max-height:210px;overflow:auto}.youth-excluded-item{display:flex;justify-content:space-between;gap:7px;padding:7px 8px;border:1px solid #203629;border-radius:8px;background:#08140d;font-size:8.5px}.youth-excluded-item span{color:#b8c8bb}.youth-excluded-item b{color:#819687}.youth-note{margin-top:10px;padding:9px;border:1px solid #5f4d24;border-radius:8px;background:#1b170c;color:#d9c58c;font-size:9px;line-height:1.45}
      .scout-toolbar{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:18px}.scout-toolbar h2{margin:5px 0 4px;font-size:23px}.scout-toolbar p{margin:0;color:var(--muted);font-size:10.5px}.scout-select{display:flex;flex-direction:column;gap:5px;min-width:220px;color:#789080;font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:900}.scout-select select{background:#09150e;border:1px solid var(--line2);color:#eaf5ed;border-radius:8px;padding:9px 10px;outline:none;font-size:11px;text-transform:none;letter-spacing:0}
      .scout-panel{border:1px solid var(--line);border-radius:13px;background:#0a160f;padding:18px;box-shadow:var(--shadow)}.scout-input{width:100%;min-height:190px;resize:vertical;background:#07120c;color:#dce9df;border:1px solid #23412d;border-radius:9px;padding:12px;font:10px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;outline:none}.scout-input:focus{border-color:#35714a}.scout-actions{display:flex;align-items:center;gap:10px;margin-top:10px}.scout-msg{font-size:10px;color:#8ea192}.scout-msg.error{color:#ef9c8f}.scout-target{margin-bottom:12px;padding:10px 12px;border:1px solid #2d5438;border-radius:9px;background:#08140d;color:#9fb1a3;font-size:10px}.scout-target b{color:var(--green)}.scout-disclaimer{margin:0 0 10px;color:#758a7b;font-size:9px}
      .scout-summary{margin-top:14px;display:grid;grid-template-columns:minmax(0,1.5fr) repeat(3,minmax(120px,.5fr));gap:9px}.scout-summary-card{border:1px solid var(--line);border-radius:10px;background:#0d1a12;padding:12px}.scout-summary-card span{display:block;color:#7f9585;font-size:8px;text-transform:uppercase;font-weight:900;letter-spacing:.07em}.scout-summary-card strong{display:block;margin-top:5px;font-size:17px;color:#eef7f0}.scout-summary-card.best strong{color:var(--green)}.scout-summary-card small{display:block;margin-top:4px;color:#849889;font-size:8.5px}
      .candidate-list{display:flex;flex-direction:column;gap:9px;margin-top:14px}.candidate-card{border:1px solid var(--line);border-radius:11px;background:#0b1710;overflow:hidden}.candidate-card.buy{border-color:#285b39}.candidate-head{display:grid;grid-template-columns:minmax(190px,1.3fr) 95px minmax(180px,1fr) 105px 105px;gap:10px;align-items:center;padding:12px 13px;cursor:pointer}.candidate-name strong{display:block;color:#eef7f0;font-size:12px}.candidate-name small{display:block;margin-top:3px;color:#849889;font-size:9px}.candidate-role{font-weight:900;color:#d9e7dc;font-size:10px}.candidate-vs{font-size:9.5px;color:#9db0a1}.candidate-vs b{color:#eaf4ec}.candidate-gain{font-size:11px;font-weight:950;color:#91a596;font-variant-numeric:tabular-nums}.candidate-gain.positive{color:var(--green)}.decision{justify-self:end;padding:6px 9px;border-radius:999px;font-size:8.5px;font-weight:950;letter-spacing:.04em}.decision.buy{background:#153822;color:#56f187;border:1px solid #29603b}.decision.no{background:#211811;color:#d9a77d;border:1px solid #4b3525}.candidate-detail{display:none;border-top:1px solid var(--line);padding:13px}.candidate-card.open .candidate-detail{display:block}.comparison-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.compare-person{border:1px solid #203629;border-radius:9px;padding:11px;background:#08140d}.compare-person h4{margin:0 0 4px;font-size:12px}.compare-person p{margin:0 0 10px;color:#8ea192;font-size:9px}.attr-compare{display:flex;flex-direction:column;gap:7px}.attr-row{display:grid;grid-template-columns:110px 1fr 24px;gap:8px;align-items:center}.attr-row span:first-child{font-size:8.5px;color:#93a697}.attr-row b{text-align:right;font-size:9.5px;color:#e8f2ea}.candidate-foot{margin-top:10px;display:flex;flex-wrap:wrap;gap:7px}.candidate-foot span{padding:6px 8px;border:1px solid #223a2a;border-radius:999px;color:#9eb0a2;font-size:8.5px}.candidate-reason{margin-top:10px;color:#a9b9ac;font-size:9.5px;line-height:1.5}.candidate-reason b{color:#edf7ef}
      @media(max-width:1200px){#view-youth .tactics-layout{grid-template-columns:190px minmax(520px,1fr) 190px}.candidate-head{grid-template-columns:1fr 80px 1fr 90px}.candidate-head .decision{grid-column:4}.scout-summary{grid-template-columns:1fr 1fr}}
      @media(max-width:900px){#view-youth .tactics-layout{grid-template-columns:1fr}.youth-stats{grid-template-columns:1fr}.scout-toolbar{flex-direction:column;align-items:stretch}.candidate-head{grid-template-columns:1fr 80px}.candidate-vs,.candidate-gain{grid-column:1/-1}.candidate-head .decision{grid-column:2;grid-row:1}.comparison-grid,.scout-summary{grid-template-columns:1fr}}
    `;document.head.appendChild(style);
  }

  const balls=value=>window.MZBallStrip?window.MZBallStrip(value):String(value);

  function exactPosition(slot,slots){
    if(!slot)return '—';if(slot.role==='POR')return 'Portero';const same=slots.filter(s=>s.role===slot.role);
    if(slot.role==='DEF'){if(slot.x<=25)return 'Defensa izquierdo';if(slot.x>=75)return 'Defensa derecho';return 'Defensa central';}
    if(slot.role==='VOL'){if(slot.x<=25)return 'Volante izquierdo';if(slot.x>=75)return 'Volante derecho';return same.length>=4?'Volante interior/central':'Volante central';}
    if(slot.role==='DEL'){if(same.length>=3&&slot.x<=30)return 'Delantero izquierdo';if(same.length>=3&&slot.x>=70)return 'Delantero derecho';return 'Delantero centro';}
    return ROLE_NAMES[slot.role]||slot.role;
  }

  function youthContext(){return MZEngine.eligibleYouth(players,getActiveMainLineup(),MZ_CONFIG.YOUTH_MAX_AGE);}

  function youthFormationResults(eligible){
    return Object.entries(FORMATIONS).map(([name,slots])=>{
      const assigned=eligible.length>=slots.length?bestAssignment(slots,eligible):bestPartialAssignment(slots,eligible);
      const complete=assigned.assigned===slots.length;
      const metrics=MZEngine.lineupMetrics(slots,assigned.lineup);
      return {name,slots,lineup:assigned.lineup,assigned:assigned.assigned,complete,tactic:complete?assigned.score:null,partial:assigned.average,weakest:metrics.weakest,bottom3:metrics.bottom3};
    }).sort((a,b)=>{
      if(a.complete!==b.complete)return a.complete?-1:1;
      if(a.complete){if(Math.abs(b.tactic-a.tactic)>MZ_CONFIG.TIE_EPSILON)return b.tactic-a.tactic;if(Math.abs(b.weakest-a.weakest)>MZ_CONFIG.TIE_EPSILON)return b.weakest-a.weakest;if(Math.abs(b.bottom3-a.bottom3)>MZ_CONFIG.TIE_EPSILON)return b.bottom3-a.bottom3;}
      if(b.assigned!==a.assigned)return b.assigned-a.assigned;return b.partial-a.partial;
    });
  }

  function resolveYouthState(state,eligible){
    const byId=new Map(eligible.map(player=>[player.uid,player]));
    return state?.players?.map(uid=>uid?byId.get(uid)||null:null)||[];
  }
  function setYouthBest(name,result){youthLineupStates[name]={formation:name,players:(result?.lineup||[]).map(player=>player?.uid||null)};}

  function renderYouth(){
    ensureStyles();const view=document.getElementById('view-youth');if(!view)return;
    if(!players.length){view.innerHTML='<div class="panel empty-state large">Carga primero tu plantilla.</div>';return;}
    const ctx=youthContext();if(!ctx.allYouth.length){view.innerHTML='<div class="panel empty-state large">No hay jugadores de 18 años o menos en la plantilla.</div>';return;}
    const results=youthFormationResults(ctx.eligible),bestName=results[0]?.name||Object.keys(FORMATIONS)[0];
    if(!youthFormation||!FORMATIONS[youthFormation])youthFormation=bestName;
    const result=results.find(x=>x.name===youthFormation)||results[0];
    if(!youthLineupStates[youthFormation])setYouthBest(youthFormation,result);
    let lineup=resolveYouthState(youthLineupStates[youthFormation],ctx.eligible);
    if(lineup.length!==11||lineup.filter(Boolean).length!==result.assigned){setYouthBest(youthFormation,result);lineup=resolveYouthState(youthLineupStates[youthFormation],ctx.eligible);}
    const score=result.complete?tacticScore(result.slots,lineup):null;
    const assigned=lineup.filter(Boolean).length,missing=11-assigned;
    const weak=lineup.map((player,index)=>({player,role:result.slots[index].role,score:player?roleRating(player,result.slots[index].role):Infinity})).filter(x=>x.player).sort((a,b)=>a.score-b.score)[0];
    view.innerHTML=`<div class="youth-stats"><div class="youth-stat"><span>Juveniles</span><strong>${ctx.allYouth.length}</strong><small>Edad máxima: ${MZ_CONFIG.YOUTH_MAX_AGE} años</small></div><div class="youth-stat"><span>Disponibles</span><strong>${ctx.eligible.length}</strong><small>Fuera del XI principal</small></div><div class="youth-stat"><span>Usados en primer equipo</span><strong>${ctx.excluded.length}</strong><small>Excluidos automáticamente</small></div></div>
      <div class="tactics-layout">
        <article class="panel tactic-sidebar-panel"><div class="panel-head"><div><span class="eyebrow">COMPARADOR JUVENIL</span><h3>Formaciones</h3></div></div><div id="youth-formation-list" class="formation-list">${results.map(r=>`<button class="formation-btn ${r.name===youthFormation?'active':''}" data-formation="${r.name}"><span>${r.name}</span><strong>${r.complete?r.tactic.toFixed(2):`${r.assigned}/11`}</strong></button>`).join('')}</div><div class="divider"></div><div class="tactic-score-box"><span>Nota de la táctica juvenil</span><strong>${Number.isFinite(score)?`${score.toFixed(2)} / 10`:'— / 10'}</strong><small>${Number.isFinite(score)?(weak?`Punto más débil: ${escapeHtml(weak.player.name)} como ${weak.role} (${weak.score.toFixed(1)}).`:''):`XI incompleto: ${assigned}/11 · calidad parcial ${result.partial.toFixed(1)}/10.`}</small></div><button id="youth-reset-lineup" class="ghost-btn full">Restaurar mejor XI juvenil</button></article>
        <article class="pitch-card"><div class="pitch-toolbar"><div><span class="eyebrow">EDITOR JUVENIL</span><h3>${result.name}</h3></div><span class="drag-tip">${missing?`Faltan ${missing} jugador${missing===1?'':'es'}`:'Arrastra jugadores para intercambiar posiciones'}</span></div><div class="pitch"><div class="pitch-line center"></div><div class="center-circle"></div><div class="penalty-area top"></div><div class="penalty-area bottom"></div><div id="youth-pitch-slots" class="pitch-slots"></div></div>${missing?`<div class="youth-note">No se completan huecos con mayores de 18 años ni con jugadores utilizados en el XI principal.</div>`:''}</article>
        <article class="panel bench-panel"><div class="panel-head"><div><span class="eyebrow">BANCO JUVENIL</span><h3>Disponibles</h3></div></div><p class="help compact">Solo juveniles elegibles que no están en este XI.</p><div id="youth-bench-list" class="bench-list"></div><div class="youth-excluded-title">No disponibles · XI principal</div><div class="youth-excluded">${ctx.excluded.length?ctx.excluded.map(p=>`<div class="youth-excluded-item"><span>${escapeHtml(p.name)}</span><b>${p.age}a</b></div>`).join(''):'<div class="empty-state">Ningún juvenil está en el XI principal.</div>'}</div></article>
      </div>`;
    document.querySelectorAll('#youth-formation-list .formation-btn').forEach(button=>button.addEventListener('click',()=>{youthFormation=button.dataset.formation;renderYouth();}));
    document.getElementById('youth-reset-lineup').addEventListener('click',()=>{setYouthBest(youthFormation,result);renderYouth();});
    MZBoard.renderBoard(document.getElementById('youth-pitch-slots'),result.slots,lineup,{interactive:true,onSwap(from,to){const state=youthLineupStates[youthFormation];[state.players[from],state.players[to]]=[state.players[to],state.players[from]];renderYouth();}});
    MZBoard.renderBenchList(document.getElementById('youth-bench-list'),ctx.eligible,lineup,{emptyText:'No quedan juveniles elegibles para el banco.'});
  }

  function marketNumber(text){return Number(String(text||'').replace(/[^0-9]/g,''))||0;}
  function extractNumber(block,label){const safe=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match=block.match(new RegExp(safe+'[^\\n]*\\((\\d+)\\)','i'));return match?Number(match[1]):0;}
  function parseMarketCandidates(text){
    const raw=String(text||'').replace(/\r/g,''),blocks=raw.split(/^##\s+/m).filter(block=>/p=players/.test(block)),parsed=[];
    for(const block of blocks){
      const head=block.match(/\[([^\]]+)\]\(https:\/\/www\.managerzone\.com\/\?p=players[^)]*pid=(\d+)[^)]*\)id:\s*(\d+)/i);if(!head)continue;
      const age=block.match(/Edad:\s*\|\s*\*\*(\d+)\*\*/i),value=block.match(/Valor:\s*\|\s*\*\*([^*]+?)\s*USD\*\*/i),salary=block.match(/Sueldo:\s*\*\*([^*]+?)\s*USD\*\*/i),priceBase=block.match(/Precio base\s*\|\s*\*\*([^*]+?)\s*USD\*\*/i),lastOffer=block.match(/Última oferta:\s*\|\s*\*\*([^*]+?)\s*USD\*\*/i);
      const p={id:head[2],uid:`market-${head[2]}`,name:cleanMarkdown(head[1]),age:Number(age?.[1]||0),temp:0,value:marketNumber(value?.[1]),salary:marketNumber(salary?.[1]),priceBase:marketNumber(priceBase?.[1]),lastOffer:marketNumber(lastOffer?.[1]),ve:extractNumber(block,'Velocidad'),res:extractNumber(block,'Resistencia'),intel:extractNumber(block,'Inteligencia'),pa:extractNumber(block,'Pases'),rem:extractNumber(block,'Remates'),ca:extractNumber(block,'Cabezazos'),at:extractNumber(block,'Atajando'),ctrl:extractNumber(block,'Control de balón'),en:extractNumber(block,'Entradas'),pl:extractNumber(block,'Pases Largos'),bp:extractNumber(block,'Balón Parado'),exp:extractNumber(block,'Experiencia'),ef:extractNumber(block,'Estado físico')};
      parsed.push(normalizePlayer(p));
    }
    const seen=new Set();return parsed.filter(p=>{if(seen.has(p.uid))return false;seen.add(p.uid);return true;});
  }

  function weakestStarterForRole(slots,lineup,role){return slots.map((slot,index)=>({slot,index,player:lineup[index]})).filter(x=>x.slot.role===role&&x.player).sort((a,b)=>roleRating(a.player,role)-roleRating(b.player,role))[0]||null;}

  function evaluateCandidate(candidate,formationName,baseline){
    const slots=FORMATIONS[formationName],sim=MZEngine.simulateCandidate(slots,baseline,candidate),role=sim.enters?slots[sim.candidateIndex].role:candidate.ratings.bestRole;
    const weak=weakestStarterForRole(slots,baseline,role),compare=sim.currentAtSlot||weak?.player||null;
    const roleDelta=compare?roleRating(candidate,role)-roleRating(compare,role):roleRating(candidate,role);
    const buy=Boolean(sim.enters&&sim.gain>=MZ_CONFIG.BUY_MIN_TACTIC_GAIN);
    return {candidate,formationName,slots,baseline,...sim,role,position:sim.enters?exactPosition(slots[sim.candidateIndex],slots):ROLE_NAMES[role],compare,roleDelta,buy,priceNow:Math.max(candidate.priceBase||0,candidate.lastOffer||0)};
  }

  function scoutFormationName(){if(scoutFormation&&FORMATIONS[scoutFormation])return scoutFormation;return selectedFormation&&FORMATIONS[selectedFormation]?selectedFormation:(formationResults[0]?.name||Object.keys(FORMATIONS)[0]);}

  function ensureScoutUi(){
    const view=document.getElementById('view-market');if(!view||view.dataset.ready)return;view.dataset.ready='1';
    view.innerHTML=`<div class="scout-toolbar"><div><span class="eyebrow">SCOUT DE MERCADO</span><h2>Jugadores a comprar</h2><p>Pega varios jugadores de ManagerZone y compáralos contra el XI que tienes configurado.</p></div><label class="scout-select">Comparar en<select id="scout-formation"></select></label></div><article class="scout-panel"><div id="scout-target"></div><p class="scout-disclaimer">La decisión SÍ/NO es deportiva: el precio se muestra, pero no forma parte del cálculo mientras no exista un presupuesto definido.</p><textarea id="scout-input" class="scout-input" spellcheck="false" placeholder="Pega aquí uno o varios jugadores del mercado de ManagerZone..."></textarea><div class="scout-actions"><button id="scout-analyze" class="primary-btn">Analizar jugadores</button><button id="scout-clear" class="ghost-btn">Limpiar</button><span id="scout-msg" class="scout-msg"></span></div></article><div id="scout-results"></div>`;
    document.getElementById('scout-analyze').addEventListener('click',analyzeCandidatesFromInput);
    document.getElementById('scout-clear').addEventListener('click',()=>{scoutInputCache='';candidateResults=[];document.getElementById('scout-input').value='';document.getElementById('scout-results').innerHTML='';document.getElementById('scout-msg').textContent='';});
    document.getElementById('scout-formation').addEventListener('change',e=>{scoutFormation=e.target.value;if(document.getElementById('scout-input').value.trim())analyzeCandidatesFromInput();});
  }

  function prepareScout(){
    ensureScoutUi();const select=document.getElementById('scout-formation');if(!select)return;
    const chosen=scoutFormationName(),best=formationResults[0]?.name||selectedFormation;
    select.innerHTML=Object.keys(FORMATIONS).map(name=>`<option value="${name}" ${name===chosen?'selected':''}>${name}${name===best?' · mejor automática':''}${name===selectedFormation?' · principal':''}</option>`).join('');
    document.getElementById('scout-input').value=scoutInputCache;
    const target=window.MZMarketTarget;document.getElementById('scout-target').innerHTML=target?`<div class="scout-target">Prioridad detectada en “Qué comprar”: <b>${escapeHtml(target.position)}</b> · mínimo <b>${escapeHtml(target.mainLabel)} ${target.minimumMain}+</b> · <b>${Number(target.minimumRating).toFixed(1)}/10+ como ${target.role}</b>.</div>`:'';
    if(candidateResults.length)renderCandidateResults();
  }

  function analyzeCandidatesFromInput(){
    const input=document.getElementById('scout-input'),msg=document.getElementById('scout-msg');if(!players.length){msg.textContent='Carga primero tu plantilla para poder comparar.';msg.className='scout-msg error';return;}
    scoutInputCache=input.value;const parsed=parseMarketCandidates(input.value);if(!parsed.length){msg.textContent='No pude detectar jugadores. Pega el bloque completo de ManagerZone.';msg.className='scout-msg error';return;}
    const formationName=scoutFormationName(),baseline=getMainLineup(formationName);
    if(baseline.length!==11||baseline.some(p=>!p)){msg.textContent='No hay un XI completo para esta formación.';msg.className='scout-msg error';return;}
    candidateResults=parsed.map(candidate=>evaluateCandidate(candidate,formationName,baseline)).sort((a,b)=>Number(b.buy)-Number(a.buy)||b.gain-a.gain||roleRating(b.candidate,b.role)-roleRating(a.candidate,a.role));
    msg.textContent=`${parsed.length} jugadores detectados · ${candidateResults.filter(x=>x.buy).length} sí mejoran deportivamente tu XI.`;msg.className='scout-msg';renderCandidateResults();
  }

  function attributeRows(person,role){if(!person)return '<div class="empty-state">Sin jugador comparable.</div>';return `<div class="attr-compare">${ROLE_ATTRS[role].map(key=>`<div class="attr-row"><span>${ATTR_NAME[key]}</span>${balls(person[key])}<b>${person[key]}</b></div>`).join('')}</div>`;}

  function candidateCard(r,index){
    const c=r.candidate,compare=r.compare,reason=r.buy?`${escapeHtml(c.name)} entra en tu XI de ${r.formationName}${r.displaced?` y desplaza a ${escapeHtml(r.displaced.name)}`:''}. La nota táctica mejora ${r.beforeScore.toFixed(2)} → ${r.afterScore.toFixed(2)}.`:`${escapeHtml(c.name)} no produce una mejora mínima de ${MZ_CONFIG.BUY_MIN_TACTIC_GAIN.toFixed(2)} puntos en la nota de tu XI de ${r.formationName}.`;
    return `<article class="candidate-card ${r.buy?'buy':'no'}${index===0&&r.buy?' open':''}"><div class="candidate-head"><div class="candidate-name"><strong>${escapeHtml(c.name)}</strong><small>${c.age} años · ${fmtUSD(c.value)} valor · ${r.priceNow?`${fmtUSD(r.priceNow)} precio actual`:'sin precio actual'}</small></div><div class="candidate-role">${r.role} · ${roleRating(c,r.role).toFixed(1)}</div><div class="candidate-vs">vs. <b>${compare?escapeHtml(compare.name):'Sin comparable'}</b>${compare?` · ${roleRating(compare,r.role).toFixed(1)}`:''}</div><div class="candidate-gain ${r.buy?'positive':''}">${r.gain>=0?'+':''}${r.gain.toFixed(2)} táctica</div><div class="decision ${r.buy?'buy':'no'}">${r.buy?'SÍ COMPRAR':'NO COMPRAR'}</div></div><div class="candidate-detail"><div class="comparison-grid"><div class="compare-person"><h4>Tu jugador actual</h4><p>${compare?`${escapeHtml(compare.name)} · ${r.role} ${roleRating(compare,r.role).toFixed(1)}/10`:'No hay titular comparable'}</p>${attributeRows(compare,r.role)}</div><div class="compare-person"><h4>Candidato</h4><p>${escapeHtml(c.name)} · ${r.position} · ${r.role} ${roleRating(c,r.role).toFixed(1)}/10</p>${attributeRows(c,r.role)}</div></div><div class="candidate-foot"><span>Entra al XI: <b>${r.enters?'Sí':'No'}</b></span><span>Táctica: <b>${r.beforeScore.toFixed(2)} → ${r.afterScore.toFixed(2)}</b></span><span>Diferencia en puesto: <b>${r.roleDelta>=0?'+':''}${r.roleDelta.toFixed(2)}</b></span>${r.displaced&&r.enters?`<span>Reemplaza: <b>${escapeHtml(r.displaced.name)}</b></span>`:''}</div><div class="candidate-reason"><b>Conclusión:</b> ${reason} Decisión por rendimiento; el precio no se pondera.</div></div></article>`;
  }

  function renderCandidateResults(){
    const wrap=document.getElementById('scout-results');if(!wrap)return;if(!candidateResults.length){wrap.innerHTML='';return;}const yes=candidateResults.filter(x=>x.buy),best=yes[0]||null;
    wrap.innerHTML=`<div class="scout-summary"><div class="scout-summary-card best"><span>Mejor compra encontrada</span><strong>${best?escapeHtml(best.candidate.name):'Ninguna'}</strong><small>${best?`${best.position} · +${best.gain.toFixed(2)} en táctica`:'Ningún candidato mejora suficientemente el XI.'}</small></div><div class="scout-summary-card"><span>Sí comprar</span><strong>${yes.length}</strong></div><div class="scout-summary-card"><span>No comprar</span><strong>${candidateResults.length-yes.length}</strong></div><div class="scout-summary-card"><span>Analizados</span><strong>${candidateResults.length}</strong></div></div><div class="candidate-list">${candidateResults.map(candidateCard).join('')}</div>`;
    wrap.querySelectorAll('.candidate-head').forEach(head=>head.addEventListener('click',()=>head.closest('.candidate-card').classList.toggle('open')));
  }

  function renderScout(){prepareScout();}
  function invalidateYouth(){youthLineupStates=Object.create(null);}
  function resetModule(){youthFormation='';invalidateYouth();candidateResults=[];scoutFormation='';scoutInputCache='';}

  registerView('youth',VIEW_META.youth,renderYouth);registerView('market',VIEW_META.market,renderScout);registerResetHandler(resetModule);
  document.addEventListener('mz:main-lineup-changed',()=>{invalidateYouth();if(document.getElementById('view-youth')?.classList.contains('active'))renderYouth();if(document.getElementById('view-market')?.classList.contains('active')&&scoutInputCache.trim())analyzeCandidatesFromInput();});
  document.addEventListener('mz:roster-changed',()=>{resetModule();});
  ensureStyles();
  window.MZYouthScout={renderYouth,renderScout,parseMarketCandidates,analyzeCandidatesFromInput,invalidateYouth};
})();