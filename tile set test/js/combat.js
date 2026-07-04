// ===== Стрельба/пули =====
function spawnBullet(x,y,tx,ty,ownerId,spread=BULLET_SPREAD,speedMul=1){
  const a=Math.atan2(ty-y,tx-x)+rand(-spread,spread);
  const speed=BULLET_SPEED*speedMul*(1+0.1*(difficulty-1));
  const bullet = {type: 'bullet', x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:BULLET_LIFE,dmg:1,owner:ownerId};
  
  const region = getOrCreateRegion(x, y);
  const { cx, cy } = worldToChunkCoords(x, y);
  const chunk = getOrCreateChunk(region, cx, cy);
  chunk.dynamicEntities.push(bullet);
}

function volley(group,tx,ty){
  if (group.insideBuilding) return false;
  const t=now(); 
  const gcd = FIRE_GCD / (firerate_player * firerate_global);
  if(group.lastFire && t-group.lastFire < gcd) return false;
  if(!group.inv || group.inv.ammo<=0) return false;

  const syncUnits = group.units.filter(u => u.fireMode === FIRE_MODE_SYNC);
  const spend = 1 + syncUnits.length;

  if(group.inv.ammo<spend) return false;

  group.lastFire=t; 
  spawnBullet(group.x,group.y,tx,ty,group.id,0.008);
  
  for(const u of syncUnits){ 
    spawnBullet(u.x,u.y,tx,ty,group.id,BULLET_SPREAD*(2-difficulty)); 
  }

  group.inv.ammo=Math.max(0,group.inv.ammo-spend); 
  if(group===player) forceUpdateInventoryUI(); 
  return true;
}

function aiCanFire(g){ 
  const gcdMul=(1.8 - 0.8*diffNorm()) * 3;
  let firerate = g.faction === FACTIONS.ALLY ? firerate_ally : firerate_enemy;
  const finalGcd = (FIRE_GCD * gcdMul) / (firerate * firerate_global);
  console.log(`DEBUG: AI ${g.id.substring(0,3)} GCD is ${finalGcd}`);
  return now()-g.lastFire >= finalGcd; 
}

function volleyAI(group,tx,ty){
  if (group.insideBuilding) return false;
  const t=now(); 
  if(!aiCanFire(group)) return false;
  if(!group.inv || group.inv.ammo<=0) return false;

  const syncUnits = group.units.filter(u => u.fireMode === FIRE_MODE_SYNC);
  const spend = 1 + syncUnits.length;
  
  if(group.inv.ammo<spend) return false;

  group.lastFire=t;
  const spreadScale = 2.2 - 1.2*diffNorm();
  spawnBullet(group.x,group.y,tx,ty,group.id,BULLET_SPREAD*spreadScale*0.5);
  
  for(const u of syncUnits){ 
    spawnBullet(u.x,u.y,tx,ty,group.id,BULLET_SPREAD*spreadScale); 
  }
  
  group.inv.ammo=Math.max(0,group.inv.ammo-spend); 
  return true;
}

function leadTarget(shooter, target){
  const dx=target.x-shooter.x, dy=target.y-shooter.y, dist=Math.hypot(dx,dy);
  const speed=BULLET_SPEED*(1+0.1*(difficulty-1)), t=dist/speed;
  const mv=target.moving?PLAYER_SPEED:0;
  return { tx: target.x + Math.cos(target.a)*mv*t, ty: target.y + Math.sin(target.a)*mv*t };
}

// ===== Поиск =====
function findNearest(g, collectionGetter, filter = ()=>true) {
  let best = null, bestDistSq = Infinity;
  const regions = getExistingRegionsInProximity(g.x, g.y);
  for (const region of regions) {
    for (const item of collectionGetter(region)) {
      if (!filter(item)) continue;
      const d2 = dist2(g, item);
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        best = item;
      }
    }
  }
  return best;
}

function nearestFarmer(g){ 
  return findNearest(g, r => getRegionDynamicEntities(r, 'farmer'), f=>f.alive); 
}

function nearestShop(x,y){ 
  return findNearest({x,y}, r => getRegionStaticEntities(r, 'shop')); 
}

function nearestNeutralHouse(x,y){ 
  return findNearest({x,y}, r => getRegionStaticEntities(r, 'house'), h=>!h.owner); 
}

function areFactionsHostile(factionA, factionB) {
    if (!factionA || !factionB) return false;
    if (factionA === factionB) return false;

    const playerAligned = [FACTIONS.PLAYER, FACTIONS.ALLY];
    const isA_PlayerAligned = playerAligned.includes(factionA);
    const isB_PlayerAligned = playerAligned.includes(factionB);

    // Player and their allies are not hostile to each other
    if (isA_PlayerAligned && isB_PlayerAligned) return false;

    // Player and allies are hostile to everyone else
    if (isA_PlayerAligned || isB_PlayerAligned) return true;

    // Different enemy factions are hostile to each other
    return true;
}

function nearestHostile(g) {
    if (enemyAiMode === 'none' || (g.faction !== FACTIONS.PLAYER && enemyAiMode === 'neutral')) return null;

    const filter = o => {
        if (!o.alive || o.id === g.id || o.hidden) return false;
        // В режиме войны фракций враги не трогают игрока и его союзников
        if (enemyAiMode === 'faction_war' && g.faction !== FACTIONS.PLAYER && g.faction !== FACTIONS.ALLY) {
            if (o.faction === FACTIONS.PLAYER || o.faction === FACTIONS.ALLY) return false;
        }
        return areFactionsHostile(g.faction, o.faction);
    };

    return findNearest(g, r => getRegionDynamicEntities(r, 'group'), filter);
}

