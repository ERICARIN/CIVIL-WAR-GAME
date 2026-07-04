// ===== Ввод =====
const kbd={}; 
let mouse={x:0,y:0,wx:0,wy:0,down:false, rdown: false};
let uiInteraction = false;
let squadFireModeIndex = 0;

// Инициализация обработчиков ввода
function initInput() {
  // Убираем initWorld() из цикла
  document.querySelectorAll('button, input, select, .slider, .window-header, .window-content, .resize-handle, .collapsible').forEach(el => {
    el.addEventListener('mousedown', (e) => { 
        uiInteraction = true; 
    });
  });

  document.addEventListener('mouseup', () => {
      uiInteraction = false;
  });

  // Если нужно, вызываем initWorld() один раз здесь
  // initWorld();

  let currentZoomIndex = 1; // Start at 1.0 zoom, which is index 1
  const zoomLevels = [2, 2, 2, 3, 4];

  // Set initial target zoom and immediately apply it
  cam.targetZoom = zoomLevels[currentZoomIndex];
  cam.zoom = cam.targetZoom;

  addEventListener('keydown', e => {
    // If chat is active, only listen for Enter and Escape
    if (chat.isActive) {
        if (e.code === 'Enter') {
            e.preventDefault();
            chat.sendMessage();
        } else if (e.code === 'Escape') {
            e.preventDefault();
            chat.toggle(false);
        }
        return; // Stop further processing of game-related keys
    }

    // --- Original keydown logic ---
    kbd[e.code] = true;
    
    // Toggle chat with 'T' (or 'Е' in Russian layout)
    if (e.code === 'KeyT') {
        e.preventDefault();
        chat.toggle(true);
        return; // Don't process other actions
    }

    if (e.code === 'KeyX') {
      if (player && player.units.length > 0) {
        squadFireModeIndex = (squadFireModeIndex + 1) % FIRE_MODES.length;
        const newMode = FIRE_MODES[squadFireModeIndex];
        player.units.forEach(u => u.fireMode = newMode.id);
        chat.addMessage(`Режим огня отряда: ${newMode.name}`, player.name, player.factionInfo, player.color);
        updateSquadUI(); // Refresh UI to show changes
      }
    }

    if (e.code === 'Escape') { 
      if (uiState.worldMapOpen) { closeWorldMap(); return; }
      togglePause(); 
    }
    if (e.code === 'Space') {
        e.preventDefault();
        if (!player) return;
        if (uiState.houseMenuOpen || uiState.shopMenuOpen || uiState.kabakMenuOpen) {
            if (uiState.houseMenuOpen) closeHouseMenu();
            if (uiState.shopMenuOpen) closeShopMenu();
            if (uiState.kabakMenuOpen) closeKabakMenu();
            player.moving = false;
            return;
        }
        if (player.insideBuilding) {
            player.moving = !player.moving;
            if (!player.moving) {
                const b = player.insideBuilding;
                if (b.type === 'house') openHouseMenu(b);
                if (b.type === 'shop') openShopMenu(b);
                if (b.type === 'kabak') openKabakMenu(b);
            }
            return;
        }
        player.moving = !player.moving;
    }

    if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        currentZoomIndex = Math.min(zoomLevels.length - 1, currentZoomIndex + 1);
        cam.targetZoom = zoomLevels[currentZoomIndex];
    }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        currentZoomIndex = Math.max(0, currentZoomIndex - 1);
        cam.targetZoom = zoomLevels[currentZoomIndex];
    }
  });

  addEventListener('keyup',e=>{ kbd[e.code]=false; });

  addEventListener('mousemove',e=>{
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;

    if (typeof screenToWorld === 'function') {
        const worldCoords = screenToWorld(e.clientX, e.clientY);
        mouse.wx = worldCoords.x;
        mouse.wy = worldCoords.y;
    }
  });

  addEventListener('mousedown',e=>{
    if (uiInteraction) return;
    if (e.button === 0) {
      mouse.down=true;
      if(player && player.alive) volley(player, mouse.wx, mouse.wy);
    }
    if (e.button === 2) mouse.rdown = true;
  });

  addEventListener('mouseup',(e)=>{ 
    if (e.button === 0) mouse.down=false;
    if (e.button === 2) mouse.rdown = false;
  });

  addEventListener('contextmenu',e=>e.preventDefault());

  canvas.addEventListener('wheel', e => {
      if (uiInteraction) return;
      e.preventDefault();
      if (e.deltaY < 0) { // Zoom in
        currentZoomIndex = Math.min(zoomLevels.length - 1, currentZoomIndex + 1);
      } else { // Zoom out
        currentZoomIndex = Math.max(0, currentZoomIndex - 1);
      }
      cam.targetZoom = zoomLevels[currentZoomIndex];
  }, { passive: false });

  initResizeSystem();
}

