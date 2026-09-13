(() => {
'use strict';
if(!window.MZSpatial||!window.MZEngine)throw new Error('MZSpatial debe cargarse antes de spatial-tools.js');

const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

function patchFormations(){
  if(!window.FORMATIONS&&typeof FORMATIONS==='undefined')return;
  const f=typeof FORMATIONS!=='undefined'?FORMATIONS:window.FORMATIONS;
  f['4-4-2']=[
    {role:'POR',x:50,y:91},{role:'DEF',x:18,y:73},{role:'DEF',x:39,y:78},{role:'DEF',x:61,y:78},{role:'DEF',x:82,y:73},
    {role:'VOL',x:17,y:49},{role:'VOL',x:50,y:58},{role:'VOL',x:50,y:39},{role:'VOL',x:83,y:49},
    {role:'DEL',x:38,y:20},{role:'DEL',x:62,y:20}
  ];
}

function ensureStyles(){
 if(document.getElementById('spatial-tools-styles'))return;
 const s=document.createElement('style');s.id='spatial-tools-styles';s.textContent=`
 .spatial-advice{margin-top:16px;display:grid;grid-template-columns:1.1fr 1fr;gap:12px}.spatial-card{border:1px solid var(--line);border-radius:12px;background:#0a160f;padding:16px}.spatial-card h3{margin:3px 0 12px;font-size:15px}.spatial-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.spatial-item{padding:10px;border:1px solid #203629;border-radius:9px;background:#08140d}.spatial-item span{display:block;color:#789080;font-size:8px;text-transform:uppercase;font-weight:900;letter-spacing:.06em}.spatial-item b{display:block;margin-top:4px;color:#eef7f0;font-size:11px}.spatial-item small{display:block;margin-top:3px;color:#8ea192;font-size:8.5px;line-height:1.35}.setpiece-list{display:flex;flex-direction:column;gap:6px}.setpiece-row{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:center;padding:7px 8px;border:1px solid #203629;border-radius:8px;background:#08140d;font-size:9px}.setpiece-row strong{color:#eef7f0}.setpiece-row small{color:#789080}.profile-enrich{margin-top:14px}.profile-enrich textarea{width:100%;min-height:120px;resize:vertical;background:#07120c;color:#dce9df;border:1px solid #23412d;border-radius:9px;padding:11px;font:10px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;outline:none}.profile-enrich-actions{display:flex;align-items:center;gap:10px;margin-top:8px}.profile-enrich-msg{font-size:9px;color:#8ea192}.profile-enrich-msg.ok{color:var(--green)}
 @media(max-width:1000px){.spatial-advice{grid-template-columns:1fr}.spatial-grid{grid-template-columns:1fr 1fr}}`;
 document.head.appendChild(s);
}

function enrichProfiles(raw){
 const text=String(raw||'');if(!text.trim())return{updated:0,found:0};let updated=0,found=0;
 for(const p of players){
   const idx=text.toLowerCase().indexOf(String(p.name||'').toLowerCase());if(idx<0)continue;found++;
   const sample=text.slice(Math.max(0,idx-80),idx+600);
   const foot=sample.match(/Pie\s*:\s*(Diestro|Zurdo|Ambidiestro|Derecho|Izquierdo)/i);
   const height=sample.match(/(1\d{2}|2\d{2})\s*cm/i);
   const weight=sample.match(/(\d{2,3})\s*kg/i);
   let changed=false;
   if(foot){const v=foot[1];if(p.foot!==v){p.foot=v;changed=true;}}
   if(height){const v=Number(height[1]);if(p.heightCm!==v){p.heightCm=v;changed=true;}}
   if(weight){const v=Number(weight[1]);if(p.weightKg!==v){p.weightKg=v;changed=true;}}
   if(changed)updated++;
 }
 if(updated){savePlayers();renderAll();}
 return{updated,found};
}

function injectProfileEnrichment(){
 const view=document.getElementById('view-import');if(!view||document.getElementById('profile-enrich-box'))return;
 const box=document.createElement('article');box.id='profile-enrich-box';box.className='panel profile-enrich';
 box.innerHTML=`<div class="panel-head"><div><span class="eyebrow">PERFILES OPCIONALES</span><h3>Pie, altura y peso</h3></div></div><p class="help">Pega fichas de jugadores de ManagerZone. La app busca los nombres ya cargados y completa Pie, altura y peso sin duplicarlos.</p><textarea id="profile-enrich-input" placeholder="Ejemplo: Rogelio Fole · Edad: 19 · Pie: Diestro · 189 cm, 96 kg"></textarea><div class="profile-enrich-actions"><button id="profile-enrich-btn" class="ghost-btn">Enriquecer plantilla</button><span id="profile-enrich-msg" class="profile-enrich-msg"></span></div>`;
 view.appendChild(box);
 document.getElementById('profile-enrich-btn').addEventListener('click',()=>{const out=enrichProfiles(document.getElementById('profile-enrich-input').value),msg=document.getElementById('profile-enrich-msg');msg.textContent=out.updated?`${out.updated} jugador(es) actualizados.`:out.found?'Los perfiles ya estaban actualizados.':'No encontré jugadores de tu plantilla en el texto.';msg.className=`profile-enrich-msg ${out.updated?'ok':''}`;});
}

function rankSetPieces(slots,lineup){
 const items=lineup.map((player,index)=>player?{player,slot:slots[index],index}:null).filter(Boolean);
 return{
  captain:[...items].sort((a,b)=>MZSpatial.captainScore(b.player,b.slot,slots)-MZSpatial.captainScore(a.player,a.slot,slots))[0]||null,
  penalties:[...items].sort((a,b)=>MZSpatial.penaltyScore(b.player,b.slot)-MZSpatial.penaltyScore(a.player,a.slot)).slice(0,5),
  freeKicks:[...items].sort((a,b)=>MZSpatial.freeKickScore(b.player)-MZSpatial.freeKickScore(a.player)).slice(0,5),
  organizer:[...items].filter(x=>x.slot.role==='VOL').sort((a,b)=>{const bc=MZSpatial.coordinatorScore(b.player)+MZSpatial.sideInfo(b.slot).centrality*.6,ac=MZSpatial.coordinatorScore(a.player)+MZSpatial.sideInfo(a.slot).centrality*.6;return bc-ac;})[0]||null
 };
}
function average(items,key){return items.length?items.reduce((s,p)=>s+(Number(p?.[key])||0),0)/items.length:0;}
function rowList(items,scoreFn){return `<div class="setpiece-list">${items.map((x,i)=>`<div class="setpiece-row"><small>${i+1}</small><strong>${esc(x.player.name)}</strong><b>${scoreFn(x).toFixed(1)}</b></div>`).join('')}</div>`;}
function renderTacticalAdvice(){
 const view=document.getElementById('view-tactics');if(!view||!players.length||!FORMATIONS[selectedFormation])return;
 view.querySelector('.spatial-advice')?.remove();
 const slots=FORMATIONS[selectedFormation],lineup=resolveLineup();if(lineup.length!==slots.length||lineup.some(p=>!p))return;
 const r=rankSetPieces(slots,lineup),avgPass=average(lineup,'pa'),avgCtrl=average(lineup,'ctrl'),avgRes=average(lineup,'res'),avgEn=average(lineup,'en');
 const advice=document.createElement('div');advice.className='spatial-advice';
 const organizer=r.organizer?`${r.organizer.player.name} · ${MZEngine.slotCode(r.organizer.slot,slots)}`:'—';
 const passReason=(avgPass+avgCtrl)/2>=6?'Encaja bien con tu XI':'Preferencia base; el XI tiene margen para mejorar pase/control';
 const aggression=avgEn>=7&&avgRes>=7?'Normal / subir solo si el partido lo exige':'Normal';
 advice.innerHTML=`<article class="spatial-card"><span class="eyebrow">INSTRUCCIONES</span><h3>Cómo jugar este XI</h3><div class="spatial-grid"><div class="spatial-item"><span>Organizador</span><b>${esc(organizer)}</b><small>El mejor creador debe influir desde zona central.</small></div><div class="spatial-item"><span>Capitán</span><b>${r.captain?esc(r.captain.player.name):'—'}</b><small>Experiencia + inteligencia + peso en el XI.</small></div><div class="spatial-item"><span>Táctica</span><b>Pases cortos</b><small>${esc(passReason)}</small></div><div class="spatial-item"><span>Estilo / agresividad</span><b>Normal</b><small>${esc(aggression)}</small></div></div></article><article class="spatial-card"><span class="eyebrow">BALÓN PARADO</span><h3>Orden recomendado</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><small class="help">Penales · prioridad a delanteros</small>${rowList(r.penalties,x=>MZSpatial.penaltyScore(x.player,x.slot))}</div><div><small class="help">Tiros libres</small>${rowList(r.freeKicks,x=>MZSpatial.freeKickScore(x.player))}</div></div></article>`;
 view.appendChild(advice);
}

function refreshAfterPatch(){
 patchFormations();
 if(typeof resetLineupStates==='function')resetLineupStates();
 if(typeof renderAll==='function')renderAll();
 if(players.length&&typeof setFormation==='function'){selectedFormation=formationResults[0]?.name||selectedFormation;setFormation(selectedFormation,true);}
 injectProfileEnrichment();renderTacticalAdvice();
}

ensureStyles();
const baseTactics=renderTactics;
renderTactics=function renderTacticsSpatialTools(){baseTactics();renderTacticalAdvice();};
document.addEventListener('mz:main-lineup-changed',()=>setTimeout(renderTacticalAdvice,0));
document.addEventListener('mz:roster-changed',()=>{setTimeout(()=>{injectProfileEnrichment();renderTacticalAdvice();},0)});
window.MZSpatialTools={enrichProfiles,renderTacticalAdvice,patchFormations};
refreshAfterPatch();
})();