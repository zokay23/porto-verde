// city.js — procedural Porto Verde: a 6x6 block grid (seed 7) with roads,
// buildings, a park, the marina, the hospital and the Verde PD precinct.
// Pure data: no DOM, no canvas, so the playtest can build it in Node.

import { RNG, clamp } from './random.js';
import { CONFIG } from './config.js';

export const PITCH = CONFIG.BLOCK_PX + CONFIG.ROAD_PX;
export const CITY_SIZE =
  CONFIG.BLOCKS * CONFIG.BLOCK_PX + (CONFIG.BLOCKS + 1) * CONFIG.ROAD_PX;

export function roadCenter(i) {
  // Centre line of road index i (0..BLOCKS).
  return i * PITCH + CONFIG.ROAD_PX / 2;
}

export function blockOrigin(bx, by) {
  return {
    x: (bx + 1) * CONFIG.ROAD_PX + bx * CONFIG.BLOCK_PX,
    y: (by + 1) * CONFIG.ROAD_PX + by * CONFIG.BLOCK_PX,
  };
}

export function isOnRoad(x, y) {
  if (x < 0 || y < 0 || x >= CITY_SIZE || y >= CITY_SIZE) return false;
  // Roads sit at the start of every pitch: [i*PITCH, i*PITCH + ROAD_PX).
  const inRoadBand = (v) => (v % PITCH) < CONFIG.ROAD_PX;
  return inRoadBand(x) || inRoadBand(y);
}

export function buildCity(seed = CONFIG.CITY_SEED) {
  const rng = new RNG(seed);
  const blocks = [];
  const buildings = [];
  const parks = [];
  const props = [];

  const carPalette = [
    '#c0392b', '#2980b9', '#27ae60', '#8e44ad',
    '#f39c12', '#16a085', '#e67e22', '#ecf0f1',
  ];

  for (let by = 0; by < CONFIG.BLOCKS; by++) {
    for (let bx = 0; bx < CONFIG.BLOCKS; bx++) {
      const o = blockOrigin(bx, by);
      const kind = rng.pick(['buildings', 'buildings', 'buildings', 'park', 'plaza']);
      const block = { bx, by, x: o.x, y: o.y, w: CONFIG.BLOCK_PX, h: CONFIG.BLOCK_PX, kind };
      blocks.push(block);

      if (kind === 'park') {
        parks.push({ ...block });
        for (let i = 0; i < 6; i++) {
          props.push({
            type: 'tree',
            x: o.x + rng.range(24, CONFIG.BLOCK_PX - 24),
            y: o.y + rng.range(24, CONFIG.BLOCK_PX - 24),
            r: rng.range(7, 12),
          });
        }
        continue;
      }

      // 2x2 or 1x2 buildings per block, with a seeded gap between them.
      const cols = rng.chance(0.5) ? 2 : 1;
      const rows = rng.chance(0.5) ? 2 : 1;
      const bw = (CONFIG.BLOCK_PX - 24 * (cols + 1)) / cols;
      const bh = (CONFIG.BLOCK_PX - 24 * (rows + 1)) / rows;
      for (let ry = 0; ry < rows; ry++) {
        for (let cx = 0; cx < cols; cx++) {
          const b = {
            x: o.x + 24 + cx * (bw + 24),
            y: o.y + 24 + ry * (bh + 24),
            w: bw,
            h: bh,
            height: rng.int(1, 5),
            color: rng.pick(['#565d68', '#6b5d4f', '#4f5d6b', '#5d565d', '#6b7280']),
            roof: rng.chance(0.3),
          };
          buildings.push(b);
          block.buildings = block.buildings || [];
          block.buildings.push(b);
        }
      }
      // A couple of street props per block corner.
      for (let i = 0; i < 2; i++) {
        props.push({
          type: 'lamp',
          x: o.x + rng.pick([6, CONFIG.BLOCK_PX - 6]),
          y: o.y + rng.range(10, CONFIG.BLOCK_PX - 10),
          r: 3,
        });
      }
    }
  }

  // Landmarks on fixed blocks so missions always know where to point.
  const hospital = { ...blockOrigin(0, 0), w: CONFIG.BLOCK_PX, h: CONFIG.BLOCK_PX, name: 'Verde General' };
  const precinct = { ...blockOrigin(5, 0), w: CONFIG.BLOCK_PX, h: CONFIG.BLOCK_PX, name: 'Verde PD' };
  const marina = { x: 0, y: CITY_SIZE - CONFIG.ROAD_PX - 120, w: 420, h: 120, name: 'The Marina' };
  const rooftop = { ...blockOrigin(2, 2), w: CONFIG.BLOCK_PX, h: CONFIG.BLOCK_PX, name: 'Rooftop' };

  const spawn = { x: roadCenter(3), y: roadCenter(3) };
  const packageSpot = { x: roadCenter(1), y: roadCenter(4) };
  const deliverySpot = { x: roadCenter(5), y: roadCenter(2) };

  return {
    seed,
    size: CITY_SIZE,
    blocks,
    buildings,
    parks,
    props,
    carPalette,
    hospital,
    precinct,
    marina,
    rooftop,
    spawn,
    packageSpot,
    deliverySpot,
    // A building counts as an obstacle for movement and bullets.
    pointInBuilding(x, y) {
      for (const b of buildings) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
      }
      return null;
    },
    randomRoadPoint(r) {
      // A random point on a road: pick a road band, then a position along it.
      const vertical = r.chance(0.5);
      const band = r.int(0, CONFIG.BLOCKS);
      const along = r.range(0, CITY_SIZE);
      if (vertical) return { x: roadCenter(band), y: along };
      return { x: along, y: roadCenter(band) };
    },
    clampToCity(x, y, margin = 20) {
      return {
        x: clamp(x, margin, CITY_SIZE - margin),
        y: clamp(y, margin, CITY_SIZE - margin),
      };
    },
  };
}
