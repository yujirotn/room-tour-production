import {doorContains} from './doors.mjs';

export function inside(point, polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}

export function stairGeometry(plan, stair) {
  const lower = plan.floors.find(f => f.id === stair.fromFloor);
  const upper = plan.floors.find(f => f.id === stair.toFloor);
  const length = Math.hypot(stair.end[0] - stair.start[0], stair.end[1] - stair.start[1]);
  const dx = (stair.end[0] - stair.start[0]) / length;
  const dz = (stair.end[1] - stair.start[1]) / length;
  return {...stair, lower, upper, length, dx, dz};
}

export function makeNavigation(plan, obstacles = [], options = {}) {
  const radius = options.radius ?? .16, eye = options.eye ?? 1.55;
  const stairs = (plan.stairs || []).map(s => stairGeometry(plan, s));
  const initial = plan.floors[0];
  const state = {x: 0, z: 0, floorId: initial.id, height: initial.elevation, onStair: false, stairId: null};
  function stairAt(x, z) {
    let closest = null, distance = Infinity;
    for (const s of stairs) {
      if (state.onStair ? s.id !== state.stairId : ![s.fromFloor, s.toFloor].includes(state.floorId)) continue;
      const px = x - s.start[0], pz = z - s.start[1];
      const along = px * s.dx + pz * s.dz;
      const across = px * -s.dz + pz * s.dx;
      if (along < 0 || along > s.length || Math.abs(across) > s.width / 2) continue;
      const t = along / s.length;
      const height = s.lower.elevation + t * (s.upper.elevation - s.lower.elevation);
      const difference = Math.abs(height - state.height);
      // Overlapping flights on different floors share their XY rectangle. Keep
      // the active flight, or enter the flight closest to this landing's height.
      if (difference < distance) {closest = {s, t, across}; distance = difference;}
    }
    return closest;
  }
  function surface(x, z) {
    const ramp = stairAt(x, z);
    if (ramp) {
      if (Math.abs(ramp.across) > ramp.s.width / 2 - radius) return null;
      const height = ramp.s.lower.elevation + ramp.t * (ramp.s.upper.elevation - ramp.s.lower.elevation);
      if (!state.onStair && Math.abs(height - state.height) > .28) return null;
      return {height, onStair: true, stairId: ramp.s.id,
        floorId: ramp.t > .5 ? ramp.s.toFloor : ramp.s.fromFloor};
    }
    let floorId = state.floorId;
    if (state.onStair) {
      const s = stairs.find(s => s.id === state.stairId);
      const t = ((x - s.start[0]) * s.dx + (z - s.start[1]) * s.dz) / s.length;
      // Prevent stepping sideways off an elevated tread into empty space.
      if (t > .055 && t < .945) return null;
      floorId = t >= .945 ? s.toFloor : s.fromFloor;
    }
    const floor = plan.floors.find(f => f.id === floorId);
    if (!floor || !inside([x, z], floor.boundary)) return null;
    return {height: floor.elevation, onStair: false, floorId, stairId: null};
  }
  function obstructed(x, z, s) {
    if (!s) return true;
    for (const o of obstacles) {
      if (o.segment) {
        if (doorContains(o, x, z, s.height, radius, eye)) return true;
        continue;
      }
      if (o.maxY <= s.height + .10 || o.minY >= s.height + eye + .05) continue;
      const dx = x - Math.max(o.minX, Math.min(o.maxX, x));
      const dz = z - Math.max(o.minZ, Math.min(o.maxZ, z));
      if (dx * dx + dz * dz < radius * radius) return true;
    }
    return false;
  }
  function free(x, z) {return !obstructed(x, z, surface(x, z));}
  function move(dx, dz) {
    const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .025));
    let moved = false;
    for (let i = 0; i < count; i++) for (const [ax, az] of [[dx / count, 0], [0, dz / count]]) {
      const x = state.x + ax, z = state.z + az, s = surface(x, z);
      if (!obstructed(x, z, s)) {Object.assign(state, {x, z, ...s}); moved = true;}
    }
    return moved;
  }
  function spawn(floorId, position) {
    const previous = {...state};
    const floor = plan.floors.find(f => f.id === floorId);
    if (!floor) return false;
    Object.assign(state, {floorId, height: floor.elevation, onStair: false, stairId: null});
    const room = floor.rooms.find(r => inside(position, r.polygon));
    let best = null, distance = Infinity;
    for (let ix = -16; ix <= 16; ix++) for (let iz = -16; iz <= 16; iz++) {
      const x = position[0] + ix * .04, z = position[1] + iz * .04;
      const s = surface(x, z), d = ix * ix + iz * iz;
      if (!s || s.onStair || obstructed(x, z, s) || (room && !inside([x, z], room.polygon))) continue;
      if (d < distance) {best = {x, z, ...s}; distance = d;}
    }
    if (!best) {Object.assign(state, previous); return false;}
    Object.assign(state, best);
    return true;
  }
  return {state, radius, eye, stairs, free, move, spawn, surface, obstructed};
}
