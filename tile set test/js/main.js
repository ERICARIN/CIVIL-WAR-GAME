// ===== Управление фракциями =====
let gameFactions = [];
let nextFactionIndex = 0; // For assigning factions to enemies

function forceUpdateInventoryUI() {
    if (!player) return;

    const inventoryMap = {
        'money': player.inv.money,
        'ammo': player.inv.ammo,
        'unit': player.inv.unit,
        'cmd': player.inv.cmd,
        'contract_paper': player.inv.contract_paper,
        'squad': 1 + (player.units ? player.units.length : 0)
    };

    for (const key in inventoryMap) {
        const slot = document.querySelector(`.inv-slot[data-key="${key}"]`);
        if (slot) {
            slot.querySelector('.cnt').textContent = inventoryMap[key] || 0;
        }
    }

    if (typeof updateGarrisonInventoryCounter === 'function') {
        updateGarrisonInventoryCounter();
    }
}

function initializeFactions() {
    const savedFactions = JSON.parse(localStorage.getItem('customFactions') || '[]');
    gameFactions = [...DEFAULT_FACTIONS, ...savedFactions];
}

function getSavedFactions() {
    return JSON.parse(localStorage.getItem('customFactions') || '[]');
}

function saveCustomFaction() {
    const name = document.getElementById('customFactionName').value.trim();
    if (!name) {
        showNotification('Название фракции не может быть пустым.', 3000);
        return;
    }

    const newFaction = {
        id: 'custom_' + name.toLowerCase().replace(/\s+/g, '_'),
        name: name,
        color: document.getElementById('customColorPicker').value,
        icon: document.getElementById('customFactionIcon').textContent,
        description: document.getElementById('customFactionDescription').value.trim() || 'Пользовательская фракция.'
    };

    let factions = getSavedFactions();
    const existingIndex = factions.findIndex(f => f.id === newFaction.id);

    if (existingIndex > -1) {
        factions[existingIndex] = newFaction;
    } else {
        factions.push(newFaction);
    }

    localStorage.setItem('customFactions', JSON.stringify(factions));
    showNotification(`Фракция "${name}" сохранена!`, 3000);
    
    initializeFactions(); // Re-initialize global list
    populateFactionSelect(); // Re-populate dropdown
    document.getElementById('factionSelect').value = newFaction.id;
    document.getElementById('factionSelect').dispatchEvent(new Event('change'));
}

function deleteCustomFaction() {
    const factionId = document.getElementById('factionSelect').value;
    if (!factionId || !factionId.startsWith('custom_')) {
        showNotification('Это не пользовательская фракция.', 3000);
        return;
    }

    let factions = getSavedFactions();
    factions = factions.filter(f => f.id !== factionId);
    localStorage.setItem('customFactions', JSON.stringify(factions));
    showNotification('Фракция удалена!', 3000);

    initializeFactions();
    populateFactionSelect();
    factionSelect.value = 'red'; // Reset to default
    document.getElementById('factionSelect').dispatchEvent(new Event('change'));
    populateFactionSpawners(); // Update cheat menu
}

function populateFactionSpawners() {
    const container = document.getElementById('faction-spawn-buttons');
    if (!container) return;
    container.innerHTML = ''; // Clear old buttons

    // Add random spawn button
    const randomBtn = document.createElement('button');
    randomBtn.className = 'btn pixel-btn draggable-item';
    randomBtn.dataset.spawn = 'enemy';
    randomBtn.title = 'Случайный враг';
    randomBtn.innerHTML = '❓';
    randomBtn.draggable = true;
    container.appendChild(randomBtn);

    // Add button for each faction
    gameFactions.forEach(faction => {
        const btn = document.createElement('button');
        btn.className = 'btn pixel-btn draggable-item';
        btn.dataset.spawn = `faction_${faction.id}`;
        btn.title = faction.name;
        btn.innerHTML = faction.icon;
        btn.draggable = true;
        container.appendChild(btn);
    });
    
    // Re-initialize drag/drop and press logic for the new buttons
    // initDragAndDrop(); // This is now handled by event delegation
}

function populateFactionSelect() {
    const factionSelect = document.getElementById('factionSelect');
    const currentValue = factionSelect.value;
    factionSelect.innerHTML = ''; // Clear existing options

    gameFactions.forEach(faction => {
        const option = document.createElement('option');
        option.value = faction.id;
        option.textContent = `${faction.name} ${faction.icon}`;
        option.dataset.color = faction.color;
        option.dataset.icon = faction.icon;
        if (faction.id.startsWith('custom_')) {
            option.dataset.custom = true;
        }
        factionSelect.appendChild(option);
    });

    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = 'Своя фракция';
    factionSelect.appendChild(customOption);

    factionSelect.value = currentValue;
    if (!factionSelect.value) {
        factionSelect.value = 'red';
    }
}

// ===== Состояние игры =====
var gameMode = 'free'; // free, journey, war, custom
var maxContracts = 3;
let previousScreen = 'main-menu-screen'; // Для кнопки "Назад" в настройках

