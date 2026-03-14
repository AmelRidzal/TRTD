// ================================================================
//  hud.js
//  Owns all reads/writes to the HUD DOM elements.
//  Call refreshHUD() any time a state variable changes.
//  To add a new HUD stat: add a DOM element in index.html,
//  add a state variable in state.js, then update it here.
// ================================================================

/** Sync every HUD element to the current state variables. */
function refreshHUD() {
  const pct = Math.max(0, (hudHp / MAX_HP) * 100);
  document.getElementById('hp-bar').style.width    = pct + '%';
  document.getElementById('hp-val').textContent    = Math.floor(Math.max(0, hudHp));
  document.getElementById('wave-num').textContent  = hudWave;
  document.getElementById('score-val').textContent = hudScore;
  const _ptEl = document.getElementById('points-val');
  if (_ptEl) _ptEl.textContent = (typeof hudPoints !== 'undefined') ? hudPoints : 0;
}
