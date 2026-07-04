// ===== Константы/утилы =====
const TILE_SIZE = 16;
const GRID_SIZE = TILE_SIZE;
const REGION_SIZE = 16384; // 1024 tiles
const REGION_SIZE_IN_TILES = REGION_SIZE / TILE_SIZE; // 1024
const CHUNK_SIZE = 16; // in tiles
const CHUNKS_IN_REGION_SIDE = REGION_SIZE_IN_TILES / CHUNK_SIZE; // 64
const VIEW_W=1280, VIEW_H=720;
const PLAYER_SPEED=180, TURN_SPEED=Math.PI*2, ROW_SPACING=78, COL_SPACING=66;
const FOLLOW_SPRING=30, FOLLOW_DAMPING=0.85, SEPARATION_FORCE=120, TARGET_DISTANCE=14;
const BULLET_SPEED=950;
let BULLET_LIFE=1.8, BULLET_SPREAD=0.02; let FIRE_GCD=0.08;
const MELEE_RANGE=26, SHOOT_RANGE=1050, GATHER_RADIUS=40;
const HOUSE_WALL=TILE_SIZE, HOUSE_GARRISON_CAP=20;

// Размеры зданий в тайлах
const HOUSE_SIZE_TILES = 6;
const SHOP_SIZE_TILES = 10;
const KABAK_SIZE_TILES = 14;
const ROAD_SIZE_TILES = 1;
const BUILDING_BARRIER_TILES = 1;

// Размеры зданий в пикселях, кратные сетке
const HOUSE_SIZE = HOUSE_SIZE_TILES * GRID_SIZE;
const SHOP_SIZE = SHOP_SIZE_TILES * GRID_SIZE;
const KABAK_SIZE = KABAK_SIZE_TILES * GRID_SIZE;
const ALLY_LEASH_RADIUS = 350;

var DEFAULT_CMD_HP = 16;
var DEFAULT_UNIT_HP = 4;

const FIRE_MODE_SYNC = 0;
const FIRE_MODE_AT_WILL = 1;
const FIRE_MODE_HOLD = 2;

const FIRE_MODES = [
    { id: FIRE_MODE_SYNC, name: 'Синхронно' },
    { id: FIRE_MODE_AT_WILL, name: 'Огонь по готовности' },
    { id: FIRE_MODE_HOLD, name: 'Не стрелять' },
];

const FACTIONS = {
    PLAYER: 'player',
    ALLY: 'ally',
    NEUTRAL: 'neutral',
    ENEMY_1: 'enemy_1', // e.g. Red
    ENEMY_2: 'enemy_2', // e.g. Blue
};

const DEFAULT_FACTIONS = [
    {
        id: 'red',
        name: 'Красные',
        icon: '🚩',
        color: '#ff6363',
        description: 'Красные - борцы за мировую революцию и диктатуру пролетариата.'
    },
    {
        id: 'white',
        name: 'Белые',
        icon: '🗡',
        color: '#ffffff',
        description: 'Белые - сторонники старого порядка и единой, неделимой России.'
    },
    {
        id: 'anarchist',
        name: 'Анархисты',
        icon: '☠',
        color: '#222222',
        description: 'Анархисты - вольные бойцы за безвластие и свободу личности.'
    }
];

const FACTION_INFO = {
    custom: 'Создайте свою уникальную фракцию со своими идеалами.'
};

const CUSTOM_FACTION_ICONS = ['⚔️','🛡️','🪖','🏹','🪓','📯','🏴', '✝️','☦️','✡️','☪️','🕉️','☸️','⚛️','🐻','🦅','🐺','🐴','🐉','🌲'];