let playerAppearance = {}; // Global object to hold final sprite data

function initCharacterEditor() {
    console.log("Initializing Character Editor...");

    const editorRoot = document.getElementById('character-editor-tab');
    if (!editorRoot) return;

    const optionsContainer = document.getElementById('char-editor-options');
    const playerPreviewEl = document.getElementById('char-editor-player');

    const layers = {
        base: document.getElementById('char-editor-base'),
        pants: document.getElementById('char-editor-pants'),
        top: document.getElementById('char-editor-topLayer'),
        hairBack: document.getElementById('char-editor-hairBack'),
        hat: document.getElementById('char-editor-hat'),
        bangs: document.getElementById('char-editor-bangs'),
    };

    const layerNames = { base: 'Скин', pants: 'Штаны', top: 'Верх', hairBack: 'Прическа', hat: 'Шапка', bangs: 'Челка' };

    const frameW = 32, frameH = 32, cols = 3;
    const angleToFrame = [5, 2, 1, 0, 3, 6, 7, 8];

    let mode = 'stay', walkFrame = 0, lastAnimTime = 0;
    const walkInterval = 150;
    let lastDirectionFrame = 7;
    let targetX = 0, targetY = 0;

    const skins = {
        base: ['player/player_stay.png'],
        pants: [{
            stay: 'cloth/cloth_bottom/cloth_bottom_01/cloth_bottom_stay.png',
            walk1: 'cloth/cloth_bottom/cloth_bottom_01/cloth_bottom_walk_01.png',
            walk2: 'cloth/cloth_bottom/cloth_bottom_01/cloth_bottom_walk_02.png',
        }],
        top: ['none', 'cloth/cloth_top/cloth_top_01.png'],
        hairBack: ['none', 'cloth/hair_back/hair_back_01.png'],
        hat: ['none', 'cloth/hats/hat_01.png'],
        bangs: ['none', 'cloth/bangs/bang_01.png']
    };

    const indices = { base: 0, pants: 0, top: 1, hairBack: 1, hat: 1, bangs: 1 };
    const colors = { base: '#e0e0e0', pants: '#335c81', top: '#8c3838', hairBack: '#59342b', hat: '#3d3531', bangs: '#59342b' };

    const recolorCache = {};
    let currentUrls = { pants: {} };

    function buildRecolored(src, color, onReady) {
        const key = src + '::' + color;
        if (recolorCache[key]) { onReady(recolorCache[key]); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = src;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const overlay = document.createElement('canvas');
            overlay.width = canvas.width; overlay.height = canvas.height;
            const octx = overlay.getContext('2d');
            octx.fillStyle = color;
            octx.fillRect(0, 0, overlay.width, overlay.height);
            const overlayData = octx.getImageData(0, 0, overlay.width, overlay.height);
            for (let i = 0; i < data.length; i += 4) {
                overlayData.data[i + 3] = data[i + 3] > 0 ? 128 : 0;
            }
            octx.putImageData(overlayData, 0, 0);
            ctx.globalCompositeOperation = 'multiply';
            ctx.drawImage(overlay, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
            const url = canvas.toDataURL();
            recolorCache[key] = url;
            onReady(url);
        };
        img.onerror = () => onReady(src);
    }

    function rebuildLayer(layer) {
        const color = (colors[layer] || '#ffffff').toLowerCase();
        const spriteSet = skins[layer][indices[layer]];

        if (layer === 'pants') {
            const states = ['stay', 'walk1', 'walk2'];
            let loadedCount = 0;
            states.forEach(state => {
                const sprite = spriteSet[state];
                const onReady = (url) => {
                    currentUrls.pants[state] = url;
                    playerAppearance.pants = playerAppearance.pants || {};
                    playerAppearance.pants[state] = { url: url, w: 96, h: 128 };
                    loadedCount++;
                    if (loadedCount === states.length) updateDirection();
                };
                if (color === '#ffffff') onReady(sprite); else buildRecolored(sprite, color, onReady);
            });
        } else {
            if (spriteSet === 'none') {
                currentUrls[layer] = 'none';
                playerAppearance[layer] = { url: 'none' };
                updateDirection();
                return;
            }
            const onReady = (url) => {
                currentUrls[layer] = url;
                playerAppearance[layer] = { url: url, w: 96, h: 128 };
                updateDirection();
            };
            if (color === '#ffffff') onReady(spriteSet); else buildRecolored(spriteSet, color, onReady);
        }
    }

    function applyFrame(el, spriteUrl, frame) {
        if (!el || !spriteUrl || spriteUrl === 'none') {
            if(el) el.style.backgroundImage = '';
            return;
        }
        const col = frame % cols, row = Math.floor(frame / cols);
        el.style.backgroundImage = `url(${spriteUrl})`;
        el.style.backgroundPosition = `${-col * frameW}px ${-row * frameH}px`;
    }

    function renderLayers(frame) {
        if (frame === 4) return;
        let pantsUrl = currentUrls.pants.stay;
        if (mode === 'walk') {
            pantsUrl = walkFrame === 0 ? currentUrls.pants.walk1 : currentUrls.pants.walk2;
        }
        applyFrame(layers.base, currentUrls.base, frame);
        applyFrame(layers.pants, pantsUrl, frame);
        applyFrame(layers.top, currentUrls.top, frame);
        applyFrame(layers.hairBack, currentUrls.hairBack, frame);
        applyFrame(layers.hat, currentUrls.hat, frame);
        applyFrame(layers.bangs, currentUrls.bangs, frame);
    }

    function updateDirection() {
        if (!playerPreviewEl) return;
        const rect = playerPreviewEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        const dx = targetX - cx, dy = cy - targetY;
        let frame = lastDirectionFrame;
        if (Math.hypot(dx, dy) >= 10) {
            let angle = Math.atan2(dy, dx);
            if (angle < 0) angle += Math.PI * 2;
            frame = angleToFrame[Math.floor(angle / (Math.PI * 2) * 8)];
            lastDirectionFrame = frame;
        }
        renderLayers(frame);
    }

    function editorGameLoop(ts) {
        if (editorRoot.style.display === 'none' && !document.hidden) {
            requestAnimationFrame(editorGameLoop);
            return;
        }
        if (ts - lastAnimTime > walkInterval) {
            walkFrame = 1 - walkFrame;
            lastAnimTime = ts;
        }
        updateDirection();
        requestAnimationFrame(editorGameLoop);
    }

    function createControls() {
        optionsContainer.innerHTML = '';
        for (const layer in skins) {
            if (skins[layer].length <= 1 && skins[layer][0] === 'none') continue;
            const row = document.createElement('div');
            row.className = 'char-editor-row';
            const label = document.createElement('h5');
            label.textContent = layerNames[layer];
            row.appendChild(label);
            if (skins[layer].length > 1) {
                const prevBtn = document.createElement('button');
                prevBtn.className = 'btn pixel-btn';
                prevBtn.textContent = '◀';
                prevBtn.onclick = () => { indices[layer] = (indices[layer] - 1 + skins[layer].length) % skins[layer].length; rebuildLayer(layer); };
                row.appendChild(prevBtn);
                const nextBtn = document.createElement('button');
                nextBtn.className = 'btn pixel-btn';
                nextBtn.textContent = '▶';
                nextBtn.onclick = () => { indices[layer] = (indices[layer] + 1) % skins[layer].length; rebuildLayer(layer); };
                row.appendChild(nextBtn);
            }
            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = colors[layer];
            colorInput.onchange = (e) => { colors[layer] = e.target.value; rebuildLayer(layer); };
            row.appendChild(colorInput);
            optionsContainer.appendChild(row);
        }
        const modeToggle = document.createElement('button');
        modeToggle.className = 'btn pixel-btn';
        modeToggle.textContent = 'Toggle Walk';
        modeToggle.onclick = () => { mode = (mode === 'stay' ? 'walk' : 'stay'); };
        optionsContainer.appendChild(modeToggle);
    }

    document.querySelectorAll('#new-game-tabs .tabbtn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#new-game-tabs .tabbtn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.new-game-tab-content').forEach(c => c.style.display = 'none');
            const newTab = document.getElementById(btn.dataset.tab);
            if (newTab) newTab.style.display = 'block';
        });
    });

    createControls();
    for (const layer in skins) rebuildLayer(layer);

    editorRoot.addEventListener('mousemove', e => { targetX = e.clientX; targetY = e.clientY; });

    requestAnimationFrame(editorGameLoop);
}