// config.js — every tunable number for Porto Verde in one place.
// The city is a 6x6 grid of blocks (seed 7) ringed by roads.

export const CONFIG = {
  // City
  CITY_SEED: 7,
  BLOCKS: 6, // blocks per side
  BLOCK_PX: 260, // block edge in world px
  ROAD_PX: 72, // road width in world px
  // Derived: PITCH = BLOCK_PX + ROAD_PX; SIZE = BLOCKS*BLOCK_PX + (BLOCKS+1)*ROAD_PX

  // Player on foot
  WALK_SPEED: 170,
  RUN_SPEED: 300,
  JUMP_TIME: 0.45,
  PLAYER_RADIUS: 14,
  PLAYER_HP: 100,

  // Driving
  CAR_ACCEL: 420,
  CAR_TOP_SPEED: 460,
  CAR_REVERSE_SPEED: 160,
  CAR_TURN: 2.6,
  CAR_RADIUS: 20,

  // Combat
  MAG_SIZE: 12,
  RELOAD_TIME: 1.1,
  BULLET_SPEED: 720,
  BULLET_DAMAGE: 34,
  PUNCH_DAMAGE: 20,
  PUNCH_RANGE: 34,
  PUNCH_COOLDOWN: 0.35,

  // Wanted / Verde PD
  MAX_WANTED: 5,
  HEAT_PER_SHOT: 6,
  HEAT_PER_PED_HIT: 25,
  HEAT_PER_CARJACK: 30,
  HEAT_DECAY_PER_SEC: 1.6,
  COP_SPEED: 235,
  COP_SPAWN_INTERVAL: 6,

  // Economy
  BUSTED_CASH_LOSS: 0.1, // lose 10% of cash when busted
  START_CASH: 250,

  // Traffic & pedestrians
  TRAFFIC_CARS: 14,
  PEDS: 26,
  PED_SPEED: 55,

  // Missions
  PACKAGE_TIME_LIMIT: 90,

  // Save
  SAVE_KEY: 'porto-verde-save-v1',

  // Viewport the game is drawn at (canvas backing size).
  VIEW_W: 1280,
  VIEW_H: 720,
};

export const MISSIONS = [
  {
    id: 'wheels-up',
    name: 'Wheels Up',
    brief: 'Jack a car (E) and drive it to the yellow marker.',
    reward: 400,
  },
  {
    id: 'the-package',
    name: 'The Package',
    brief: 'Pick up the package, then deliver it in 90 seconds.',
    reward: 700,
  },
  {
    id: 'heat-check',
    name: 'Heat Check',
    brief: 'Verde PD is watching. Reach 3 stars, then shake them off to 0.',
    reward: 900,
  },
  {
    id: 'rooftop-rumble',
    name: 'Rooftop Rumble',
    brief: 'Get to the rooftop and take down all 4 of Marlin’s crew.',
    reward: 1200,
  },
  {
    id: 'marlins-due',
    name: "The Marlin's Due",
    brief: 'Drive the money to the marina. No cops on your tail.',
    reward: 2000,
  },
];

export const PALETTE = {
  asphalt: '#2b2f36',
  asphaltLine: '#e8c33a',
  sidewalk: '#3a3f47',
  grass: '#2e5d33',
  water: '#1d4e6b',
  building: '#565d68',
  buildingRoof: '#6b7280',
  player: '#f2b705',
  cop: '#2f6df6',
  ped: '#d8d8d8',
  hud: '#ffffff',
};

export const SAVE_VERSION = 1;
