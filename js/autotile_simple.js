// js/autotile_simple.js
// This file contains the simplified 4x4 (16-tile) autotiling logic
// based on the user's provided example.

const TILE_SIZE$1 = 16;
const ATLAS_COLS = 4; // The new spritesheets are 4 tiles wide

// Helper function to get a 0-based index from a 0-based col/row
function idx(col, row) {
  return row * ATLAS_COLS + col;
}

// Tile constants based on the user's 4x4 layout
const TILE_1  = idx(0, 0); const TILE_2  = idx(1, 0); const TILE_3  = idx(2, 0); const TILE_4  = idx(3, 0);
const TILE_5  = idx(0, 1); const TILE_6  = idx(1, 1); const TILE_7  = idx(2, 1); const TILE_8  = idx(3, 1);
const TILE_9  = idx(0, 2); const TILE_10 = idx(1, 2); const TILE_11 = idx(2, 2); const TILE_12 = idx(3, 2);
const TILE_13 = idx(0, 3); const TILE_14 = idx(1, 3); const TILE_15 = idx(2, 3); const TILE_16 = idx(3, 3);

const TILE_SINGLE = TILE_13;

/**
 * Computes a 4-bit bitmask based on cardinal neighbors within a given tile Set.
 * @param {number} tx - The tile x-coordinate.
 * @param {number} ty - The tile y-coordinate.
 * @param {Set<string>} tileSet - The Set of "tx,ty" strings representing solid tiles.
 * @returns {number} A bitmask from 0 to 15.
 */
function computeMask4(tx, ty, tileSet) {
  let m = 0;
  if (tileSet.has(`${tx},${ty - 1}`)) m |= 1; // North
  if (tileSet.has(`${tx + 1},${ty}`)) m |= 2; // East
  if (tileSet.has(`${tx},${ty + 1}`)) m |= 4; // South
  if (tileSet.has(`${tx - 1},${ty}`)) m |= 8; // West
  return m;
}

/**
 * Takes a 4-bit bitmask and returns the correct tile index based on the user's logic.
 * @param {number} m - The 4-bit bitmask (0-15).
 * @returns {number} The index of the tile to use (0-15).
 */
function getTileIndexFromMask(m) {
  if (m === 0) return TILE_SINGLE;
  if (m === 4) return TILE_1;
  if (m === 1) return TILE_9;
  if (m === (1 | 4)) return TILE_5;
  if (m === 2) return TILE_14;
  if (m === 8) return TILE_16;
  if (m === (2 | 8)) return TILE_15;
  if (m === (2 | 4)) return TILE_2;
  if (m === (4 | 8)) return TILE_4;
  if (m === (1 | 2)) return TILE_10;
  if (m === (1 | 8)) return TILE_12;
  if (m === (2 | 4 | 8)) return TILE_3;
  if (m === (1 | 2 | 4)) return TILE_6;
  if (m === (1 | 4 | 8)) return TILE_8;
  if (m === (1 | 2 | 8)) return TILE_11;
  if (m === (1 | 2 | 4 | 8)) return TILE_7;
  return TILE_7; // Fallback for T-junctions and crosses
}

/**
 * Generic function to draw an autotiled layer.
 * @param {CanvasRenderingContext2D} octx - The rendering context.
 * @param {Array} shapes - The array of shape objects (buildings or paths).
 * @param {HTMLImageElement} texture - The 4x4 autotile spritesheet.
 * @param {Object} viewBounds - The bounding box of the visible screen area.
 */
function drawAutotiledLayer(octx, shapes, texture, viewBounds) {
    if (!texture.complete || texture.naturalHeight === 0 || shapes.length === 0) {
        return;
    }

    const TILE_W = TILE_SIZE$1;
    const TILE_H = TILE_SIZE$1;
    const tileSet = new Set();

    // 1. Paint all shape tiles onto the Set.
    const viewStartX = Math.floor(viewBounds.minX / TILE_W);
    const viewStartY = Math.floor(viewBounds.minY / TILE_H);
    const viewEndX = Math.ceil(viewBounds.maxX / TILE_W);
    const viewEndY = Math.ceil(viewBounds.maxY / TILE_H);
    
    // Check a slightly larger area to handle neighbor checks at the edges of the screen
    for (let ty = viewStartY - 1; ty < viewEndY + 1; ty++) {
        for (let tx = viewStartX - 1; tx < viewEndX + 1; tx++) {
            const worldX = tx * TILE_W + TILE_W / 2;
            const worldY = ty * TILE_H + TILE_H / 2;
            
            for (const shape of shapes) {
                // Buildings use center x/y, paths use top-left x/y. A robust check for a building type.
                const isBuilding = shape.type === 'house' || shape.type === 'shop' || shape.type === 'kabak';
                const shapeX = isBuilding ? shape.x - shape.w / 2 : shape.x;
                const shapeY = isBuilding ? shape.y - shape.h / 2 : shape.y;

                if (worldX >= shapeX && worldX < shapeX + shape.w &&
                    worldY >= shapeY && worldY < shapeY + shape.h) {
                    tileSet.add(`${tx},${ty}`);
                    break;
                }
            }
        }
    }
    
    if (tileSet.size === 0) return;

    // 2. Iterate through visible tiles and draw the correct autotile.
    for (let ty = viewStartY; ty < viewEndY; ty++) {
        for (let tx = viewStartX; tx < viewEndX; tx++) {
            if (!tileSet.has(`${tx},${ty}`)) continue;

            const mask = computeMask4(tx, ty, tileSet);
            const tileIndex = getTileIndexFromMask(mask);
            
            const sx = (tileIndex % ATLAS_COLS) * TILE_W;
            const sy = Math.floor(tileIndex / ATLAS_COLS) * TILE_H;
            
            octx.drawImage(
                texture,
                sx, sy, TILE_W, TILE_H,
                tx * TILE_W, ty * TILE_H, TILE_W, TILE_H
            );
        }
    }
}
