// ===== Grid =====
const worldGrid = new Map(); // "x_y" -> 'building' | 'barrier' | 'road'

function isAreaFree(x, y, widthInTiles, heightInTiles, barrierSize) {
    const tileX = Math.round(x / GRID_SIZE);
    const tileY = Math.round(y / GRID_SIZE);
    const startX = tileX - Math.floor(widthInTiles / 2);
    const startY = tileY - Math.floor(heightInTiles / 2);
    const endX = startX + widthInTiles;
    const endY = startY + heightInTiles;

    for (let i = startX - barrierSize; i < endX + barrierSize; i++) {
        for (let j = startY - barrierSize; j < endY + barrierSize; j++) {
            if (worldGrid.has(`${i}_${j}`)) {
                return false;
            }
        }
    }
    return true;
}

function occupyArea(x, y, widthInTiles, heightInTiles, barrierSize, type = 'building') {
    const tileX = Math.round(x / GRID_SIZE);
    const tileY = Math.round(y / GRID_SIZE);
    const startX = tileX - Math.floor(widthInTiles / 2);
    const startY = tileY - Math.floor(heightInTiles / 2);
    const endX = startX + widthInTiles;
    const endY = startY + heightInTiles;

    // Barrier
    for (let i = startX - barrierSize; i < endX + barrierSize; i++) {
        for (let j = startY - barrierSize; j < endY + barrierSize; j++) {
            if (!worldGrid.has(`${i}_${j}`)) {
                worldGrid.set(`${i}_${j}`, 'barrier');
            }
        }
    }

    // Building
    for (let i = startX; i < endX; i++) {
        for (let j = startY; j < endY; j++) {
            worldGrid.set(`${i}_${j}`, type);
        }
    }
}


// ===== Утилиты =====
function snapToGrid(val) { return Math.round(val / GRID_SIZE) * GRID_SIZE; }
function snapToMainGrid(val) { return Math.floor(val / GRID_SIZE) * GRID_SIZE; }
function snapToTile(val) { return Math.round(val / TILE_SIZE) * TILE_SIZE; }
function dist2(a,b){ return (a.x-b.x)**2 + (a.y-b.y)**2; }
function angleTo(x1,y1,x2,y2){ return Math.atan2(y2-y1,x2-x1); }
function turnTowards(g, targetA, dt) {
    let delta = targetA - g.a;
    // Ensure we take the shortest path around the circle
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    
    const maxTurn = TURN_SPEED * dt;
    const turn = clamp(delta, -maxTurn, maxTurn);
    g.a += turn;

    // Normalize the angle to prevent it from growing indefinitely
    while (g.a > Math.PI) g.a -= Math.PI * 2;
    while (g.a < -Math.PI) g.a += Math.PI * 2;
}
function rand(min,max){ return Math.random()*(max-min)+min; }
function randInt(min,max){ return Math.floor(rand(min,max+1)); }
function clamp(val,min,max){ return Math.max(min,Math.min(val,max)); }
function shade(hex, percent) {
    let f=parseInt(hex.slice(1),16),t=percent<0?0:255,p=percent<0?percent*-1:percent,R=f>>16,G=f>>8&0x00FF,B=f&0x0000FF;
    return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
}
function now(){ return performance.now()/1000; }

// ===== Seeded PRNG (for deterministic world generation) =====
// Hash function for string seeds
function cyrb53(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
    h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1>>>0);
}

// Mulberry32 PRNG
function createPrng(seedStr) {
    let seed = cyrb53(seedStr);
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function isPointInsideBuilding(x, y) {
    const tileX = Math.floor(x / GRID_SIZE);
    const tileY = Math.floor(y / GRID_SIZE);
    // A direct lookup is much faster than iterating through all buildings.
    return worldGrid.has(`${tileX}_${tileY}`);
}

function generateLastName() {
  const VOWELS = "аеиоу";
  const CONSONANTS = "бвгджзклмнпрстфхцчшщ";
  const ENDINGS = ["ов", "ев", "ин", "ен", "ский", "ко", "ок", "чук", "ич"];
  
  let name = CONSONANTS[randInt(0, CONSONANTS.length - 2)].toUpperCase() +
             VOWELS[randInt(0, VOWELS.length - 1)] +
             CONSONANTS[randInt(0, CONSONANTS.length - 2)] +
             VOWELS[randInt(0, VOWELS.length - 1)] +
             CONSONANTS[randInt(0, CONSONANTS.length - 2)] +
             ENDINGS[randInt(0, ENDINGS.length - 1)];
  return name;
}