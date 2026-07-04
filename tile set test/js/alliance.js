// ===== Система Альянсов =====

let playerAlliances = [];

/**
 * Рассчитывает стоимость заключения союза с отрядом.
 * @param {object} group - Отряд, с которым заключается союз.
 * @returns {number} Стоимость в рублях.
 */
function calculateAllianceCost(group) {
    if (!group) return Infinity;
    
    const commanderCost = 1000;
    const unitCost = 50 * group.units.length;
    const ammoCost = 1 * group.inv.ammo;
    
    const base = getBaseHouseForId(group.id);
    const baseCost = base ? 500 : 0;
    
    return commanderCost + unitCost + ammoCost + baseCost;
}

/**
 * Заключает союз с целевым отрядом.
 * @param {object} targetGroup - Отряд, с которым заключается союз.
 * @param {boolean} isFree - Если true, альянс заключается бесплатно (для читов).
 */
function formAlliance(targetGroup, isFree = false) {
    if (playerAlliances.length >= maxContracts) {
        showNotification("Достигнут лимит контрактов.");
        return;
    }
    if (!targetGroup || targetGroup.faction === FACTIONS.PLAYER || targetGroup.faction === FACTIONS.ALLY) {
        showNotification("Нельзя заключить союз с этим отрядом.");
        return;
    }

    const cost = calculateAllianceCost(targetGroup);
    if (!isFree && player.inv.money < cost) {
        showNotification(`Недостаточно денег. Требуется: ${cost}₽`);
        return;
    }

    if (!isFree) {
        player.inv.money -= cost;
    }

    // Save original faction details
    const originalFactionDetails = {
        faction: targetGroup.faction,
        factionInfo: targetGroup.factionInfo,
        color: targetGroup.color,
        icon: targetGroup.icon
    };

    // Apply player's faction details to the new ally
    targetGroup.faction = FACTIONS.ALLY; // Gameplay faction
    targetGroup.factionInfo = player.factionInfo;
    targetGroup.color = player.color;
    targetGroup.icon = player.icon;

    const alliance = {
        id: Math.random().toString(36).slice(2, 8),
        allyId: targetGroup.id,
        startTime: now(),
        duration: rand(20 * 60, 120 * 60), // от 20 минут до 2 часов
        totalCost: cost,
        isPaused: false,
        originalFactionDetails: originalFactionDetails,
        remainingTimeOnPause: 0
    };
    alliance.endTime = alliance.startTime + alliance.duration;

    playerAlliances.push(alliance);
    
    player.inv.contract_paper = (player.inv.contract_paper || 0) + 1;
    forceUpdateInventoryUI();
    updatePlayerContractsTab();

    showNotification(`Союз заключен с командиром ${targetGroup.name}!`);
    console.log("New alliance formed:", alliance);
}

/**
 * Разрывает союз.
 * @param {string} allianceId - ID союза, который нужно разорвать.
 */
function breakAlliance(allianceId, noRefund = false) {
    const allianceIndex = playerAlliances.findIndex(a => a.id === allianceId);
    if (allianceIndex === -1) return;

    const alliance = playerAlliances[allianceIndex];
    const ally = findEntityById(alliance.allyId);

    if (ally && alliance.originalFactionDetails) {
        ally.faction = alliance.originalFactionDetails.faction;
        ally.factionInfo = alliance.originalFactionDetails.factionInfo;
        ally.color = alliance.originalFactionDetails.color;
        ally.icon = alliance.originalFactionDetails.icon;
        showNotification(`Союз с ${ally.name} расторгнут.`);
    }

    if (!noRefund) {
        const elapsedTime = now() - alliance.startTime;
        const remainingRatio = alliance.isPaused ? (alliance.remainingTimeOnPause / alliance.duration) : (1 - (elapsedTime / alliance.duration));
        if (remainingRatio > 0) {
            const refund = Math.floor(alliance.totalCost * remainingRatio * 0.5); // Возвращаем 50% от оставшейся стоимости
            if (refund > 0) {
                player.inv.money += refund;
                showNotification(`Возвращено: ${refund}₽`);
            }
        }
    }

    playerAlliances.splice(allianceIndex, 1);
    player.inv.contract_paper = Math.max(0, (player.inv.contract_paper || 0) - 1);
    forceUpdateInventoryUI();
    updatePlayerContractsTab();
}

/**
 * Приостанавливает действие союза.
 * @param {string} allianceId 
 */
function pauseAlliance(allianceId) {
    const alliance = playerAlliances.find(a => a.id === allianceId);
    if (!alliance || alliance.isPaused) return;

    alliance.isPaused = true;
    alliance.remainingTimeOnPause = alliance.endTime - now();

    const ally = findEntityById(alliance.allyId);
    if (ally && alliance.originalFactionDetails) {
        ally.faction = alliance.originalFactionDetails.faction;
        ally.factionInfo = alliance.originalFactionDetails.factionInfo;
        ally.color = alliance.originalFactionDetails.color;
        ally.icon = alliance.originalFactionDetails.icon;
        showNotification(`Союз с ${ally.name} приостановлен.`);
    }
    updatePlayerContractsTab();
}

/**
 * Возобновляет действие союза.
 * @param {string} allianceId 
 */
function resumeAlliance(allianceId) {
    const alliance = playerAlliances.find(a => a.id === allianceId);
    if (!alliance || !alliance.isPaused) return;

    alliance.isPaused = false;
    alliance.endTime = now() + alliance.remainingTimeOnPause;

    const ally = findEntityById(alliance.allyId);
    if (ally) {
        ally.faction = FACTIONS.ALLY;
        ally.factionInfo = player.factionInfo;
        ally.color = player.color;
        ally.icon = player.icon;
        showNotification(`Союз с ${ally.name} возобновлен.`);
    }
}

/**
 * Продлевает действие союза.
 * @param {string} allianceId 
 */
function extendAlliance(allianceId) {
    const alliance = playerAlliances.find(a => a.id === allianceId);
    if (!alliance) return;

    const ally = findEntityById(alliance.allyId);
    if (!ally) return;

    const cost = calculateAllianceCost(ally);
    if (player.inv.money < cost) {
        showNotification(`Недостаточно денег для продления. Требуется: ${cost}₽`);
        return;
    }

    player.inv.money -= cost;
    const additionalTime = 30 * 60; // Продлеваем на 30 минут
    if (alliance.isPaused) {
        alliance.remainingTimeOnPause += additionalTime;
    } else {
        alliance.endTime += additionalTime;
    }
    
    showNotification(`Союз с ${ally.name} продлен на 30 минут.`);
    updatePlayerContractsTab();
}

/**
 * Обновление логики альянсов в игровом цикле.
 */
function updateAlliances(dt) {
    for (let i = playerAlliances.length - 1; i >= 0; i--) {
        const alliance = playerAlliances[i];
        if (alliance.isPaused) continue;

        if (now() > alliance.endTime) {
            const ally = findEntityById(alliance.allyId);
            if(ally) showNotification(`Срок союза с ${ally.name} истек.`);
            breakAlliance(alliance.id);
        }
    }
}