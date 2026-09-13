(() => {
  'use strict';

  let formationChoice = '';

  function ensureStyles(){
    if(document.getElementById('needs-styles'))return;
    const style=document.createElement('style');style.id='needs-styles';style.textContent=`
      #view-needs .needs-toolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:18px}
      #view-needs .needs-toolbar h2{margin:5px 0 4px;font-size:23px}#view-needs .needs-toolbar p{margin:0;color:var(--muted);font-size:10.5px}
      .needs-select{display:flex;flex-direction:column;gap:5px;min-width:220px;color:#789080;font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:900}
      .needs-select select{background:#09150e;border:1px solid var(--line2);color:#eaf5ed;border-radius:8px;padding:9px 10px;outline:none;font-size:11px;text-transform:none;letter-spacing:0}
      .buy-one{max-width:930px;margin:0 auto;padding:24px;background:linear-gradient(180deg,#0e1b13,#0a1710);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow)}
      .buy-one-top{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}.buy-one-kicker{font-size:9px;color:var(--green);font-weight:950;letter-spacing:.1em}
      .buy-one h2{margin:7px 0 4px;font-size:30px}.buy-one-current{margin:0;color:#8fa596;font-size:11px}.buy-urgency{text-align:right}.buy-urgency small{display:block;color:#789080;font-size:8px;letter-spacing:.08em;font-weight:900}.buy-urgency strong{display:block;color:var(--green);font-size:34px}
      .buy-minimum{margin-top:20px;padding:18px;border:1px solid #2d5438;border-radius:11px;background:#08140d}.buy-minimum-label{font-size:9px;color:#789080;font-weight:900;letter-spacing:.09em;text-transform:uppercase}
      .need-req-list{display:flex;flex-direction:column;gap:10px;margin-top:10px}.need-req{display:grid;grid-template-columns:1fr 1fr;gap:10px}.need-ball-side{padding:12px;border:1px solid #203a29;border-radius:9px;background:#0b1810}.need-ball-side.target{border-color:#2d653e;background:#0b1c12}
      .need-ball-side small{display:block;color:#819687;font-size:8.5px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;margin-bottom:7px}.need-ball-value{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.need-ball-value b{font-size:18px;color:#eff8f1}
      .mz-balls{display:inline-flex;align-items:center;gap:3px;flex-wrap:wrap;min-height:15px}.mz-ball{width:13px;height:13px;border-radius:50%;display:inline-block;box-sizing:border-box;border:1px solid #66716a;background:radial-gradient(circle at 50% 48%,#151a17 0 18%,transparent 20%),radial-gradient(circle at 35% 28%,#151a17 0 10%,transparent 12%),radial-gradient(circle at 68% 30%,#151a17 0 9%,transparent 11%),radial-gradient(circle at 28% 68%,#151a17 0 9%,transparent 11%),radial-gradient(circle at 70% 68%,#151a17 0 9%,transparent 11%),#edf1ee;box-shadow:inset 0 0 0 1px #fff8}.mz-ball-plus{margin-left:3px;color:var(--green);font-weight:950;font-size:12px}
      .need-rating-min{margin-top:12px;color:#91a596;font-size:10px}.need-rating-min b{color:var(--green)}.recommended-title{margin-top:16px;font-size:8.5px;color:#789080;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
      .buy-secondary{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}.buy-secondary span{padding:7px 9px;border:1px solid #203a29;border-radius:999px;background:#0e1b13;color:#a8baad;font-size:9.5px}.buy-rule{margin:16px 0 0;color:#9aac9f;font-size:10.5px;line-height:1.55}.buy-rule strong{color:var(--green)}.buy-action{margin-top:18px;width:100%;padding:11px 14px}.buy-empty{max-width:930px;margin:0 auto;min-height:260px}
      @media(max-width:900px){#view-needs .needs-toolbar{flex-direction:column;align-items:stretch}.buy-one-top{flex-direction:column}.buy-urgency{text-align:left}.need-req{grid-template-columns:1fr}}
    `;document.head.appendChild(style);
  }

  function ballStrip(value,plus=false){
    const n=Math.max(0,Math.min(10,Math.round(Number(value)||0)));
    const balls=n?'<span class="mz-ball"></span>'.repeat(n):'<span style="color:#728177;font-size:9px">0</span>';
    return `<span class="mz-balls">${balls}${plus?'<span class="mz-ball-plus">+</span>':''}</span>`;
  }
  window.MZBallStrip=ballStrip;

  function secondaryRecommendations(player,slot,slots){
    const profile=MZEngine.slotProfile(slot,slots);
    const mandatory=new Set((profile.requirements||[]).map(item=>item[0]));
    return Object.entries(profile.weights||{})
      .filter(([key])=>!mandatory.has(key))
      .sort((a,b)=>b[1]-a[1])
      .slice(0,3)
      .map(([key])=>{
        const current=Number(player?.[key])||0;
        const target=Math.min(10,Math.max(5,Math.ceil(current+1)));
        return `${MZEngine.ATTR_LABELS[key]||key} ${target}+`;
      });
  }

  function analyzeSlot(slot,index,slots,lineup){
    const player=lineup[index];if(!player)return null;
    const score=MZEngine.slotRating(player,slot,slots);
    const used=new Set(lineup.filter(Boolean).map(p=>p.uid));
    const backup=players.filter(p=>!used.has(p.uid)).map(p=>MZEngine.slotRating(p,slot,slots)).sort((a,b)=>b-a)[0]||0;
    const performanceGap=clamp((7.5-score)/4.5,0,1),depthGap=clamp((6.2-backup)/4.2,0,1),agePressure=player.age>=32?1:player.age>=29?.55:0;
    const priority=Math.round(100*(.68*performanceGap+.22*depthGap+.10*agePressure));
    const requirements=MZEngine.slotRequirements(player,slot,slots);
    return {
      index,slot,role:slot.role,code:MZEngine.slotCode(slot,slots),position:MZEngine.slotLabel(slot,slots),player,current:score,priority,
      minimumRating:Math.min(9.5,Math.max(6.5,score+.75)),requirements,secondary:secondaryRecommendations(player,slot,slots)
    };
  }

  function analyzeNeed(roleOrSlots,slotsOrLineup,lineupMaybe){
    let slots,lineup,role=null;
    if(Array.isArray(roleOrSlots)){slots=roleOrSlots;lineup=slotsOrLineup;}
    else{role=roleOrSlots;slots=slotsOrLineup;lineup=lineupMaybe;}
    const list=slots.map((slot,index)=>analyzeSlot(slot,index,slots,lineup)).filter(Boolean).filter(item=>!role||item.role===role).sort((a,b)=>b.priority-a.priority||a.current-b.current);
    return list[0]||null;
  }

  function chosenFormation(){
    if(formationChoice&&FORMATIONS[formationChoice])return formationChoice;
    return selectedFormation&&FORMATIONS[selectedFormation]?selectedFormation:(formationResults[0]?.name||Object.keys(FORMATIONS)[0]);
  }

  function setMarketTarget(need,formationName){
    const primary=need.requirements[0]||{key:MZEngine.slotProfile(need.slot,FORMATIONS[formationName]).primary,label:'Atributo',minimum:0};
    window.MZMarketTarget={
      formationName,role:need.role,position:need.position,slotIndex:need.index,slotCode:need.code,
      mainKey:primary.key,mainLabel:primary.label,minimumMain:primary.minimum,requirements:need.requirements,
      minimumRating:need.minimumRating,playerUid:need.player.uid,current:need.current
    };
    switchView('market');
  }

  function renderRequirements(need){
    return need.requirements.map(req=>`<div class="need-req"><div class="need-ball-side"><small>Tu jugador · ${escapeHtml(req.label)}</small><div class="need-ball-value">${ballStrip(req.current)}<b>${req.current}</b></div></div><div class="need-ball-side target"><small>Mínimo a comprar · ${escapeHtml(req.label)}</small><div class="need-ball-value">${ballStrip(req.minimum,true)}<b>${req.minimum}+</b></div></div></div>`).join('');
  }

  function renderNeeds(){
    ensureStyles();
    const view=document.getElementById('view-needs');if(!view)return;
    if(!players.length){view.innerHTML='<div class="panel empty-state buy-empty">Carga primero tu plantilla.</div>';return;}
    const best=formationResults[0]?.name||selectedFormation;
    const formationName=chosenFormation();
    const options=Object.keys(FORMATIONS).map(name=>`<option value="${name}" ${name===formationName?'selected':''}>${name}${name===best?' · mejor automática':''}${name===selectedFormation?' · principal':''}</option>`).join('');
    const slots=FORMATIONS[formationName],lineup=getMainLineup(formationName);
    const first=analyzeNeed(slots,lineup);
    view.innerHTML=`<div class="needs-toolbar"><div><span class="eyebrow">PLAN DE CONTRATACIONES</span><h2>¿Qué jugador debo comprar?</h2><p>La prioridad se calcula por el puesto exacto del XI, no solo por defensa, volante o delantero.</p></div><label class="needs-select">Analizar para<select id="needs-formation">${options}</select></label></div><div id="needs-content"></div>`;
    const content=document.getElementById('needs-content');
    if(!first){content.innerHTML='<div class="panel empty-state buy-empty">No pude calcular una necesidad de compra.</div>';return;}
    const mandatory=first.requirements.map(req=>`${req.label} ${req.minimum}+`).join(' · ');
    content.innerHTML=`<article class="buy-one"><div class="buy-one-top"><div><div class="buy-one-kicker">COMPRA RECOMENDADA · ${formationName} · ${first.code}</div><h2>${escapeHtml(first.position)}</h2><p class="buy-one-current">Tu referencia actual es ${escapeHtml(first.player.name)} · ${first.current.toFixed(1)}/10 en este puesto exacto.</p></div><div class="buy-urgency"><small>URGENCIA</small><strong>${first.priority}%</strong></div></div>
      <div class="buy-minimum"><div class="buy-minimum-label">MÍNIMO OBLIGATORIO</div><div class="need-req-list">${renderRequirements(first)}</div><div class="need-rating-min">Valoración posicional mínima: <b>${first.minimumRating.toFixed(1)}/10+ como ${escapeHtml(first.position)}</b></div><div class="recommended-title">Recomendado, no obligatorio</div><div class="buy-secondary">${first.secondary.map(x=>`<span>${escapeHtml(x)}</span>`).join('')}</div></div>
      <p class="buy-rule">La decisión exige <strong>${escapeHtml(mandatory)}</strong> y aproximadamente <strong>${first.minimumRating.toFixed(1)}/10 en ${escapeHtml(first.position)}</strong>. El mismo jugador puede tener una nota distinta si lo mueves a otro lugar de la cancha.</p><button class="ghost-btn buy-action" id="buy-one-market">Analizar jugadores del mercado</button></article>`;
    document.getElementById('needs-formation').addEventListener('change',e=>{formationChoice=e.target.value;renderNeeds();});
    document.getElementById('buy-one-market').addEventListener('click',()=>setMarketTarget(first,formationName));
  }

  registerView('needs',VIEW_META.needs,renderNeeds);
  registerResetHandler(()=>{formationChoice='';delete window.MZMarketTarget;});
  document.addEventListener('mz:main-lineup-changed',()=>{if(document.getElementById('view-needs')?.classList.contains('active'))renderNeeds();});
  document.addEventListener('mz:roster-changed',()=>{formationChoice='';if(document.getElementById('view-needs')?.classList.contains('active'))renderNeeds();});
  ensureStyles();
  window.MZNeeds={render:renderNeeds,analyzeNeed,analyzeSlot};
})();
