// ================================================================
//  textures.js
//  Generates every Phaser texture used across all modes and maps.
//  Called once from a Phaser scene's create() via makeTextures(scene).
//
//  To add a new sprite:
//    1. Draw it inside makeTextures() using the graphics object g
//    2. Call g.generateTexture('my-key', width, height); g.clear();
//    3. Use 'my-key' as the texture key anywhere in your scene
// ================================================================

/**
 * Procedurally draw and cache every game texture.
 * Must be called from within a Phaser scene (needs this.make).
 * @param {Phaser.Scene} scene - the scene to generate textures in
 */
function makeTextures(scene) {
  const g = scene.make.graphics({ add: false });

  // ── Tiles ────────────────────────────────────────────────────

  // Floor tile
  g.fillStyle(0x0c0c1a); g.fillRect(0, 0, 40, 40);
  g.lineStyle(1, 0x10101e); g.strokeRect(0, 0, 40, 40);
  g.generateTexture('floor', 40, 40); g.clear();

  // Wall tile
  g.fillStyle(0x14142a); g.fillRect(0, 0, 40, 40);
  g.fillStyle(0x1c1c36); g.fillRect(3, 3, 34, 34);
  g.lineStyle(1, 0x22224a); g.strokeRect(0, 0, 40, 40);
  g.fillStyle(0x0d0d1c);
  g.fillRect(5, 5, 13, 13); g.fillRect(22, 22, 13, 13);
  g.generateTexture('wall', 40, 40); g.clear();

  // ── Player tank ──────────────────────────────────────────────

  // Player body (cyan)
  g.fillStyle(0x002a3a); g.fillRoundedRect(0, 0, 42, 36, 6);
  g.fillStyle(0x00bbdd); g.fillRoundedRect(3, 3, 36, 30, 4);
  g.fillStyle(0x004455); g.fillRoundedRect(9, 9, 24, 18, 3);
  g.fillStyle(0x003344); g.fillRect(0, 2, 8, 32); g.fillRect(34, 2, 8, 32);
  g.fillStyle(0x001e2a);
  for (let i = 0; i < 7; i++) {
    g.fillRect(1,  4 + i * 4, 6, 2);
    g.fillRect(35, 4 + i * 4, 6, 2);
  }
  g.generateTexture('pbody', 42, 36); g.clear();

  // Player turret
  g.fillStyle(0x00bbdd); g.fillCircle(15, 15, 13);
  g.fillStyle(0x006688); g.fillRect(12, 0, 6, 17);
  g.fillStyle(0x00e5ff); g.fillCircle(15, 15, 6);
  g.fillStyle(0xffffff, 0.3); g.fillCircle(12, 12, 3);
  g.generateTexture('pturret', 30, 30); g.clear();

  // ── Enemy tank ───────────────────────────────────────────────

  // Enemy body (red)
  g.fillStyle(0x3a0010); g.fillRoundedRect(0, 0, 40, 34, 5);
  g.fillStyle(0xcc1133); g.fillRoundedRect(3, 3, 34, 28, 4);
  g.fillStyle(0x550015); g.fillRoundedRect(8, 8, 24, 18, 2);
  g.fillStyle(0x440010); g.fillRect(0, 2, 7, 30); g.fillRect(33, 2, 7, 30);
  g.fillStyle(0x2a0008);
  for (let i = 0; i < 7; i++) {
    g.fillRect(1,  3 + i * 4, 5, 2);
    g.fillRect(34, 3 + i * 4, 5, 2);
  }
  g.generateTexture('ebody', 40, 34); g.clear();

  // Enemy turret
  g.fillStyle(0xcc1133); g.fillCircle(13, 13, 11);
  g.fillStyle(0x770022); g.fillRect(10, 0, 6, 15);
  g.fillStyle(0xff4060); g.fillCircle(13, 13, 5);
  g.generateTexture('eturret', 26, 26); g.clear();

  // ── Bullets ──────────────────────────────────────────────────

  // Player bullet (cyan)
  g.fillStyle(0x00e5ff); g.fillCircle(5, 5, 5);
  g.fillStyle(0xffffff, 0.7); g.fillCircle(3, 3, 2);
  g.generateTexture('pbullet', 10, 10); g.clear();

  // Enemy bullet (red)
  g.fillStyle(0xff3355); g.fillCircle(5, 5, 5);
  g.fillStyle(0xffffff, 0.7); g.fillCircle(3, 3, 2);
  g.generateTexture('ebullet', 10, 10); g.clear();

  g.destroy();
}
