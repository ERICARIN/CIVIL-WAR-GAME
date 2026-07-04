


// This file will handle the loading and rendering of layered character sprites.

const spriteCache = {};
const angleToFrame = [5, 8, 7, 6, 3, 0, 1, 2]; // Correct map for 3x3 grid (0-8, center is unused)
const WALK_ANIM_SPEED = 150; // ms per frame
const DAMAGE_FLASH_DURATION = 0.2; // seconds

// Pre-load images from the appearance object
function preloadSprite(appearance) {
    const loadedAppearance = {};
    const layerPromises = [];

    for (const layerName in appearance) {
        const layerData = appearance[layerName];
        if (layerName === 'pants') {
            loadedAppearance.pants = {};
            for (const state in layerData) { // stay, walk1, walk2
                const url = layerData[state].url;
                if (url && url !== 'none') {
                    const promise = new Promise((resolve) => {
                        const img = new Image();
                        img.src = url;
                        img.onload = () => {
                            spriteCache[url] = img;
                            loadedAppearance.pants[state] = img;
                            resolve();
                        };
                        img.onerror = () => resolve();
                    });
                    layerPromises.push(promise);
                }
            }
        } else {
            const url = layerData.url;
            if (url && url !== 'none') {
                const promise = new Promise((resolve) => {
                    const img = new Image();
                    img.src = url;
                    img.onload = () => {
                        spriteCache[url] = img;
                        loadedAppearance[layerName] = img;
                        resolve();
                    };
                    img.onerror = () => resolve();
                });
                layerPromises.push(promise);
            }
        }
    }
    return Promise.all(layerPromises).then(() => loadedAppearance);
}

function drawSprite(ctx, entity, dt, entityInsideBuilding) {
    if (!entity.spriteData || !entity.spriteData.layers) {
        return;
    }

    const frameW = 32, frameH = 32, cols = 3;
    const t = now();
    const isDamaged = entity.lastDamageTime && (t - entity.lastDamageTime < DAMAGE_FLASH_DURATION);
    
    // 1. Use the real physics angle
    const angle = entity.a; 
    // 2. Convert angle to 8-direction index (0-7) using the robust character editor logic
    let normalizedAngle = angle;
    if (normalizedAngle < 0) {
        normalizedAngle += 2 * Math.PI;
    }
    const dir = Math.floor(normalizedAngle / (Math.PI * 2) * 8) % 8;

    let frame = angleToFrame[dir];

    const layersToDraw = ['base', 'pants', 'top', 'hairBack', 'hat', 'bangs'];

    ctx.save();
    if (entityInsideBuilding) {
        ctx.globalAlpha = 0.5;
    }

    ctx.translate(entity.x, entity.y);
    ctx.scale(1.0, 1.0); // Ensure scale is correct
    ctx.translate(-frameW / 2, -frameH / 2);

    // Update animation frame for walking
    if (entity.moving) {
        entity.animTime = (entity.animTime || 0) + dt * 1000;
        if (entity.animTime > WALK_ANIM_SPEED) {
            entity.animTime = 0;
            entity.animFrame = 1 - (entity.animFrame || 0); // Toggle between 0 and 1
        }
    } else {
        entity.animFrame = 0;
    }

    for (const layerName of layersToDraw) {
        let img;
        if (layerName === 'pants') {
            const pantsSet = entity.spriteData.layers.pants;
            if (entity.moving) {
                img = entity.animFrame === 0 ? pantsSet.walk1 : pantsSet.walk2;
            } else {
                img = pantsSet.stay;
            }
        } else {
            img = entity.spriteData.layers[layerName];
        }

        if (img) {
            const col = frame % cols;
            const row = Math.floor(frame / cols);
            const sx = Math.floor(col * frameW);
            const sy = Math.floor(row * frameH);
            ctx.drawImage(img, sx, sy, frameW, frameH, 0, 0, frameW, frameH);
        }
    }

    if (isDamaged) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgba(255, 128, 128, 1)';
        ctx.fillRect(0, 0, frameW, frameH);
        ctx.globalCompositeOperation = 'source-over';
    }

    // --- Name and HP Bar (drawn in local, transformed space, where 0,0 is the top-left of the sprite) ---
    const barWidth = 30;
    const barHeight = 5;
    const barX = frameW / 2 - barWidth / 2; // Center the bar horizontally
    const barY = frameH + 2; // Position below the sprite

    const hp = clamp(entity.cmdHp, 0, entity.maxHp || 4);
    const hpPercent = hp / (entity.maxHp || 4);

    // HP Bar background
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    // HP fill
    ctx.fillStyle = '#a7f3d0';
    ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
    
    // Border
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX - 0.5, barY - 0.5, barWidth + 1, barHeight + 1);

    // Name
    ctx.font = 'normal 8px \'Press Start 2P\', monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const name = entity.name || 'Командир';
    const icon = entity.icon || '';
    ctx.fillText(`${icon} ${name}`, frameW / 2, -2);
    
    // HP Text
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000'; // Black shadow
    ctx.fillText(hp, barX + barWidth + 3, barY + barHeight / 2 + 1);
    ctx.fillStyle = '#fff'; // White text
    ctx.fillText(hp, barX + barWidth + 2, barY + barHeight / 2);


    ctx.restore();
}

