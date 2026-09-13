(()=>{
'use strict';
if(!window.MZFinanceParser||!window.MZFinanceEngine)throw new Error('Finance modules missing');

const HK='mz_tactical_lab_finance_v1';
const SK='mz_tactical_lab_finance_market_snapshot_v1';
const RK='mz_tactical_lab_finance_reserve_weeks_v1';
let preview=null;
let notice='';
let noticeClass='';

const usd=n=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n)||0);
const sign=n=>(Number(n)>=0?'+':'−')+usd(Math.abs(Number(n)||0));
const esc=s=>String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

function read(k,d){try{return JSON.parse(localStorage.getItem(k)||'null')??d}catch{return d}}
function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
function hist(){return read(HK,[])}
function snap(){return read(SK,null)}
function weeks(){return Number(localStorage.getItem(RK))||4}
function latest(){return hist().slice().sort((a,b)=>b.savedAt-a.savedAt)[0]||null}
function snapshotState(){return MZFinanceEngine.snapshotStatus(snap())}
function ctx(state=snapshotState()){
 return{players:typeof players==='undefined'?[]:players,lineup:typeof getActiveMainLineup==='function'?getActiveMainLineup():[],availableBalance:state.fresh?state.balance:null,reserveWeeks:weeks()};
}
function metric(a,b,c){return`<div class="fin-metric"><span>${a}</span><b>${b}</b><small>${c}</small></div>`}
function snapshotAgeText(state){
 if(!state.hasBalance||!state.capturedAt)return'';
 const hours=Math.floor(state.ageMs/(60*60*1000));
 if(hours<1)return'actualizado hace menos de 1 h';
 if(hours<24)return`actualizado hace ${hours} h`;
 return`actualizado hace ${Math.floor(hours/24)} d`;
}
function summary(){
 const e=latest();if(!e)return'<div class="panel fin-empty">Pega tu primer reporte financiero para empezar.</div>';
 const state=snapshotState(),a=MZFinanceEngine.analyze(e.report,ctx(state));
 const extra=state.stale?[{level:'warn',title:'Actualiza el saldo disponible',text:'El último saldo guardado tiene más de 24 horas y no se usa para calcular el presupuesto seguro.'}]:[];
 const recs=[...extra,...a.recommendations].slice(0,4).map(r=>`<div class="fin-rec ${r.level}"><b>${esc(r.title)}</b><span>${esc(r.text)}</span></div>`).join('');
 const sales=a.saleCandidates.map(p=>`<div class="fin-player"><span><b>${esc(p.name)}</b><small>${p.role} · ${p.rating.toFixed(1)}/10</small></span><strong>${usd(p.salary)}/sem</strong></div>`).join('')||'<div class="fin-muted">Sin candidatos claros a venta.</div>';
 const budgetDetail=state.stale?'Saldo desactualizado':a.safeBudget==null?'Pega saldo del mercado':`Reserva ${a.reserveWeeks} semanas`;
 const snapshotNote=state.hasBalance?`<div class="fin-snapshot-note ${state.stale?'stale':''}">Saldo guardado: <b>${usd(state.balance)}</b> · ${snapshotAgeText(state)}${state.stale?' · no se usa para el presupuesto':''}</div>`:'';
 return`<div class="fin-head"><div><span class="eyebrow">DIAGNÓSTICO</span><h2>${esc(a.status)}</h2></div><label>Reserva<select id="fin-weeks"><option ${weeks()===2?'selected':''}>2</option><option ${weeks()===4?'selected':''}>4</option><option ${weeks()===6?'selected':''}>6</option></select> semanas</label></div><div class="fin-metrics">${metric('Resultado semana',sign(a.accountingResult),'Contable')}${metric('Resultado operativo',sign(a.operatingResult),'Sin extraordinarios')}${metric('Gasto semanal',usd(a.weeklyCost),`Sueldos ${usd(a.salaryCost)}`)}${metric('Presupuesto seguro',a.safeBudget==null?'—':usd(a.safeBudget),budgetDetail)}</div>${snapshotNote}<div class="fin-grid"><article class="panel"><div class="panel-head"><div><span class="eyebrow">RECOMENDACIONES</span><h3>Qué hacer ahora</h3></div></div>${recs}</article><article class="panel"><div class="panel-head"><div><span class="eyebrow">PLANTILLA</span><h3>Control de salarios</h3></div></div><div class="fin-compare"><span>ManagerZone <b>${usd(a.salaryCost)}</b></span><span>Plantilla <b>${usd(a.rosterSalary)}</b></span></div>${sales}</article></div>`;
}
function importer(){return`<article class="panel fin-import"><div class="panel-head"><div><span class="eyebrow">PEGAR DATOS</span><h3>Economía de ManagerZone</h3></div><button id="fin-example" class="text-btn">Usar ejemplo</button></div><p class="help">Pega “Esta semana”. También puedes pegar una página del mercado para actualizar el saldo disponible.</p><textarea id="fin-input" placeholder="Pega aquí los datos..."></textarea><div class="fin-actions"><button id="fin-analyze" class="primary-btn">Analizar</button><button id="fin-save" class="ghost-btn" disabled>Guardar</button><span id="fin-msg" class="fin-message ${noticeClass}">${esc(notice)}</span></div><div id="fin-preview"></div></article>`}
function historyBox(){const h=hist().slice().sort((a,b)=>b.savedAt-a.savedAt).slice(0,5);if(!h.length)return'';return`<article class="panel"><div class="panel-head"><div><span class="eyebrow">HISTORIAL</span><h3>Últimos reportes</h3></div><button id="fin-clear" class="text-btn">Borrar</button></div>${h.map(x=>`<div class="fin-history"><span>${new Date(x.savedAt).toLocaleDateString('es-EC')}</span><b>${sign(x.report.accountingResult)}</b><small>Gasto ${usd(x.report.weeklyCosts.total)}</small></div>`).join('')}</article>`}
function render(){const v=document.getElementById('view-finance');if(!v)return;v.innerHTML=summary()+importer()+historyBox();wire()}
function analyze(){
 const raw=document.getElementById('fin-input').value,p=MZFinanceParser.parseFinanceReport(raw),m=window.MZMarketParser?MZMarketParser.parseSnapshot(raw):null;
 const financeReady=p.complete&&p.warnings.length===0,balanceReady=!!m?.hasAvailableBalance;preview={p,m,financeReady,balanceReady};
 const vals=[];if(p.report)vals.push(['Ingresos',p.report.income.total],['Gastos',p.report.expenses.total],['Gasto semanal',p.report.weeklyCosts.total]);if(balanceReady)vals.push(['Saldo',m.availableBalance]);
 const warnings=p.warnings.length?`<div class="fin-warning-list"><b>Revisa antes de guardar</b>${p.warnings.map(w=>`<span>${esc(w)}</span>`).join('')}</div>`:'';
 document.getElementById('fin-preview').innerHTML='<div class="fin-preview">'+vals.filter(x=>x[1]!=null).map(x=>`<span>${x[0]} <b>${usd(x[1])}</b></span>`).join('')+'</div>'+warnings;
 document.getElementById('fin-save').disabled=!(financeReady||balanceReady);
 const msg=document.getElementById('fin-msg');
 if(financeReady&&balanceReady){msg.textContent='Reporte completo y saldo listos para guardar.';msg.className='fin-message ok';}
 else if(financeReady){msg.textContent='Reporte completo y validado.';msg.className='fin-message ok';}
 else if(balanceReady){msg.textContent=p.warnings.length?'Saldo listo. El reporte financiero requiere revisión y no se guardará.':'Saldo listo para actualizar.';msg.className='fin-message warn';}
 else if(p.valid){msg.textContent='Reporte detectado con observaciones. Corrige los datos antes de guardar.';msg.className='fin-message warn';}
 else{msg.textContent='No se detectaron datos financieros completos.';msg.className='fin-message error';}
}
function save(){
 if(!preview)return;let savedBalance=false,savedReport=false,duplicate=false;
 if(preview.balanceReady){write(SK,preview.m);savedBalance=true;}
 if(preview.financeReady){const h=hist();if(h.some(x=>x.report.fingerprint===preview.p.report.fingerprint))duplicate=true;else{h.push({savedAt:Date.now(),report:preview.p.report});write(HK,h);savedReport=true;}}
 if(savedReport&&savedBalance){notice='Reporte financiero y saldo guardados.';noticeClass='ok';}
 else if(savedReport){notice='Reporte financiero guardado.';noticeClass='ok';}
 else if(savedBalance&&duplicate){notice='Saldo actualizado. Ese reporte financiero ya estaba guardado.';noticeClass='ok';}
 else if(savedBalance){notice='Saldo actualizado. El reporte financiero no se guardó porque requiere revisión.';noticeClass='warn';}
 else if(duplicate){notice='Ese reporte financiero ya estaba guardado.';noticeClass='warn';}
 preview=null;render();
}
function clearHistory(){if(!confirm('¿Borrar historial financiero?'))return;write(HK,[]);notice='Historial financiero borrado.';noticeClass='ok';render()}
function resetModule(){write(HK,[]);write(SK,null);localStorage.setItem(RK,'4');preview=null;notice='';noticeClass=''}
function wire(){
 document.getElementById('fin-analyze')?.addEventListener('click',analyze);
 document.getElementById('fin-save')?.addEventListener('click',save);
 document.getElementById('fin-weeks')?.addEventListener('change',e=>{localStorage.setItem(RK,e.target.value);render()});
 document.getElementById('fin-clear')?.addEventListener('click',clearHistory);
 document.getElementById('fin-example')?.addEventListener('click',()=>{document.getElementById('fin-input').value=EXAMPLE;analyze()});
}
const EXAMPLE='Ingresos 934 457 USD\nRecompensa de Logro 791 228 USD\nRecaudación por instalaciones 4 379 USD\nIngreso por venta de entradas 44 080 USD\nIngresos por espónsors 94 770 USD\nGastos 559 763 USD\nConstrucción del estadio 129 321 USD\nCompra de jugadores 184 124 USD\nGastos por instalaciones 1 185 USD\nGastos por el estadio 13 360 USD\nSueldos de jugadores 184 680 USD\nJuveniles 46 000 USD\nSueldos de empleados 1 093 USD\nCálculo de gastos semanales.\nSueldos de jugadores 184 680 USD\nSueldos de empleados 1 093 USD\nGastos por el estadio 13 680 USD\nGastos por instalaciones 1 422 USD\nJuveniles 46 000 USD\nTotal 246 875 USD\nPartidos generadores de ingresos\nPartidos locales de Liga Senior 1\nPartidos Amistosos de local 0 / 2';
registerView('finance',['Finanzas','Ingresos, gastos, salarios y presupuesto para fichajes.'],render);
registerResetHandler(resetModule);
document.addEventListener('mz:roster-changed',()=>{if(document.getElementById('view-finance')?.classList.contains('active'))render()});
window.MZFinance={render,history:hist,snapshot:snap,snapshotStatus:snapshotState,reset:resetModule};
})();
