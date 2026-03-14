// ================================================================
//  main.js  —  Entry point
// ================================================================

// All available maps. Add new maps here after adding their <script>.
const MAPS = {
  arena: MAP_ARENA,
  // ffa not in random pool — launched directly
};

const MAP_LIST = Object.values(MAPS);

// activeMap is set to a random map each time a game starts.
// It's read by both WaveScene and DuelScene in their create().
let activeMap = MAP_ARENA;

/** Pick a random map (different from the current one if possible). */
function pickRandomMap() {
  const others = MAP_LIST.filter(m => m.id !== activeMap.id);
  const pool   = others.length > 0 ? others : MAP_LIST;
  activeMap    = pool[Math.floor(Math.random() * pool.length)];
  return activeMap;
}

/**
 * Create a fresh Phaser game for one scene, sized to the active map.
 * Called by ui.js launchGame() and _launchDuelGame().
 * @param {string} sceneKey - 'WaveScene' | 'DuelScene'
 */
function startPhaserGame(sceneKey) {
  pickRandomMap();

  const sceneClass = sceneKey === 'DuelScene' ? DuelScene : WaveScene;
  return new Phaser.Game({
    type:            Phaser.AUTO,
    width:           activeMap.width,
    height:          activeMap.height,
    parent:          'phaser-container',
    backgroundColor: '#07070f',
    physics: {
      default: 'arcade',
      arcade:  { gravity: { y: 0 }, debug: false },
    },
    scene:           [sceneClass],
    audio:           { noAudio: true },
  });
}

// Boot — show the main menu
showScreen('screen-main');
