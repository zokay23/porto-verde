// render.js — canvas drawing for Porto Verde: city, entities, HUD and
// the round minimap. Top-down view; the camera follows Dante.

import { CONFIG, PALETTE } from './config.js';
import { PITCH, CITY_SIZE, isOnRoad } from './city.js';
import { missionTarget } from './sim.js';

export function cameraFor(state, vw, vh) {
  const p = state.player;
  return {
    x: Math.max(0, Math.min(CITY_SIZE - vw, p.x - vw / 2)),
    y: Math.max(0, Math.min(CITY_SIZE - vh, p.y - vh / 2)),
  };
}

function drawCar(ctx, x, y, angle, color, label) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-19, -11, 40, 26);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-18, -10, 36, 20, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(-4, -9, 12, 18);
  ctx.fillStyle = '#111';
  ctx.fillRect(14, -9, 3, 5);
  ctx.fillRect(14, 4, 3, 5);
  ctx.fillStyle = '#ffe27a';
  ctx.fillRect(-18, -8, 2, 4);
  ctx.fillRect(-18, 4, 2, 4);
  ctx.restore();
  if (label) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 18);
  }
}

function drawPerson(ctx, x, y, angle, color, hop) {
  ctx.save();
  ctx.translate(x, y - (hop || 0));
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(5, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawWorld(ctx, state, cam, vw, vh) {
  const city = state.city;
  const t = state.time;

  // Ground: grass base.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(cam.x, cam.y, vw, vh);

  // Blocks (sidewalk slabs) and parks.
  for (const b of city.blocks) {
    if (b.x + b.w < cam.x || b.x > cam.x + vw || b.y + b.h < cam.y || b.y > cam.y + vh) continue;
    ctx.fillStyle = b.kind === 'park' ? '#2e6b35' : PALETTE.sidewalk;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }

  // Roads: asphalt bands with dashed centre lines.
  ctx.fillStyle = PALETTE.asphalt;
  for (let i = 0; i <= CONFIG.BLOCKS; i++) {
    const c = i * PITCH + CONFIG.ROAD_PX / 2;
    ctx.fillRect(0, c - CONFIG.ROAD_PX / 2, CITY_SIZE, CONFIG.ROAD_PX);
    ctx.fillRect(c - CONFIG.ROAD_PX / 2, 0, CONFIG.ROAD_PX, CITY_SIZE);
  }
  ctx.strokeStyle = PALETTE.asphaltLine;
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 18]);
  for (let i = 0; i <= CONFIG.BLOCKS; i++) {
    const c = i * PITCH + CONFIG.ROAD_PX / 2;
    ctx.beginPath();
    ctx.moveTo(0, c);
    ctx.lineTo(CITY_SIZE, c);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c, 0);
    ctx.lineTo(c, CITY_SIZE);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Marina water at the south edge.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(city.marina.x, city.marina.y, city.marina.w, city.marina.h);
  ctx.strokeStyle = '#9fd8ef';
  ctx.lineWidth = 2;
  ctx.strokeRect(city.marina.x + 2, city.marina.y + 2, city.marina.w - 4, city.marina.h - 4);

  // Buildings with a simple shaded roof.
  for (const b of city.buildings) {
    if (b.x + b.w < cam.x || b.x > cam.x + vw || b.y + b.h < cam.y || b.y > cam.y + vh) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = PALETTE.buildingRoof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    if (b.roof) {
      ctx.fillStyle = '#3f7d4e';
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) / 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('H' + b.height, b.x + 8, b.y + 16);
  }

  // Props: trees and lamps.
  for (const pr of city.props) {
    if (pr.x < cam.x || pr.x > cam.x + vw || pr.y < cam.y || pr.y > cam.y + vh) continue;
    if (pr.type === 'tree') {
      ctx.fillStyle = '#1f7a33';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2fa04a';
      ctx.beginPath();
      ctx.arc(pr.x - 3, pr.y - 3, pr.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Mission target marker (pulsing ring).
  const target = missionTarget(state);
  if (target) {
    const pulse = 34 + Math.sin(t * 4) * 6;
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,230,0,0.25)';
    ctx.beginPath();
    ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe600';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(target.label, target.x, target.y - pulse - 8);
  }

  // Pickups.
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    ctx.fillStyle = '#ff9f1c';
    ctx.save();
    ctx.translate(pk.x, pk.y);
    ctx.rotate(Math.sin(t * 3) * 0.2);
    ctx.fillRect(-11, -8, 22, 16);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 4);
    ctx.restore();
  }

  // Pedestrians.
  for (const ped of state.peds) {
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, 0);
  }

  // Enemies (Marlin's crew).
  for (const e of state.enemies) {
    if (!e.alive) continue;
    drawPerson(ctx, e.x, e.y, e.angle, '#c0392b', 0);
    ctx.fillStyle = '#300';
    ctx.fillRect(e.x - 14, e.y - 24, 28, 5);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(e.x - 14, e.y - 24, 28 * Math.max(0, e.hp / 60), 5);
  }

  // Traffic + player cars.
  for (const car of state.cars) {
    drawCar(ctx, car.x, car.y, car.angle, car.color, car.driver === 'player' ? 'D' : '');
  }

  // Cops.
  for (const cop of state.cops) {
    drawCar(ctx, cop.x, cop.y, cop.angle, PALETTE.cop, 'PD');
    ctx.fillStyle = cop.speed > 0 && Math.floor(t * 4) % 2 === 0 ? '#ff3b30' : '#3b82ff';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y - 4, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bullets.
  ctx.fillStyle = '#ffe600';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player on foot.
  const p = state.player;
  if (!p.inCar) {
    const hop = p.jumping > 0 ? Math.sin((1 - p.jumping / CONFIG.JUMP_TIME) * Math.PI) * 14 : 0;
    drawPerson(ctx, p.x, p.y, p.angle, PALETTE.player, hop);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('D', p.x, p.y - 16 - hop);
  }

  // Wanted vignette: red pulse at high stars.
  if (state.wanted >= 3) {
    const a = 0.08 + 0.05 * Math.sin(t * 5);
    ctx.fillStyle = `rgba(255,0,0,${a.toFixed(3)})`;
    ctx.fillRect(cam.x, cam.y, vw, vh);
  }

  // Off-screen mission target: a yellow edge arrow points the way.
  if (target) {
    const p = state.player;
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 520) {
      const ax = cam.x + vw / 2 + (dx / d) * (vw / 2 - 60);
      const ay = cam.y + vh / 2 + (dy / d) * (vh / 2 - 60);
      ctx.fillStyle = '#ffe600';
      ctx.beginPath();
      ctx.arc(ax, ay, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(d / 10) + 'm', ax, ay + 30);
    }
  }
}

