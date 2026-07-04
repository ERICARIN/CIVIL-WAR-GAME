// ===== Состояние мира =====
var player=null, paused=false, running=false, musicOn=true, sfxOn=true;
var worldSeed = '';
var maxSquadSize = 12;
var maxContracts = 3;
var bulletMaxRangeTiles = 12;
var PLAYER_PROXIMITY_RADIUS = 0; // Initialize to 0, only current region cached

var speed_player = 1.0, speed_enemy = 1.0, speed_ally = 1.0, speed_global = 1.0;
var firerate_player = 1.0, firerate_enemy = 1.0, firerate_ally = 1.0, firerate_global = 1.0;
var hideMinimap=false;
var stats={kills:0,startTime:0};
var uiState={houseMenuOpen:false,house:null,shopMenuOpen:false,shop:null, kabakMenuOpen: false, kabak: null, worldMapOpen: false};
var playerLocationState = null;
var mech={leaveOnBaseChange:true};
var auto={enemy:0,farmer:0, lastSpawnCheck: 0};
var lastContractsUIUpdate = 0;
var tooltipCheckTime = 0;
var enemyAiMode = 'neutral';

// Сложность: ползунок -50..50 → norm 0..1 → difficulty 0.7..1.3
var diffKnob=0, difficulty=1;
const diffNorm=()=> (clamp(diffKnob,-50,50)+50)/100;
function applyDiff(){ difficulty = 1 + (diffNorm()-0.5)*0.6; }

function resetWorld() {
    worldData.clear();
    player = null;
    playerAlliances = [];
}

// ===== Шаг симуляции =====
function handleBuildingCollision(entity, prevX, prevY, buildings) {
  for (const b of buildings) {
    if (entity.insideBuilding === b) continue;
    const door = houseDoorRect(b);
    if (insideRect(entity.x, entity.y, door.x, door.y, door.w + TILE_SIZE, door.h + TILE_SIZE)) { continue; }
    if (insideRect(entity.x, prevY, b.x, b.y, b.w, b.h)) { entity.x = prevX; }
    if (insideRect(entity.x, entity.y, b.x, b.y, b.w, b.h)) { entity.y = prevY; }
  }
}


function manageChunkCaches() {


  if (!player) return;





  const CHUNK_PROXIMITY_RADIUS = 4; // 4 chunks in each direction (9x9 grid)


  


  // Get all chunks that should be active around the PLAYER


  const activeChunks = getChunksInProximity(player.x, player.y, CHUNK_PROXIMITY_RADIUS);


  const activeChunkKeys = new Set(activeChunks.map(c => `${c.rx}_${c.ry}_${c.key}`));





  // Load/Pre-render active chunks if they aren't cached yet


  for (const chunk of activeChunks) {


    if (!chunk.staticCache) {


      // This function creates the canvas and attaches it to chunk.staticCache


      preRenderChunk(chunk);


    }


  }





  // Unload non-active chunks from cache to save memory


  for (const region of worldData.values()) {


    for (const chunk of region.chunks.values()) {


      const fullChunkKey = `${chunk.rx}_${chunk.ry}_${chunk.key}`;


      if (!activeChunkKeys.has(fullChunkKey) && chunk.staticCache) {


        chunk.staticCache = null; // Clear the cached canvas


      }


    }


  }


}





