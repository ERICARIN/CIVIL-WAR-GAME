function updateDossierUI() {
    if (!player || !player.factionInfo) return;

    const nameEl = document.getElementById('dossier-name');
    const factionEl = document.getElementById('dossier-faction');
    const colorEl = factionEl.querySelector('.dossier-color-box');

    if (nameEl) {
        nameEl.textContent = player.name;
        nameEl.style.color = player.color;
    }
    if (factionEl) factionEl.firstChild.textContent = `Фракция: ${player.factionInfo.name} ${player.factionInfo.icon} `;
    if (colorEl) colorEl.style.background = player.color;
}

// ===== UI =====
function showHint(text) {
  if (!text) return; // Do nothing if text is empty
  chat.addMessage(text, 'Подсказка', { icon: '💡' }, '#FFD700'); 
}

let lastUITooltipTime = 0;
const UI_TOOLTIP_COOLDOWN = 1000; // 1 second

function showUITooltip(text) {
    const now = performance.now();
    if (now - lastUITooltipTime < UI_TOOLTIP_COOLDOWN) {
        return;
    }
    lastUITooltipTime = now;
    showHint(text);
}

function checkBuildingTooltips() {
    if (!player || player.insideBuilding) {
        if (playerLocationState !== null) {
            playerLocationState = null;
        }
        return;
    }

    const region = getOrCreateRegion(player.x, player.y);
    let currentLocationId = null;
    let currentMessage = null;

    if (region.villages && region.villages.length > 0) {
        for (const village of region.villages) {
            if (insideRect(player.x, player.y, village.x, village.y, village.w, village.h)) {
                currentLocationId = 'village-' + village.name;
                currentMessage = `Вы в деревне ${village.name}`;
                break;
            }
        }
    }

    if (currentLocationId === null) {
        const buildings = getRegionStaticEntities(region, ['house', 'shop', 'kabak']);
        for (const b of buildings) {
            const d = houseDoorRect(b);
            if (dist2(player, d) < 1500) {
                currentLocationId = 'building-' + b.x + '-' + b.y;
                currentMessage = `Подойдите к двери, чтобы войти`;
                break;
            }
        }
    }

    if (currentLocationId !== playerLocationState) {
        playerLocationState = currentLocationId;

        if (currentLocationId !== null) {
            showHint(currentMessage);
        }
    }
}

function updateGarrisonInventoryCounter() {
  if (!player) return;
  const base = getBaseHouseForId(player.id);
  const counterSlot = document.querySelector('#tab-inventory .inv-slot[data-key="garrison"]');
  if (base && base.garrison.length > 0) {
    counterSlot.style.display = 'flex';
    counterSlot.querySelector('.cnt').textContent = base.garrison.length;
  } else {
    counterSlot.style.display = 'none';
  }
}

function showNotification(message, duration = 3000) {
    const existing = document.querySelector('.notification');
    if(existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if(notification.parentElement) document.body.removeChild(notification);
        }, 500);
    }, duration);
}

function showConfirmation(text, onConfirm) {
    const menu = document.getElementById('alliance-proposal-menu');
    const textField = document.getElementById('alliance-proposal-text');
    const acceptBtn = document.getElementById('alliance-accept-btn');
    const cancelBtn = document.getElementById('alliance-cancel-btn');

    textField.textContent = text;

    acceptBtn.onclick = () => {
        onConfirm();
        closeAllianceProposalMenu();
    };
    cancelBtn.onclick = closeAllianceProposalMenu;

    menu.style.display = 'block';
}

