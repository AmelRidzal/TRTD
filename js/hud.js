// ================================================================
//  hud.js
//  Owns all reads/writes to the HUD DOM elements.
//  Call refreshHUD() any time a state variable changes.
// ================================================================

/** Sync every HUD element to the current state variables. */
function refreshHUD() {
  const pct = Math.max(0, (hudHp / MAX_HP) * 100);
  document.getElementById('hp-bar').style.width    = pct + '%';
  document.getElementById('hp-val').textContent    = Math.max(0, hudHp);
  document.getElementById('wave-num').textContent  = hudWave;
  document.getElementById('score-val').textContent = hudScore;

  // Points counter — only present when RTD HUD block is in the DOM
  const ptEl = document.getElementById('points-val');
  if (ptEl) ptEl.textContent = hudPoints;
}
