
// ===== Движение/повороты =====
function turnTowards(g,ang,dt){ 
  let da=((ang-g.a+Math.PI*3)%(Math.PI*2))-Math.PI; 
  const max=TURN_SPEED*dt; 
  const newA=g.a+clamp(da,-max,max);
  g.a=newA; 
}

function goTo(g,tx,ty,dt){ 
  const ang=angleTo(g.x,g.y,tx,ty); 
  turnTowards(g,ang,dt); 
  const d=Math.hypot(tx-g.x,ty-g.y); 
  g.moving = d > 2;
}

function setBuildingAsTarget(g, building) {
    const door = houseDoorRect(building);
    const buffer = 80; // Буферное расстояние от двери
    let stageX, stageY;

    // Рассчитываем точку строго перед входом, в зависимости от ориентации двери
    if (door.side === 0) { // Дверь сверху
        stageX = door.x;
        stageY = door.y - buffer;
    } else if (door.side === 2) { // Дверь снизу
        stageX = door.x;
        stageY = door.y + buffer;
    } else if (door.side === 1) { // Дверь справа
        stageX = door.x + buffer;
        stageY = door.y;
    } else { // Дверь слева
        stageX = door.x - buffer;
        stageY = door.y;
    }

    g.ai.targetBuilding = building;
    g.ai.targetPos = { x: stageX, y: stageY };
    g.ai.movement_stage = 'approaching'; // Этап 1: подход к безопасной точке
}


