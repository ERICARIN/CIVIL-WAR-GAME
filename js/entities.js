// ===== Сущности =====

const defaultAppearance = {
    base:     { url: 'player/player_stay.png' },
    top:      { url: 'cloth/cloth_top/cloth_top_01.png' },
    hairBack: { url: 'cloth/hair_back/hair_back_01.png' },
    hat:      { url: 'cloth/hats/hat_01.png' },
    bangs:    { url: 'cloth/bangs/bang_01.png' },
    pants:    {
        stay:  { url: 'cloth/cloth_bottom/cloth_bottom_01/cloth_bottom_stay.png' },
        walk1: { url: 'cloth/cloth_bottom/cloth_bottom_01/cloth_bottom_walk_01.png' },
        walk2: { url: 'cloth/cloth_bottom/cloth_bottom_01/cloth_bottom_walk_02.png' },
    },
};

const unitAppearance = {
    ...defaultAppearance,
    hat:      { url: 'none' },
    bangs:    { url: 'none' },
    hairBack: { url: 'none' },
};

function newGroup({x,y,color,name,isPlayer=false,faction=FACTIONS.ENEMY_1, inv: startInv = {}, icon = null, factionInfo = null, spriteData = null}){
  const finalInv = {ammo:120, money:0, unit:0, cmd:0, contract_paper: 0, ...startInv};
  const groupName = isPlayer ? (name || 'Ком. Игрок') : `Ком. ${generateLastName()}`;
  const g={ id:Math.random().toString(36).slice(2,8), type: 'group', x,y,a:rand(0,Math.PI*2),prevA:0,angVel:0,color,name:groupName,
    moving:false,cmdHp:DEFAULT_CMD_HP,maxHp:DEFAULT_CMD_HP,units:[],alive:true,lastFire:-9,
    nextAmmoShare: 0,
    formationAngle: 0, // Add formationAngle
    ai:!isPlayer?{state:'patrol',desired:6,target:null,nextThink:0, nextMoveDecision:0, moveState:'advancing', spawnX:x, spawnY:y}:{},
    insideBuilding:null,hidden:false,faction,isPlayer,
    inv:finalInv,doorCd:0, tx:null,ty:null, isMissionTarget: false, icon, factionInfo, spriteData, animFrame: 0, animTime: 0 };
  
  const region = getOrCreateRegion(x, y);
  const { cx, cy } = worldToChunkCoords(x, y);
  const chunk = getOrCreateChunk(region, cx, cy);
  chunk.dynamicEntities.push(g);

  if(isPlayer) player=g; 
  return g;
}

function newFarmer(x, y, options = {}){
  const lastName = options.lastName || generateLastName();
  const startHp = options.cmdHp || DEFAULT_UNIT_HP;
  
  const farmer = {
      id: Math.random().toString(36).slice(2,8),
      type: 'farmer',
      x, y, a: rand(0, Math.PI * 2), // Initial random angle
      vx: 0, vy: 0,
      name: `Крест. ${lastName}`,
      lastName: lastName,
      cmdHp: startHp, maxHp: DEFAULT_UNIT_HP,
      spriteData: null,
      moving: false,
      alive:true,
      inv: { money: 0, ammo: 0 },
      nextMove:0, aiState: 'idle', target: null,
      fleeingFrom: null,
      fleeUntil: 0,
  };

  preloadSprite(unitAppearance).then(loadedLayers => {
      farmer.spriteData = { layers: loadedLayers };
  });

  const region = getOrCreateRegion(x, y);
  const { cx, cy } = worldToChunkCoords(x, y);
  const chunk = getOrCreateChunk(region, cx, cy);
  chunk.dynamicEntities.push(farmer);
  
  return farmer;
}

