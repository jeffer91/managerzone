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