export function drawHUD(ctx, state, vw, vh) {
  const p = state.player;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = 'bold 20px sans-serif';

  // Cash.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(12, 12, 190, 40);
  ctx.fillStyle = '#7dff8a';
  ctx.fillText('$' + p.cash.toLocaleString('en-US'), 24, 40);

  // Wanted stars.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(12, 60, 190, 36);
  for (let i = 0; i < CONFIG.MAX_WANTED; i++) {
    ctx.fillStyle = i < state.wanted ? '#ffd700' : 'rgba(255,255,255,0.25)';
    ctx.font = '22px sans-serif';
    ctx.fillText('★', 22 + i * 34, 88);
  }

  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(12, 104, 190, 26);
  ctx.fillStyle = '#222';
  ctx.fillRect(20, 112, 174, 10);
  ctx.fillStyle = p.hp > 40 ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(20, 112, 174 * Math.max(0, p.hp / 100), 10);

  // Ammo.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(12, 138, 190, 34);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px sans-serif';
  const reloading = p.reloadTimer > 0 ? ' RELOADING…' : '';
  ctx.fillText('AMMO ' + p.ammo + ' / ' + p.reserve + reloading, 22, 161);

  // Mission banner.
  if (state.mission) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const bw = Math.min(vw - 24, 560);
    ctx.fillRect((vw - bw) / 2, 12, bw, 58);
    ctx.fillStyle = '#ffe600';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MISSION ' + (state.missionIndex + 1) + '/5 — ' + state.mission.name, vw / 2, 34);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(state.mission.brief, vw / 2, 56);
    if (state.mission.id === 'the-package' && state.mission.stage === 1) {
      ctx.fillStyle = state.missionTimer < 15 ? '#ff5b5b' : '#7dff8a';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(Math.ceil(state.missionTimer) + 's', vw / 2, 78);
    }
  }

  // Flash message.
  if (state.messageTimer > 0 && state.message) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.font = 'bold 18px sans-serif';
    const w = ctx.measureText(state.message).width + 32;
    ctx.fillRect((vw - w) / 2, vh - 96, w, 40);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, vw / 2, vh - 69);
  }

  // Controls hint.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD move · Shift run · Space jump · E car · F punch · Click shoot · R reload · P pause · M mute', 12, vh - 12);

  ctx.restore();
}

export function drawMinimap(ctx, state, vw, vh) {
  const R = 92;
  const cx = vw - R - 18;
  const cy = vh - R - 18;
  const scale = (R * 2) / CITY_SIZE;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#20242a';
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  // Roads on the minimap.
  ctx.fillStyle = '#3a3f47';
  for (let i = 0; i <= CONFIG.BLOCKS; i++) {
    const c = i * PITCH + CONFIG.ROAD_PX / 2;
    ctx.fillRect(cx - R, cy - R + (c - CONFIG.ROAD_PX / 2) * scale, R * 2, CONFIG.ROAD_PX * scale);
    ctx.fillRect(cx - R + (c - CONFIG.ROAD_PX / 2) * scale, cy - R, CONFIG.ROAD_PX * scale, R * 2);
  }
  const dot = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx - R + x * scale, cy - R + y * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const target = missionTarget(state);
  if (target) dot(target.x, target.y, '#ffe600', 5);
  for (const cop of state.cops) dot(cop.x, cop.y, '#2f6df6', 3);
  dot(state.player.x, state.player.y, '#f2b705', 4);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawScreen(ctx, state, vw, vh) {
  const cam = cameraFor(state, vw, vh);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawWorld(ctx, state, cam, vw, vh);
  ctx.restore();
  drawHUD(ctx, state, vw, vh);
  drawMinimap(ctx, state, vw, vh);
}