function step(dt){


  manageChunkCaches(); // Ensure chunk caches are managed dynamically


  if (!player || !player.alive) return; // CRITICAL: Prevent crash if player is null or dead


  


  // --- Camera and Mouse Update ---


  const t = now();


  const dpr = window.devicePixelRatio || 1;


  cam.x = player.x; // Lock camera to player


  cam.y = player.y; // Lock camera to player


  cam.zoom += (cam.targetZoom - cam.zoom) * 0.15;


  mouse.wx = player.x + (mouse.x - W / dpr / 2) / cam.zoom;


  mouse.wy = player.y + (mouse.y - H / dpr / 2) / cam.zoom;


  


  // --- Get Active Entities ---


  const LOGIC_RADIUS = 2; // 5x5 grid for logic, can be tuned


  const activeChunks = getChunksInProximity(player.x, player.y, LOGIC_RADIUS);





  const activeGroups = [];


  const activeFarmers = [];


  const activeBullets = [];


  const activeLoot = [];


  const allBuildings = [];





  for (const chunk of activeChunks) {


      for (const entity of chunk.dynamicEntities) {


          switch (entity.type) {


              case 'group': activeGroups.push(entity); break;


              case 'farmer': activeFarmers.push(entity); break;


              case 'bullet': activeBullets.push(entity); break;


              case 'loot': activeLoot.push(entity); break;


          }


      }


      for (const entity of chunk.staticEntities) {


           if (['house', 'shop', 'kabak'].includes(entity.type)) {


              allBuildings.push(entity);


           }


      }


  }

  // --- END NEW ---



  if(player&&player.alive){

    let cursorOffsetX = 0, cursorOffsetY = 0;

    if(kbd.KeyW || kbd.ArrowUp) cursorOffsetY -= 100;

    if(kbd.KeyS || kbd.ArrowDown) cursorOffsetY += 100;

    if(kbd.KeyA || kbd.ArrowLeft) cursorOffsetX -= 100;

    if(kbd.KeyD || kbd.ArrowRight) cursorOffsetX += 100;

    

    if(cursorOffsetX !== 0 || cursorOffsetY !== 0) {

      mouse.wx = player.x + cursorOffsetX;

      mouse.wy = player.y + cursorOffsetY;

      player.moving = true;

    }

    

        const a=angleTo(player.x,player.y,mouse.wx,mouse.wy);

    

        player.a = a;

    

      }

    

      aiUpdate(dt, activeGroups);

    

    

    

      // Update formation angle only when the group is moving

    

      for (const g of activeGroups) {

    

        if (g.moving) {

      g.formationAngle = g.a;

    }

  }



  for(const g of activeGroups){

    if(!g.alive)continue;

    const move=g.moving;



    let speed = PLAYER_SPEED * speed_global;

    if (g.isPlayer) speed *= speed_player;

    else if (g.faction === FACTIONS.ALLY) speed *= speed_ally;

    else speed *= speed_enemy;



    if (g.insideBuilding) {

        const b = g.insideBuilding;

        const inner = { x: b.x, y: b.y, w: b.w - HOUSE_WALL * 2, h: b.h - HOUSE_WALL * 2 };

        if (move) {

            g.x += Math.cos(g.a) * speed * dt;

            g.y += Math.sin(g.a) * speed * dt;

        }

        g.x = clamp(g.x, inner.x - inner.w / 2, inner.x + inner.w / 2);

        g.y = clamp(g.y, inner.y - inner.h / 2, inner.y + inner.h / 2);

        b.roof = Math.max(0, b.roof - 3 * dt);

        let d = houseDoorRect(b);

        if (d.side === 0) d.y = b.y - b.h / 2 + HOUSE_WALL;

        if (d.side === 2) d.y = b.y + b.h / 2 - HOUSE_WALL;

        if (d.side === 1) d.x = b.x + b.w / 2 - HOUSE_WALL;

        if (d.side === 3) d.x = b.x - b.w / 2 + HOUSE_WALL;

        if (now() > g.doorCd && insideRect(g.x, g.y, d.x, d.y, d.w + TILE_SIZE, d.h + TILE_SIZE)) {

            g.insideBuilding = null;

            g.hidden = false;

            b.roof = 1;

            if (b.type === 'house') b.lockedBy = null;

            g.doorCd = now() + 0.25;

            const pad = TILE_SIZE * 2;

            if (d.side === 0) g.y = b.y - b.h / 2 - pad;

            if (d.side === 2) g.y = b.y + b.h / 2 + pad;

            if (d.side === 1) g.x = b.x + b.w / 2 + pad;

            if (d.side === 3) g.x = b.x - b.w / 2 - pad;

            if (g === player) {

                if (uiState.houseMenuOpen) closeHouseMenu();

                if (uiState.shopMenuOpen) closeShopMenu();

                if (uiState.kabakMenuOpen) closeKabakMenu();

            }

        }

        continue;

    }



    const prevX = g.x; const prevY = g.y;

    if(move){

      g.x+=Math.cos(g.a)*speed*dt;

      g.y+=Math.sin(g.a)*speed*dt;

      handleBuildingCollision(g, prevX, prevY, allBuildings);

    }

    if(g.hidden)g.hidden=false;



    // --- CHUNK TRANSITION LOGIC for groups ---

    const oldChunk = getChunkFromWorldCoords(prevX, prevY);

    const newChunk = getChunkFromWorldCoords(g.x, g.y);

    if (oldChunk && newChunk && oldChunk !== newChunk) {

        const index = oldChunk.dynamicEntities.findIndex(e => e.id === g.id);

        if (index > -1) {

            oldChunk.dynamicEntities.splice(index, 1);

            newChunk.dynamicEntities.push(g);

        }

    }

  }



  for(const g of activeGroups){

    if(!g.alive) continue;

    if(g.units.length >= maxSquadSize && !g.isPlayer) continue;

    

    for(let i = activeFarmers.length - 1; i >= 0; i--){

      const f = activeFarmers[i];

      if(!f.alive) continue;

      if(dist2(f,g) < GATHER_RADIUS*GATHER_RADIUS){

        f.alive=false; 

        

        // Remove farmer from its chunk

        const farmerChunk = getChunkFromWorldCoords(f.x, f.y);

        if(farmerChunk) {

            const index = farmerChunk.dynamicEntities.findIndex(e => e.id === f.id);

            if(index > -1) farmerChunk.dynamicEntities.splice(index, 1);

        }

        activeFarmers.splice(i, 1); // Also remove from this frame's active list



        if (g.isPlayer && g.units.length >= maxSquadSize) {

            const allies = playerAlliances.map(a => findEntityById(a.allyId)).filter(ally => ally && ally.alive && ally.units.length < maxSquadSize);

            if (allies.length > 0) {

                allies.sort((a, b) => a.units.length - b.units.length);

                const recipient = allies[0];

                addUnitToGroup(recipient, f); // Pass farmer to ally

                showNotification(`Отряд полон! Юнит передан союзнику: ${recipient.name}.`);

            } else {

                showNotification(`Ваш отряд и отряды союзников полны!`);

            }

        } else if (g.units.length < maxSquadSize) {

            addUnitToGroup(g, f); // Pass farmer to group

        }

        if(g.units.length >= maxSquadSize && !g.isPlayer) break;

      }

    }

    // tryLootNearby now needs the list of active loot

    for (let i = activeLoot.length - 1; i >= 0; i--) {

        const item = activeLoot[i];

        if (Math.hypot(item.x - g.x, item.y - g.y) < GATHER_RADIUS) {

            g.inv[item.lootType] = (g.inv[item.lootType] || 0) + item.amount;

            

            const lootChunk = getChunkFromWorldCoords(item.x, item.y);

            if(lootChunk) {

                const index = lootChunk.dynamicEntities.findIndex(e => e.id === item.id);

                if(index > -1) lootChunk.dynamicEntities.splice(index, 1);

            }

            activeLoot.splice(i, 1);

            

            if (g === player) forceUpdateInventoryUI();

        }

    }

  }



  for(const g of activeGroups){

    if(!g.alive) continue;

    for (let i = 0; i < g.units.length; i++) {

      const u = g.units[i];

      const prevX = u.x; const prevY = u.y;

      const targetPos = getFormationSlot(g, i);

      u.x += (targetPos.x - u.x) * 0.2;

      u.y += (targetPos.y - u.y) * 0.2;

      u.moving = Math.hypot(u.x - prevX, u.y - prevY) > 0.1;

      u.a = g.a;

      handleBuildingCollision(u, prevX, prevY, allBuildings);

    }



    if (g.isPlayer && g.units.length > 0 && g.inv.ammo > 0 && !g.insideBuilding) {

      const t = now();

      for (const u of g.units) {

        if (u.fireMode === FIRE_MODE_AT_WILL) {

          const gcd = FIRE_GCD * 4 / (firerate_player * firerate_global);

          if (t - u.lastFire > gcd) {

            const hostile = findHostileForUnit(u, g); 

            if (hostile && dist2(u, hostile) < SHOOT_RANGE * SHOOT_RANGE) {

              const lead = leadTarget(u, hostile);

              spawnBullet(u.x, u.y, lead.tx, lead.ty, g.id, BULLET_SPREAD * (2 - difficulty));

              g.inv.ammo = Math.max(0, g.inv.ammo - 1);

              u.lastFire = t;

              forceUpdateInventoryUI();

            }

          }

        }

      }

    }

  }

  

  for (const f of activeFarmers) {

    if (!f.alive) continue;



    if (f.fleeingFrom && t < f.fleeUntil) {

        const fleeAngle = angleTo(f.fleeingFrom.x, f.fleeingFrom.y, f.x, f.y);

        f.vx = Math.cos(fleeAngle) * PLAYER_SPEED; f.vy = Math.sin(fleeAngle) * PLAYER_SPEED;

    } else {

        if (f.fleeingFrom) { f.fleeingFrom = null; f.vx = 0; f.vy = 0; }

        if (t > f.nextMove) {

            f.nextMove = t + rand(2, 5);

            const angle = rand(0, Math.PI * 2); const speed = rand(10, 25);

            f.vx = Math.cos(angle) * speed; f.vy = Math.sin(angle) * speed;

        }

    }



    const prevX = f.x, prevY = f.y; 

    f.x += f.vx * dt; f.y += f.vy * dt;

    if (Math.hypot(f.vx, f.vy) > 0.1) { f.a = Math.atan2(f.vy, f.vx); f.moving = true; } 

    else { f.moving = false; }

    handleBuildingCollision(f, prevX, prevY, allBuildings);

    

    // --- CHUNK TRANSITION LOGIC for farmers ---

    const oldChunk = getChunkFromWorldCoords(prevX, prevY);

    const newChunk = getChunkFromWorldCoords(f.x, f.y);

    if (oldChunk && newChunk && oldChunk !== newChunk) {

        const index = oldChunk.dynamicEntities.findIndex(e => e.id === f.id);

        if (index > -1) {

            oldChunk.dynamicEntities.splice(index, 1);

            newChunk.dynamicEntities.push(f);

        }

    }

  }



  updateAlliances(dt);



      for(let i = activeBullets.length - 1; i >= 0; i--){



          const b = activeBullets[i];



          const oldChunk = getChunkFromWorldCoords(b.x, b.y);



    



          b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;



          



          let currentChunk = getChunkFromWorldCoords(b.x, b.y);



    



          // --- CHUNK TRANSITION LOGIC for bullets ---



          if (oldChunk && currentChunk && oldChunk !== currentChunk) {



            const index = oldChunk.dynamicEntities.findIndex(e => e === b);



            if (index > -1) {



                oldChunk.dynamicEntities.splice(index, 1);



                currentChunk.dynamicEntities.push(b);



            }



          }



          



          if(b.life <= 0 || !currentChunk){



              if(oldChunk) { // If it flew out of bounds, it was last in oldChunk



                  const index = oldChunk.dynamicEntities.findIndex(e => e === b);



                  if(index > -1) oldChunk.dynamicEntities.splice(index, 1);



              }



              activeBullets.splice(i,1);



              continue;



          }



          



          let hit = false;



          for(const building of allBuildings) { 



              if (insideRect(b.x, b.y, building.x, building.y, building.w, building.h)) { 



                  if(currentChunk) currentChunk.dynamicEntities.splice(currentChunk.dynamicEntities.findIndex(e => e === b), 1);



                  activeBullets.splice(i,1);



                  hit = true; break; 



              } 



          }



          if(hit) continue;



    



          for(let fi = activeFarmers.length - 1; fi >= 0; fi--) {



            const f = activeFarmers[fi];



            if (!f.alive) continue;



            if (Math.hypot(b.x - f.x, b.y - f.y) < 18) {



              f.cmdHp--; f.lastDamageTime = t;



              const shooter = activeGroups.find(g => g.id === b.owner);



              if (shooter) { f.fleeingFrom = shooter; f.fleeUntil = t + 7; }



              if (f.cmdHp <= 0) { 



                f.alive = false; createLoot(f.x, f.y, 'money', 10); 



                const farmerChunk = getChunkFromWorldCoords(f.x, f.y);



                if(farmerChunk) farmerChunk.dynamicEntities.splice(farmerChunk.dynamicEntities.findIndex(e => e.id === f.id), 1);



                activeFarmers.splice(fi, 1);



              }



              if(currentChunk) currentChunk.dynamicEntities.splice(currentChunk.dynamicEntities.findIndex(e => e === b), 1);



              activeBullets.splice(i,1);



              hit = true; break;



            }



          }



          if(hit) continue;



    



          for(const g of activeGroups){



            if(!g.alive||g.id===b.owner || (g.insideBuilding && g.insideBuilding.type === 'house' && g.insideBuilding.owner===g.id) || (g.insideBuilding && g.insideBuilding.type === 'kabak'))continue;



            const shooter=activeGroups.find(x=>x.id===b.owner);



            if(shooter&&shooter.faction===g.faction&&!g.isPlayer)continue;



            const R=18+g.units.length*0.5;



            if(dist2(g,b)<R*R){



                applyDamageToGroup(g,b.dmg);



                if(currentChunk) currentChunk.dynamicEntities.splice(currentChunk.dynamicEntities.findIndex(e => e === b), 1);



                activeBullets.splice(i,1);



                break;



            }



          }



        }



  if(player && player.alive && !player.insideBuilding && enemyAiMode !== 'neutral' && enemyAiMode !== 'faction_war'){ 

    for(const g of activeGroups){ 

      if(g === player || !g.alive || !areFactionsHostile(player.faction, g.faction)) continue;

    } 

  }



  for(const g of activeGroups){

    if(!g.alive||g.insideBuilding)continue;

    for(const b of allBuildings){

      const d=houseDoorRect(b),atDoor=insideRect(g.x,g.y,d.x,d.y,d.w+TILE_SIZE,d.h+TILE_SIZE);

      if(atDoor){

        let canEnter = false;

        if (b.type === 'house') {

            if (b.lockedBy && b.lockedBy !== g.id) continue;

            canEnter = !b.owner || b.owner === g.id;

            if (canEnter) b.lockedBy = g.id;

        } else {

            canEnter = true;

        }

        if(canEnter){

          g.insideBuilding=b; g.doorCd=now()+0.25;

          const o=TILE_SIZE*1.5; if(d.side===0)g.y=b.y-b.h/2+HOUSE_WALL+o; if(d.side===2)g.y=b.y+b.h/2-HOUSE_WALL-o;

          if(d.side===1)g.x=b.x+b.w/2-HOUSE_WALL-o; if(d.side===3)g.x=b.x-b.w/2+HOUSE_WALL+o;

          break; 

        }

      }

    }

  }



  for(const h of allBuildings.filter(b => b.type === 'house')){

    if(!h.owner||h.garrison.length===0)continue;

    const our=activeGroups.find(g=>g.id===h.owner); if(!our)continue;

    const target=activeGroups.filter(g=>g.alive&&g.id!==h.owner&&!g.hidden&&(!our||g.faction!==our.faction||g.isPlayer)).sort((a,b)=>dist2(h,a)-dist2(h,b))[0];

    if(target){

      const fireRate = (0.8 / (1 + diffNorm())) * 3; const spread = 0.04 * (1.5 - diffNorm());

      if(dist2(h,target)<SHOOT_RANGE**2 && now()-h.lastFire > fireRate){ h.lastFire=now(); for(let i=0;i<Math.min(h.garrison.length,10);i++){ spawnBullet(h.x,h.y,target.x,target.y,h.owner,spread); } }

    }

  }



  if(t > auto.lastSpawnCheck + 1) { handleAutospawn(); auto.lastSpawnCheck = t; }

  if (t > tooltipCheckTime + 0.5) { checkBuildingTooltips(); tooltipCheckTime = t; }

  if (t - lastContractsUIUpdate > 1) { updatePlayerContractsTab(); lastContractsUIUpdate = t; }

}

