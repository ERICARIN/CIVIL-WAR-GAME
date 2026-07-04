// ===== Мир и регионы =====
const worldData = new Map(); // "x_y" -> region object

// --- Chunk Helper Functions ---
function getChunkKey(cx, cy) {
    return `${cx}_${cy}`;
}

function worldToChunkCoords(x, y) {
    const rx = Math.floor(x / REGION_SIZE);
    const ry = Math.floor(y / REGION_SIZE);

    const localX = x - rx * REGION_SIZE;
    const localY = y - ry * REGION_SIZE;

    const cx = Math.floor(localX / (CHUNK_SIZE * TILE_SIZE));
    const cy = Math.floor(localY / (CHUNK_SIZE * TILE_SIZE));

    return { rx, ry, cx, cy };
}

function getChunkFromWorldCoords(x, y) {
    const region = getOrCreateRegion(x, y);
    if (!region) return null;

    const { cx, cy } = worldToChunkCoords(x, y);
    const chunkKey = getChunkKey(cx, cy);

    return region.chunks.get(chunkKey);
}

function getOrCreateChunk(region, cx, cy) {
    const chunkKey = getChunkKey(cx, cy);
    if (!region.chunks.has(chunkKey)) {
        const chunk = {
            key: chunkKey,
            cx, cy,
            rx: region.rx, ry: region.ry,
            // Entities that are static and will be pre-rendered
            staticEntities: [],
            // Entities that are dynamic and updated every frame
            dynamicEntities: [],
            staticCache: null,
            // Position of the top-left corner of the chunk in world coordinates
            x: region.rx * REGION_SIZE + cx * CHUNK_SIZE * TILE_SIZE,
            y: region.ry * REGION_SIZE + cy * CHUNK_SIZE * TILE_SIZE,
        };
        region.chunks.set(chunkKey, chunk);
    }
    return region.chunks.get(chunkKey);
}
// --- End Chunk Helper Functions ---


function getRegionKey(x, y) { 
  return `${Math.floor(x / REGION_SIZE)}_${Math.floor(y / REGION_SIZE)}`; 
}

function getRegionCoords(key) { 
  const parts = key.split('_'); 
  return {rx: parseInt(parts[0]), ry: parseInt(parts[1])}; 
}

function getOrCreateRegion(x, y, seed) {
  const key = getRegionKey(x, y);
  if (!worldData.has(key)) {
    generateRegion(key, seed);
  }
  return worldData.get(key);
}

function getExistingRegionsInProximity(x, y, radius = 1) {
  const regions = new Set();
  const currentRx = Math.floor(x / REGION_SIZE);
  const currentRy = Math.floor(y / REGION_SIZE);
  for (let rx = currentRx - radius; rx <= currentRx + radius; rx++) {
    for (let ry = currentRy - radius; ry <= currentRy + radius; ry++) {
      const key = `${rx}_${ry}`;
      if (worldData.has(key)) {
        regions.add(worldData.get(key));
      }
    }
  }
  return Array.from(regions);
}

// New function to get or create regions in proximity (for dynamic loading)
function getOrCreateRegionsInProximity(x, y, seed, radius = 1) {
  const regions = new Set();
  const currentRx = Math.floor(x / REGION_SIZE);
  const currentRy = Math.floor(y / REGION_SIZE);
  for (let rx = currentRx - radius; rx <= currentRx + radius; rx++) {
    for (let ry = currentRy - radius; ry <= currentRy + radius; ry++) {
      const key = `${rx}_${ry}`;
      // This will generate region if it doesn't exist
      regions.add(getOrCreateRegion(rx * REGION_SIZE, ry * REGION_SIZE, seed));
    }
  }
  return Array.from(regions);
}