function openHouseMenu(house){
  const wrap=document.getElementById('houseMenu');
  wrap.style.display = 'block'; uiState.houseMenuOpen=true; uiState.house=house;
  const title = wrap.querySelector('.window-header span');
  const update = () => {
    title.textContent = `Дом (${house.owner ? (worldData.get(getRegionKey(house.x, house.y)).groups.find(g=>g.id===house.owner)?.name || 'Неизвестный') : 'ничей'})`;
    leave.max = (player.units?.length||0); take.max = (house.garrison?.length||0);
    leaveCount.textContent = leave.value; takeCount.textContent = take.value;
    updateGarrisonInventoryCounter();
  };
  const leave=document.getElementById('leaveSlider'), take=document.getElementById('takeSlider');
  const leaveCount=document.getElementById('leaveCount'), takeCount=document.getElementById('takeCount');
  leave.oninput=()=>leaveCount.textContent=leave.value;
  take.oninput=()=>takeCount.textContent=take.value;
  document.getElementById('makeBaseBtn').classList.add('pixel-btn');
  document.getElementById('makeBaseBtn').onclick=()=>{ setBaseFor(player,house); update(); };
  document.getElementById('leaveOkBtn').classList.add('pixel-btn');
  document.getElementById('leaveOkBtn').onclick=()=>{ let n=+leave.value|0; while(n-->0 && player.units.length>0 && house.garrison.length<HOUSE_GARRISON_CAP){ house.garrison.push(player.units.pop()); } leave.value=0; update(); forceUpdateInventoryUI(); updateSquadUI(); };
  document.getElementById('takeOkBtn').classList.add('pixel-btn');
  document.getElementById('takeOkBtn').onclick=()=>{ let n=+take.value|0; while(n-->0 && house.garrison.length>0 && player.units.length < maxSquadSize){ player.units.push(house.garrison.pop()); } take.value=0; update(); forceUpdateInventoryUI(); updateSquadUI(); };
  document.getElementById('exitHouseBtn').classList.add('pixel-btn');
  document.getElementById('exitHouseBtn').onclick=()=>{ const d=houseDoorRect(house); if(d.side===0) player.y=house.y-house.h/2-20; if(d.side===2) player.y=house.y+house.h/2+20; if(d.side===1) player.x=house.x+house.w/2+20; if(d.side===3) player.x=house.x-house.w/2-20; closeHouseMenu(); };
  update();
}

function closeHouseMenu(){ 
  uiState.houseMenuOpen=false; 
  uiState.house=null; 
  document.getElementById('houseMenu').style.display = 'none'; 
  updateGarrisonInventoryCounter(); 
}

function openShopMenu(shop){
  const wrap=document.getElementById('shopMenu');
  wrap.style.display = 'block'; uiState.shopMenuOpen=true; uiState.shop=shop;
  function updateShopView(){ info.textContent=`Деньги: ${player.inv.money|0}₽, Патроны: ${player.inv.ammo|0}`; forceUpdateInventoryUI(); range.max=player.inv.money|0; range.value=0; val.textContent='0'; }
  const info=document.getElementById('shopInfo');
  const range=document.getElementById('ammoRange'), val=document.getElementById('ammoRangeVal');
  range.oninput = () => val.textContent = range.value;
  document.getElementById('sellUnitLootBtn').classList.add('pixel-btn');
  document.getElementById('sellUnitLootBtn').onclick=()=>{ if(player.inv.unit > 0){ player.inv.unit--; player.inv.money+=100; updateShopView(); } };
  document.getElementById('sellCmdLootBtn').classList.add('pixel-btn');
  document.getElementById('sellCmdLootBtn').onclick=()=>{ if(player.inv.cmd > 0){ player.inv.cmd--; player.inv.money+=500; updateShopView(); } };
  document.getElementById('buyUnitBtn').classList.add('pixel-btn');
  document.getElementById('buyUnitBtn').onclick=()=>{ if(player.inv.money >= 250 && player.units.length < maxSquadSize){ player.inv.money-=250; addUnitToGroup(player); updateShopView(); updateSquadUI(); }};
  document.getElementById('sellLiveUnitBtn').classList.add('pixel-btn');
  document.getElementById('sellLiveUnitBtn').onclick=()=>{ if(player.units.length > 0){ player.units.pop(); player.inv.money += 50; updateShopView(); updateSquadUI(); } };
  document.getElementById('buyAmmoBtn').classList.add('pixel-btn');
  document.getElementById('buyAmmoBtn').onclick=()=>{ const spend=+range.value|0; if(spend>0 && spend<=player.inv.money){ player.inv.money-=spend; player.inv.ammo+=(spend|0); updateShopView(); } };
  document.getElementById('exitShopBtn').classList.add('pixel-btn');
  document.getElementById('exitShopBtn').onclick=()=>{ const d=houseDoorRect(shop); if(d.side===0) player.y=shop.y-shop.h/2-20; if(d.side===2) player.y=shop.y+shop.h/2+20; if(d.side===1) player.x=shop.x+shop.w/2+20; if(d.side===3) player.x=shop.x-shop.w/2-20; closeShopMenu(); };
  updateShopView();
}

