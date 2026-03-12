// ================================================================
//  main.js  —  Entry point
// ================================================================

const MAPS = {
  arena: MAP_ARENA,
};

let activeMap = MAPS['arena'];

// Base Phaser config shared by all modes
const BASE_CFG = {
  type:            Phaser.AUTO,
  width:           MAP_W,
  height:          MAP_H,
  parent:          'phaser-container',
  backgroundColor: '#07070f',
  physics: {
    default: 'arcade',
    arcade:  { gravity: { y: 0 }, debug: false },
  },
  audio: { noAudio: true },
};

/**
 * Create a fresh Phaser game running exactly one scene.
 * Passing only the scene we need avoids stop()/start() race conditions
 * that silently kill the canvas.
 *
 * @param {string} sceneKey - 'WaveScene' | 'DuelScene'
 */
function startPhaserGame(sceneKey) {
  const sceneClass = sceneKey === 'DuelScene' ? DuelScene : WaveScene;
  return new Phaser.Game({ ...BASE_CFG, scene: [sceneClass] });
}

// Boot — show the main menu
showScreen('screen-main');