function getChunksInProximity(x, y, radius = 4) {
    const { rx: centerRx, ry: centerRy, cx: centerCx, cy: centerCy } = worldToChunkCoords(x, y);

    const chunks = [];
    
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            let currentCx = centerCx + dx;
            let currentCy = centerCy + dy;
            let currentRx = centerRx;
            let currentRy = centerRy;

            // Handle wrapping across region boundaries
            if (currentCx < 0) {
                currentRx--;
                currentCx += CHUNKS_IN_REGION_SIDE;
            } else if (currentCx >= CHUNKS_IN_REGION_SIDE) {
                currentRx++;
                currentCx -= CHUNKS_IN_REGION_SIDE;
            }

            if (currentCy < 0) {
                currentRy--;
                currentCy += CHUNKS_IN_REGION_SIDE;
            } else if (currentCy >= CHUNKS_IN_REGION_SIDE) {
                currentRy++;
                currentCy -= CHUNKS_IN_REGION_SIDE;
            }
            
            const region = getOrCreateRegion(currentRx * REGION_SIZE, currentRy * REGION_SIZE);
            if (region) {
                const chunk = getOrCreateChunk(region, currentCx, currentCy);
                chunks.push(chunk);
            }
        }
    }
    return chunks;
}

function getRegionStaticEntities(region, typeFilter = null) {
    const entities = [];
    if (!region || !region.chunks) return entities;
    
    for (const chunk of region.chunks.values()) {
        for (const entity of chunk.staticEntities) {
            if (typeFilter) {
                if (Array.isArray(typeFilter) && typeFilter.includes(entity.type)) {
                    entities.push(entity);
                } else if (typeof typeFilter === 'string' && entity.type === typeFilter) {
                    entities.push(entity);
                }
            } else {
                entities.push(entity);
            }
        }
    }
    return entities;
}

function getRegionDynamicEntities(region, typeFilter = null) {
    const entities = [];
    if (!region || !region.chunks) return entities;
    
    for (const chunk of region.chunks.values()) {
        for (const entity of chunk.dynamicEntities) {
            if (typeFilter) {
                if (entity.type === typeFilter) {
                    entities.push(entity);
                }
            } else {
                entities.push(entity);
            }
        }
    }
    return entities;
}

function getNeighboringChunks(chunk) {
    const neighbors = [];
    if (!chunk) return neighbors;

    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;

            let cx = chunk.cx + dx;
            let cy = chunk.cy + dy;
            let rx = chunk.rx;
            let ry = chunk.ry;

            // Handle wrapping across region boundaries
            if (cx < 0) {
                rx--;
                cx += CHUNKS_IN_REGION_SIDE;
            } else if (cx >= CHUNKS_IN_REGION_SIDE) {
                rx++;
                cx -= CHUNKS_IN_REGION_SIDE;
            }
            if (cy < 0) {
                ry--;
                cy += CHUNKS_IN_REGION_SIDE;
            } else if (cy >= CHUNKS_IN_REGION_SIDE) {
                ry++;
                cy -= CHUNKS_IN_REGION_SIDE;
            }
            
            // Use getOrCreateRegion to ensure the region is loaded/generated
            const region = getOrCreateRegion(rx * REGION_SIZE, ry * REGION_SIZE);
            if (region) {
                // Then get the specific chunk, which will also be created if it doesn't exist
                const neighborChunk = getOrCreateChunk(region, cx, cy);
                neighbors.push(neighborChunk);
            }
        }
    }
    return neighbors;
}

// ===== Базы =====
function getBaseHouseForId(id){ 
    for (const region of worldData.values()) {
        for (const chunk of region.chunks.values()) {
            for (const entity of chunk.staticEntities) {
                if (entity.type === 'house' && entity.owner === id) {
                    return entity;
                }
            }
        }
    }
    return null; 
}

function setBaseFor(group, house){
  if(!group||!house) return; 
  const prev=getBaseHouseForId(group.id);
  if(prev && prev!==house){
    if(!mech.leaveOnBaseChange){ 
      while(prev.garrison.length && house.garrison.length<HOUSE_GARRISON_CAP){ 
        house.garrison.push(prev.garrison.pop()); 
      } 
    }
    prev.owner=null; 
    prev.ownerColor='#777'; 
    prev.roof=1;
  }
  house.owner=group.id; 
  house.ownerColor=group.color; 
  house.roof=0.4;
  updateGarrisonInventoryCounter();
}