function addUnitToGroup(g, farmer = null) {
    if (g.units.length >= maxSquadSize) return;

    const lastName = farmer ? farmer.lastName : generateLastName();
    const startHp = farmer ? farmer.cmdHp : DEFAULT_UNIT_HP;

    const unit = {
        id: Math.random().toString(36).slice(2, 8),
        x: g.x,
        y: g.y,
        a: g.a,
        vx: 0,
        vy: 0,
        name: `Боец ${lastName}`,
        lastName: lastName,
        cmdHp: startHp,
        maxHp: DEFAULT_UNIT_HP,
        spriteData: null,
        moving: false,
        fireMode: FIRE_MODE_SYNC, // Default fire mode
        lastFire: 0, // For 'Fire at Will' cooldown
    };

    preloadSprite(unitAppearance).then(loadedLayers => {
        unit.spriteData = { layers: loadedLayers };
    });

    g.units.push(unit);
    if (g.isPlayer) {
      updateSquadUI();
    }
}

// ===== Спавнпулы/действия =====
function findSafeSpawnPoint(x, y, radius = 200) {
    let spawnX = x;
    let spawnY = y;
    let attempts = 0;
    while (isPointInsideBuilding(spawnX, spawnY) && attempts < 20) {
        const angle = rand(0, Math.PI * 2);
        const dist = rand(50, radius);
        spawnX = x + Math.cos(angle) * dist;
        spawnY = y + Math.sin(angle) * dist;
        attempts++;
    }
    return { x: spawnX, y: spawnY };
}

