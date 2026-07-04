// ===== Миссии для ИИ =====

// Типы миссий
const MISSION_TYPES = {
    KILL_TARGET: 'kill_target',
    DESTROY_BASE: 'destroy_base',
    PROTECT_BASE: 'protect_base'
};

// Глобальный список всех миссий в мире
let allMissions = new Map();

/**
 * Создает новый объект миссии.
 * @param {object} kabak - Таверна, в которой будет доступна миссия.
 * @returns {object} Созданный объект миссии.
 */
function generateMission(kabak) {
    const type = pickRandom([MISSION_TYPES.KILL_TARGET, MISSION_TYPES.DESTROY_BASE]); // PROTECT_BASE пока уберем, т.к. требует сложной логики ИИ
    
    let mission = {
        id: Math.random().toString(36).slice(2, 8),
        type: type,
        status: 'available', // available, active, completed, failed
        reward: { money: 100 + randInt(0, 15) * 10, ammo: 200 + randInt(0, 10) * 20 },
        originKabakId: kabak.id,
        targetId: null,
        description: ''
    };

    // Определяем детали в зависимости от типа миссии
    switch (type) {
        case MISSION_TYPES.KILL_TARGET: {
            const spawnX = kabak.x + rand(-2000, 2000);
            const spawnY = kabak.y + rand(-2000, 2000);
            
            const enemy = spawnEnemy(spawnX, spawnY);
            if (!enemy) return null; // Не удалось создать врага

            enemy.isMissionTarget = true; 
            mission.targetId = enemy.id;
            mission.description = `Уничтожить вражеского командира ${enemy.name}.`;
            break;
        }
        case MISSION_TYPES.DESTROY_BASE: {
            const spawnX = kabak.x + rand(-3000, 3000);
            const spawnY = kabak.y + rand(-3000, 3000);

            const base = spawnHouse(spawnX, spawnY);
            const owner = spawnEnemy(spawnX + 100, spawnY);
            if (!base || !owner) return null; // Не удалось создать базу или владельца

            setBaseFor(owner, base);
            
            base.isMissionTarget = true;
            mission.targetId = base.id;
            mission.description = `Уничтожить вражескую базу в районе (${Math.round(base.x)}, ${Math.round(base.y)}).`;
            break;
        }
    }

    allMissions.set(mission.id, mission);
    return mission;
}


/**
 * Вспомогательная функция для поиска любой сущности по ID.
 * @param {string} id 
 * @returns {object|null}
 */
function findEntityById(id) {
    if (!id) return null;
    for (const region of worldData.values()) {
        for (const list of [region.groups, region.houses, region.shops, region.kabaks]) {
            const entity = list.find(e => e.id === id);
            if (entity) return entity;
        }
    }
    return null;
}

// Простая утилита
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}