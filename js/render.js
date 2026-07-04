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
let showGrid = false;
let showChunkGrid = false;
let showMicroGrid = false;
let showVillageAreas = false;
let showAllyLeash = false;
let renderDistance = 3; // New variable for render distance

let grassTexture, dirtTexture, desksTexture, roofTexture, wallsTexture, doorTexture, windowTexture;

function loadTextures() {
    grassTexture = new Image();
    grassTexture.src = 'textures/grass.png';
    dirtTexture = new Image();
    dirtTexture.src = 'textures/dirt.png';
    desksTexture = new Image();
    desksTexture.src = 'textures/desks.png';
    roofTexture = new Image();
    roofTexture.src = 'textures/roof.png';
    wallsTexture = new Image();
    wallsTexture.src = 'textures/walls.png';
    doorTexture = new Image();
    doorTexture.src = 'textures/door.png';
    windowTexture = new Image();
    windowTexture.src = 'textures/window.png';
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

// ===== FPS Counter =====
let frameCount = 0;
let lastFpsUpdateTime = 0;
let fps = 0;

function updateFps(timestamp) {
    frameCount++;
    if (timestamp - lastFpsUpdateTime > 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFpsUpdateTime = timestamp;
        const fpsDisplay = document.getElementById('fps-display');
        if (fpsDisplay) {
            fpsDisplay.textContent = `FPS: ${fps}`;
        }
    }
}

// ===== Main Draw Function =====
function draw(dt) {
  updateFps(performance.now());
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
    if (grassTexture.complete && grassTexture.naturalHeight !== 0) {
      let pattern = octx.createPattern(grassTexture, 'repeat');
      octx.fillStyle = pattern;
      const textureSize = grassTexture.width;
      const startX = Math.floor(viewBounds.minX / textureSize) * textureSize;
      const startY = Math.floor(viewBounds.minY / textureSize) * textureSize;
      octx.fillRect(startX, startY, (viewBounds.maxX - startX) + textureSize, (viewBounds.maxY - startY) + textureSize);
    }
    
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

    if (showChunkGrid) {
        const chunkSizePx = CHUNK_SIZE * TILE_SIZE;
        octx.strokeStyle = "rgba(255,255,0,0.2)"; octx.lineWidth = 2 / cam.zoom;
        octx.beginPath();
        const gridMinX = snapToGrid(viewBounds.minX, chunkSizePx);
        const gridMaxX = snapToGrid(viewBounds.maxX, chunkSizePx) + chunkSizePx;
        const gridMinY = snapToGrid(viewBounds.minY, chunkSizePx);
        const gridMaxY = snapToGrid(viewBounds.maxY, chunkSizePx) + chunkSizePx;
        for (let x = gridMinX; x < gridMaxX; x += chunkSizePx) { octx.moveTo(x, gridMinY); octx.lineTo(x, gridMaxY); }
        for (let y = gridMinY; y < gridMaxY; y += chunkSizePx) { octx.moveTo(gridMinX, y); octx.lineTo(gridMaxX, y); }
        octx.stroke();
    }
    
    // --- Render static and dynamic entities from chunks ---
    const chunksToDraw = getChunksInProximity(player.x, player.y, renderDistance);
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
    
    // Draw building addons (walls, roofs) on top of everything else
    for (const b of allVisibleBuildings) {
        if (b.roof > 0) { // Check if walls/roof should be visible
            octx.globalAlpha = b.roof;

            // 1. Draw Walls (new)
            if (wallsTexture.complete && wallsTexture.naturalHeight !== 0) {
                const wallHeight = 3 * TILE_SIZE;
                if (b.h >= wallHeight) { // Only draw if building is tall enough
                    const wallShape = { 
                        type: b.type, // Pass type to be recognized as a building
                        x: b.x, 
                        y: b.y + b.h / 2 - wallHeight / 2, // New center y
                        w: b.w, 
                        h: wallHeight 
                    };
                    const wallBounds = { // Bounds for drawing and optimization
                        minX: wallShape.x - wallShape.w / 2,
                        maxX: wallShape.x + wallShape.w / 2,
                        minY: wallShape.y - wallShape.h / 2,
                        maxY: wallShape.y + wallShape.h / 2,
                    };
                    drawAutotiledLayer(octx, [wallShape], wallsTexture, wallBounds);
                }
            }

            // Draw windows on the front wall
            if (windowTexture.complete && windowTexture.naturalHeight !== 0) {
                const spaceInTiles = (b.w / TILE_SIZE - 2) / 2;
                const numWindows = Math.floor(spaceInTiles / 2);
                const windowY = b.y + b.h / 2 - 2 * TILE_SIZE;

                for (let i = 0; i < numWindows; i++) {
                    // Left side
                    octx.drawImage(windowTexture, b.x - b.w / 2 + i * 2 * TILE_SIZE, windowY, 32, 32);
                    // Right side
                    octx.drawImage(windowTexture, b.x + b.w / 2 - (i + 1) * 2 * TILE_SIZE, windowY, 32, 32);
                }
            }

            // 2. Draw Roof (modified)
            if (roofTexture.complete && roofTexture.naturalHeight !== 0) {
                const roofHeight = b.h - (2 * TILE_SIZE);
                if (roofHeight > 0) {
                     const roofShape = {
                        type: b.type,
                        x: b.x,
                        y: b.y - TILE_SIZE, // New center y. (b.y - b.h/2) is top edge. New center is (top edge + bottom edge)/2 = ( (b.y-b.h/2) + (b.y+b.h/2-2*TILE_SIZE) )/2 = (2*b.y - 2*TILE_SIZE)/2 = b.y - TILE_SIZE
                        w: b.w,
                        h: roofHeight
                    };
                     const roofBounds = { // Bounds for drawing and optimization
                        minX: roofShape.x - roofShape.w / 2,
                        maxX: roofShape.x + roofShape.w / 2,
                        minY: roofShape.y - roofShape.h / 2,
                        maxY: roofShape.y + roofShape.h / 2,
                    };
                    drawAutotiledLayer(octx, [roofShape], roofTexture, roofBounds);
                }
            }
            
            octx.globalAlpha = 1.0;
        }
    }

    // Draw Doors separately
    octx.globalAlpha = 1.0; // Force full opacity
    for (const b of allVisibleBuildings) {
        if (doorTexture.complete && doorTexture.naturalHeight !== 0) {
            let frame = 0;
            if (b.doorState === 'opening') {
                frame = (b.doorAnimationTime < DOOR_ANIMATION_SPEED / 2) ? 1 : 2;
            } else if (b.doorState === 'open') {
                frame = 2;
            } else if (b.doorState === 'closing') {
                frame = (b.doorAnimationTime < DOOR_ANIMATION_SPEED / 2) ? 1 : 0;
            }
            
            const doorX = b.x - 16; // Center the 32px door
            const doorY = b.y + b.h / 2 - 32; // Place at the bottom of the wall

            octx.drawImage(doorTexture, frame * 32, 0, 32, 32, doorX, doorY, 32, 32);
        }
    }

    // Draw building names and info
    octx.save();
    octx.textAlign = 'center';

    for (const b of allVisibleBuildings) {
        const textX = b.x;
        let textY = b.y - b.h / 2 - 20;
        let infoTextY = textY + 14;

        // --- Main Building Name ---
        octx.font = 'normal 12px \'Press Start 2P\', monospace';
        octx.fillStyle = '#000'; // Shadow
        octx.fillText(b.name, textX + 1, textY + 1);
        octx.fillStyle = '#fff'; // Text
        octx.fillText(b.name, textX, textY);

        if (b.type === 'house') {
            // --- House Number ---
            const houseNumberText = `#${b.houseNumber}`;
            octx.font = 'normal 10px \'Press Start 2P\', monospace';
            octx.fillStyle = '#000'; // Shadow
            octx.fillText(houseNumberText, textX + 1, infoTextY + 1);
            octx.fillStyle = '#fff'; // Text
            octx.fillText(houseNumberText, textX, infoTextY);
            infoTextY += 12;

            if (b.owner) {
                const ownerGroup = allVisibleDynamicEntities.find(e => e.type === 'group' && e.id === b.owner);
                if (ownerGroup) {
                    const ownerText = `${ownerGroup.name}`;
                    const factionIcon = ownerGroup.factionInfo ? ownerGroup.factionInfo.icon : `[${ownerGroup.faction}]`;
                    const fullText = `${factionIcon} ${ownerText}`;
                    
                    octx.font = 'normal 8px \'Press Start 2P\', monospace';
                    
                    octx.fillStyle = '#000';
                    octx.fillText(fullText, textX + 1, infoTextY + 1);

                    octx.fillStyle = ownerGroup.color;
                    octx.fillText(fullText, textX, infoTextY);
                    
                    infoTextY += 10;
                }
            }
        } else if (b.type === 'shop') {
            octx.font = 'normal 8px \'Press Start 2P\', monospace';
            octx.globalAlpha = 0.7;
            octx.fillStyle = '#333'; // Lighter shadow
            const sellsText = `Продаётся: ${b.sells}`;
            octx.fillText(sellsText, textX + 1, infoTextY + 1);
            octx.fillStyle = '#888'; // Grey text
            octx.fillText(sellsText, textX, infoTextY);
            octx.globalAlpha = 1.0;
            infoTextY += 10;
        } else if (b.type === 'kabak') {
            const groupsInside = allVisibleDynamicEntities.filter(e => e.type === 'group' && e.insideBuilding === b.id);
            if (groupsInside.length > 0) {
                octx.font = 'normal 8px \'Press Start 2P\', monospace';
                octx.globalAlpha = 0.7;
                octx.fillStyle = '#333'; // Lighter shadow
                octx.fillText('Внутри:', textX + 1, infoTextY + 1);
                octx.fillStyle = '#888'; // Grey text
                octx.fillText('Внутри:', textX, infoTextY);
                octx.globalAlpha = 1.0;
                infoTextY += 10;

                for (const group of groupsInside) {
                    octx.fillStyle = '#000';
                    octx.fillText(group.name, textX + 1, infoTextY + 1);
                    octx.fillStyle = group.color;
                    octx.fillText(group.name, textX, infoTextY);
                    infoTextY += 10;
                }
            }
        }
    }
    octx.restore();

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
    mctx.clearRect(0, 0, mw, mh); // Clear the minimap
    const mapScale = mw / REGION_SIZE;
    const region = getOrCreateRegion(player.x, player.y);
    const regionX = region.rx * REGION_SIZE;
    const regionY = region.ry * REGION_SIZE;
    
    for (const chunk of region.chunks.values()) {
        // Draw chunk cache as background
        if (chunk.staticCache) {
            const chunkXOnMap = (chunk.x - regionX) * mapScale;
            const chunkYOnMap = (chunk.y - regionY) * mapScale;
            const chunkSizeOnMap = (CHUNK_SIZE * TILE_SIZE) * mapScale;
            mctx.drawImage(chunk.staticCache, chunkXOnMap, chunkYOnMap, chunkSizeOnMap, chunkSizeOnMap);
        }

        // Draw static paths and buildings
        for (const entity of chunk.staticEntities) {
            if (entity.type === 'path') {
                mctx.fillStyle = roadColor;
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