function newHouse(x,y, village=null){ 
  let houseNumber = 0;
  if (village) {
    if (!village.houseCounter) {
      village.houseCounter = 0;
    }
    village.houseCounter++;
    houseNumber = village.houseCounter;
  }
  const h = {type:'house', x,y,w:HOUSE_SIZE,h:HOUSE_SIZE,roof:1,owner:null,ownerColor:'#777',garrison:[],id:Math.random().toString(36).slice(2,8),doorSide:2,lastFire:0,lockedBy:null, village, isMissionTarget: false, name: 'Дом', houseNumber: houseNumber, doorState: 'closed', doorAnimationTime: 0}; 
  const region = getOrCreateRegion(x, y);
  const { cx, cy } = worldToChunkCoords(x, y);
  const chunk = getOrCreateChunk(region, cx, cy);
  chunk.staticEntities.push(h);
  chunk.staticCache = null; // Invalidate cache to force a re-render
  return h; 
}

function newShop(x,y, village=null){
  const possibleGoods = ['ammo', 'food', 'medicines'];
  const sells = possibleGoods[Math.floor(Math.random() * possibleGoods.length)];
  const shop = {type:'shop', x,y,w:SHOP_SIZE,h:SHOP_SIZE,roof:1,doorSide:2,lockedBy:null,id:Math.random(), village, name: 'Лавка', sells: sells, doorState: 'closed', doorAnimationTime: 0};
  const region = getOrCreateRegion(x, y);
  const { cx, cy } = worldToChunkCoords(x, y);
  const chunk = getOrCreateChunk(region, cx, cy);
  chunk.staticEntities.push(shop);
  chunk.staticCache = null; // Invalidate cache to force a re-render
  return shop;
}

function newKabak(x,y, village=null){
  const kabak = {type:'kabak', x,y,w:KABAK_SIZE,h:KABAK_SIZE,roof:1,doorSide:2,lockedBy:null,id:Math.random().toString(36).slice(2,8), village, missions: [], name: 'Кабак', doorState: 'closed', doorAnimationTime: 0};
  const region = getOrCreateRegion(x, y);
  const { cx, cy } = worldToChunkCoords(x, y);
  const chunk = getOrCreateChunk(region, cx, cy);
  chunk.staticEntities.push(kabak);
  chunk.staticCache = null; // Invalidate cache to force a re-render
  
  // Генерируем миссии для кабака
  const numMissions = randInt(2, 4);
  for (let i = 0; i < numMissions; i++) {
      const mission = generateMission(kabak);
      if (mission) {
          kabak.missions.push(mission);
      }
  }

  return kabak;
}



function rectsOverlap(a,b,pad=0){
  return Math.abs(a.x-b.x)<(a.w+b.w)/2+pad && Math.abs(a.y-b.y)<(a.h+b.h)/2+pad
}

function houseDoorRect(h){ 
  const doorW = TILE_SIZE * 2, doorH = TILE_SIZE * 1.5;
  if(h.doorSide===0) return {x:h.x,y:h.y-h.h/2,w:doorW,h:doorH,side:0}; 
  if(h.doorSide===2) return {x:h.x,y:h.y+h.h/2,w:doorW,h:doorH,side:2}; 
  if(h.doorSide===1) return {x:h.x+h.w/2,y:h.y,w:doorH,h:doorW,side:1}; 
  return {x:h.x-h.w/2,y:h.y,w:doorH,h:doorW,side:3}; 
}

function insideRect(px,py,rx,ry,rw,rh){ 
  return Math.abs(px-rx)<rw/2 && Math.abs(py-ry)<rh/2; 
}

// ===== Геометрия/рисование =====
function circle(renderCtx,x,y,r,fill=true){
  renderCtx.beginPath();
  renderCtx.arc(x,y,r,0,Math.PI*2);
  fill?renderCtx.fill():renderCtx.stroke();
}

function getFormationSlot(group, idx) {
  let row = 0, base = 0, countInRow = 1;
  while (base + countInRow <= idx) { 
    base += countInRow; 
    row++; 
    countInRow = Math.min(8, countInRow * 2); 
  }
  const inRowIdx = idx - base;
  const cols = Math.min(group.units.length - base, countInRow);
  const rowBack = (row + 1) * ROW_SPACING;
  const colOffset = (inRowIdx - (cols - 1) / 2) * COL_SPACING;
  const cos = Math.cos(group.formationAngle || group.a), sin = Math.sin(group.formationAngle || group.a);
  return { 
    x: group.x - cos * rowBack - sin * colOffset, 
    y: group.y - sin * rowBack + cos * colOffset 
  };
}
