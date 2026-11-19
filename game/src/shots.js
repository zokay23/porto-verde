// Deterministic screenshot scenes: ?shot=<name>&seed=<n> stages a fixed moment
// (same seed → same frame), then sets window.__shotReady when the frame is stable.
// The camera yaw always sits behind the player/car, so the action faces the lens.
import { PLACES } from './config.js';

export function stageShot(game, renderer, name, seed) {
  const { player, state } = game;
  game.reset(seed || 7);
  state.mode = 'play';
  player.x = PLACES.garage.x - 4;
  player.z = PLACES.garage.z + 6;
  player.angle = Math.PI;
  renderer.camState.yaw = 0; // behind the player, who faces -z (north, into the city)
  renderer.camState.pitch = 0.22;
  state.cash = 2450;
  state.wanted = 0;
  player.health = 94;

  // A car that must keep its staged speed while the frame settles.
  let holdCar = null;
  let holdSpeed = 0;
  // Police cars that must hold a formation ahead of the player (chase shot).
  let holdFormation = null;

  if (name === 'action') {
    game.startMission(0);
    state.wanted = 3;
    // Close enough to be dramatic, far enough that the 1.6s bust hold cannot
    // complete during the ~2s settle (cop runs 6.5 m/s, needs ~1.5s to arrive).
    const cop = game.spawnPolicePed();
    cop.x = player.x + 7;
    cop.z = player.z + 7;
    cop.state = 'chase';
  } else if (name === 'drive') {
    game.startMission(0);
    const car = game.nearestParkedCar(40) || game.cars[0];
    game.enterCar(car);
    // East along the road one block north of the garage: the beacon stays
    // ~14m off the path at closest approach, so mission 1 stays active.
    car.x = PLACES.garage.x - 40;
    car.z = 141;
    car.angle = Math.PI / 2; // facing +x, toward the garage beacon
    car.speed = 35;
    holdCar = car;
    holdSpeed = 35;
    renderer.camState.yaw = -Math.PI / 2; // behind the car
  } else if (name === 'mission') {
    game.startMission(1);
    state.missionTimer = 84;
    state.missionPhase = 'deliver';
    game.setBeacon(PLACES.marlinClub.x, PLACES.marlinClub.z, true);
    const car = game.nearestParkedCar(40) || game.cars[0];
    game.enterCar(car);
    car.x = 0;
    car.z = 0;
    car.angle = Math.PI / 2;
    car.speed = 30;
    holdCar = car;
    holdSpeed = 30;
    renderer.camState.yaw = -Math.PI / 2; // behind the car
  } else if (name === 'chase') {
    game.startMission(2);
    // 4 stars for the shot (the carjack finds no cop in range at this point,
    // so no +1 is added here).
    state.wanted = 4;
    game.spawnPoliceCar();
    game.spawnPoliceCar();
    game.spawnPoliceCar();
    const car = game.nearestParkedCar(40) || game.cars[0];
    game.enterCar(car);
    // South down the road at x=-7; the interceptors hold a flanking formation
    // ahead of the player (re-applied each settle frame, like the speed hold),
    // so the chase is in frame when the shutter falls.
    car.x = -7;
    car.z = 0;
    car.angle = 0;
    car.speed = 34;
    holdCar = car;
    holdSpeed = 34;
    holdFormation = game.policeCars.slice(0, 3).map((c, i) => ({
      car: c, dx: (i - 1) * 11, dz: 18 + (i % 2) * 8,
    }));
    renderer.camState.yaw = Math.PI; // behind the car, which faces +z
  }

  // Let the world settle, then freeze the frame. Re-apply the staged speed each
  // frame so the speedometer and the moment stay as staged.
  const settle = { n: 0 };
  return () => {
    settle.n += 1;
    if (holdCar) holdCar.speed = holdSpeed;
    if (holdFormation && holdCar) {
      for (const f of holdFormation) {
        f.car.x = holdCar.x + f.dx;
        f.car.z = holdCar.z + f.dz;
        f.car.angle = Math.PI;
        f.car.speed = holdSpeed;
      }
    }
    return settle.n > 40;
  };
}