// Helper to find hostile for an individual unit (which doesn't have a faction itself)
function findHostileForUnit(unit, commandingGroup) {
  if (enemyAiMode === 'none') return null;

  const filter = o => {
      if (!o.alive || o.id === commandingGroup.id || o.hidden) return false; // Don't target self or hidden
      // Ensure unit doesn't target other units in its own group
      if (commandingGroup.units.some(u => u.id === o.id)) return false; 
      return areFactionsHostile(commandingGroup.faction, o.faction);
  };
  // Pass unit's position (x, y) to findNearest
  return findNearest(unit, r => getRegionDynamicEntities(r, 'group'), filter);
}

// ===== Смерть/лут =====
function createLoot(x, y, type, amount = 1) { 
  const loot = {x, y, type: 'loot', lootType: type, amount};
  const region = getOrCreateRegion(x, y);
  const { cx, cy } = worldToChunkCoords(x, y);
  const chunk = getOrCreateChunk(region, cx, cy);
  chunk.dynamicEntities.push(loot);
}

function gameOver(){ 
  running=false; 
  togglePause(true); 
}

function handleDeath(g){ 
  if (g.faction === FACTIONS.ALLY) {
    const alliance = playerAlliances.find(a => a.allyId === g.id);
    if (alliance) {
        // Вызываем breakAlliance без возврата денег, т.к. союзник погиб
        breakAlliance(alliance.id, true);
    }
  }

  createLoot(g.x, g.y, 'cmd');
  if (g.inv.ammo > 0) { 
    createLoot(g.x + rand(-10, 10), g.y + rand(-10, 10), 'ammo', g.inv.ammo); 
  }
  g.alive=false; 
  g.moving=false; 
  g.units.length=0; 
  
  const chunk = getChunkFromWorldCoords(g.x, g.y);
  if (chunk) {
    const index = chunk.dynamicEntities.findIndex(e => e.id === g.id);
    if (index > -1) {
      chunk.dynamicEntities.splice(index, 1);
    }
  }

  if(g===player) gameOver(); 
}

function applyDamageToGroup(g,dmg){
  if(g.insideBuilding && g.insideBuilding.type === 'house' && g.insideBuilding.owner===g.id) return;
  if(g.insideBuilding && g.insideBuilding.type === 'kabak') return;

  const t = now();

  if (g.units.length > 0) {
    const randomUnitIndex = randInt(0, g.units.length - 1);
    const u = g.units[randomUnitIndex];
    u.cmdHp -= dmg;
    u.lastDamageTime = t;
    if (u.cmdHp <= 0) {
      createLoot(u.x, u.y, 'unit'); 
      g.units.splice(randomUnitIndex, 1);
      if (g.isPlayer) {
        updateSquadUI();
        forceUpdateInventoryUI();
      }
    }
  } else {
    g.cmdHp -= dmg;
    g.lastDamageTime = t;
    if (g.cmdHp <= 0) {
      if(player && g!==player) stats.kills++; 
      handleDeath(g); 
    }
  }
}

function captureCommander(captor,victim){ 
  if(!victim.alive) return; 
  victim.alive=false; 
  createLoot(victim.x,victim.y,'cmd');
  
  const numToConvert = victim.units.length;
  victim.units.length = 0; // Empty victim's squad

  for (let i = 0; i < numToConvert; i++) {
    if (captor.units.length < maxSquadSize) {
      // We can't call addUnitToGroup here, so we replicate the object creation
      const lastName = generateLastName();
      const unit = {
          id: Math.random().toString(36).slice(2, 8),
          x: captor.x, y: captor.y, a: captor.a, vx: 0, vy: 0,
          name: `Боец ${lastName}`,
          lastName: lastName,
          cmdHp: DEFAULT_UNIT_HP, maxHp: DEFAULT_UNIT_HP,
          spriteData: null, moving: false,
          inv: { money: 0, ammo: 0 }
      };
      preloadSprite(unitAppearance).then(loadedLayers => {
          unit.spriteData = { layers: loadedLayers };
      });
      captor.units.push(unit);
    }
  }

  if (captor.isPlayer) {
    updateSquadUI();
    forceUpdateInventoryUI();
  }
  
  stats.kills++; 
}

function tryLootNearby(g) {
    const regions = getExistingRegionsInProximity(g.x, g.y);
    let pickedUpSomething = false;

    for (const region of regions) {
        const lootItems = getRegionDynamicEntities(region, 'loot');
        for (let i = lootItems.length - 1; i >= 0; i--) {
            const item = lootItems[i];
            
            if (Math.hypot(item.x - g.x, item.y - g.y) < GATHER_RADIUS) {
                g.inv[item.lootType] = (g.inv[item.lootType] || 0) + item.amount;
                
                const lootChunk = getChunkFromWorldCoords(item.x, item.y);
                if (lootChunk) {
                    const index = lootChunk.dynamicEntities.findIndex(e => e === item);
                    if (index > -1) {
                        lootChunk.dynamicEntities.splice(index, 1);
                    }
                }
                
                pickedUpSomething = true;
            }
        }
    }

    if (pickedUpSomething && g === player) {
        forceUpdateInventoryUI();
    }

    return pickedUpSomething;
}


