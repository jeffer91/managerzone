(() => {
'use strict';
if(!window.MZEngine?.analyzeTeam)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={positional:'Puestos',cohesion:'Cohesión',connection:'Conexión',attack:'Ataque',defense:'Defensa'};

function ensureStyles(){
 if(document.getElementById('team-engine-styles'))return;
 const s=document.createElement('style');s.id='team-engine-styles';s.textContent=`
 .team-engine-panel{margin-top:14px}.team-score-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:10px}.team-score-item{padding:10px;border:1px solid #203629;border-radius:9px;background:#08140d}.team-score-item span{display:block;color:#789080;font-size:8px;text-transform:uppercase;font-weight:900}.team-score-item strong{display:block;margin-top:4px;font-size:16px;color:#eef7f0}.team-score-item i{display:block;height:5px;margin-top:6px;border-radius:99px;background:#16261b;overflow:hidden}.team-score-item i:after{content:'';display:block;height:100%;width:var(--v);background:var(--green);border-radius:99px}.team-plan-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.team-plan{padding:11px;border:1px solid #203629;border-radius:9px;background:#08140d}.team-plan span{display:block;color:#78a283;font-size:8px;font-weight:900;text-transform:uppercase}.team-plan p{margin:5px 0 0;color:#d7e5da;font-size:10px;line-height:1.45}.team-diagnostics{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.team-diagnostics div{padding:10px;border-radius:9px;border:1px solid #203629;background:#08140d}.team-diagnostics b{font-size:9px;color:#eef7f0}.team-diagnostics ul{margin:6px 0 0;padding-left:15px;color:#9db0a1;font-size:9px;line-height:1.45}.team-diagnostics .warn b{color:#ffd166}.formation-row small.team-mini{display:block;color:#789080;font-size:7.5px;margin-top:2px}
 @media(max-width:900px){.team-score-grid{grid-template-columns:1fr 1fr}.team-plan-grid,.team-diagnostics{grid-template-columns:1fr}}`;
 document.head.appendChild(s);
}
function analysisForCurrent(){
 if(typeof FORMATIONS==='undefined'||typeof selectedFormation==='undefined'||typeof resolveLineup!=='function')return null;
 const slots=FORMATIONS[selectedFormation],lineup=resolveLineup();if(!slots||!lineup||lineup.some(p=>!p))return null;
 return MZEngine.analyzeTeam(slots,lineup);
}
function renderTeamPanel(){
 const view=document.getElementById('view-tactics');if(!view)return;view.querySelector('.team-engine-panel')?.remove();const a=analysisForCurrent();if(!a)return;
 const panel=document.createElement('article');panel.className='panel team-engine-panel';
 const metrics=Object.entries(a.components).map(([k,v])=>`<div class="team-score-item"><span>${labels[k]||k}</span><strong>${v.toFixed(1)}</strong><i style="--v:${Math.max(0,Math.min(100,v*10))}%"></i></div>`).join('');
 const strengths=(a.strengths||[]).slice(0,4),warnings=(a.warnings||[]).slice(0,4);
 panel.innerHTML=`<div class="panel-head"><div><span class="eyebrow">MOTOR DE EQUIPO</span><h3>Cómo funciona esta táctica</h3></div><strong>${a.score.toFixed(2)} / 10</strong></div><div class="team-score-grid">${metrics}</div><div class="team-plan-grid"><div class="team-plan"><span>Cómo atacar</span><p>${esc(a.attackPlan)}</p></div><div class="team-plan"><span>Cómo defender</span><p>${esc(a.defensePlan)}</p></div></div><div class="team-diagnostics"><div><b>Lo que funciona</b><ul>${strengths.length?strengths.map(x=>`<li>${esc(x)}</li>`).join(''):'<li>Sin una ventaja estructural clara.</li>'}</ul></div><div class="warn"><b>Riesgos</b><ul>${warnings.length?warnings.map(x=>`<li>${esc(x)}</li>`).join(''):'<li>No se detectan riesgos estructurales importantes.</li>'}</ul></div></div>`;
 view.appendChild(panel);
}
function patchDashboard(){
 if(typeof formationResults==='undefined'||!formationResults.length)return;const best=formationResults[0],a=best.analysis;if(!a)return;
 const reason=document.getElementById('best-formation-reason');if(reason){const good=a.strengths?.[0],risk=a.warnings?.[0];reason.textContent=good?(risk?`${good} Riesgo principal: ${risk}`:good):'Es la estructura que mejor conecta tus líneas.';}
 const rows=[...document.querySelectorAll('#formation-ranking .formation-row')];rows.forEach((row,i)=>{row.querySelector('.team-mini')?.remove();const r=formationResults[i];if(!r?.analysis)return;const small=document.createElement('small');small.className='team-mini';small.textContent=`Coh ${r.analysis.components.cohesion.toFixed(1)} · Con ${r.analysis.components.connection.toFixed(1)} · At ${r.analysis.components.attack.toFixed(1)} · Def ${r.analysis.components.defense.toFixed(1)}`;row.appendChild(small);});
}
ensureStyles();
const note=document.querySelector('.sidebar-note');if(note)note.innerHTML='<small>Motor de equipo</small><p><b>Puestos + cohesión + conexión + ataque + defensa.</b></p>';
if(typeof renderDashboard==='function'){const prev=renderDashboard;renderDashboard=function renderDashboardTeam(){prev();patchDashboard();};}
if(typeof renderTactics==='function'){const prev=renderTactics;renderTactics=function renderTacticsTeam(){prev();renderTeamPanel();};}
document.addEventListener('mz:main-lineup-changed',()=>setTimeout(()=>{renderTeamPanel();patchDashboard();},0));
document.addEventListener('mz:roster-changed',()=>setTimeout(()=>{renderTeamPanel();patchDashboard();},0));
setTimeout(()=>{patchDashboard();renderTeamPanel();},0);
window.MZTeamUI={renderTeamPanel,patchDashboard};
})();