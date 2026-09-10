'use strict';

if (!window.MZEngine) throw new Error('MZEngine debe cargarse antes de app.js');

const STORAGE_KEY = 'mz_tactical_lab_players_v1';
const ATTRS = ['ve','res','intel','pa','rem','ca','at','ctrl','en','pl','bp','exp','ef'];
const ATTR_LABELS = {ve:'Velocidad',res:'Resistencia',intel:'Inteligencia',pa:'Pases',rem:'Remates',ca:'Cabezazos',at:'Atajando',ctrl:'Control',en:'Entradas',pl:'Pases largos',bp:'Balón parado',exp:'Experiencia',ef:'Estado físico'};
const ROLE_LABELS = {POR:'Portero',DEF:'Defensa',VOL:'Volante',DEL:'Delantero'};
const MZ_CONFIG = MZEngine.CONFIG;

const FORMATIONS = {
  '4-3-3': [
    {role:'POR',x:50,y:91},{role:'DEF',x:18,y:72},{role:'DEF',x:39,y:77},{role:'DEF',x:61,y:77},{role:'DEF',x:82,y:72},
    {role:'VOL',x:26,y:48},{role:'VOL',x:50,y:55},{role:'VOL',x:74,y:48},
    {role:'DEL',x:18,y:22},{role:'DEL',x:50,y:15},{role:'DEL',x:82,y:22}
  ],
  '4-4-2': [
    {role:'POR',x:50,y:91},{role:'DEF',x:18,y:73},{role:'DEF',x:39,y:78},{role:'DEF',x:61,y:78},{role:'DEF',x:82,y:73},
    {role:'VOL',x:17,y:48},{role:'VOL',x:39,y:52},{role:'VOL',x:61,y:52},{role:'VOL',x:83,y:48},
    {role:'DEL',x:38,y:20},{role:'DEL',x:62,y:20}
  ],
  '4-2-3-1': [
    {role:'POR',x:50,y:91},{role:'DEF',x:18,y:74},{role:'DEF',x:39,y:78},{role:'DEF',x:61,y:78},{role:'DEF',x:82,y:74},
    {role:'VOL',x:38,y:57},{role:'VOL',x:62,y:57},{role:'VOL',x:19,y:38},{role:'VOL',x:50,y:35},{role:'VOL',x:81,y:38},
    {role:'DEL',x:50,y:15}
  ],
  '3-5-2': [
    {role:'POR',x:50,y:91},{role:'DEF',x:27,y:76},{role:'DEF',x:50,y:80},{role:'DEF',x:73,y:76},
    {role:'VOL',x:12,y:49},{role:'VOL',x:31,y:54},{role:'VOL',x:50,y:48},{role:'VOL',x:69,y:54},{role:'VOL',x:88,y:49},
    {role:'DEL',x:38,y:20},{role:'DEL',x:62,y:20}
  ],
  '5-3-2': [
    {role:'POR',x:50,y:91},{role:'DEF',x:12,y:69},{role:'DEF',x:30,y:77},{role:'DEF',x:50,y:80},{role:'DEF',x:70,y:77},{role:'DEF',x:88,y:69},
    {role:'VOL',x:28,y:48},{role:'VOL',x:50,y:54},{role:'VOL',x:72,y:48},
    {role:'DEL',x:38,y:20},{role:'DEL',x:62,y:20}
  ],
  '3-4-3': [
    {role:'POR',x:50,y:91},{role:'DEF',x:27,y:77},{role:'DEF',x:50,y:81},{role:'DEF',x:73,y:77},
    {role:'VOL',x:17,y:50},{role:'VOL',x:40,y:53},{role:'VOL',x:60,y:53},{role:'VOL',x:83,y:50},
    {role:'DEL',x:18,y:22},{role:'DEL',x:50,y:15},{role:'DEL',x:82,y:22}
  ]
};

let players = loadPlayers();
let selectedFormation = '4-3-3';
let currentLineup = null;
let formationResults = [];
let lineupStates = Object.create(null);

