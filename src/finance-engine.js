(function(root,factory){
'use strict';
const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MZFinanceEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const n=v=>Number(v)||0;
const pct=v=>Math.max(0,Math.min(999,Math.round((Number(v)||0)*10)/10));
function median(values){const a=(values||[]).map(n).sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function saleCandidates(players,lineup=[]){
 const list=(players||[]).filter(Boolean),starters=new Set((lineup||[]).filter(Boolean).map(p=>p.uid)),med=median(list.map(p=>p.salary)),avg=list.length?list.reduce((s,p)=>s+n(p.ratings?.bestScore),0)/list.length:0;
 return list.filter(p=>!starters.has(p.uid)&&n(p.salary)>=med&&n(p.ratings?.bestScore)<=avg+.25).map(p=>({uid:p.uid,name:p.name,role:p.ratings?.bestRole||'—',rating:n(p.ratings?.bestScore),salary:n(p.salary),value:n(p.value),age:n(p.age),reason:'Suplente con sueldo relevante y aporte por debajo del promedio de la plantilla.'})).sort((a,b)=>b.salary-a.salary||a.rating-b.rating).slice(0,3);
}
function analyze(report,context={}){
 const income=n(report?.income?.total),expenses=n(report?.expenses?.total),accounting=report?.accountingResult==null?income-expenses:n(report.accountingResult),d=report?.income?.details||{},weekly=n(report?.weeklyCosts?.total)||[report?.weeklyCosts?.players,report?.weeklyCosts?.employees,report?.weeklyCosts?.stadium,report?.weeklyCosts?.facilities,report?.weeklyCosts?.youth].reduce((s,v)=>s+n(v),0),extra=n(d.achievementReward)+n(d.playerSales),ordinary=Math.max(0,income-extra),operating=ordinary-weekly,salaries=n(report?.weeklyCosts?.players),salaryShare=weekly?salaries/weekly:0,extraShare=income?extra/income:0,coverage=weekly?ordinary/weekly:0;
 const rosterSalary=(context.players||[]).reduce((s,p)=>s+n(p.salary),0),salaryDelta=salaries?rosterSalary-salaries:null,reserveWeeks=Math.max(1,n(context.reserveWeeks)||4),balance=context.availableBalance==null?null:n(context.availableBalance),reserve=weekly*reserveWeeks,safeBudget=balance==null?null:Math.max(0,balance-reserve);
 let status='Sin datos suficientes';if(income||expenses||weekly){if(accounting<0)status='Semana en pérdida';else if(operating<0)status='Semana positiva, operación deficitaria';else status='Operación sostenible';}
 const recommendations=[];
 if(extraShare>=.5)recommendations.push({level:'warn',title:'No tomes esta semana como ingreso normal',text:`El ${pct(extraShare*100)}% de los ingresos provino de conceptos extraordinarios.`});
 if(operating<0)recommendations.push({level:'danger',title:'No aumentes gastos fijos todavía',text:`Los ingresos ordinarios no cubren el gasto semanal. Déficit operativo estimado: ${Math.abs(operating)} USD.`});
 else if(weekly)recommendations.push({level:'good',title:'La operación cubre el gasto semanal',text:`Los ingresos ordinarios cubren el ${pct(coverage*100)}% de los gastos recurrentes.`});
 if(salaryShare>=.7)recommendations.push({level:'info',title:'La plantilla es tu principal gasto',text:`Los sueldos de jugadores representan el ${pct(salaryShare*100)}% del gasto semanal.`});
 if(salaryDelta!=null&&Math.abs(salaryDelta)>Math.max(1000,salaries*.02))recommendations.push({level:'warn',title:'Actualiza la plantilla',text:`Los sueldos importados difieren en ${Math.abs(Math.round(salaryDelta))} USD respecto al reporte financiero.`});
 const friendlies=report?.matches?.friendliesHome;if(friendlies?.maximum!=null&&friendlies.current<friendlies.maximum)recommendations.push({level:'info',title:'Hay cupos de amistosos locales sin usar',text:`Esta semana registras ${friendlies.current}/${friendlies.maximum}. La app no estima ingreso hasta tener historial suficiente.`});
 if(safeBudget!=null)recommendations.push({level:safeBudget>0?'good':'warn',title:safeBudget>0?'Presupuesto financiero disponible':'Protege tu caja',text:safeBudget>0?`Con una reserva de ${reserveWeeks} semanas, el máximo financiero es ${Math.round(safeBudget)} USD.`:`El saldo no cubre una reserva de ${reserveWeeks} semanas de gastos.`});
 return{status,accountingResult:accounting,ordinaryIncome:ordinary,extraordinaryIncome:extra,operatingResult:operating,weeklyCost:weekly,salaryCost:salaries,salaryShare,extraordinaryShare:extraShare,ordinaryCoverage:coverage,rosterSalary,salaryDelta,reserveWeeks,reserve,safeBudget,saleCandidates:saleCandidates(context.players,context.lineup),recommendations};
}
return{median,saleCandidates,analyze};
});