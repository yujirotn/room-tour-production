/** Plan-derived door mechanics. Geometry stays in metres, with Y as height. */
export function makeDoor(floor, wall, opening) {
  const length = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
  const ux = (wall.end[0] - wall.start[0]) / length;
  const uz = (wall.end[1] - wall.start[1]) / length;
  const reverse = opening.hinge === 'end';
  const offset = opening.offset + (reverse ? opening.width : 0);
  // Sliding leaves travel on the positive wall-normal face, matching the builder.
  const normalOffset = opening.operation === 'sliding' ? wall.thickness / 2 + .04 : 0;
  const d = {
    id: opening.id, name: opening.name || opening.id, floorId: floor.id,
    operation: opening.operation || 'hinged', width: opening.width,
    hingeX: wall.start[0] + ux * offset - uz * normalOffset,
    hingeZ: wall.start[1] + uz * offset + ux * normalOffset,
    dx: ux * (reverse ? -1 : 1), dz: uz * (reverse ? -1 : 1),
    wallDx: ux, wallDz: uz, swing: opening.swing ?? 1, slide: opening.slide ?? 1,
    progress: 0, target: 0, rotation: 0, translation: 0,
    collider: {segment: true, minY: floor.elevation + (opening.bottom || 0),
      maxY: floor.elevation + (opening.bottom || 0) + opening.height, thickness: .045},
  };
  setDoorProgress(d, 0);
  return d;
}

export function setDoorProgress(d, progress) {
  d.progress = Math.max(0, Math.min(1, progress));
  d.rotation = d.operation === 'hinged' ? d.swing * Math.PI / 2 * d.progress : 0;
  d.translation = d.operation === 'sliding' ? d.slide * d.width * d.progress : 0;
  const c = Math.cos(d.rotation), s = Math.sin(d.rotation);
  const ax = d.hingeX + d.wallDx * d.translation;
  const az = d.hingeZ + d.wallDz * d.translation;
  Object.assign(d.collider, {ax, az,
    bx: ax + (d.dx * c + d.dz * s) * d.width,
    bz: az + (d.dz * c - d.dx * s) * d.width});
}

export function doorContains(o, x, z, height, radius, eye = 1.55) {
  if (o.maxY <= height + .10 || o.minY >= height + eye + .05) return false;
  const vx = o.bx - o.ax, vz = o.bz - o.az;
  const t = Math.max(0, Math.min(1, ((x - o.ax) * vx + (z - o.az) * vz) / (vx * vx + vz * vz || 1)));
  return (x - o.ax - t * vx) ** 2 + (z - o.az - t * vz) ** 2 < (radius + o.thickness / 2) ** 2;
}

export function toggleDoor(d) {
  // A stopped leaf continues towards the farther endpoint on the next operation.
  d.target = d.target > .5 ? 0 : 1;
}

export function stepDoor(d, dt, body) {
  if (Math.abs(d.progress - d.target) < 1e-7) return {changed: false, blocked: false};
  const old = d.progress;
  const delta = Math.sign(d.target - old) * Math.min(Math.abs(d.target - old), Math.max(0, dt) / .7);
  // Keep each swept tip displacement below 8 mm, including slow-frame recovery.
  const travel = Math.abs(delta) * d.width * (d.operation === 'hinged' ? Math.PI / 2 : 1);
  const steps = Math.max(1, Math.ceil(travel / .008));
  for (let i = 1; i <= steps; i++) {
    setDoorProgress(d, old + delta * i / steps);
    if (body && doorContains(d.collider, body.x, body.z, body.height, body.radius, body.eye)) {
      setDoorProgress(d, old);
      d.target = old;
      return {changed: false, blocked: true};
    }
  }
  return {changed: Math.abs(delta) > 0, blocked: false};
}

export function doorStateText(d) {
  if (Math.abs(d.progress - d.target) > .001) return d.target > d.progress ? '開いています…' : '閉じています…';
  return d.progress < .01 ? '閉' : d.progress > .99 ? '開' : '途中で停止';
}