const VIEW_META = {
  dashboard:['Inicio','Decisiones basadas en tus atributos reales de ManagerZone.'],
  import:['Cargar plantilla','Pega los datos tal como salen de ManagerZone.'],
  squad:['Plantilla','Cada jugador tiene una nota 0–10 diferente por posición.'],
  tactics:['Tácticas','La formación completa se calcula con precisión interna y se muestra con dos decimales.'],
  youth:['Juveniles','Táctica exclusiva para jugadores de hasta 18 años que no estén en el XI principal.'],
  needs:['Qué comprar','Una sola recomendación de compra, con mínimos claros de ManagerZone.'],
  market:['Jugadores a comprar','Compara candidatos reales contra tu XI y decide cuáles sí mejoran el equipo.']
};
const VIEW_RENDERERS = Object.create(null);
const RESET_HANDLERS = new Set();

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const clamp = (n,min,max) => MZEngine.clamp(n,min,max);
const r1 = n => Math.round((Number(n)||0)*10)/10;
const r2 = n => Math.round((Number(n)||0)*100)/100;
const fmtUSD = n => new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n)||0);
const cleanMarkdown = s => String(s||'').replace(/\[\*\*(.*?)\*\*\]\([^)]*\)/g,'$1').replace(/\*\*/g,'').replace(/&nbsp;/g,' ').replace(/\u00a0/g,' ').trim();
const numberFrom = s => Number(String(s||'').replace(/[^0-9.-]/g,''))||0;
const escapeHtml = s => String(s??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));

function registerView(name, meta, renderer) {
  if (meta) VIEW_META[name] = meta;
  if (typeof renderer === 'function') VIEW_RENDERERS[name] = renderer;
}
function registerResetHandler(handler) { if (typeof handler === 'function') RESET_HANDLERS.add(handler); }
function notifyMainLineupChanged(reason='edit') {
  document.dispatchEvent(new CustomEvent('mz:main-lineup-changed',{detail:{formation:selectedFormation,reason,lineup:getActiveMainLineup()}}));
}
function notifyRosterChanged() { document.dispatchEvent(new CustomEvent('mz:roster-changed',{detail:{count:players.length}})); }

function ratePlayer(p){ return MZEngine.ratePlayer(p); }
function normalizePlayer(p){
  ATTRS.forEach(k=>p[k]=clamp(Number(p[k])||0,0,10));
  p.age=Number(p.age)||0;p.value=Number(p.value)||0;p.salary=Number(p.salary)||0;p.temp=Number(p.temp)||0;
  p.uid=p.uid||`${p.id||''}-${p.name}`;
  p.ratings=ratePlayer(p);
  return p;
}
function dedupePlayers(arr){
  const seen=new Set();
  return (arr||[]).filter(p=>{if(!p?.name)return false;const id=String(p.id||'').trim();const key=id?`id:${id}`:`name:${p.name.trim().toLowerCase()}`;if(seen.has(key))return false;seen.add(key);return true;});
}

function parseRoster(text){
  const raw=String(text||'').trim();if(!raw)return [];
  const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),result=[];
  for(const line of lines){
    if(!line.includes('|'))continue;
    const cols=line.split('|').map(cleanMarkdown).filter((v,i,arr)=>!(i===0&&v==='')&&!(i===arr.length-1&&v===''));
    if(cols.length<19||!/^\d+$/.test(cols[0]))continue;
    const p={id:cols[0],name:cols[1],value:numberFrom(cols[2]),salary:numberFrom(cols[3]),age:numberFrom(cols[4]),temp:numberFrom(cols[5]),ve:numberFrom(cols[6]),res:numberFrom(cols[7]),intel:numberFrom(cols[8]),pa:numberFrom(cols[9]),rem:numberFrom(cols[10]),ca:numberFrom(cols[11]),at:numberFrom(cols[12]),ctrl:numberFrom(cols[13]),en:numberFrom(cols[14]),pl:numberFrom(cols[15]),bp:numberFrom(cols[16]),exp:numberFrom(cols[17]),ef:numberFrom(cols[18])};
    if(p.name)result.push(normalizePlayer(p));
  }
  return dedupePlayers(result);
}

