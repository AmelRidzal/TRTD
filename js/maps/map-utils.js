// ================================================================
//  map-utils.js  —  Shared helpers used by all map files.
//  Must be loaded before any map-*.js files.
// ================================================================

/** Tile floor across the full map dimensions. */
function _buildFloor(scene, w, h) {
  for (let x = 0; x < w; x += 40)
    for (let y = 0; y < h; y += 40)
      scene.add.image(x + 20, y + 20, 'floor').setDepth(0);
}

/**
 * Returns [cx, cy] tile-centre pairs for the border ring.
 * @param {number} w  map pixel width
 * @param {number} h  map pixel height
 */
function _borders(w, h) {
  const p = [];
  for (let x = 0; x < w; x += 40) {
    p.push([x + 20, 20]);
    p.push([x + 20, h - 20]);
  }
  for (let y = 40; y < h - 40; y += 40) {
    p.push([20,     y + 20]);
    p.push([w - 20, y + 20]);
  }
  return p;
}
