(() => {
  'use strict';
  if (!window.MZEngine || !window.MZBoard) return;

  function decorate(wrap, slots, lineup) {
    if (!wrap) return;
    [...wrap.querySelectorAll('.slot')].forEach((element, index) => {
      const slot = slots[index];
      const player = lineup[index];
      if (!slot) return;
      const rate = player ? MZEngine.slotRating(player, slot, slots) : 0;
      const code = MZEngine.slotCode(slot, slots);
      const label = MZEngine.slotLabel(slot, slots);
      const pos = element.querySelector('.slot-pos');
      const value = element.querySelector('.slot-rating-value');
      const quality = element.querySelector('.slot-quality');
      if (pos) pos.textContent = code;
      if (value) value.textContent = player ? rate.toFixed(1) : '—';
      if (quality && player) quality.textContent = rate >= 7 ? 'FUERTE' : rate >= 5 ? 'MEDIA' : 'DÉBIL';
      element.classList.remove('rating-high','rating-mid','rating-low');
      if (player) element.classList.add(ratingClass(rate));
      element.title = player ? `${player.name} · ${label} · ${rate.toFixed(1)}/10` : label;
    });
  }

  const basePitch = renderPitch;
  renderPitch = function slotAwarePitch(slots, lineup) {
    basePitch(slots, lineup);
    decorate($('#pitch-slots'), slots, lineup);
  };

  const baseBoard = window.MZBoard.renderBoard;
  window.MZBoard.renderBoard = function slotAwareBoard(wrap, slots, lineup, options) {
    baseBoard(wrap, slots, lineup, options);
    decorate(wrap, slots, lineup);
  };

  window.MZSlotUI = { decorate };
  if (typeof renderTactics === 'function') renderTactics();
})();