function closeShopMenu(){ 
  uiState.shopMenuOpen = false; 
  uiState.shop = null; 
  document.getElementById('shopMenu').style.display = 'none'; 
  forceUpdateInventoryUI(); 
}

function closeKabakVisitorsMenu() {
    const menu = document.getElementById('kabak-visitors-menu');
    if (menu) menu.style.display = 'none';
    uiState.kabakMenuOpen = false;
}

function closeAllianceProposalMenu() {
    const menu = document.getElementById('alliance-proposal-menu');
    if (menu) menu.style.display = 'none';
}

function showAllianceProposal(targetGroup) {
    const menu = document.getElementById('alliance-proposal-menu');
    const textField = document.getElementById('alliance-proposal-text');
    const acceptBtn = document.getElementById('alliance-accept-btn');
    const cancelBtn = document.getElementById('alliance-cancel-btn');

    const cost = calculateAllianceCost(targetGroup);
    textField.textContent = `Командир ${targetGroup.name} предлагает союз. Это будет стоить ${cost}₽. Хотите объединиться?`;

    acceptBtn.onclick = () => {
        formAlliance(targetGroup);
        closeAllianceProposalMenu();
        closeKabakVisitorsMenu();
    };
    cancelBtn.onclick = closeAllianceProposalMenu;

    menu.style.display = 'block';
}

function openKabakMenu(kabak){
    const menu = document.getElementById('kabak-visitors-menu');
    const listDiv = document.getElementById('kabak-visitors-list');
    if (!menu || !listDiv) return;

    listDiv.innerHTML = '';

    const regions = getExistingRegionsInProximity(kabak.x, kabak.y);
    const allGroups = regions.flatMap(r => getRegionDynamicEntities(r, 'group'));
    const visitors = allGroups.filter(g => g.insideBuilding === kabak && !g.isPlayer);

    if (visitors.length === 0) {
        listDiv.innerHTML = '<p>Других командиров здесь нет.</p>';
    } else {
        visitors.forEach(group => {
            const btn = document.createElement('button');
            btn.className = 'btn pixel-btn';
            btn.textContent = group.name;
            if (playerAlliances.length >= maxContracts) {
                btn.disabled = true;
                btn.title = 'Достигнут лимит контрактов';
            } else {
                btn.onclick = () => showAllianceProposal(group);
            }
            listDiv.appendChild(btn);
        });
    }

    menu.style.display = 'block';
    uiState.kabakMenuOpen = true;
    uiState.kabak = kabak;
}

function closeKabakMenu(){
    closeKabakVisitorsMenu();
    closeAllianceProposalMenu();
}

function updatePlayerContractsTab() {
    const contractsListDiv = document.getElementById('contracts-list');
    if (!contractsListDiv) return;

    contractsListDiv.innerHTML = '';

    if (playerAlliances.length === 0) {
        contractsListDiv.innerHTML = '<div style="text-align:center; opacity:0.7;">Нет активных союзов.</div>';
        return;
    }

    playerAlliances.forEach(alliance => {
        const ally = findEntityById(alliance.allyId);
        if (!ally) return;

        let timeStr;
        if (alliance.isPaused) {
            const minutes = Math.floor(alliance.remainingTimeOnPause / 60);
            const seconds = Math.floor(alliance.remainingTimeOnPause % 60);
            timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
            const remainingTime = alliance.endTime - now();
            const minutes = Math.floor(remainingTime / 60);
            const seconds = Math.floor(remainingTime % 60);
            timeStr = remainingTime > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : 'Истекло';
        }

        const contractDiv = document.createElement('div');
        contractDiv.className = 'contract-details-compact rowline';
        contractDiv.style.justifyContent = 'space-between';
        contractDiv.style.alignItems = 'center';
        contractDiv.style.marginBottom = '4px';

        const nameAndStats = document.createElement('div');
        nameAndStats.className = 'rowline';
        nameAndStats.style.alignItems = 'center';
        nameAndStats.style.gap = '8px';
        nameAndStats.innerHTML = `
            <strong title="${ally.name}">${ally.name.substring(0, 12)}</strong>
            <span title="Отряд"><span class="pixel-emoji">👤</span> ${1 + ally.units.length}</span>
            <span title="Патроны"><span class="pixel-emoji">🔫</span> ${ally.inv.ammo}</span>
            <span title="Время"><span class="pixel-emoji">⏱️</span> ${timeStr}</span>
        `;

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'rowline';
        controlsDiv.style.gap = '4px';

        const pauseBtn = document.createElement('button');
        pauseBtn.className = 'btn pixel-btn';
        pauseBtn.innerHTML = alliance.isPaused ? '▶️' : '⏸️';
        pauseBtn.title = alliance.isPaused ? 'Возобновить' : 'Пауза';
        pauseBtn.onclick = () => {
            if (alliance.isPaused) resumeAlliance(alliance.id);
            else pauseAlliance(alliance.id);
        };

        const extendBtn = document.createElement('button');
        extendBtn.className = 'btn pixel-btn';
        extendBtn.innerHTML = '➕';
        extendBtn.title = 'Продлить';
        extendBtn.onclick = () => {
            const cost = calculateAllianceCost(ally);
            showConfirmation(`Продлить союз с ${ally.name} за ${cost}₽?`, () => extendAlliance(alliance.id));
        };

        const breakBtn = document.createElement('button');
        breakBtn.className = 'btn pixel-btn';
        breakBtn.innerHTML = '❌';
        breakBtn.title = 'Разорвать';
        breakBtn.onclick = () => {
            const elapsedTime = now() - alliance.startTime;
            const remainingRatio = alliance.isPaused ? (alliance.remainingTimeOnPause / alliance.duration) : (1 - (elapsedTime / alliance.duration));
            const refund = (remainingRatio > 0) ? Math.floor(alliance.totalCost * remainingRatio * 0.5) : 0;
            showConfirmation(`Разорвать союз с ${ally.name}? Вам вернется ${refund}₽.`, () => breakAlliance(alliance.id));
        };

        controlsDiv.appendChild(pauseBtn);
        controlsDiv.appendChild(extendBtn);
        controlsDiv.appendChild(breakBtn);
        
        contractDiv.appendChild(nameAndStats);
        contractDiv.appendChild(controlsDiv);
        contractsListDiv.appendChild(contractDiv);
    });
}