// ===== Resize System =====
function initResizeSystem() {
    let activeHandle = null;
    let windowPanel = null;
    let initialPos = { x: 0, y: 0 };
    let initialSize = { w: 0, h: 0 };

    const startResize = (e) => {
        e.preventDefault();
        e.stopPropagation();
        activeHandle = e.target;
        windowPanel = activeHandle.closest('.window-panel');
        if (!windowPanel) return;

        const rect = windowPanel.getBoundingClientRect();
        initialPos = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
        initialSize = { w: rect.width, h: rect.height };

        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
    };

    const resize = (e) => {
        if (!activeHandle || !windowPanel) return;

        const dx = e.clientX - initialPos.x;
        const dy = e.clientY - initialPos.y;
        const minW = parseInt(windowPanel.style.minWidth) || 150;
        const minH = parseInt(windowPanel.style.minHeight) || 100;

        if (activeHandle.classList.contains('resize-handle-br')) {
            const newWidth = Math.max(minW, initialSize.w + dx);
            const newHeight = Math.max(minH, initialSize.h + dy);
            windowPanel.style.width = newWidth + 'px';
            windowPanel.style.height = newHeight + 'px';
        } else if (activeHandle.classList.contains('resize-handle-bl')) {
            const newWidth = Math.max(minW, initialSize.w - dx);
            const newHeight = Math.max(minH, initialSize.h + dy);
            if (newWidth > minW) {
                windowPanel.style.width = newWidth + 'px';
                windowPanel.style.left = initialPos.left + dx + 'px';
            }
            windowPanel.style.height = newHeight + 'px';
        } else if (activeHandle.classList.contains('resize-handle-tr')) {
            const newWidth = Math.max(minW, initialSize.w + dx);
            const newHeight = Math.max(minH, initialSize.h - dy);
            windowPanel.style.width = newWidth + 'px';
            if (newHeight > minH) {
                windowPanel.style.height = newHeight + 'px';
                windowPanel.style.top = initialPos.top + dy + 'px';
            }
        } else if (activeHandle.classList.contains('resize-handle-tl')) {
            const newWidth = Math.max(minW, initialSize.w - dx);
            const newHeight = Math.max(minH, initialSize.h - dy);
            
            if (newWidth > minW) {
              windowPanel.style.width = newWidth + 'px';
              windowPanel.style.left = initialPos.left + dx + 'px';
            }
            if (newHeight > minH) {
              windowPanel.style.height = newHeight + 'px';
              windowPanel.style.top = initialPos.top + dy + 'px';
            }
        }
    };

    const stopResize = () => {
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
        activeHandle = null;
        windowPanel = null;
    };

    document.querySelectorAll('.resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', startResize);
    });
}

// ===== Система окон =====
function initWindowSystem() {
  const windows = Array.from(document.querySelectorAll('.window-panel'));
  let activeWindow = null, offsetX, offsetY; 
  let dragFrameRequest = null;
  
  windows.forEach(win => {
    const header = win.querySelector('.window-header');
    header.addEventListener('mousedown', e => {
      if (e.target.tagName === 'BUTTON' || e.target.classList.contains('resize-handle')) return;
      activeWindow = win; 
      windows.forEach(w => w.style.zIndex = (w === activeWindow) ? 8 : 7);
      
      const rect = win.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;

      // Convert transform-centered windows to absolute positioning on drag start
      if (win.id === 'player-menu' || win.id === 'pause-menu') {
        win.style.top = rect.top + 'px';
        win.style.left = rect.left + 'px';
        win.style.bottom = 'auto';
        win.style.transform = 'none';
      }
      
      win.classList.add('smooth-drag');
    });
  });

  document.addEventListener('mousemove', e => {
    if (!activeWindow) return;
    if (dragFrameRequest) cancelAnimationFrame(dragFrameRequest);
    dragFrameRequest = requestAnimationFrame(() => {
      if (!activeWindow) return;
      let x = e.clientX - offsetX; 
      let y = e.clientY - offsetY;
      x = Math.max(0, Math.min(x, window.innerWidth - activeWindow.offsetWidth));
      y = Math.max(0, Math.min(y, window.innerHeight - activeWindow.offsetHeight));
      activeWindow.style.left = x + 'px'; 
      activeWindow.style.top = y + 'px';
      
      if (activeWindow.id === 'player-menu') { 
        activeWindow.style.transform = 'none'; 
      }
      dragFrameRequest = null;
    });
  });

  document.addEventListener('mouseup', () => {
    if (activeWindow) { 
      activeWindow.classList.remove('smooth-drag'); 
    }
    if (dragFrameRequest) { 
      cancelAnimationFrame(dragFrameRequest); 
      dragFrameRequest = null; 
    }
    activeWindow = null;
  });
}