function spawnEnemy(x,y, factionId = null){
  const safePos = findSafeSpawnPoint(x ?? (player ? player.x : 0), y ?? (player ? player.y : 0));
  
  let faction;
  if (factionId) {
      faction = gameFactions.find(f => f.id === factionId);
      if (!faction) {
          console.error(`Faction with id ${factionId} not found. Spawning random.`);
          factionId = null; // Fallback to random
      }
  }
  
  if (!factionId) {
      let factionsToUse = gameFactions.filter(f => f.id !== FACTIONS.PLAYER);
      if (player && player.factionInfo) {
          const playerFactionId = player.factionInfo.id;
          factionsToUse = factionsToUse.filter(f => f.id !== playerFactionId);
      }
      if (factionsToUse.length === 0) { factionsToUse = gameFactions.filter(f => f.id !== FACTIONS.PLAYER); }
      if (factionsToUse.length === 0) { console.error("No available enemy factions to spawn."); return; }

      faction = factionsToUse[nextFactionIndex % factionsToUse.length];
      nextFactionIndex++;
  }

  const g = newGroup({
      x: safePos.x,
      y: safePos.y,
      color: faction.color,
      name: `Ком. ${faction.name}`,
      faction: faction.id,
      factionInfo: faction,
      icon: faction.icon
  });

  preloadSprite(defaultAppearance).then(loadedLayers => {
    g.spriteData = { layers: loadedLayers };
  });

  return g;
}

