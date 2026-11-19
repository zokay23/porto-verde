// Porto Verde — configuration, story and mission data.
// Everything here is original fiction: a made-up city, made-up people, made-up places.

export const GAME_TITLE = 'PORTO VERDE';
export const GAME_SUBTITLE = 'An open-world crime story — an original game, not affiliated with Rockstar Games';
export const SAVE_KEY = 'portoverde.save.v1';
export const BEST_KEY = 'portoverde.best.v1';

// --- city layout -------------------------------------------------------------
export const BLOCK = 60;          // building block size (metres)
export const STREET = 14;         // street width
export const GRID = 6;            // blocks per side
export const PITCH = BLOCK + STREET;
export const CITY_HALF = (GRID * PITCH + STREET) / 2; // ~229
export const ROAD_Y = 0.02;

// Seeded city: the same seed always builds the same Porto Verde.
export const CITY_SEED = 20261119;

// --- player ------------------------------------------------------------------
export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  accel: 40,
  jumpSpeed: 8,
  gravity: 22,
  radius: 0.55,
  height: 1.8,
  health: 100,
  punchDamage: 25,
  punchRange: 2.2,
  punchCooldown: 0.45,
  pistolDamage: 34,
  pistolRange: 60,
  pistolCooldown: 0.28,
  magSize: 12,
  reloadTime: 1.1,
};

// --- cars --------------------------------------------------------------------
export const CAR = {
  maxSpeed: 42,          // m/s (~150 km/h)
  accel: 16,
  brake: 30,
  reverseMax: 10,
  steer: 0.55,           // max steer angle at low speed
  grip: 8,
  trafficSpeed: 9,
};

// --- police / wanted -----------------------------------------------------------
export const WANTED = {
  max: 5,
  decaySeconds: 28,      // one star fades after this long with no crime and no cop nearby
  bustHoldSeconds: 1.6,  // a cop must stay this close this long to bust you on foot
  bustCarHoldSeconds: 2.2,
};

// --- story --------------------------------------------------------------------
export const STORY = [
  'Porto Verde, 2026. Dante "D" Marlow comes home to find his brother\'s garage torched',
  'and a debt owed to the Marlin Club. One week. Five jobs. No backup. The city is yours',
  'to take — on foot or behind the wheel — if the Verde PD doesn\'t take you first.',
];

// Missions run in order. Each has a kind, a target, a reward and the line the game shows.
export const MISSIONS = [
  {
    id: 'wheels-up',
    name: '1 — Wheels Up',
    kind: 'steal-deliver',
    text: 'Steal any car and bring it to the garage',
    detail: 'Press E near a parked car. The garage is marked on your map.',
    reward: 300,
  },
  {
    id: 'the-package',
    name: '2 — The Package',
    kind: 'timed-deliver',
    text: 'Drive the package to the Marlin Club — 90 seconds',
    detail: 'Fast and clean. The cops are watching this route.',
    reward: 500,
    timeLimit: 90,
  },
  {
    id: 'heat-check',
    name: '3 — Heat Check',
    kind: 'lose-wanted',
    text: 'Lose the 2-star wanted level',
    detail: 'Break line of sight. Lay low until the heat fades.',
    reward: 400,
  },
  {
    id: 'rooftop-rumble',
    name: '4 — Rooftop Rumble',
    kind: 'defeat',
    text: 'Reach the plaza and defeat the 3 rivals',
    detail: 'On foot. F to punch, click to shoot. Watch your health.',
    reward: 700,
    enemies: 3,
  },
  {
    id: 'marlins-due',
    name: '5 — The Marlin\'s Due',
    kind: 'ram-target',
    text: 'Ram the rival\'s car until it stops, then return to the garage',
    detail: 'The green coupe is running for the bridge. Cut it off.',
    reward: 1000,
  },
];

// --- places -------------------------------------------------------------------
export const PLACES = {
  garage: { x: -PITCH * 2 - STREET / 2, z: PITCH * 2 + STREET / 2, label: 'Marlow Garage' },
  marlinClub: { x: PITCH * 2 + STREET / 2, z: -PITCH * 2 - STREET / 2, label: 'Marlin Club' },
  plaza: { x: PITCH / 2, z: PITCH / 2, label: 'Plaza Verde' },
  policeStation: { x: -PITCH * 2 - STREET / 2, z: -PITCH * 2 - STREET / 2, label: 'Verde PD HQ' },
  hospital: { x: PITCH * 2 + STREET / 2, z: PITCH * 2 + STREET / 2, label: 'St. Verde Hospital' },
};

// --- colours ------------------------------------------------------------------
export const COLORS = {
  sky: 0x87b5d6,
  fog: 0x9db8c8,
  sun: 0xfff2d0,
  road: 0x383c44,
  roadLine: 0xd8d3a0,
  sidewalk: 0x8f8a80,
  sand: 0xd9c28a,
  sea: 0x2e6f8e,
  grass: 0x5d8a4a,
  building: [0xb8a88f, 0x9aa3ad, 0xc2b49a, 0x8d99a8, 0xa89a86, 0x7e8b99],
  police: 0x1c2f57,
  taxi: 0xe8b400,
};

// Car paint jobs the city spawns with (name shown when you steal one).
export const CAR_NAMES = [
  ['Vento S', 0x8a1f1f], ['Cometa GT', 0x1f4d8a], ['Lobo Pickup', 0x3a3f45],
  ['Brisa', 0x7a8a99], ['Tornado', 0xd8a020], ['Falcão', 0x2f6b3a],
  ['Maré', 0x5a2f7a], ['Solano', 0xc8c8c8], ['Puma X', 0x111111],
];