function savePlayers(){localStorage.setItem(STORAGE_KEY,JSON.stringify(players));}
function loadPlayers(){try{return (JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')||[]).map(normalizePlayer);}catch{return [];}}
function bestAssignment(slots,roster=players){return MZEngine.bestAssignment(slots,roster);}
function bestPartialAssignment(slots,roster=players){return MZEngine.bestPartialAssignment(slots,roster);}
function tacticScore(slots,lineup){return MZEngine.tacticScore(slots,lineup);}
function roleRating(player,role){return MZEngine.roleRating(player,role);}

function compareFormations(){
  formationResults=MZEngine.compareFormations(FORMATIONS,players);
  return formationResults;
}
function getFormationResult(name){return formationResults.find(result=>result.name===name)||null;}
function resolveStateLineup(state){return state?.players?.map(uid=>players.find(p=>p.uid===uid)||null)||[];}
function getMainLineup(name=selectedFormation){
  const saved=lineupStates[name];
  if(saved)return resolveStateLineup(saved);
  return getFormationResult(name)?.lineup?.slice()||[];
}
function getActiveMainLineup(){return getMainLineup(selectedFormation);}

function averageRole(role,formationName=selectedFormation){
  if(!players.length)return 0;
  const required=Math.max(1,(FORMATIONS[formationName]||[]).filter(slot=>slot.role===role).length);
  const top=players.map(p=>roleRating(p,role)).sort((a,b)=>b-a).slice(0,Math.min(required,players.length));
  return top.length?top.reduce((a,b)=>a+b,0)/top.length:0;
}
function roleNeed(formationName=selectedFormation){
  return MZEngine.ROLES.map(role=>({role,score:averageRole(role,formationName)})).sort((a,b)=>a.score-b.score)[0]||{role:'—',score:0};
}
function ratingClass(n){return n>=7?'rating-high':n>=5?'rating-mid':'rating-low';}

function resetLineupStates(){lineupStates=Object.create(null);currentLineup=null;}
function setFormation(name,forceBest=false){
  if(!FORMATIONS[name])return;
  selectedFormation=name;
  const result=getFormationResult(name);
  if(forceBest||!lineupStates[name])lineupStates[name]={formation:name,players:(result?.lineup||[]).map(p=>p?.uid||null)};
  currentLineup=lineupStates[name];
  renderTactics();
  notifyMainLineupChanged(forceBest?'restore':'formation');
}
function resolveLineup(){return currentLineup?.formation===selectedFormation?resolveStateLineup(currentLineup):getMainLineup(selectedFormation);}

function renderAll(){
  players=players.map(normalizePlayer);
  $('#player-count').textContent=players.length;
  compareFormations();
  renderDashboard();renderSquad();renderTactics();
  const active=$('.view.active')?.id?.replace('view-','');
  if(active&&VIEW_RENDERERS[active])VIEW_RENDERERS[active]();
}

function renderDashboard(){
  if(!players.length){
    $('#best-formation-name').textContent='Sin plantilla';$('#best-formation-reason').textContent='Carga tu plantilla para comparar formaciones automáticamente.';
    $('#best-formation-score').textContent='—';$('#best-formation-score').classList.add('muted');
    $('#metric-best-player').textContent='—';$('#metric-best-player-detail').textContent='Sin datos';$('#metric-need').textContent='—';$('#metric-need-detail').textContent='Sin datos';
    $('#metric-value').textContent='$0';$('#metric-value-detail').textContent='0 jugadores';$('#formation-ranking').className='formation-ranking empty-state';$('#formation-ranking').textContent='Carga la plantilla para generar el ranking.';
    $('#line-strengths').className='strength-list empty-state';$('#line-strengths').textContent='Todavía no hay jugadores analizados.';return;
  }
  const best=formationResults[0],second=formationResults[1];
  $('#best-formation-name').textContent=best.name;
  const visibleTie=second&&best.score?.toFixed(2)===second.score?.toFixed(2);
  $('#best-formation-reason').textContent=visibleTie?'Es la mejor estructura tras aplicar el desempate interno por punto débil, equilibrio y banco.':'Es la estructura que mejor aprovecha a tu plantilla actual con precisión interna completa.';
  $('#best-formation-score').textContent=best.score.toFixed(2);$('#best-formation-score').classList.remove('muted');
  $('#hero-action').textContent='Preparar táctica';$('#hero-action').dataset.go='tactics';
  const bestP=[...players].sort((a,b)=>b.ratings.bestScore-a.ratings.bestScore)[0];
  $('#metric-best-player').textContent=bestP.name;$('#metric-best-player-detail').textContent=`${bestP.ratings.bestRole} · ${bestP.ratings.bestScore.toFixed(1)}/10`;
  const need=roleNeed(best.name);$('#metric-need').textContent=ROLE_LABELS[need.role]||need.role;$('#metric-need-detail').textContent=`Fortaleza actual ${need.score.toFixed(1)}/10`;
  const total=players.reduce((s,p)=>s+p.value,0);$('#metric-value').textContent=fmtUSD(total);$('#metric-value-detail').textContent=`${players.length} jugadores`;
  $('#formation-ranking').className='formation-ranking';
  $('#formation-ranking').innerHTML=formationResults.map((f,i)=>`<div class="formation-row"><b>${i+1}. ${f.name}</b><div class="bar"><span style="width:${Math.max(0,Math.min(100,f.score*10))}%"></span></div><strong>${f.score.toFixed(2)}</strong></div>`).join('');
  $('#line-strengths').className='strength-list';
  $('#line-strengths').innerHTML=MZEngine.ROLES.map(role=>{const score=averageRole(role,best.name),top=[...players].sort((a,b)=>roleRating(b,role)-roleRating(a,role))[0];return `<div class="strength-item"><span class="role">${role}</span><div class="bar"><span style="width:${score*10}%"></span></div><strong>${score.toFixed(1)}</strong><small>Mejor: ${escapeHtml(top.name)} ${roleRating(top,role).toFixed(1)}</small></div>`;}).join('');
}

function renderSquad(){
  const tbody=$('#players-body'),empty=$('#squad-empty');if(!tbody||!empty)return;
  if(!players.length){tbody.innerHTML='';empty.style.display='grid';return;}empty.style.display='none';
  const q=($('#player-search').value||'').toLowerCase(),rf=$('#role-filter').value;
  const list=players.filter(p=>(!q||p.name.toLowerCase().includes(q))&&(rf==='ALL'||p.ratings.bestRole===rf)).sort((a,b)=>b.ratings.bestScore-a.ratings.bestScore);
  tbody.innerHTML=list.map(p=>`<tr data-player="${encodeURIComponent(p.uid)}"><td><span class="player-name">${escapeHtml(p.name)}</span><span class="player-sub">Sueldo ${fmtUSD(p.salary)}</span></td><td>${p.age}</td><td>${fmtUSD(p.value)}</td>${MZEngine.ROLES.map(role=>`<td class="rating-cell ${ratingClass(roleRating(p,role))}">${roleRating(p,role).toFixed(1)}</td>`).join('')}<td><span class="role-badge">${p.ratings.bestRole} · ${p.ratings.bestScore.toFixed(1)}</span></td></tr>`).join('');
  tbody.querySelectorAll('tr').forEach(tr=>tr.addEventListener('click',()=>openPlayer(decodeURIComponent(tr.dataset.player))));
}

function renderTactics(){
  const list=$('#formation-list');if(!list)return;
  if(!players.length){list.innerHTML='<div class="empty-state">Sin plantilla.</div>';$('#current-tactic-score').textContent='—';$('#pitch-slots').innerHTML='';$('#bench-list').innerHTML='<div class="empty-state">Sin suplentes.</div>';$('#pitch-formation-title').textContent='—';return;}
  if(!FORMATIONS[selectedFormation])selectedFormation=formationResults[0].name;
  if(!lineupStates[selectedFormation]){const result=getFormationResult(selectedFormation);lineupStates[selectedFormation]={formation:selectedFormation,players:(result?.lineup||[]).map(p=>p?.uid||null)};}
  currentLineup=lineupStates[selectedFormation];
  list.innerHTML=formationResults.map(f=>`<button class="formation-btn ${f.name===selectedFormation?'active':''}" data-formation="${f.name}"><span>${f.name}</span><strong>${f.score.toFixed(2)}</strong></button>`).join('');
  list.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>setFormation(button.dataset.formation,false)));
  const slots=FORMATIONS[selectedFormation],lineup=resolveLineup(),score=tacticScore(slots,lineup);
  $('#pitch-formation-title').textContent=selectedFormation;$('#current-tactic-score').textContent=Number.isFinite(score)?`${score.toFixed(2)} / 10`:'— / 10';
  const weak=lineup.map((p,i)=>({p,role:slots[i].role,score:p?roleRating(p,slots[i].role):0})).sort((a,b)=>a.score-b.score)[0];
  $('#current-tactic-explanation').textContent=weak?.p?`Punto más débil: ${weak.p.name} como ${weak.role} (${weak.score.toFixed(1)}).`:'Faltan jugadores.';
  renderPitch(slots,lineup);renderBench(lineup);
}

function renderPitch(slots,lineup){
  const wrap=$('#pitch-slots');if(!wrap)return;
  wrap.innerHTML=slots.map((slot,i)=>{const p=lineup[i],rate=p?roleRating(p,slot.role):0;return `<div class="slot" draggable="${!!p}" data-slot="${i}" style="left:${slot.x}%;top:${slot.y}%"><div class="slot-role">${slot.role}</div><div class="slot-player">${p?escapeHtml(p.name):'Vacío'}</div><div class="slot-rating">${p?rate.toFixed(1):'—'}<small>${p?'/10':''}</small></div></div>`;}).join('');
}
function renderBench(lineup){
  const wrap=$('#bench-list');if(!wrap)return;
  const used=new Set(lineup.filter(Boolean).map(p=>p.uid)),remaining=players.filter(p=>!used.has(p.uid)),bench=MZEngine.selectBench(remaining);
  wrap.innerHTML=bench.length?bench.map((x,i)=>`<div class="bench-item"><span class="bench-role">${i+1} · ${x.role}</span><strong>${escapeHtml(x.player.name)}</strong><span>${x.score.toFixed(1)}/10</span></div>`).join(''):'<div class="empty-state">No quedan jugadores suficientes.</div>';
}

function openPlayer(uid){
  const p=players.find(x=>x.uid===uid);if(!p)return;
  const strengths=ATTRS.filter(k=>k!=='ef').sort((a,b)=>p[b]-p[a]).slice(0,3).map(k=>`${ATTR_LABELS[k]} ${p[k]}`).join(' · ');
  const dominant={POR:`Atajando ${p.at}`,DEF:`Entradas ${p.en}`,VOL:`Pases ${p.pa} · equilibrio ${p.ratings.balance.toFixed(1)}/10`,DEL:`Remates ${p.rem}`}[p.ratings.bestRole];
  $('#modal-content').innerHTML=`<div class="player-modal-head"><div><span class="eyebrow">PERFIL INTELIGENTE</span><h2>${escapeHtml(p.name)}</h2><p>${p.age} años · ${fmtUSD(p.value)} · sueldo ${fmtUSD(p.salary)}</p></div><div class="modal-best">${p.ratings.bestRole} ${p.ratings.bestScore.toFixed(1)}/10</div></div><div class="modal-ratings">${MZEngine.ROLES.map(role=>`<div class="modal-rating"><span>${role}</span><strong class="${ratingClass(roleRating(p,role))}">${roleRating(p,role).toFixed(1)}</strong></div>`).join('')}</div><div class="skills-grid">${ATTRS.map(k=>`<div class="skill"><span>${ATTR_LABELS[k]}</span><b>${p[k]}</b></div>`).join('')}</div><div class="modal-analysis"><h4>Lectura rápida</h4><p>Mejor rol: <b>${ROLE_LABELS[p.ratings.bestRole]}</b>. Factor clave: ${dominant}. Sus atributos más altos son ${strengths}.</p></div>`;
  $('#player-modal').classList.remove('hidden');
}

function switchView(name){
  const target=$(`#view-${name}`);if(!target)return;
  $$('.view').forEach(v=>v.classList.toggle('active',v===target));$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  const meta=VIEW_META[name]||[name,''];$('#page-title').textContent=meta[0];$('#page-subtitle').textContent=meta[1];
  if(name==='tactics')renderTactics();
  if(VIEW_RENDERERS[name])VIEW_RENDERERS[name]();
}

function installEvents(){
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));$$('[data-go]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.go)));
  $('#analyze-btn').addEventListener('click',()=>{const parsed=parseRoster($('#roster-input').value),msg=$('#import-message');if(!parsed.length){msg.textContent='No pude detectar filas de jugadores. Revisa que hayas pegado la tabla completa.';msg.className='import-message error';return;}players=parsed;savePlayers();resetLineupStates();compareFormations();selectedFormation=formationResults[0]?.name||'4-3-3';setFormation(selectedFormation,true);renderAll();notifyRosterChanged();msg.textContent=`${players.length} jugadores detectados y analizados.`;msg.className='import-message ok';switchView('squad');});
  $('#clear-input-btn').addEventListener('click',()=>{$('#roster-input').value='';$('#import-message').textContent='';});$('#load-demo-btn').addEventListener('click',()=>{$('#roster-input').value=DEMO_DATA;});
  $('#player-search').addEventListener('input',renderSquad);$('#role-filter').addEventListener('change',renderSquad);$('#reset-lineup-btn').addEventListener('click',()=>setFormation(selectedFormation,true));
  $('#modal-close').addEventListener('click',()=>$('#player-modal').classList.add('hidden'));$('#player-modal').addEventListener('click',e=>{if(e.target.id==='player-modal')$('#player-modal').classList.add('hidden');});
  $('#reset-btn').addEventListener('click',()=>{if(!confirm('¿Borrar la plantilla guardada y reiniciar la app?'))return;localStorage.removeItem(STORAGE_KEY);players=[];resetLineupStates();formationResults=[];selectedFormation='4-3-3';delete window.MZMarketTarget;RESET_HANDLERS.forEach(handler=>{try{handler();}catch(error){console.error(error);}});renderAll();document.dispatchEvent(new CustomEvent('mz:reset'));switchView('import');});
}