// ===== Генерация мира =====
function generateRegion(key, seed) {
  console.trace(`generateRegion: ${key}`);
  console.time(`generateRegion: ${key}`);
  const prng = createPrng(seed + key);
  const rand = (min, max) => prng() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));

  const {rx, ry} = getRegionCoords(key);
  const region = { 
    key, rx, ry, 
    villages: [],
    chunks: new Map()
  };
  worldData.set(key, region);

  // Initialize all chunks for this region
  for (let cy = 0; cy < CHUNKS_IN_REGION_SIDE; cy++) {
      for (let cx = 0; cx < CHUNKS_IN_REGION_SIDE; cx++) {
          getOrCreateChunk(region, cx, cy);
      }
  }

  const regionStartX = rx * REGION_SIZE;
  const regionStartY = ry * REGION_SIZE;
  
  const VOWELS = "аеиоу"; 
  const CONSONANTS = "бвгджзклмнпрстфхцчшщ";
  const ENDINGS = ["ово", "ево", "ино", "овка", "евка", "инька"];
  const generateVillageName = () => {
    return CONSONANTS[randInt(0, CONSONANTS.length - 1)].toUpperCase() +
           VOWELS[randInt(0, VOWELS.length - 1)] +
           CONSONANTS[randInt(0, CONSONANTS.length - 1)] +
           VOWELS[randInt(0, VOWELS.length - 1)] +
           ENDINGS[randInt(0, ENDINGS.length - 1)];
  }

  const numVillages = randInt(2, 3);
  for (let i = 0; i < numVillages; i++) {
    const village = {
      name: generateVillageName(),
      x: snapToMainGrid(regionStartX + rand(2000, REGION_SIZE - 2000)),
      y: snapToMainGrid(regionStartY + rand(2000, REGION_SIZE - 2000)),
      buildings: [], // Temp storage for path generation
      paths: [], // Temp storage
    };
    
    const numHouses = randInt(5, 10);
    const numShops = randInt(1, 3);
    const numKabaks = randInt(0, 1);

    for(let j = 0; j < numHouses + numShops + numKabaks; j++) {
      for(let k=0; k<50; k++) {
        const angle = rand(0, Math.PI * 2);
        const dist = rand(250, 1200);
        
        let buildingWidth, buildingHeight;
        if (j < numHouses) {
            buildingWidth = HOUSE_SIZE; buildingHeight = HOUSE_SIZE;
        } else if (j < numHouses + numShops) {
            buildingWidth = SHOP_SIZE; buildingHeight = SHOP_SIZE;
        } else {
            buildingWidth = KABAK_SIZE; buildingHeight = KABAK_SIZE;
        }

        const desiredCenterX = village.x + Math.cos(angle) * dist;
        const desiredCenterY = village.y + Math.sin(angle) * dist;

        const topLeftX = snapToMainGrid(desiredCenterX - buildingWidth / 2);
        const topLeftY = snapToMainGrid(desiredCenterY - buildingHeight / 2);

        const bx = topLeftX + buildingWidth / 2;
        const by = topLeftY + buildingHeight / 2;

        const widthInTiles = buildingWidth / GRID_SIZE;
        const heightInTiles = buildingHeight / GRID_SIZE;

        // Boundary Check: Ensure the building is fully within the current region
        const regionStartX = rx * REGION_SIZE;
        const regionStartY = ry * REGION_SIZE;
        const fullyInBounds = topLeftX >= regionStartX && 
                              (topLeftX + buildingWidth) <= (regionStartX + REGION_SIZE) &&
                              topLeftY >= regionStartY &&
                              (topLeftY + buildingHeight) <= (regionStartY + REGION_SIZE);

        if (fullyInBounds && isAreaFree(bx, by, widthInTiles, heightInTiles, BUILDING_BARRIER_TILES)) {
            let newB;
            if (j < numHouses) {
                newB = newHouse(bx, by, village);
            } else if (j < numHouses + numShops) {
                newB = newShop(bx, by, village);
            } else {
                newB = newKabak(bx, by, village);
            }
            
            occupyArea(bx, by, widthInTiles, heightInTiles, BUILDING_BARRIER_TILES, 'building');
            
            const { cx, cy } = worldToChunkCoords(bx, by);
            const chunk = getOrCreateChunk(region, cx, cy);
            chunk.staticEntities.push(newB);
            
            village.buildings.push(newB);
            break;
        }
      }
    }
    
    for(let j = 0; j < village.buildings.length - 1; j++) {
      const b1 = village.buildings[j];
      const b2 = village.buildings[j+1];
      const door1 = houseDoorRect(b1);
      const door2 = houseDoorRect(b2);
      
      const roadWidth = ROAD_SIZE_TILES * GRID_SIZE;
      const p1 = {x: snapToMainGrid(door1.x), y: snapToMainGrid(door1.y)};
      const p2 = {x: snapToMainGrid(door2.x), y: snapToMainGrid(door2.y)};
      
      const pathV = { type: 'path', x: p1.x, y: Math.min(p1.y, p2.y), w: roadWidth, h: Math.abs(p1.y - p2.y) };
      const pathH = { type: 'path', x: Math.min(p1.x, p2.x), y: p2.y, w: Math.abs(p1.x - p2.x) + roadWidth, h: roadWidth };
      
      village.paths.push(pathV, pathH);
    }
    
    // Add path entities to all chunks they span
    for (const path of village.paths) {
        const startX = path.x;
        const startY = path.y;
        const endX = path.x + path.w;
        const endY = path.y + path.h;

        const startCoords = worldToChunkCoords(startX, startY);
        const endCoords = worldToChunkCoords(endX - 1, endY - 1);

        for (let cy = startCoords.cy; cy <= endCoords.cy; cy++) {
            for (let cx = startCoords.cx; cx <= endCoords.cx; cx++) {
                // We are assuming paths don't cross region boundaries for simplicity
                const chunk = getOrCreateChunk(region, cx, cy);
                if (chunk) {
                    // Avoid adding duplicates if logic is ever re-run
                    if (!chunk.staticEntities.some(e => e === path)) {
                        chunk.staticEntities.push(path);
                    }
                }
            }
        }
    }
    
    const bounds = village.buildings.reduce((acc, b) => ({
      minX: Math.min(acc.minX, b.x - b.w/2), maxX: Math.max(acc.maxX, b.x + b.w/2),
      minY: Math.min(acc.minY, b.y - b.h/2), maxY: Math.max(acc.maxY, b.y + b.h/2)
    }), {minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity});

    const padding = 400;
    village.w = (snapToMainGrid(bounds.maxX + padding)) - (snapToMainGrid(bounds.minX - padding));
    village.h = (snapToMainGrid(bounds.maxY + padding)) - (snapToMainGrid(bounds.minY - padding));
    village.x = snapToMainGrid(bounds.minX - padding) + village.w / 2;
    village.y = snapToMainGrid(bounds.minY - padding) + village.h / 2;

    region.villages.push(village);
  }

  const numFarmers = randInt(10, 20);
  for(let i=0; i<numFarmers; i++) {
      spawnFarmer(regionStartX + rand(200, REGION_SIZE-200), regionStartY + rand(200, REGION_SIZE-200));
  }
  
  for(let i=0; i<4; i++) {
      spawnEnemy(regionStartX + rand(200, REGION_SIZE-200), regionStartY + rand(200, REGION_SIZE-200));
  }

  // The pre-rendering will now happen on a per-chunk basis,
  // likely triggered by the game loop as chunks come into view.
  // We will remove the all-at-once pre-rendering step.
  // console.time(`preRenderStaticLayers for region ${key}`);
  // preRenderStaticLayers(region); // This function will be replaced.
  // console.timeEnd(`preRenderStaticLayers for region ${key}`);

  console.timeEnd(`generateRegion: ${key}`);
}