function removeEnemy(){
  const regions = getExistingRegionsInProximity(player.x, player.y, 1);
  for(const region of regions) {
    const groups = getRegionDynamicEntities(region, 'group');
    const enemy = groups.find(g => g && !g.isPlayer);
    if (enemy) {
      const chunk = getChunkFromWorldCoords(enemy.x, enemy.y);
      if (chunk) {
        const index = chunk.dynamicEntities.findIndex(e => e.id === enemy.id);
        if (index > -1) {
          chunk.dynamicEntities.splice(index, 1);
          return;
        }
      }
    }
  }
}

function spawnFarmer(x,y){ 
  const safePos = findSafeSpawnPoint(x ?? player.x + rand(-300, 300), y ?? player.y + rand(-300, 300));
  return newFarmer(safePos.x, safePos.y); 
}

function removeFarmer(){ 
  const regions = getExistingRegionsInProximity(player.x, player.y, 1);
  for(const region of regions) {
    const farmers = getRegionDynamicEntities(region, 'farmer');
    if (farmers.length > 0) {
      const farmer = farmers[0];
      const chunk = getChunkFromWorldCoords(farmer.x, farmer.y);
      if (chunk) {
        const index = chunk.dynamicEntities.findIndex(e => e.id === farmer.id);
        if (index > -1) {
          chunk.dynamicEntities.splice(index, 1);
          return;
        }
      }
    }
  }
}