const DEMO_DATA=`| N° | Nombre | Valor | Sueldo | Edad | Temp | Ve | Res | In | Pa | Rem | Ca | At | Ctrl | En | PL | BP | Exp | EF |
| 1 | Félix Ozaolaza | 783624 USD | 12573 USD | 22 | 77 | 8 | 7 | 1 | 5 | 2 | 1 | 1 | 6 | 8 | 10 | 0 | 5 | 7 |
| 2 | Humberto Andrino | 564546 USD | 9344 USD | 22 | 77 | 8 | 8 | 1 | 3 | 2 | 0 | 1 | 4 | 7 | 7 | 3 | 5 | 7 |
| 3 | Nestor Carmona | 539268 USD | 10031 USD | 25 | 74 | 7 | 8 | 8 | 2 | 1 | 4 | 1 | 3 | 7 | 6 | 1 | 8 | 7 |
| 4 | Luis Ansola | 1230205 USD | 18687 USD | 32 | 67 | 6 | 7 | 9 | 10 | 7 | 1 | 1 | 10 | 4 | 1 | 1 | 10 | 7 |
| 5 | Insua Arambula | 1011127 USD | 14497 USD | 35 | 64 | 6 | 6 | 9 | 6 | 8 | 8 | 1 | 6 | 7 | 1 | 0 | 10 | 7 |
| 6 | Arévalo Gayo | 421303 USD | 5565 USD | 19 | 80 | 7 | 7 | 2 | 0 | 2 | 1 | 6 | 1 | 0 | 1 | 1 | 2 | 7 |
| 7 | Darío Lope | 379173 USD | 6184 USD | 19 | 80 | 6 | 9 | 2 | 1 | 1 | 2 | 3 | 5 | 5 | 1 | 2 | 2 | 7 |
| 8 | Evelio Fajardo | 808902 USD | 9481 USD | 19 | 80 | 5 | 6 | 2 | 8 | 0 | 2 | 2 | 7 | 7 | 2 | 0 | 2 | 7 |
| 9 | Quiróz Marentos | 657233 USD | 9825 USD | 19 | 80 | 8 | 6 | 1 | 0 | 7 | 5 | 1 | 8 | 2 | 1 | 2 | 2 | 7 |
| 10 | Espinosa Rosello | 766772 USD | 11748 USD | 19 | 80 | 7 | 8 | 1 | 3 | 2 | 0 | 1 | 8 | 9 | 2 | 1 | 2 | 7 |
| 11 | Francisco Queiruga | 513990 USD | 7832 USD | 19 | 80 | 7 | 7 | 1 | 8 | 0 | 0 | 1 | 1 | 6 | 2 | 1 | 2 | 7 |
| 12 | Perez Pala | 488712 USD | 7008 USD | 19 | 80 | 6 | 8 | 2 | 6 | 2 | 1 | 1 | 4 | 6 | 2 | 2 | 2 | 7 |
| 13 | Zeledon Abello | 581398 USD | 9069 USD | 19 | 80 | 8 | 6 | 1 | 8 | 1 | 0 | 3 | 2 | 6 | 4 | 1 | 2 | 7 |
| 14 | Rogelio Fole | 648807 USD | 10237 USD | 19 | 80 | 6 | 7 | 1 | 8 | 3 | 1 | 3 | 8 | 1 | 2 | 2 | 2 | 7 |
| 15 | Antonio Marote | 387599 USD | 5153 USD | 19 | 80 | 7 | 5 | 2 | 2 | 1 | 0 | 1 | 6 | 6 | 2 | 1 | 2 | 7 |
| 16 | Zenaido Feliu | 353895 USD | 6321 USD | 19 | 80 | 7 | 6 | 2 | 4 | 1 | 1 | 1 | 6 | 1 | 7 | 1 | 2 | 7 |
| 17 | Timoteo Casares | 438156 USD | 5497 USD | 19 | 80 | 7 | 5 | 0 | 2 | 7 | 1 | 0 | 5 | 1 | 1 | 2 | 2 | 7 |
| 18 | Vincent Hervias | 404451 USD | 7901 USD | 19 | 80 | 8 | 9 | 1 | 2 | 0 | 1 | 1 | 6 | 1 | 7 | 0 | 2 | 7 |
| 19 | Adolfo Arce | 252782 USD | 4397 USD | 19 | 80 | 6 | 6 | 1 | 1 | 1 | 2 | 2 | 5 | 4 | 1 | 2 | 2 | 7 |
| 20 | Roman Villela | 320191 USD | 4810 USD | 19 | 80 | 4 | 5 | 1 | 5 | 1 | 0 | 2 | 5 | 1 | 7 | 2 | 2 | 7 |`;

installEvents();renderAll();
if(players.length){selectedFormation=formationResults[0]?.name||selectedFormation;setFormation(selectedFormation,true);}