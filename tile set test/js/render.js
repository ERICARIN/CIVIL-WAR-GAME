// ===== Canvas Setup for Pixel-Perfect Rendering =====

// 1. Offscreen canvas for rendering the game at a fixed low resolution
const offscreenCanvas = document.createElement('canvas');
offscreenCanvas.width = VIEW_W;
offscreenCanvas.height = VIEW_H;
const octx = offscreenCanvas.getContext('2d');
octx.imageSmoothingEnabled = false;

// 2. The main, visible canvas that fills the screen
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ===== Camera/Colors =====
let W = VIEW_W, H = VIEW_H; // Base rendering dimensions are fixed
let cam = { x: REGION_SIZE / 2, y: REGION_SIZE / 2, zoom: 1, targetZoom: 1 };
let fieldColor, houseColor, shopColor, kabakColor, roadColor;
let showGrid = true;
let showMicroGrid = false;
let showVillageAreas = false;
let showAllyLeash = false;

let grassTexture, dirtTexture, desksTexture, roofTexture, wallsTexture, grassSubTiles = [];

function loadTextures() {
    grassTexture = new Image();
    grassTexture.src = 'textures/grass.png';
    grassTexture.onload = () => {
        // Assuming TILE_SIZE is 16, as found in constants.js
        const TILE_SIZE_LOCAL = 16;
        for (let i = 0; i < 4; i++) { // 2x2 grid, so 4 sub-tiles
            const subCanvas = document.createElement('canvas');
            subCanvas.width = TILE_SIZE_LOCAL;
            subCanvas.height = TILE_SIZE_LOCAL;
            const subCtx = subCanvas.getContext('2d');
            subCtx.imageSmoothingEnabled = false;

            const sx = (i % 2) * TILE_SIZE_LOCAL; // Source X
            const sy = Math.floor(i / 2) * TILE_SIZE_LOCAL; // Source Y

            subCtx.drawImage(grassTexture, sx, sy, TILE_SIZE_LOCAL, TILE_SIZE_LOCAL, 0, 0, TILE_SIZE_LOCAL, TILE_SIZE_LOCAL);
            grassSubTiles.push(subCanvas);
        }
    };
    dirtTexture = new Image();
    dirtTexture.src = 'textures/dirt.png';
    desksTexture = new Image();
    desksTexture.src = 'textures/desks.png';
    roofTexture = new Image();
    roofTexture.src = 'textures/roof.png';
    wallsTexture = new Image();
    wallsTexture.src = 'textures/walls.png';
}

function applyThemeColors() {
  const styles = getComputedStyle(document.documentElement);
  fieldColor = styles.getPropertyValue('--field').trim();
  houseColor = styles.getPropertyValue('--house').trim();
  shopColor = styles.getPropertyValue('--shop').trim();
  kabakColor = styles.getPropertyValue('--kabak').trim();
  roadColor = styles.getPropertyValue('--road').trim();
  document.getElementById('fieldColor').value = fieldColor;
  document.getElementById('houseColor').value = houseColor;
  document.getElementById('shopColorInput').value = shopColor;
}

// ===== Minimap =====
const minimapCanvas = document.getElementById('minimap-canvas');
const mctx = minimapCanvas.getContext('2d');
mctx.imageSmoothingEnabled = false;