function spawnHouse(x,y){ 
  const widthInTiles = HOUSE_SIZE / GRID_SIZE;
  if (!isAreaFree(x, y, widthInTiles, widthInTiles, 0)) return null;
  const house = newHouse(x, y);
  if (house) occupyArea(x, y, widthInTiles, widthInTiles, BUILDING_BARRIER_TILES, 'building');
  return house;
}

function spawnShop(x,y){ 
  const widthInTiles = SHOP_SIZE / GRID_SIZE;
  if (!isAreaFree(x, y, widthInTiles, widthInTiles, 0)) return null;
  const shop = newShop(x, y);
  if (shop) occupyArea(x, y, widthInTiles, widthInTiles, BUILDING_BARRIER_TILES, 'building');
  return shop;
}

function spawnKabak(x,y){ 
  const widthInTiles = KABAK_SIZE / GRID_SIZE;
  if (!isAreaFree(x, y, widthInTiles, widthInTiles, 0)) return null;
  const kabak = newKabak(x, y);
  if (kabak) occupyArea(x, y, widthInTiles, widthInTiles, BUILDING_BARRIER_TILES, 'building');
  return kabak;
}

function handleAutospawn() {
  if (enemyAiMode !== 'none' && auto.enemy !== 0 && Math.random() < Math.abs(auto.enemy) / 10) { auto.enemy > 0 ? spawnEnemy() : removeEnemy(); }
  if (auto.farmer !== 0 && Math.random() < Math.abs(auto.farmer) / 10) { auto.farmer > 0 ? spawnFarmer() : removeFarmer(); }
}

