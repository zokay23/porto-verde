// Porto Verde tuning: every number the city, the driving and the missions
// share lives here, so a balance change is one edit, not a hunt.
// Round 2: added saveIntervalSeconds and ramCooldownSeconds (used by
// main.js / sim.js). All round-1 values below are unchanged.
export const CONFIG = {
  seed: 7,
  // City grid: 6 x 6 blocks, roads on a regular lattice.
  block: 44,
  road: 14,
  blocks: 6,
  worldHalf: 168,
  // Player on foot.
  walkSpeed: 7,
  runSpeed: 11.5,
  jumpSpeed: 8.5,
  gravity: 22,
  playerHealth: 100,
  // Arcade driving.
  carAccel: 26,
  carBrake: 42,
  carMaxSpeed: 34,
  carMaxReverse: 12,
  carTurn: 1.9,
  carDrag: 0.6,
  trafficSpeed: 11,
  // Wanted / police.
  maxWanted: 5,
  bustedCashLoss: 0.10,
  policeCarSpeed: 30,
  policeFootSpeed: 8.2,
  // Combat.
  magSize: 12,
  shootRange: 34,
  shootDamage: 34,
  punchDamage: 25,
  punchRange: 2.6,
  rivalHealth: 100,
  // Missions pay out in cash; mission 2 is timed.
  mission2Seconds: 90,
  saveKey: 'porto-verde-save-v1',
  // How often (seconds of game time) the autosave runs, and the minimum
  // gap between two counted rams on the rival coupe in mission 5.
  saveIntervalSeconds: 0.5,
  ramCooldownSeconds: 1.0,
};

export const PALETTE = {
  sky: 0xffb36b,
  sun: 0xffd9a0,
  sea: 0x1e6f8e,
  sand: 0xe8cf9a,
  grass: 0x5da24a,
  road: 0x33363d,
  roadLine: 0xf5d76e,
  sidewalk: 0x9a938a,
  plaza: 0xb8a888,
  building: [0xd8a06a, 0xc98a7a, 0x8aa8c8, 0xd8c48a, 0xa88ab8, 0x7ab8a0],
  windowLit: 0xffe9a8,
  windowDark: 0x2a3442,
  garage: 0xe86a3a,
  marlin: 0x2ec8c8,
  tower: 0x6a8ac8,
};

export const CAR_DEFS = [
  { name: 'Verde Sedan', color: 0xc23a2e, speed: 1.0 },
  { name: 'Marlin Coupe', color: 0x2a6ac8, speed: 1.15 },
  { name: 'Porto Taxi', color: 0xf2c230, speed: 0.95 },
  { name: 'Beach Buggy', color: 0x3aa86a, speed: 0.9 },
  { name: 'Night Van', color: 0x5a4a8a, speed: 0.85 },
  { name: 'Verde PD Interceptor', color: 0x1a2a4a, speed: 1.2, police: true },
];

export const MISSIONS = [
  {
    id: 'wheels-up', title: '1 — Wheels Up',
    brief: 'Steal a car and bring it to the garage.',
    objective: 'Steal a car, then drive to the garage beacon',
    reward: 150,
  },
  {
    id: 'the-package', title: '2 — The Package',
    brief: 'A sealed package for the Marlin Club. 90 seconds. No excuses.',
    objective: 'Deliver the package to the Marlin Club before the timer ends',
    reward: 300,
  },
  {
    id: 'heat-check', title: '3 — Heat Check',
    brief: 'Verde PD is watching. Lose the heat, then lay low.',
    objective: 'Lose your 2-star wanted level',
    reward: 250,
  },
  {
    id: 'rooftop-rumble', title: '4 — Rooftop Rumble',
    brief: 'Three Marlin rivals are waiting at the plaza. Settle it.',
    objective: 'Defeat all 3 rivals at the plaza',
    reward: 450,
  },
  {
    id: 'marlins-due', title: '5 — The Marlin\'s Due',
    brief: 'Ram the rival coupe three times, then bring the car home.',
    objective: 'Ram the rival coupe 3 times, then return to the garage',
    reward: 800,
  },
];

export const STORY = {
  hero: 'Dante "D" Marlow',
  city: 'Porto Verde',
  intro: 'Dante comes home to find his brother\'s garage torched and a debt owed to the Marlin Club. One week. Five jobs. No backup.',
  outro: 'Debt paid. The garage is yours again — and Porto Verde is open.',
};