// ===== Main Draw Function =====
function draw(dt) {
  // --- Step 1: Render the game scene to the offscreen canvas ---
  octx.fillStyle = fieldColor || '#000';
  octx.fillRect(0, 0, W, H);

  if (player) {
    const styles = getComputedStyle(document.documentElement);
    const fontWeight = styles.getPropertyValue('--canvas-font-weight').trim() || 'normal';
    const fontSize = styles.getPropertyValue('--canvas-font-size').trim() || '12px';
    const fontFamily = styles.getPropertyValue('--canvas-font-family').trim() || 'system-ui';
    const canvasFont = `${fontWeight} ${fontSize} ${fontFamily}`;

    octx.save();
    octx.translate(W / 2, H / 2);
    octx.scale(cam.zoom, cam.zoom);
    octx.translate(-player.x, -player.y);

    const viewBounds = {
      minX: player.x - (W / 2) / cam.zoom, maxX: player.x + (W / 2) / cam.zoom,
      minY: player.y - (H / 2) / cam.zoom, maxY: player.y + (H / 2) / cam.zoom,
    };

    // --- Background & Grid ---
    
    if (showGrid) {
      octx.strokeStyle = "rgba(255,255,255,0.08)"; octx.lineWidth = 1 / cam.zoom;
      octx.beginPath();
      const gridMinX = snapToGrid(viewBounds.minX, GRID_SIZE);
      const gridMaxX = snapToGrid(viewBounds.maxX, GRID_SIZE) + GRID_SIZE;
      const gridMinY = snapToGrid(viewBounds.minY, GRID_SIZE);
      const gridMaxY = snapToGrid(viewBounds.maxY, GRID_SIZE) + GRID_SIZE;
      for (let x = gridMinX; x < gridMaxX; x += GRID_SIZE) { octx.moveTo(x, gridMinY); octx.lineTo(x, gridMaxY); }
      for (let y = gridMinY; y < gridMaxY; y += GRID_SIZE) { octx.moveTo(gridMinX, y); octx.lineTo(gridMaxX, y); }
      octx.stroke();
    }
    
    // --- Render static and dynamic entities from chunks ---
    const chunksToDraw = getChunksInProximity(player.x, player.y, 2);
    const chunkSizePx = CHUNK_SIZE * TILE_SIZE;
    const allVisibleBuildings = [];
    const allVisibleDynamicEntities = [];

    // First, draw all static backgrounds
    for (const chunk of chunksToDraw) {
        if (chunk.x + chunkSizePx < viewBounds.minX || chunk.x > viewBounds.maxX ||
            chunk.y + chunkSizePx < viewBounds.minY || chunk.y > viewBounds.maxY) {
            continue; 
        }
        if (chunk.staticCache) {
            octx.drawImage(chunk.staticCache, chunk.x, chunk.y);
        }
    }

    // Next, collect all dynamic entities and visible static buildings from the chunks
    for (const chunk of chunksToDraw) {
        if (chunk.x + chunkSizePx < viewBounds.minX || chunk.x > viewBounds.maxX ||
            chunk.y + chunkSizePx < viewBounds.minY || chunk.y > viewBounds.maxY) {
            continue;
        }
        for(const entity of chunk.staticEntities) {
            if (['house', 'shop', 'kabak'].includes(entity.type)) {
                allVisibleBuildings.push(entity);
            }
        }
        for (const entity of chunk.dynamicEntities) {
            if (entity.alive || entity.type === 'loot' || entity.type === 'bullet') {
                allVisibleDynamicEntities.push(entity);
            }
        }
    }
    
    // Sort dynamic entities by their Y position for correct layering
    allVisibleDynamicEntities.sort((a, b) => a.y - b.y);

    // Now, draw the sorted dynamic entities
    for (const entity of allVisibleDynamicEntities) {
        switch (entity.type) {
            case 'group':
                if (!entity.hidden) {
                    for (const u of entity.units) { if (u.spriteData) { drawSprite(octx, u, dt, entity.insideBuilding); } }
                    if (entity.spriteData) { drawSprite(octx, entity, dt, entity.insideBuilding); }
                }
                break;
            case 'farmer':
                 if (entity.spriteData) { drawSprite(octx, entity, dt); } 
                 else { octx.fillStyle = '#e9d8a6'; circle(octx, entity.x, entity.y, 5, true); }
                break;
            case 'bullet':
                octx.fillStyle = '#ffd166';
                octx.fillRect(Math.round(entity.x - 1), Math.round(entity.y - 1), 2, 2);
                break;
            case 'loot':
                octx.save();
                octx.translate(entity.x, entity.y);
                if (entity.lootType === 'unit') {
                    octx.strokeStyle = '#c4c4c4'; octx.lineWidth = 2; octx.beginPath();
                    octx.moveTo(-6, 0); octx.lineTo(6, 0); octx.moveTo(0, -6); octx.lineTo(0, 6);
                    octx.stroke();
                } else if (entity.lootType === 'cmd') {
                    octx.strokeStyle = '#ffd166'; octx.lineWidth = 3; octx.beginPath();
                    octx.moveTo(-6, 0); octx.lineTo(6, 0); octx.moveTo(0, -6); octx.lineTo(0, 6);
                    octx.stroke();
                } else if (entity.lootType === 'money') {
                    octx.fillStyle = '#aacc80'; octx.font = canvasFont; octx.textAlign = 'center'; octx.fillText('₽', 0, 4);
                } else if (entity.lootType === 'ammo') {
                    octx.fillStyle = '#cccccc'; octx.font = canvasFont; octx.textAlign = 'center'; octx.fillText('🔫', 0, 4);
                }
                octx.restore();
                break;
        }
    }
    
    // Draw building addons (doors, borders, roofs) on top of everything else
    for (const b of allVisibleBuildings) {
        const w = b.w, h = b.h;
        let buildingColor = b.type === 'house' ? houseColor : (b.type === 'shop' ? shopColor : kabakColor);





        if (b.roof > 0) {
             if (wallsTexture.complete && wallsTexture.naturalHeight !== 0 &&
                 roofTexture.complete && roofTexture.naturalHeight !== 0) {
                octx.globalAlpha = b.roof;

                                // Draw walls layer (3 tiles high from bottom)

                                const TILE_SIZE = 16; // Assuming TILE_SIZE is 16, as found in constants.js

                                const wallsHeight = 3 * TILE_SIZE;
                const wallsY = (b.y + b.h / 2) - (wallsHeight / 2); // Center Y for 3 tiles from bottom
                const wallsEntity = { ...b, h: wallsHeight, y: wallsY };
                const wallsBounds = { minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minY: wallsY - wallsHeight / 2, maxY: wallsY + wallsHeight / 2 };
                drawAutotiledLayer(octx, [wallsEntity], wallsTexture, wallsBounds);

                // Draw roof layer (shortened by 2 tiles from bottom)
                const roofShrink = 2 * TILE_SIZE;
                const newRoofHeight = b.h - roofShrink;
                const newRoofY = b.y - TILE_SIZE; // Adjust center Y to keep top same
                const roofEntity = { ...b, h: newRoofHeight, y: newRoofY };
                const roofBounds = { minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minY: newRoofY - newRoofHeight / 2, maxY: newRoofY + newRoofHeight / 2 };
                drawAutotiledLayer(octx, [roofEntity], roofTexture, roofBounds);

                                octx.globalAlpha = 1.0;
            }
        }
    }

    octx.restore();
  }

  // --- Step 2: Draw the offscreen canvas to the visible canvas, stretching to fill ---
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(offscreenCanvas, 0, 0, W, H, 0, 0, canvas.width, canvas.height);

  // --- Step 3: Render Minimap ---
  if (!hideMinimap && player) {
    const panel = document.getElementById('minimap-panel');
    const panelSize = Math.min(panel.clientWidth - 16, panel.clientHeight - 44);
    minimapCanvas.width = panelSize; minimapCanvas.height = panelSize;
    const mw = minimapCanvas.width, mh = minimapCanvas.height;
    mctx.fillStyle = fieldColor; mctx.fillRect(0, 0, mw, mh);
    const mapScale = mw / REGION_SIZE;
    const region = getOrCreateRegion(player.x, player.y);
    const regionX = region.rx * REGION_SIZE;
    const regionY = region.ry * REGION_SIZE;
    
    if (dirtTexture.complete && dirtTexture.naturalHeight !== 0) { mctx.fillStyle = mctx.createPattern(dirtTexture, 'repeat'); } else { mctx.fillStyle = roadColor; }
    
    for (const chunk of region.chunks.values()) {
        // Draw static paths and buildings
        for (const entity of chunk.staticEntities) {
            if (entity.type === 'path') {
                 mctx.fillRect((entity.x - regionX) * mapScale, (entity.y - regionY) * mapScale, entity.w * mapScale, entity.h * mapScale);
            } else if (['house', 'shop', 'kabak'].includes(entity.type)) {
                const hx = (entity.x - regionX) * mapScale;
                const hy = (entity.y - regionY) * mapScale;
                if (entity.owner) {
                    mctx.fillStyle = entity.ownerColor || '#999999';
                    mctx.fillRect(hx - 2, hy - 2, 4, 4);
                    if (player && entity.owner === player.id) {
                        mctx.strokeStyle = '#ffffff'; mctx.lineWidth = 1;
                        mctx.strokeRect(hx - 2.5, hy - 2.5, 5, 5);
                    }
                } else {
                     mctx.fillStyle = '#999999'; mctx.fillRect(hx - 1, hy - 1, 2, 2);
                }
            }
        }
        // Draw dynamic entities
        for (const entity of chunk.dynamicEntities) {
            if (!entity.alive) continue;
            const ex = (entity.x - regionX) * mapScale;
            const ey = (entity.y - regionY) * mapScale;
            if (entity.type === 'group') {
                mctx.fillStyle = (entity === player) ? '#3ddc97' : (areFactionsHostile(player.faction, entity.faction) ? '#ff6b6b' : entity.color);
                mctx.beginPath();
                mctx.arc(ex, ey, (entity === player) ? 2 : 1.5, 0, Math.PI * 2);
                mctx.fill();
            } else if (entity.type === 'farmer') {
                mctx.fillStyle = '#e9d8a6';
                mctx.beginPath();
                mctx.arc(ex, ey, 1, 0, Math.PI * 2);
                mctx.fill();
            }
        }
    }
    mctx.strokeStyle = '#222'; mctx.strokeRect(0.5, 0.5, mw - 1, mh - 1);
  }
}

// ===== Resize Handling =====
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  canvas.width = cw * dpr;
  canvas.height = ch * dpr;
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  ctx.imageSmoothingEnabled = false;
}

window.addEventListener('resize', resize);
resize();

function screenToWorld(screenX, screenY) {
    if (!player) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const cssX = screenX - rect.left;
    const cssY = screenY - rect.top;
    const gameViewX = cssX * (W / rect.width);
    const gameViewY = cssY * (H / rect.height);
    const worldX = player.x + (gameViewX - W / 2) / cam.zoom;
    const worldY = player.y + (gameViewY - H / 2) / cam.zoom;
    return { x: worldX, y: worldY };
}