function applyPixelUI(){
  document.querySelectorAll('button, .btn, .tabbtn, .cheat-section .btn').forEach(el=>{
    el.classList.add('pixel-btn');
  });
  document.querySelectorAll('.emoji').forEach(el=>{
    el.classList.add('pixel-emoji');
  });
}

function kickUnit(unitId) {
    if (!player || !player.units) return;
    const unitIndex = player.units.findIndex(u => u.id === unitId);
    if (unitIndex > -1) {
        const unit = player.units[unitIndex];
        
        // Re-create the peasant in the world with the unit's stats
        newFarmer(unit.x, unit.y, {
            lastName: unit.lastName,
            cmdHp: unit.cmdHp
        });

        player.units.splice(unitIndex, 1);
        updateSquadUI();
        forceUpdateInventoryUI();
    }
}

function sendUnitToBase(unitId) {
    if (!player) return;
    const base = getBaseHouseForId(player.id);
    if (!base) {
        showHint('У вас пока нет базы, где можно оставить бойцов');
        return;
    }

    if (base.garrison.length >= HOUSE_GARRISON_CAP) {
        showHint('В гарнизоне нет места');
        return;
    }

    const unitIndex = player.units.findIndex(u => u.id === unitId);
    if (unitIndex > -1) {
        const unit = player.units.splice(unitIndex, 1)[0];
        base.garrison.push(unit);
        updateSquadUI();
        forceUpdateInventoryUI(); // This calls updateGarrisonInventoryCounter
    }
}