// ===== AI =====
function aiUpdate(dt, activeGroups){
  if(!player || !player.alive) return;
  const t=now();
  
  for(const g of activeGroups){
    if(g===player || !g.alive || !g.ai) continue;

    if (!g.ai.state) g.ai.state = 'patrol';

    // --- Обработка движения к зданию ---
    if (g.ai.targetBuilding && g.ai.movement_stage) {
        if (g.ai.movement_stage === 'approaching') {
            if (dist2(g, g.ai.targetPos) < 20*20) { // Подходим ближе к точке
                g.ai.movement_stage = 'entering';
                const door = houseDoorRect(g.ai.targetBuilding);
                g.ai.targetPos = { x: door.x, y: door.y };
            }
        }
    }

    const hostile = nearestHostile(g);
    const seeHostile = hostile && dist2(g,hostile) < (SHOOT_RANGE*SHOOT_RANGE) && !hostile.hidden;

    if(g.insideBuilding){
      g.ai.movement_stage = null; // Сбрасываем логику входа
      const b = g.insideBuilding;
      if (g.ai.state === 'chilling' && b.type === 'kabak') {
          if (!g.ai.chillUntil || t > g.ai.chillUntil) { g.ai.state = 'patrol'; } 
          else { g.moving = false; }
      } else {
          if(b.type === 'house') {
            if(!b.owner || b.owner!==g.id) setBaseFor(g,b);
            if(b.owner===g.id && b.garrison.length<1 && g.units.length>1){ b.garrison.push(g.units.pop()); }
          } else if (b.type === 'shop') {
            if(g.inv.ammo<300){ g.inv.money += g.inv.cmd * 500; g.inv.cmd = 0; g.inv.money += g.inv.unit * 100; g.inv.unit = 0; const buy=Math.min(1000, g.inv.money|0); g.inv.money-=buy; g.inv.ammo+=buy; }
          }
          const d=houseDoorRect(b); goTo(g,d.x,d.y,dt);
      }
      continue;
    }

    if(seeHostile){
      g.ai.state='fight'; g.ai.movement_stage = null;
      const dTo = Math.hypot(hostile.x-g.x, hostile.y-g.y); let tx=hostile.x, ty=hostile.y;
      if (diffNorm() > 0.35) { const lead = leadTarget(g, hostile); tx = lead.tx; ty = lead.ty; }
      if(t > g.ai.nextMoveDecision){ g.ai.nextMoveDecision = t + rand(0.8, 1.5); const willHold = Math.random() < (0.4 - diffNorm() * 0.3); g.ai.moveState = willHold ? 'holding' : 'advancing'; }
      if (g.ai.moveState === 'advancing') {
          const keepDist = SHOOT_RANGE * 0.7;
          if (dTo > keepDist) {
              // Too far, advance
              goTo(g, hostile.x, hostile.y, dt);
          } else {
              // Good distance, strafe
              const angleToHostile = angleTo(g.x, g.y, hostile.x, hostile.y);
              const orbitDirection = (g.id.charCodeAt(0) % 2 === 0) ? 1 : -1; // Consistent strafe direction per AI
              const strafeAngle = angleToHostile + (Math.PI / 2) * orbitDirection;
              
              const strafeTargetX = g.x + Math.cos(strafeAngle) * 100;
              const strafeTargetY = g.y + Math.sin(strafeAngle) * 100;
              
              goTo(g, strafeTargetX, strafeTargetY, dt);
          }
      } 
      else { g.moving = false; turnTowards(g, angleTo(g.x, g.y, tx, ty), dt); }
      
      // --- Fire Control Logic ---
      if(dTo < SHOOT_RANGE * 0.95 && g.inv.ammo > 0) {
        // Commander fires, which also triggers sync-fire units via volleyAI
        volleyAI(g, tx, ty); 

        // "Fire at Will" units act independently
        for (const u of g.units) {
          if (u.fireMode === FIRE_MODE_AT_WILL && g.inv.ammo > 0) {
            const firerate = g.faction === FACTIONS.ALLY ? firerate_ally : firerate_enemy;
            const gcd = (FIRE_GCD * 4) / (firerate * firerate_global); // Slower GCD for individual unit autonomy
            if (t - u.lastFire > gcd) {
              // Use findHostileForUnit to correctly find a hostile relative to the unit and its group's faction
              const unitHostile = findHostileForUnit(u, g); 
              if (unitHostile && dist2(u, unitHostile) < SHOOT_RANGE * SHOOT_RANGE) {
                  const lead = leadTarget(u, unitHostile);
                  const spreadScale = 2.2 - 1.2*diffNorm();
                  spawnBullet(u.x, u.y, lead.tx, lead.ty, g.id, BULLET_SPREAD * spreadScale);
                  g.inv.ammo = Math.max(0, g.inv.ammo - 1);
                  u.lastFire = t;
              }
            }
          }
        }
      }
      continue;
    }

    // --- Принятие решений ---
    if (g.ai.movement_stage) { goTo(g, g.ai.targetPos.x, g.ai.targetPos.y, dt); continue; }

    if (!g.ai.nextDecisionTime || t > g.ai.nextDecisionTime) {
        g.ai.nextDecisionTime = t + rand(3, 7);
        const isAlly = g.faction === FACTIONS.ALLY;
        const leash = isAlly ? ALLY_LEASH_RADIUS : Infinity;

        // 1. Кабак
        const kabak = findNearest(g, r => getRegionStaticEntities(r, 'kabak'));
        if (kabak && dist2(g, kabak) < leash*leash && Math.random() < 0.1) {
            g.ai.state = 'chilling';
            g.ai.chillUntil = t + rand(20, 60);
            setBuildingAsTarget(g, kabak);
            continue;
        }

        // 2. Магазин
        if(g.inv.ammo < 60){
            const shop=nearestShop(g.x,g.y);
            if(shop && dist2(g, shop) < leash*leash){ g.ai.state='resupply'; setBuildingAsTarget(g, shop); continue; }
        }

        // 3. База
        const base=getBaseHouseForId(g.id);
        if(!base){
            const h=nearestNeutralHouse(g.x,g.y);
            if(h && dist2(g, h) < leash*leash){ g.ai.state='claimBase'; setBuildingAsTarget(g, h); continue; }
        }
        if(base && base.garrison.length<1 && g.units.length>1){
            if(dist2(g, base) < leash*leash) { g.ai.state='garrison'; setBuildingAsTarget(g, base); continue; }
        }

        // 4. Рекруты
        if(g.units.length<g.ai.desired){
            const f=nearestFarmer(g);
            if(f && dist2(g, f) < leash*leash){ g.ai.state='recruit'; g.ai.targetPos = {x:f.x, y:f.y}; goTo(g,f.x,f.y,dt); continue; }
        }
    }
    
    // 5. Патруль (по умолчанию)
    if (g.ai.state !== 'patrol') g.ai.targetPos = null;
    g.ai.state = 'patrol';
    let patrolCenterX = g.ai.spawnX || g.x;
    let patrolCenterY = g.ai.spawnY || g.y;
    if (g.faction === FACTIONS.ALLY) {
        patrolCenterX = player.x;
        patrolCenterY = player.y;
    }
    if (!g.ai.targetPos || dist2(g, g.ai.targetPos) < 100*100) {
        const patrolRadius = g.faction === FACTIONS.ALLY ? ALLY_LEASH_RADIUS * 0.8 : 800;
        const patrolX = patrolCenterX + rand(-patrolRadius, patrolRadius);
        const patrolY = patrolCenterY + rand(-patrolRadius, patrolRadius);
        g.ai.targetPos = { x: patrolX, y: patrolY };
    }
    goTo(g, g.ai.targetPos.x, g.ai.targetPos.y, dt);
  }
}