// ===== Drag and Drop и клики чит-меню =====
function initDragAndDrop() {
  let draggedItem = null;
  const canvas = document.querySelector('canvas');
  if (canvas) {
    canvas.setAttribute('tabindex', '0'); // делаем фокусируемым
  }

  // Use event delegation on the document body for dynamic items
  document.body.addEventListener('click', e => {
    if (!e.target.matches('.draggable-item[data-spawn]')) return;
    
    e.preventDefault();
    const spawnKey = e.target.dataset.spawn;
    handleCheatSpawn(spawnKey, undefined, undefined, true);
  });

  document.body.addEventListener('dragstart', e => {
    if (!e.target.matches('.draggable-item')) return;
    draggedItem = e.target;
    e.dataTransfer.effectAllowed = 'move';
    const data = { type: 'unknown' };
    if (draggedItem.dataset.key) { data.type = 'inventory'; data.key = draggedItem.dataset.key; }
    if (draggedItem.dataset.spawn) { data.type = 'spawn'; data.key = draggedItem.dataset.spawn; }
    e.dataTransfer.setData('text/plain', JSON.stringify(data));
  });

  // Prevent spacebar from triggering clicks on focused buttons
  document.body.addEventListener('keydown', e => {
      if (e.code === 'Space' && e.target.matches('.draggable-item')) {
          e.preventDefault();
          canvas?.focus();
      }
  });



  canvas.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
  canvas.addEventListener('drop', e => {
    e.preventDefault(); 
    if (!player) return;
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const rect = canvas.getBoundingClientRect(); 
      const dpr = window.devicePixelRatio || 1;
      const viewX = e.clientX - rect.left; 
      const viewY = e.clientY - rect.top;
      
      // Это ВЕРХНИЙ ЛЕВЫЙ угол, привязанный к сетке
      const worldX = snapToMainGrid(player.x + (viewX - W / dpr / 2) / cam.zoom);
      const worldY = snapToMainGrid(player.y + (viewY - H / dpr / 2) / cam.zoom);

      if (data.type === 'inventory') {
        const key = data.key;
        if (key === 'squad' && player.units.length > 0) { const unit = player.units.pop(); newFarmer(worldX, worldY); redistributeHP(player); } 
        else if (key === 'rub' && player.inv.money >= 10) { createLoot(worldX, worldY, 'money', 10); player.inv.money -= 10; } 
        else if (key === 'ammo' && player.inv.ammo >= 100) { createLoot(worldX, worldY, 'ammo', 100); player.inv.ammo -= 100; } 
        else if (key === 'unit' && player.inv.unit > 0) { createLoot(worldX, worldY, 'unit', 1); player.inv.unit--; } 
        else if (key === 'cmd' && player.inv.cmd > 0) { createLoot(worldX, worldY, 'cmd', 1); player.inv.cmd--; }
        else if (key === 'contract_paper' && player.inv.contract_paper > 0) {
            const allianceToPause = playerAlliances.find(a => !a.isPaused);
            if (allianceToPause) {
                pauseAlliance(allianceToPause.id);
            }
        }
        forceUpdateInventoryUI();
      } else if (data.type === 'spawn') {
        let spawnX = worldX;
        let spawnY = worldY;
        let buildingWidth = 0;
        let buildingHeight = 0;

        // Определяем размер здания по ключу
        switch(data.key) {
            case 'house':
                buildingWidth = HOUSE_SIZE;
                buildingHeight = HOUSE_SIZE;
                break;
            case 'shop':
                buildingWidth = SHOP_SIZE;
                buildingHeight = SHOP_SIZE;
                break;
            case 'kabak':
                buildingWidth = KABAK_SIZE;
                buildingHeight = KABAK_SIZE;
                break;
        }

        // Если это здание, вычисляем центр из верхнего левого угла
        if (buildingWidth > 0) {
            spawnX = worldX + buildingWidth / 2;
            spawnY = worldY + buildingHeight / 2;
        }
        
        const b = handleCheatSpawn(data.key, spawnX, spawnY, false);
        if (b) { b.generated = true; b.noAutoSpawn = true; }
      }
    } catch (err) { console.error("Drop error:", err); }
  });
}