function handleCheatSpawn(key, x, y, isClick) {
  if (!player) return;

  const spawnX = isClick ? snapToMainGrid(player.x + rand(-400, 400)) : x;
  const spawnY = isClick ? snapToMainGrid(player.y + rand(-400, 400)) : y;

  const safePos = findSafeSpawnPoint(spawnX, spawnY);

  if (key.startsWith('faction_')) {
      const factionId = key.substring('faction_'.length);
      spawnEnemy(safePos.x, safePos.y, factionId);
      forceUpdateInventoryUI();
      return;
  }

  switch(key) {
    case 'enemy': 
        spawnEnemy(safePos.x, safePos.y);
        break;
    case 'farmer': 
        spawnFarmer(safePos.x, safePos.y);
        break;
    case 'house': 
        spawnHouse(safePos.x, safePos.y);
        break;
    case 'shop': 
        spawnShop(safePos.x, safePos.y);
        break;
    case 'kabak': 
        spawnKabak(safePos.x, safePos.y);
        break;
    case 'money_100': 
        if (isClick) player.inv.money += 100; else createLoot(safePos.x, safePos.y, 'money', 100); 
        break;
    case 'ammo': 
        if (isClick) player.inv.ammo += 100; else createLoot(safePos.x, safePos.y, 'ammo', 100); 
        break;
    case 'unit_loot': 
        if (isClick) player.inv.unit++; else createLoot(safePos.x, safePos.y, 'unit', 1); 
        break;
    case 'cmd_loot': 
        if (isClick) player.inv.cmd++; else createLoot(safePos.x, safePos.y, 'cmd', 1); 
        break;
    case 'unit_add': 
        if (player.units.length < maxSquadSize) { 
            addUnitToGroup(player);
        } else {
            const allies = playerAlliances.map(a => findEntityById(a.allyId)).filter(ally => ally && ally.alive && ally.units.length < maxSquadSize);
            if (allies.length > 0) {
                allies.sort((a, b) => a.units.length - b.units.length);
                const recipient = allies[0];
                addUnitToGroup(recipient);
                showNotification(`Отряд полон! Юнит передан союзнику: ${recipient.name}.`);
            } else {
                showNotification(`Ваш отряд и отряды союзников полны!`);
            }
        }
        break;
    case 'ally_contract': {
        if (playerAlliances.length >= maxContracts) {
            showNotification("Достигнут лимит контрактов.");
            break;
        }
        const enemy = spawnEnemy(safePos.x, safePos.y);
        if (enemy) formAlliance(enemy, true);
        break;
    }
  }
  forceUpdateInventoryUI();
}