function updateSquadUI() {
    const squadListDiv = document.getElementById('tab-squad');
    if (!squadListDiv || !player || !player.units) return;

    squadListDiv.innerHTML = '';

    // --- Global Squad Control ---
    const globalControlDiv = document.createElement('div');
    globalControlDiv.className = 'squad-global-control-row rowline';
    globalControlDiv.style.justifyContent = 'space-between';
    globalControlDiv.style.marginBottom = '8px';
    globalControlDiv.style.padding = '4px';
    globalControlDiv.style.border = '1px solid #777'; // Highlight
    globalControlDiv.style.backgroundColor = '#333'; // Highlight
    globalControlDiv.style.fontWeight = 'bold';

    const globalNameSpan = document.createElement('span');
    globalNameSpan.textContent = 'Отряд';
    
    const globalButtonsDiv = document.createElement('div');
    globalButtonsDiv.className = 'rowline';
    globalButtonsDiv.style.gap = '4px';

    const globalFireModeBtn = document.createElement('button');
    globalFireModeBtn.className = 'btn pixel-btn';

    const updateGlobalButtonAppearance = () => {
        const mode = FIRE_MODES[squadFireModeIndex]; // Use global index
        let modeText = '?';
        if (mode) {
            switch(mode.id) {
                case FIRE_MODE_SYNC: modeText = 'Синхр.'; break;
                case FIRE_MODE_AT_WILL: modeText = 'Атака'; break;
                case FIRE_MODE_HOLD: modeText = 'Тихо'; break;
            }
        }
        globalFireModeBtn.innerHTML = modeText;
        globalFireModeBtn.title = mode ? `Режим огня отряда: ${mode.name}` : 'Неизвестный режим';
    };

    globalFireModeBtn.onclick = () => {
        squadFireModeIndex = (squadFireModeIndex + 1) % FIRE_MODES.length;
        const newMode = FIRE_MODES[squadFireModeIndex];
        player.units.forEach(u => u.fireMode = newMode.id);
        chat.addMessage(`Режим огня всего отряда: ${newMode.name}`, player.name, player.factionInfo, player.color);
        updateSquadUI(); // Refresh UI to update all buttons
    };
    updateGlobalButtonAppearance();

    globalButtonsDiv.appendChild(globalFireModeBtn);
    globalControlDiv.appendChild(globalNameSpan);
    globalControlDiv.appendChild(globalButtonsDiv);
    squadListDiv.appendChild(globalControlDiv);
    // --- End Global Squad Control ---

    if (player.units.length === 0) {
        squadListDiv.innerHTML += '<div style="text-align:center; opacity:0.7;">В отряде нет бойцов.</div>';
        return;
    }

    player.units.forEach(unit => {
        const unitDiv = document.createElement('div');
        unitDiv.className = 'squad-member-row rowline';
        unitDiv.style.justifyContent = 'space-between';
        unitDiv.style.marginBottom = '4px';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = unit.name;
        
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'rowline';
        buttonsDiv.style.gap = '4px';

        // --- Fire Mode Button ---
        const fireModeBtn = document.createElement('button');
        fireModeBtn.className = 'btn pixel-btn';
        
        const updateButtonAppearance = () => {
            const mode = FIRE_MODES.find(m => m.id === unit.fireMode);
            let modeText = '?';
            if (mode) {
                switch(mode.id) {
                    case FIRE_MODE_SYNC: modeText = 'Синхр.'; break;
                    case FIRE_MODE_AT_WILL: modeText = 'Атака'; break;
                    case FIRE_MODE_HOLD: modeText = 'Тихо'; break;
                }
            }
            fireModeBtn.innerHTML = modeText;
            fireModeBtn.title = mode ? `Режим огня: ${mode.name}` : 'Неизвестный режим';
        };

        fireModeBtn.onclick = () => {
            unit.fireMode = (unit.fireMode + 1) % FIRE_MODES.length;
            const newMode = FIRE_MODES.find(m => m.id === unit.fireMode);
            updateButtonAppearance();
            if (newMode) {
                chat.addMessage(`Боец ${unit.lastName} переведен в режим: ${newMode.name}`, player.name, player.factionInfo, player.color);
            }
            // After changing individual unit mode, reset global index if it doesn't match
            const allUnitsSameMode = player.units.every(u => u.fireMode === unit.fireMode);
            if (allUnitsSameMode) {
                squadFireModeIndex = unit.fireMode;
                updateGlobalButtonAppearance();
            }
        };

        updateButtonAppearance(); // Set initial text

        // --- Other Buttons ---
        const baseBtn = document.createElement('button');
        baseBtn.className = 'btn pixel-btn';
        baseBtn.innerHTML = '🏠';
        baseBtn.title = 'Отправить на базу';
        baseBtn.onclick = () => sendUnitToBase(unit.id);

        const kickBtn = document.createElement('button');
        kickBtn.className = 'btn pixel-btn';
        kickBtn.innerHTML = '❌';
        kickBtn.title = 'Выгнать из отряда';
        kickBtn.onclick = () => kickUnit(unit.id);

        buttonsDiv.appendChild(fireModeBtn);
        buttonsDiv.appendChild(baseBtn);
        buttonsDiv.appendChild(kickBtn);
        unitDiv.appendChild(nameSpan);
        unitDiv.appendChild(buttonsDiv);
        squadListDiv.appendChild(unitDiv);
    });
}