// ===== Управление экранами меню =====
function showScreen(screenId) {
    document.querySelectorAll('#pause-menu .menu-screen').forEach(screen => {
        screen.style.display = 'none';
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.style.display = 'flex'; // Use flex for centering columns
    }

    const titleEl = document.getElementById('pause-menu-title');
    switch (screenId) {
        case 'main-menu-screen':
            titleEl.textContent = 'Гражданская война';
            break;
        case 'in-game-pause-screen':
            titleEl.textContent = 'Пауза';
            break;
        case 'play-screen':
            titleEl.textContent = 'Новая игра';
            break;
        case 'settings-screen':
            titleEl.textContent = 'Настройки';
            break;
    }
}

// ===== Пауза/настройки =====
function showInGamePauseMenu() {
    const pauseMenu = document.getElementById('pause-menu');
    pauseMenu.style.display = 'block';
    showScreen('in-game-pause-screen');
    previousScreen = 'in-game-pause-screen';
}

function showMainMenu() {
    const pauseMenu = document.getElementById('pause-menu');
    pauseMenu.style.display = 'block';
    showScreen('main-menu-screen');
    previousScreen = 'main-menu-screen';
}

function togglePause() {
  paused = !paused;
  if (paused) {
      if (running) {
          showInGamePauseMenu();
      } else {
          showMainMenu();
      }
  } else {
      document.getElementById('pause-menu').style.display = 'none';
  }
}

function applySettings() {
  mech.leaveOnBaseChange=document.getElementById('leaveBaseChk').checked;
  mech.friendlyFire = document.getElementById('friendlyFireChk').checked;
  document.documentElement.setAttribute('data-theme', document.getElementById('themeSel').value);
  applyThemeColors();
    musicOn = document.getElementById('musicChk').checked;
  sfxOn = document.getElementById('sfxChk').checked;
  toggleMusic(musicOn);
  toggleSfx(sfxOn);
  const cheatsHidden = document.getElementById('hideCheatsChk').checked;
  if (running) {
    document.getElementById('panel').style.display = cheatsHidden ? 'none' : 'block';
  } else {
    document.getElementById('panel').style.display = 'none';
  }
  coordXInput.readOnly = cheatsHidden;
  coordYInput.readOnly = cheatsHidden;
  hideMinimap = document.getElementById('hideMinimapChk').checked;
  if(running) document.getElementById('minimap-panel').style.display = hideMinimap ? 'none' : 'block';
}

function bindAuto(id, key){
  const input=document.getElementById(id), label=document.getElementById(id+'Val');
  input.oninput=()=>{ auto[key]=parseInt(input.value,10)||0; label.textContent=auto[key]; };
  input.addEventListener('wheel',e=>{
    e.preventDefault(); 
    const step=Math.sign(-e.deltaY);
    const v=clamp((parseInt(input.value,10)||0)+step,input.min,input.max);
    input.value=v;
    input.oninput();
  });
  input.oninput();
}

// ===== Старт/инициализация =====
function getPlayerFaction() {
    const sel = document.getElementById('factionSelect');
    const factionId = sel.value;

    if (factionId === 'custom') {
        return {
            id: 'custom_new',
            name: document.getElementById('customFactionName').value.trim() || 'Игрок',
            color: document.getElementById('customColorPicker').value,
            icon: document.getElementById('customFactionIcon').textContent,
            description: FACTION_INFO.custom
        };
    }
    
    // Find from the global list
    return gameFactions.find(f => f.id === factionId);
}

// ===== Custom Game Modes =====
function saveCustomMode() {
    const modeName = prompt("Введите название для нового режима:");
    if (!modeName) return;

    const modeSettings = {
        // General
        enemyAiMode: document.getElementById('enemyAiModeSel').value,
        diffKnob: document.getElementById('diffSlider').value,
        squadLimit: document.getElementById('squadLimitSlider').value,
        contractLimit: document.getElementById('contractLimitSlider').value,
        // Speeds
        speedPlayer: document.getElementById('speedPlayer').value,
        speedEnemy: document.getElementById('speedEnemy').value,
        speedAlly: document.getElementById('speedAlly').value,
        speedGlobal: document.getElementById('speedGlobal').value,
        // Firerates
        fireratePlayer: document.getElementById('fireratePlayer').value,
        firerateEnemy: document.getElementById('firerateEnemy').value,
        firerateAlly: document.getElementById('firerateAlly').value,
        firerateGlobal: document.getElementById('firerateGlobal').value,
        // Inventory (from player object, which is a proxy in this state)
        inv: player ? player.inv : { ammo: 0, money: 0, unit: 0, cmd: 0 },
        // Spawn Coords
        spawnX: document.getElementById('coordX').value,
        spawnY: document.getElementById('coordY').value
    };

    let savedModes = JSON.parse(localStorage.getItem('customGameModes') || '[]');
    const newMode = { id: 'custom_' + Date.now(), name: modeName, settings: modeSettings };
    savedModes.push(newMode);
    localStorage.setItem('customGameModes', JSON.stringify(savedModes));

    loadCustomModes(); // Refresh the buttons
    showNotification(`Режим "${modeName}" сохранен!`);
}

function deleteCustomMode(modeId) {
    if (!confirm("Вы уверены, что хотите удалить этот режим?")) return;
    let savedModes = JSON.parse(localStorage.getItem('customGameModes') || '[]');
    savedModes = savedModes.filter(mode => mode.id !== modeId);
    localStorage.setItem('customGameModes', JSON.stringify(savedModes));
    loadCustomModes(); // Refresh the buttons
}

function loadCustomModes() {
    const container = document.querySelector('#gameModeSelection .rowline');
    // Remove existing custom mode buttons
    container.querySelectorAll('.custom-mode-btn').forEach(btn => btn.remove());

    const savedModes = JSON.parse(localStorage.getItem('customGameModes') || '[]');
    savedModes.forEach(mode => {
        const btn = document.createElement('button');
        btn.id = mode.id;
        btn.className = 'btn pixel-btn mode-btn custom-mode-btn';
        btn.title = mode.name;
        btn.innerHTML = `<span class="pixel-emoji">💾</span>`; // Generic save icon
        container.appendChild(btn);
    });
}

function applyCustomMode(modeId) {
    const savedModes = JSON.parse(localStorage.getItem('customGameModes') || '[]');
    const mode = savedModes.find(m => m.id === modeId);
    if (!mode) return;

    const settings = mode.settings;
    // Apply settings to UI
    document.getElementById('enemyAiModeSel').value = settings.enemyAiMode;
    document.getElementById('diffSlider').value = settings.diffKnob;
    document.getElementById('squadLimitSlider').value = settings.squadLimit;
    document.getElementById('contractLimitSlider').value = settings.contractLimit;
    document.getElementById('speedPlayer').value = settings.speedPlayer;
    document.getElementById('speedEnemy').value = settings.speedEnemy;
    document.getElementById('speedAlly').value = settings.speedAlly;
    document.getElementById('speedGlobal').value = settings.speedGlobal;
    document.getElementById('fireratePlayer').value = settings.fireratePlayer;
    document.getElementById('firerateEnemy').value = settings.firerateEnemy;
    document.getElementById('firerateAlly').value = settings.firerateAlly;
    document.getElementById('firerateGlobal').value = settings.firerateGlobal;
    document.getElementById('coordX').value = settings.spawnX;
    document.getElementById('coordY').value = settings.spawnY;

    // Manually trigger input events for sliders to update their labels
    document.querySelectorAll('.slider').forEach(slider => slider.dispatchEvent(new Event('input')));

    // Apply inventory
    if (player) {
        player.inv = settings.inv;
        forceUpdateInventoryUI();
    }
}


async function initWorld(startInventory = {}, spriteData = null){
  console.log('initWorld: Starting world initialization.');
  worldData.clear();
  worldGrid.clear();
  getOrCreateRegion(0, 0);
  const faction = getPlayerFaction();

  // Use spawn coordinates from the UI, with a fallback
  const spawnX = (parseInt(document.getElementById('coordX').value, 10) || (REGION_SIZE / 2 / TILE_SIZE)) * TILE_SIZE;
  const spawnY = (parseInt(document.getElementById('coordY').value, 10) || (REGION_SIZE / 2 / TILE_SIZE)) * TILE_SIZE;

  console.log(`initWorld: Spawning player at (${spawnX}, ${spawnY}) in region ${getRegionKey(spawnX, spawnY)}.`);
  newGroup({
      x: spawnX, 
      y: spawnY, 
      color:faction.color, 
      name:document.getElementById('nameInput').value.trim() || 'Ком. Игрок', 
      isPlayer:true, 
      faction:FACTIONS.PLAYER,
      icon: faction.icon,
      factionInfo: faction,
      inv: startInventory,
      spriteData: spriteData
    });
  stats.kills=0; stats.startTime=performance.now(); forceUpdateInventoryUI(); updateDossierUI();
  updatePlayerContractsTab();
  console.log('initWorld: World initialization complete.');
}







async function startGame() {







  PLAYER_PROXIMITY_RADIUS = 0; // Explicitly set to 0 at start







  loadTextures();







  if (typeof initAudio === 'function' && !window.isAudioInitialized) {







    initAudio();







  }







  let startInventory = {};







  document.getElementById('hideCheatsChk').disabled = false;







  







  if (!gameMode.startsWith('custom')) {







    switch(gameMode) {







        case 'free':







            enemyAiMode = 'neutral';







            startInventory = { ammo: 99999, money: 99999 };







            document.getElementById('hideCheatsChk').checked = false;







            break;







        case 'journey':







            enemyAiMode = 'faction_war';







            startInventory = { ammo: 120, money: 0 };







            document.getElementById('hideCheatsChk').checked = true;







            document.getElementById('hideCheatsChk').disabled = true;







            break;







        case 'war':







            enemyAiMode = 'player_aggro';







            startInventory = { ammo: 120, money: 0 };







            document.getElementById('hideCheatsChk').checked = true;







            document.getElementById('hideCheatsChk').disabled = true;







            break;







        case 'custom':







            // This case is for when the 'new custom' button is active







            // but no specific saved mode is selected. It's a sandbox.







            break;







    }







  }















  // Preload the character sprite







  const loadedLayers = await preloadSprite(playerAppearance);







  const spriteData = { layers: loadedLayers };















  document.getElementById('pause-menu').style.display = 'none';







  document.getElementById('player-menu').style.display = 'block';







  document.getElementById('minimap-panel').style.display = 'block';















  running = true; paused = false;







  console.log(`startGame: PLAYER_PROXIMITY_RADIUS before initWorld: ${PLAYER_PROXIMITY_RADIUS}`);







  initWorld(startInventory, spriteData);







  console.log(`startGame: PLAYER_PROXIMITY_RADIUS after initWorld: ${PLAYER_PROXIMITY_RADIUS}`);







  applySettings();







}

// ===== Карта мира =====
const worldMapContainer = document.getElementById('world-map-container');
const worldMapCanvas = document.getElementById('world-map-canvas');
const wmctx = worldMapCanvas.getContext('2d');
let worldMapState = { zoom: 1, panX: 0, panY: 0, isPanning: false, lastX: 0, lastY: 0 };

function openWorldMap() {
  if (paused) return;
  uiState.worldMapOpen = true;
  worldMapContainer.style.display = 'flex';
  drawWorldMap();
}

function closeWorldMap() {
  uiState.worldMapOpen = false;
  worldMapContainer.style.display = 'none';
}

function drawWorldMap() {
  const size = Math.min(window.innerWidth, window.innerHeight) * 0.9;
  worldMapCanvas.width = size;
  worldMapCanvas.height = size;

  const keys = Array.from(worldData.keys());
  if (keys.length === 0) return;

  let minRx = Infinity, maxRx = -Infinity, minRy = Infinity, maxRy = -Infinity;
  keys.forEach(key => {
    const {rx, ry} = getRegionCoords(key);
    minRx = Math.min(minRx, rx); maxRx = Math.max(maxRx, rx);
    minRy = Math.min(minRy, ry); maxRy = Math.max(maxRy, ry);
  });

  const worldWidthRegions = maxRx - minRx + 1;
  const worldHeightRegions = maxRy - minRy + 1;
  const baseRegionPixelSize = Math.min(size / worldWidthRegions, size / worldHeightRegions);
  
  wmctx.fillStyle = fieldColor;
  wmctx.fillRect(0, 0, size, size);

  wmctx.save();
  wmctx.translate(size/2 + worldMapState.panX, size/2 + worldMapState.panY);
  wmctx.scale(worldMapState.zoom, worldMapState.zoom);
  wmctx.translate(-size/2, -size/2);

  for(const [key, region] of worldData.entries()) {
    const {rx, ry} = getRegionCoords(key);
    const x = (rx - minRx) * baseRegionPixelSize;
    const y = (ry - minRy) * baseRegionPixelSize;

    wmctx.strokeStyle = '#444';
    wmctx.lineWidth = 1 / worldMapState.zoom;
    wmctx.strokeRect(x, y, baseRegionPixelSize, baseRegionPixelSize);

    const scale = baseRegionPixelSize / REGION_SIZE;
    wmctx.fillStyle = roadColor;
    for(const village of region.villages) {
      for(const path of village.paths) {
        wmctx.fillRect(x + (path.x - rx * REGION_SIZE) * scale, y + (path.y - ry * REGION_SIZE) * scale, path.w * scale, path.h * scale);
      }
    }
    for(const b of [...region.houses, ...region.shops, ...region.kabaks]) {
      wmctx.fillStyle = b.type === 'house' ? houseColor : (b.type === 'shop' ? shopColor : kabakColor);
      wmctx.fillRect(x + (b.x - b.w/2 - rx * REGION_SIZE) * scale, y + (b.y - b.h/2 - ry * REGION_SIZE) * scale, b.w * scale, b.h * scale);
    }
    
    if (worldMapState.zoom > 1.5) {
      for(const village of region.villages) {
        wmctx.fillStyle = '#fff';
        wmctx.font = `${clamp(baseRegionPixelSize/20, 8, 14) / worldMapState.zoom}px system-ui`;
        wmctx.textAlign = 'center';
        const vx = x + (village.x - rx * REGION_SIZE) * scale;
        const vy = y + (village.y - ry * REGION_SIZE) * scale;
        wmctx.fillText(village.name, vx, vy);
      }
    }
  }
  
  if (player) {
    const playerMapX = (player.x - minRx * REGION_SIZE) * baseRegionPixelSize / REGION_SIZE;
    const playerMapY = (player.y - minRy * REGION_SIZE) * baseRegionPixelSize / REGION_SIZE;
    wmctx.fillStyle = player.color;
    wmctx.beginPath();
    wmctx.arc(playerMapX, playerMapY, 4 / worldMapState.zoom, 0, Math.PI * 2);
    wmctx.fill();
    wmctx.strokeStyle = '#fff';
    wmctx.lineWidth = 1 / worldMapState.zoom;
    wmctx.stroke();
  }
  wmctx.restore();
}

// ===== Телепорт и координаты =====
const coordXInput = document.getElementById('coordX');
const coordYInput = document.getElementById('coordY');
const timerEl = document.getElementById('game-timer');

function updateCoords() {
  if (player) { coordXInput.value = Math.round(player.x / TILE_SIZE); coordYInput.value = Math.round(player.y / TILE_SIZE); }
  if (running && stats.startTime > 0) {
    const elapsed = (performance.now() - stats.startTime) / 1000;
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = Math.floor(elapsed % 60).toString().padStart(2, '0');
    timerEl.textContent = `${minutes}:${seconds}`;
  }
}

function teleport() {
  if (player && !document.getElementById('hideCheatsChk').checked) {
    const tileX = parseInt(coordXInput.value);
    const tileY = parseInt(coordYInput.value);
    
    const newX = isNaN(tileX) ? player.x : tileX * TILE_SIZE;
    const newY = isNaN(tileY) ? player.y : tileY * TILE_SIZE;

    const dx = newX - player.x; const dy = newY - player.y;
    player.x = newX; player.y = newY;
    player.units.forEach(u => { u.x += dx; u.y += dy; });
  }
}

// ===== Сохранение и загрузка =====

function getGameState() {
    const worldDataArray = Array.from(worldData.entries());
    const gameState = {
        gameMode,
        enemyAiMode,
        diffKnob,
        maxSquadSize,
        maxContracts,
        player: player,
        worldData: worldDataArray,
        stats,
        mech,
        auto,
        alliances: playerAlliances,
    };
    return JSON.stringify(gameState, (key, value) => {
        if (key === 'insideBuilding' && value) {
            return { type: value.type, x: value.x, y: value.y };
        }
        return value;
    });
}

function saveGame(saveName) {
    if (!saveName) {
        openSaveAsModal();
        return;
    }
    try {
        const screenshot = canvas.toDataURL('image/jpeg', 0.7);
        const gameState = getGameState();
        let savedGames = JSON.parse(localStorage.getItem('savedGames') || '[]');
        const save = {
            name: saveName,
            date: new Date().toISOString(),
            gameState: gameState,
            screenshot: screenshot,
            worldInfo: {
                regions: worldData.size,
                playerLevel: player ? player.units.length : 0,
            }
        };
        const existingSaveIndex = savedGames.findIndex(s => s.name === saveName);
        if (existingSaveIndex > -1) {
            savedGames[existingSaveIndex] = save;
        } else {
            savedGames.push(save);
        }
        localStorage.setItem('savedGames', JSON.stringify(savedGames));
        currentGame.name = saveName;
        showNotification(`Игра "${saveName}" сохранена!`);
        closeSaveAsModal();
    } catch (e) {
        console.error("Ошибка при сохранении игры:", e);
        showNotification("Ошибка: не удалось сохранить игру. Возможно, хранилище переполнено или отключено.", 5000);
    }
}

function loadGame(saveObject) {
    try {
        const savedState = JSON.parse(saveObject.gameState);
        worldData.clear();
        gameMode = savedState.gameMode;
        enemyAiMode = savedState.enemyAiMode;
        diffKnob = savedState.diffKnob;
        maxSquadSize = savedState.maxSquadSize;
        maxContracts = savedState.maxContracts;
        stats = savedState.stats;
        mech = savedState.mech;
        auto = savedState.auto;
        playerAlliances = savedState.alliances || [];

        const worldDataMap = new Map(savedState.worldData);
        worldDataMap.forEach((value, key) => {
            worldData.set(key, value);
        });

        player = savedState.player;
        
        worldData.forEach(region => {
            region.groups.forEach(group => {
                if (group.isPlayer) {
                    player = group;
                }
                if (group.insideBuilding) {
                    const bPos = group.insideBuilding;
                    group.insideBuilding = findBuildingAt(bPos.x, bPos.y);
                }
            });
        });

        applyDiff();
        forceUpdateInventoryUI();
        updatePlayerContractsTab();
        
        document.getElementById('pause-menu').style.display = 'none';
        document.getElementById('saved-games-container').style.display = 'none';
        document.getElementById('player-menu').style.display = 'block';
        document.getElementById('minimap-panel').style.display = 'block';

        currentGame.name = saveObject.name;
        running = true;
        paused = false;
        showNotification(`Игра "${saveObject.name}" загружена!`);
    } catch (e) {
        console.error("Ошибка при загрузке игры:", e);
        showNotification("Ошибка: не удалось загрузить сохранение.", 5000);
        location.reload();
    }
}

function findBuildingAt(x, y) {
    const region = getOrCreateRegion(x, y);
    const allBuildings = [...region.houses, ...region.shops, ...region.kabaks];
    return allBuildings.find(b => b.x === x && b.y === y);
}

function openSaveAsModal() {
    document.getElementById('save-as-modal').style.display = 'block';
    document.getElementById('save-name-input').focus();
}

function closeSaveAsModal() {
    document.getElementById('save-as-modal').style.display = 'none';
}

function showSavedGamesMenu() {
    document.getElementById('saved-games-container').style.display = 'block';
    document.getElementById('pause-menu').style.display = 'none';
    renderSavedGames();
}

function closeSavedGamesMenu() {
    document.getElementById('saved-games-container').style.display = 'none';
    document.getElementById('pause-menu').style.display = 'block';
}

function renderSavedGames() {
    const listEl = document.getElementById('saved-games-list');
    listEl.innerHTML = '';
    try {
        const savedGames = JSON.parse(localStorage.getItem('savedGames') || '[]');
        if (savedGames.length === 0) {
            listEl.innerHTML = '<p style="text-align:center; width:100%;">Нет сохраненных игр.</p>';
            return;
        }
        savedGames.forEach(save => {
            const card = document.createElement('div');
            card.className = 'saved-game-card';
            const date = new Date(save.date);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
            card.innerHTML = `
                <h3>${save.name}</h3>
                <img src="${save.screenshot}" class="saved-game-screenshot">
                <div class="saved-game-info">
                    <p>Дата: ${formattedDate}</p>
                    <p>Регионов: ${save.worldInfo.regions}</p>
                    <p>Размер отряда: ${save.worldInfo.playerLevel}</p>
                </div>
                <div class="saved-game-actions">
                    <button class="btn pixel-btn" style="flex:1">Загрузить</button>
                    <button class="btn pixel-btn" style="flex:0.5">❌</button>
                </div>
            `;
            card.querySelector('.btn:first-child').onclick = () => loadGame(save);
            card.querySelector('.btn:last-child').onclick = (e) => {
                e.stopPropagation();
                if (confirm(`Удалить сохранение "${save.name}"?`)) {
                    deleteSave(save.name);
                }
            };
            listEl.appendChild(card);
        });
    } catch (e) {
        console.error("Ошибка при загрузке сохраненных игр:", e);
        listEl.innerHTML = '<p style="text-align:center; width:100%; color: #ff6363;">Ошибка чтения сохранений.</p>';
    }
}

function deleteSave(saveName) {
    try {
        let savedGames = JSON.parse(localStorage.getItem('savedGames') || '[]');
        savedGames = savedGames.filter(s => s.name !== saveName);
        localStorage.setItem('savedGames', JSON.stringify(savedGames));
        renderSavedGames();
    } catch (e) {
        console.error("Ошибка при удалении сохранения:", e);
        showNotification("Ошибка: не удалось удалить сохранение.", 5000);
    }
}

// ===== Основной цикл =====
let lastTs=performance.now();
function loop(ts){
  let dt = (ts - lastTs) / 1000;
  if (dt > 1.0) { // If tab was inactive, just reset timer and skip frame
    lastTs = ts;
    requestAnimationFrame(loop);
    return;
  }
  dt = Math.max(0, Math.min(0.05, dt)); // Keep existing clamping
  lastTs = ts;

  try {
    if(running && !paused){ step(dt); }
    draw(dt);
  } catch (e) {
    console.error("Error in game loop:", e);
    // We can pause the game here to prevent further errors if we want
    // paused = true; 
  }
  
  if (running) updateCoords();  
  requestAnimationFrame(loop);
}

// ===== Инициализация =====
document.addEventListener('DOMContentLoaded', () => {
  applyPixelUI();
  initInput();
  chat.init(); // Initialize the chat system
  initWindowSystem();
  initDragAndDrop();
  initializeFactions(); // Initialize the global faction list
  initCharacterEditor(); // Initialize the character editor UI and logic
  populateFactionSpawners(); // Populate spawn buttons on startup


  // Function to set up a collapsible window panel
  function setupCollapsiblePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) return;

    const toggle = panel.querySelector('.collapse-toggle');
    const content = panel.querySelector('.window-content');
    if (!toggle || !content) return;

    // Initial state: if 'expanded' class is not present, hide content
    if (!toggle.classList.contains('expanded')) {
      content.style.display = 'none';
    }

    toggle.addEventListener('click', () => {
      toggle.classList.toggle('expanded');
      content.style.display = content.style.display === 'none' ? 'block' : 'none';
      // Adjust panel height if it was set
      if (panel.style.height && content.style.display === 'none') {
        panel.dataset.originalHeight = panel.style.height;
        panel.style.height = panel.querySelector('.window-header').offsetHeight + 'px';
      } else if (panel.dataset.originalHeight && content.style.display === 'block') {
        panel.style.height = panel.dataset.originalHeight;
        delete panel.dataset.originalHeight;
      }
    });
  }

  // Set up collapsible functionality for main panels
  setupCollapsiblePanel('player-menu');
  setupCollapsiblePanel('panel'); // Cheat menu
  setupCollapsiblePanel('minimap-panel');
  setupCollapsiblePanel('pause-menu');

  // --- Новая логика меню ---
  const pauseMenu = document.getElementById('pause-menu');

  pauseMenu.addEventListener('click', e => {
      if (e.target.matches('[data-screen]')) {
          const screenId = e.target.dataset.screen;
          if (screenId === 'previous-screen') {
              showScreen(previousScreen);
          } else {
              const currentScreen = e.target.closest('.menu-screen');
              if (currentScreen && currentScreen.id !== 'settings-screen') {
                  previousScreen = currentScreen.id;
              }
              showScreen(screenId);
          }
      }
  });

  document.getElementById('show-saved-games-btn').onclick = showSavedGamesMenu;
  document.getElementById('resume-btn').onclick = togglePause;
  document.getElementById('save-btn').onclick = () => saveGame(currentGame.name);
  document.getElementById('save-as-btn').onclick = openSaveAsModal;
  document.getElementById('to-main-menu-btn').onclick = () => location.reload();
  document.getElementById('startNewGameBtn').onclick = startGame;
  document.getElementById('close-saved-games').onclick = closeSavedGamesMenu;
  document.getElementById('save-game-cancel').onclick = closeSaveAsModal;
  document.getElementById('save-game-confirm').onclick = () => {
      const saveName = document.getElementById('save-name-input').value.trim();
      if (saveName) {
          saveGame(saveName);
      }
  };

  // --- Старая логика инициализации ---
  document.getElementById('leaveBaseChk').onchange = applySettings;
  document.getElementById('friendlyFireChk').onchange = applySettings;
  document.getElementById('themeSel').onchange = applySettings;
  document.getElementById('musicChk').onchange = applySettings;
  document.getElementById('sfxChk').onchange = applySettings;
  document.getElementById('hideCheatsChk').onchange = applySettings;
  document.getElementById('hideMinimapChk').onchange = applySettings;
  document.getElementById('fieldColor').oninput = e => { fieldColor = e.target.value; };
  document.getElementById('houseColor').oninput = e => { houseColor = e.target.value; };
  document.getElementById('shopColorInput').oninput = e => { shopColor = e.target.value; };

  document.getElementById('gridChk').onchange = e => showGrid = e.target.checked;
  document.getElementById('microGridChk').onchange = e => showMicroGrid = e.target.checked;
  document.getElementById('villageAreasChk').onchange = e => showVillageAreas = e.target.checked;
  document.getElementById('allyLeashChk').onchange = e => showAllyLeash = e.target.checked;
  
  const enemyAiModeSel = document.getElementById('enemyAiModeSel');
  const friendlyFireSetting = document.getElementById('friendlyFireSetting');
  enemyAiModeSel.onchange = e => { 
    enemyAiMode = e.target.value; 
    friendlyFireSetting.style.display = enemyAiMode === 'faction_war' ? 'flex' : 'none';
  };
  enemyAiModeSel.onchange({target: enemyAiModeSel});

  const diffSlider=document.getElementById('diffSlider'), diffVal=document.getElementById('diffVal');
  diffSlider.oninput=()=>{ diffKnob=parseInt(diffSlider.value,10)||0; diffVal.textContent=diffKnob; applyDiff(); };
  diffSlider.addEventListener('wheel',e=>{
    e.preventDefault(); 
    const step=(e.shiftKey?10:(e.ctrlKey?1:5))*Math.sign(-e.deltaY);
    const v=clamp((parseInt(diffSlider.value,10)||0)+step,-50,50);
    diffSlider.value=v;
    diffSlider.oninput();
  });
  
  const squadLimitSlider=document.getElementById('squadLimitSlider'), squadLimitVal=document.getElementById('squadLimitVal');
  squadLimitSlider.oninput=()=>{ maxSquadSize=parseInt(squadLimitSlider.value,10)||12; squadLimitVal.textContent=maxSquadSize; };

  const contractLimitSlider=document.getElementById('contractLimitSlider'), contractLimitVal=document.getElementById('contractLimitVal');
  contractLimitSlider.oninput=()=>{ maxContracts=parseInt(contractLimitSlider.value,10)||3; contractLimitVal.textContent=maxContracts; };

  const bulletRangeSlider=document.getElementById('bulletRangeSlider'), bulletRangeVal=document.getElementById('bulletRangeVal');
  bulletRangeSlider.oninput=()=>{ 
      bulletMaxRangeTiles=parseInt(bulletRangeSlider.value,10)||12; 
      bulletRangeVal.textContent=bulletMaxRangeTiles; 
      BULLET_LIFE = (bulletMaxRangeTiles * TILE_SIZE) / BULLET_SPEED;
  };
  bulletRangeSlider.oninput();

  function bindHpSlider(sliderId, valueId, variableName, targetType) {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(valueId);
    if (!slider || !label) return;
    slider.oninput = () => {
        const newValue = parseInt(slider.value, 10) || 0;
        window[variableName] = newValue;
        label.textContent = newValue;

        // Real-time update logic
        if (!window.worldData) return;
        for (const region of worldData.values()) {
            if (targetType === 'commander' || targetType === 'all') {
                for (const g of region.groups) {
                    g.maxHp = newValue;
                    g.cmdHp = newValue; // Set current HP to new max
                }
            }
            if (targetType === 'unit' || targetType === 'all') {
                for (const g of region.groups) {
                    for (const u of g.units) {
                        u.maxHp = newValue;
                        u.cmdHp = newValue; // Set current HP to new max
                    }
                }
            }
            if (targetType === 'unit' || targetType === 'all') {
                 for (const f of region.farmers) {
                    f.maxHp = newValue;
                    f.cmdHp = newValue; // Set current HP to new max
                }
            }
        }
    };
    slider.addEventListener('wheel', e => {
        e.preventDefault();
        const step = 1;
        const v = clamp((parseInt(slider.value, 10) || 0) + (e.deltaY < 0 ? step : -step), parseInt(slider.min), parseInt(slider.max));
        slider.value = v;
        slider.oninput();
    });
    slider.oninput(); // Set initial value
  }

  bindHpSlider('commanderHpSlider', 'commanderHpVal', 'DEFAULT_CMD_HP', 'commander');
  bindHpSlider('unitHpSlider', 'unitHpVal', 'DEFAULT_UNIT_HP', 'unit');

  function bindMultiplier(sliderId, variableName) {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(sliderId + 'Val');
    const update = () => {
        const value = parseInt(slider.value, 10);
        window[variableName] = value / 100.0;
        if(label) label.textContent = `${value}%`;
    };
    slider.addEventListener('input', update);
    slider.addEventListener('wheel', e => {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        slider.value = clamp(parseInt(slider.value) + (e.deltaY < 0 ? step : -step), parseInt(slider.min), parseInt(slider.max));
        update();
    });
    update();
  }

  bindMultiplier('speedPlayer', 'speed_player');
  bindMultiplier('speedEnemy', 'speed_enemy');
  bindMultiplier('speedAlly', 'speed_ally');
  bindMultiplier('speedGlobal', 'speed_global');
  bindMultiplier('fireratePlayer', 'firerate_player');
  bindMultiplier('firerateEnemy', 'firerate_enemy');
  bindMultiplier('firerateAlly', 'firerate_ally');
  bindMultiplier('firerateGlobal', 'firerate_global');

  document.querySelectorAll('.collapsible').forEach(header => {
    const content = header.nextElementSibling;
    if (!header.classList.contains('expanded')) {
        content.style.display = 'none';
        header.classList.add('collapsed');
    }
    header.addEventListener('click', () => {
        header.classList.toggle('collapsed');
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
    });
  });

  document.querySelectorAll('#settingsMenu #tabs .tabbtn').forEach(btn=>{
    btn.addEventListener('click',()=>{
        document.querySelectorAll('#settingsMenu .tabbtn.active').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('#settingsMenu .tabwrap').forEach(t=>t.hidden=true);
        document.querySelector(`#settingsMenu #tab-${btn.dataset.tab}`).hidden = false;
    });
  });

  document.querySelectorAll('#player-menu-tabs .tabbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#player-menu-tabs .tabbtn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('#player-menu-content .tab-content').forEach(c => c.style.display = 'none');
      const content = document.getElementById(`tab-${btn.dataset.tab}`);
      content.style.display = btn.dataset.tab === 'inventory' ? 'flex' : 'block';
    });
  });

  // --- Faction Management ---
  populateFactionSelect();
  document.getElementById('saveFactionBtn').onclick = saveCustomFaction;
  document.getElementById('deleteFactionBtn').onclick = deleteCustomFaction;

  const factionSelect = document.getElementById('factionSelect');
  const customFactionDiv = document.getElementById('customFactionDiv');
  const customFactionIcon = document.getElementById('customFactionIcon');
  const iconPickerMenu = document.getElementById('icon-picker-menu');
  const factionDescription = document.getElementById('factionDescription');
  const deleteFactionBtn = document.getElementById('deleteFactionBtn');

  factionSelect.addEventListener('change', e => {
      const sel = e.target;
      const factionId = sel.value;
      const isCustomNew = factionId === 'custom';
      
      const factionData = gameFactions.find(f => f.id === factionId);
      const isSavedCustom = factionData && factionData.id.startsWith('custom_');

      customFactionDiv.style.display = isCustomNew || isSavedCustom ? 'flex' : 'none';
      deleteFactionBtn.style.display = isSavedCustom ? 'inline-block' : 'none';
      saveFactionBtn.style.display = isCustomNew || isSavedCustom ? 'inline-block' : 'none';
      
      const customFactionHeader = document.getElementById('customFactionHeader');

      if (isCustomNew) {
          // Clear fields for new custom faction
          customFactionHeader.textContent = 'Создайте свою уникальную фракцию.';
          document.getElementById('customFactionName').value = '';
          document.getElementById('customFactionDescription').value = '';
          document.getElementById('customColorPicker').value = '#3ddc97';
          if (!customFactionIcon.textContent) {
              customFactionIcon.textContent = CUSTOM_FACTION_ICONS[0];
          }
          factionDescription.textContent = FACTION_INFO.custom;
      } else if (isSavedCustom) {
          // Populate fields with saved custom faction data for editing
          customFactionHeader.textContent = 'Редактировать сохраненную фракцию.';
          document.getElementById('customFactionName').value = factionData.name;
          document.getElementById('customFactionDescription').value = factionData.description;
          document.getElementById('customColorPicker').value = factionData.color;
          customFactionIcon.textContent = factionData.icon;
          factionDescription.textContent = factionData.description;
      } else if (factionData) {
          // For default factions
          factionDescription.textContent = factionData.description;
      } else {
          factionDescription.textContent = '';
      }
  });
  // Trigger change to set initial description
  factionSelect.dispatchEvent(new Event('change'));


  customFactionIcon.addEventListener('click', () => {
    iconPickerMenu.style.display = 'block';
  });

  document.querySelectorAll('.icon-picker-item').forEach(item => {
      item.addEventListener('click', e => {
          customFactionIcon.textContent = e.target.textContent;
          iconPickerMenu.style.display = 'none';
      });
  });

  document.getElementById('saveModeBtn').onclick = saveCustomMode;
  document.getElementById('deleteModeBtn').onclick = () => {
      if (gameMode.startsWith('custom_')) {
          deleteCustomMode(gameMode);
      }
  };

  // This listener needs to be attached to a static parent, because mode buttons are dynamic
  document.getElementById('gameModeSelection').addEventListener('click', e => {
      if (!e.target.closest('.mode-btn')) return;
      const button = e.target.closest('.mode-btn');

      // Deactivate all mode buttons first
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      
      // Hide custom mode UI
      document.getElementById('customModeControls').style.display = 'none';
      document.getElementById('panel').style.display = 'none';
      document.getElementById('minimap-panel').style.display = 'none';
      document.getElementById('player-menu').style.display = 'none';
      coordXInput.readOnly = true;
      coordYInput.readOnly = true;

      // Activate the clicked button
      button.classList.add('active');
      gameMode = button.id;

      // Handle different mode types
      if (gameMode.startsWith('custom_') && gameMode !== 'modeCustom') {
          applyCustomMode(gameMode);
      } else if (gameMode === 'modeCustom') {
          if (!player) {
              // Create a temporary player proxy for the editor
              player = { inv: { money: 0, ammo: 0, unit: 0, cmd: 0, contract_paper: 0 }, units: [] };
          }
          forceUpdateInventoryUI();
          document.getElementById('customModeControls').style.display = 'flex';
          document.getElementById('panel').style.display = 'block';
          document.getElementById('minimap-panel').style.display = 'block';
          document.getElementById('player-menu').style.display = 'block';
          coordXInput.readOnly = false;
          coordYInput.readOnly = false;
          document.getElementById('worldSeed').readOnly = false;
      } else {
        // When switching to a non-custom mode, clear the proxy player and reset UI
        player = null;
        document.getElementById('worldSeed').readOnly = true;
      }
  });

  document.querySelectorAll('.mode-btn').forEach(btn => {
      if (btn.title) {
          btn.addEventListener('mouseover', () => showUITooltip(btn.title));
      }
  });

  loadCustomModes(); // Load buttons on startup

  minimapCanvas.addEventListener('click', openWorldMap);
  
  coordXInput.addEventListener('change', () => { if(running) teleport(); });
  coordYInput.addEventListener('change', () => { if(running) teleport(); });
  coordXInput.addEventListener('wheel', e => { 
      if (coordXInput.readOnly) return; 
      e.preventDefault(); 
      coordXInput.value = (parseInt(coordXInput.value) || 0) + Math.sign(e.deltaY) * -10; 
      if(running) teleport(); 
  });
  coordYInput.addEventListener('wheel', e => { 
      if (coordYInput.readOnly) return; 
      e.preventDefault(); 
      coordYInput.value = (parseInt(coordYInput.value) || 0) + Math.sign(e.deltaY) * -10; 
      if(running) teleport(); 
  });

  document.getElementById('worldSeed').addEventListener('change', () => {
      if (running && !document.getElementById('hideCheatsChk').checked) {
          initWorld();
      }
  });

  // --- Первоначальный запуск ---
  resize();
  applyThemeColors();
  togglePause();
  paused = true;
  requestAnimationFrame(loop);
});
