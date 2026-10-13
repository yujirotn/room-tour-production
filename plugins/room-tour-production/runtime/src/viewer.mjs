import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {makeDoor, toggleDoor, stepDoor, doorStateText, setDoorProgress} from './doors.mjs';
import {inside, makeNavigation} from './navigation.mjs';

const $ = id => document.getElementById(id);
const plan = JSON.parse($('plan-data').textContent);
const canvas = $('viewport');
const errors = [];
function report(error) {
  const text = error?.message || String(error);
  errors.push(text);
  $('loading').hidden = false;
  $('loading').textContent = '3D表示に失敗しました：' + text;
  $('render-status').textContent = '読み込みエラー';
  console.error(error);
}

initialize().catch(report);

async function initialize() {
  THREE.ColorManagement.enabled = true;
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor('#eef0eb');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, .04, 500);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.minDistance = .5;
  controls.maxPolarAngle = Math.PI * .499;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = new RoomEnvironment();
  const environmentTarget = pmrem.fromScene(environment, .04);
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = .45;
  environment.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0x718477, .8));
  const sun = new THREE.DirectionalLight(0xfff4dd, 2.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = .025;
  scene.add(sun, sun.target);

  const raw = atob($('model-data').textContent.trim());
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
  const model = gltf.scene;
  scene.add(model);
  model.updateMatrixWorld(true);
  const meshes = [];
  model.traverse(object => {
    if (!object.isMesh) return;
    // Node extras may be placed on a parent by an external model exporter.
    for (let parent = object.parent; parent && parent !== model.parent; parent = parent.parent) {
      for (const key of ['floorId', 'modelRole', 'openingId']) {
        if (object.userData[key] === undefined && parent.userData[key] !== undefined) object.userData[key] = parent.userData[key];
      }
    }
    object.castShadow = true;
    object.receiveShadow = true;
    const original = Array.isArray(object.material) ? object.material : [object.material];
    const materials = original.map(material => material.clone());
    // GLTFLoader preserves glTF PBR factors and tags its colour maps correctly.
    for (const material of materials) {
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) {
        if (material[key]) material[key].anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      }
    }
    object.material = Array.isArray(object.material) ? materials : materials[0];
    meshes.push(object);
  });
  const fullBounds = new THREE.Box3().setFromObject(model);
  const fullCenter = fullBounds.getCenter(new THREE.Vector3());
  const span = Math.max(4, fullBounds.getSize(new THREE.Vector3()).length());
  camera.far = Math.max(100, span * 8);
  camera.updateProjectionMatrix();
  controls.maxDistance = span * 4;
  sun.position.copy(fullCenter).add(new THREE.Vector3(-span * .4, span * 1.5, -span * .7));
  sun.target.position.copy(fullCenter);
  const shadowHalf = span * .65;
  Object.assign(sun.shadow.camera, {left: -shadowHalf, right: shadowHalf, top: shadowHalf,
    bottom: -shadowHalf, near: .1, far: span * 4});
  sun.shadow.camera.updateProjectionMatrix();

  let floor = plan.floors[0].id, low = true, ceilings = false, walk = false;
  let yaw = 0, pitch = 0, dragging = null, nearestDoor = null;
  const keys = new Set(), doorStates = [], labels = [];
  const raycaster = new THREE.Raycaster();
  for (const f of plan.floors) for (const wall of f.walls) for (const opening of wall.openings || []) {
    if (opening.kind !== 'door') continue;
    const parts = meshes.filter(m => m.userData.modelRole === 'door' && m.userData.openingId === opening.id);
    if (!parts.length) throw new Error('建具のGLBメッシュがありません：' + opening.id);
    const door = makeDoor(f, wall, opening);
    const pivot = new THREE.Group();
    pivot.position.set(door.hingeX, f.elevation + (opening.bottom || 0), door.hingeZ);
    scene.add(pivot);
    for (const mesh of parts) {pivot.attach(mesh); mesh.userData.interactiveDoorId = door.id;}
    door.pivot = pivot;
    door.closedPosition = pivot.position.clone();
    door.parts = parts;
    doorStates.push(door);
  }
  const obstacles = [];
  for (const mesh of meshes) {
    if (!['wall', 'fixture', 'window', 'trim'].includes(mesh.userData.modelRole)) continue;
    const box = new THREE.Box3().setFromObject(mesh);
    obstacles.push({minX: box.min.x, maxX: box.max.x, minY: box.min.y,
      maxY: box.max.y, minZ: box.min.z, maxZ: box.max.z, name: mesh.name});
  }
  obstacles.push(...doorStates.map(d => d.collider));
  const nav = makeNavigation(plan, obstacles);

  $('project-name').textContent = plan.project?.name || '住宅3D内覧';
  document.title = $('project-name').textContent + ' | 3D内覧';
  const assumptions = plan.assumptions || [];
  for (const note of assumptions.length ? assumptions : ['補完した仕様の記録がありません。']) {
    const li = document.createElement('li');
    li.textContent = typeof note === 'string' ? note : JSON.stringify(note);
    $('assumptions').appendChild(li);
  }
  function button(text, callback) {
    const b = document.createElement('button'); b.textContent = text; b.onclick = callback; return b;
  }
  for (const f of plan.floors) {
    const b = button(f.name || f.id, () => selectFloor(f.id));
    b.dataset.floor = f.id; $('floors').appendChild(b);
    for (const room of f.rooms) {
      const el = button(room.name, () => roomView(f, room)); el.className = 'room-label';
      $('labels').appendChild(el);
      labels.push({element: el, floorId: f.id, position: new THREE.Vector3(room.position[0], f.elevation + .12, room.position[1])});
    }
  }
  const allButton = button('全階', () => selectFloor('all')); allButton.dataset.floor = 'all'; $('floors').appendChild(allButton);
  for (const s of nav.stairs) {
    for (const [atTop, f] of [[false, s.lower], [true, s.upper]]) {
      const b = button((f.name || f.id) + ' / 階段' + (atTop ? '上' : '下'), () => {
        if (!walk) enterWalk();
        const p = atTop ? s.end : s.start, sign = atTop ? 1 : -1;
        const moved = spawn(f, {name: '階段', position: [p[0] + s.dx * sign * .4, p[1] + s.dz * sign * .4]});
        if (moved) {yaw = atTop ? Math.atan2(s.dx, s.dz) : Math.atan2(-s.dx, -s.dz); orient(); drawMap();}
      });
      $('stair-list').appendChild(b);
    }
  }
  if (!nav.stairs.length) $('stair-list').appendChild(document.createTextNode('階段なし'));

  function resize() {
    const box = canvas.getBoundingClientRect();
    renderer.setSize(Math.max(1, box.width), Math.max(1, box.height), false);
    camera.aspect = Math.max(1, box.width) / Math.max(1, box.height); camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas); resize();
  function fit(top = false) {
    const bounds = new THREE.Box3();
    for (const mesh of meshes) if (floor === 'all' || mesh.userData.floorId === floor) bounds.expandByObject(mesh);
    if (bounds.isEmpty()) bounds.copy(fullBounds);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const distance = Math.max(size.x, size.z, size.y * 1.2, 2) * 1.2;
    controls.target.copy(center);
    camera.position.copy(center).add(top ? new THREE.Vector3(0, distance * 1.4, .001) : new THREE.Vector3(distance * .55, distance * .8, distance));
    controls.update();
  }
  function visibility() {
    for (const mesh of meshes) {
      const f = plan.floors.find(f => f.id === mesh.userData.floorId), role = mesh.userData.modelRole;
      mesh.visible = walk || ((floor === 'all' || mesh.userData.floorId === floor || role === 'stair') && (ceilings || role !== 'ceiling'));
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const clipping = !walk && low && role === 'wall' && f ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), f.elevation + 1.15)] : [];
        if ((material.clippingPlanes?.length || 0) !== clipping.length) material.needsUpdate = true;
        material.clippingPlanes = clipping;
      }
    }
    for (const label of labels) label.element.hidden = walk || floor === 'all' || floor !== label.floorId;
    $('height-btn').textContent = low ? '壁を実高に' : '壁を低く';
    $('height-btn').classList.toggle('active', !low);
    $('ceiling-btn').textContent = ceilings ? '天井を隠す' : '天井を表示';
    $('ceiling-btn').classList.toggle('active', ceilings);
    renderer.shadowMap.needsUpdate = true;
  }
  function syncFloor() {
    for (const b of $('floors').children) b.classList.toggle('active', b.dataset.floor === floor);
  }
  function rooms() {
    $('rooms').replaceChildren();
    for (const f of plan.floors.filter(f => floor === 'all' || f.id === floor)) for (const room of f.rooms) {
      $('rooms').appendChild(button(room.name, () => roomView(f, room)));
    }
    renderDoors();
  }
  function selectFloor(id) {
    if (walk && id === 'all') leaveWalk();
    if (walk) {
      const f = plan.floors.find(f => f.id === id); spawn(f, f.rooms[0]); return;
    }
    floor = id; low = id !== 'all'; ceilings = id === 'all';
    visibility(); fit(); syncFloor(); rooms();
    $('current-view').textContent = id === 'all' ? '建物全体' : (plan.floors.find(f => f.id === id).name || id);
  }
  function roomView(f, room) {
    if (walk) return spawn(f, room);
    floor = f.id; low = true; ceilings = false; visibility(); syncFloor(); rooms();
    controls.target.set(room.position[0], f.elevation + .7, room.position[1]);
    camera.position.copy(controls.target).add(new THREE.Vector3(2.4, 3.4, 3.0)); controls.update();
    $('current-view').textContent = room.name + ' / 拡大表示';
    return true;
  }
  function orient() {camera.rotation.order = 'YXZ'; camera.rotation.set(pitch, yaw, 0);}
  function spawn(f, room) {
    if (!f || !room || !nav.spawn(f.id, room.position)) {
      $('walk-feedback').textContent = (room?.name || '指定位置') + 'には安全な開始位置がありません。'; return false;
    }
    floor = f.id; yaw = 0; pitch = 0;
    camera.position.set(nav.state.x, nav.state.height + nav.eye, nav.state.z); orient();
    syncFloor(); rooms(); visibility(); readout(); $('walk-feedback').textContent = '';
    return true;
  }
  function enterWalk() {
    walk = true; controls.enabled = false; camera.fov = 66; camera.updateProjectionMatrix();
    document.body.classList.add('walking'); $('walk-btn').classList.add('active'); $('walk-btn').textContent = '歩行を終了';
    $('height-btn').disabled = $('ceiling-btn').disabled = true;
    const f = plan.floors.find(f => f.id === floor) || plan.floors[0];
    if (!spawn(f, f.rooms[0])) {
      let found = false;
      for (const candidate of plan.floors) for (const room of candidate.rooms) if (!found) found = spawn(candidate, room);
      if (!found) {leaveWalk(); throw new Error('歩行を開始できる部屋がありません。');}
    }
    canvas.focus(); visibility();
  }
  function leaveWalk() {
    walk = false; keys.clear(); dragging = null; controls.enabled = true; camera.fov = 45; camera.updateProjectionMatrix();
    document.body.classList.remove('walking'); $('walk-btn').classList.remove('active'); $('walk-btn').textContent = '室内を歩く';
    $('height-btn').disabled = $('ceiling-btn').disabled = false;
    visibility(); fit(); $('current-view').textContent = plan.floors.find(f => f.id === floor)?.name || '建物全体';
  }
  function readout() {
    const s = nav.state, changed = floor !== s.floorId; floor = s.floorId;
    syncFloor(); if (changed) rooms();
    const f = plan.floors.find(f => f.id === floor), room = f.rooms.find(r => inside([s.x, s.z], r.polygon));
    $('current-view').textContent = s.onStair ? '階段を移動中' : (room?.name || f.name || f.id) + ' / 歩行';
    $('walk-position').textContent = `${f.name || f.id} · X ${s.x.toFixed(2)} m / Z ${s.z.toFixed(2)} m · 目線 ${(s.height + nav.eye).toFixed(2)} m`;
    drawMap();
  }
  function drawMap() {
    if (!walk) return;
    const c = $('walk-map'), ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height);
    const f = plan.floors.find(f => f.id === nav.state.floorId);
    const xs = f.boundary.map(p => p[0]), zs = f.boundary.map(p => p[1]);
    const minX = Math.min(...xs), minZ = Math.min(...zs);
    const scale = Math.min((c.width - 24) / (Math.max(...xs) - minX), (c.height - 24) / (Math.max(...zs) - minZ));
    const point = p => [12 + (p[0] - minX) * scale, 12 + (p[1] - minZ) * scale];
    ctx.strokeStyle = '#71846f'; ctx.lineWidth = 3;
    for (const wall of f.walls) {
      const a = point(wall.start), b = point(wall.end); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    }
    ctx.strokeStyle = '#b17943'; ctx.lineWidth = 2;
    for (const d of doorStates.filter(d => d.floorId === f.id)) {
      ctx.beginPath(); ctx.moveTo(...point([d.collider.ax, d.collider.az])); ctx.lineTo(...point([d.collider.bx, d.collider.bz])); ctx.stroke();
    }
    const [x, z] = point([nav.state.x, nav.state.z]); ctx.fillStyle = '#b17943'; ctx.beginPath(); ctx.arc(x, z, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, z); ctx.lineTo(x - Math.sin(yaw) * 18, z - Math.cos(yaw) * 18); ctx.stroke();
  }
  function renderDoors() {
    const wanted = doorStates.filter(d => floor === 'all' || d.floorId === floor);
    if ($('door-list').dataset.floor !== floor) {
      $('door-list').replaceChildren(); $('door-list').dataset.floor = floor;
      for (const d of wanted) {const b = button('', () => activateDoor(d)); b.dataset.door = d.id; $('door-list').appendChild(b);}
      if (!wanted.length) $('door-list').appendChild(document.createTextNode('可動建具なし'));
    }
    for (const b of $('door-list').querySelectorAll('button')) {
      const d = doorStates.find(d => d.id === b.dataset.door); b.textContent = d.name + '：' + doorStateText(d);
    }
  }
  function activateDoor(d) {
    toggleDoor(d); $('door-feedback').textContent = d.name + (d.target > d.progress ? 'を開きます' : 'を閉じます'); renderDoors();
  }
  function applyDoor(d) {
    d.pivot.rotation.y = d.rotation;
    d.pivot.position.copy(d.closedPosition).add(new THREE.Vector3(d.wallDx * d.translation, 0, d.wallDz * d.translation));
  }
  function updateDoors(dt) {
    let changed = false, blocked = false;
    const body = walk ? {...nav.state, radius: nav.radius, eye: nav.eye} : null;
    for (const d of doorStates) {
      const result = stepDoor(d, dt, body);
      if (result.changed) {applyDoor(d); changed = true;}
      if (result.blocked) {blocked = true; $('door-feedback').textContent = d.name + 'の動く範囲から離れてください。';}
    }
    if (changed) {scene.updateMatrixWorld(true); renderer.shadowMap.needsUpdate = true; drawMap();}
    if (changed || blocked) renderDoors();
    if (walk) {
      const forward = camera.getWorldDirection(new THREE.Vector3());
      const candidates = doorStates.filter(d => d.floorId === floor).map(d => {
        const x = (d.collider.ax + d.collider.bx) / 2 - nav.state.x;
        const z = (d.collider.az + d.collider.bz) / 2 - nav.state.z;
        const distance = Math.hypot(x, z); return {d, distance, dot: (x * forward.x + z * forward.z) / (distance || 1)};
      }).filter(d => d.distance < 2.4);
      const front = candidates.filter(d => d.dot > .45);
      nearestDoor = (front.length ? front : candidates).sort((a, b) => a.distance - b.distance)[0]?.d || null;
      $('door-action').disabled = !nearestDoor;
      $('door-action').textContent = nearestDoor ? nearestDoor.name + '：' + doorStateText(nearestDoor) + ' / E で開閉' : '近くの建具に近づいてください';
    }
  }
  function clickDoor(event) {
    const box = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - box.left) / box.width * 2 - 1, -(event.clientY - box.top) / box.height * 2 + 1), camera);
    // Intersect visible solids first, so a door cannot be selected through a wall.
    const hit = raycaster.intersectObjects(meshes.filter(m => m.visible), false)[0];
    if (!hit || hit.distance > 2.4) return;
    const d = doorStates.find(d => d.id === hit.object.userData.interactiveDoorId); if (d) activateDoor(d);
  }
  $('walk-btn').onclick = () => {try {walk ? leaveWalk() : enterWalk();} catch (error) {report(error);}};
  $('height-btn').onclick = () => {low = !low; visibility();};
  $('ceiling-btn').onclick = () => {ceilings = !ceilings; visibility();};
  $('plan-btn').onclick = () => {if (walk) leaveWalk(); low = true; ceilings = false; visibility(); fit(true);};
  $('reset-btn').onclick = () => {if (walk) leaveWalk(); low = floor !== 'all'; ceilings = floor === 'all'; visibility(); fit();};
  $('info-btn').onclick = () => {keys.clear(); $('notes').showModal();};
  $('close-notes').onclick = () => $('notes').close();
  $('door-action').onclick = () => {if (nearestDoor) activateDoor(nearestDoor);};
  document.addEventListener('keydown', e => {
    if (!walk || $('notes').open || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {keys.add(e.code); e.preventDefault();}
    if (e.code === 'KeyE' && !e.repeat) {if (nearestDoor) activateDoor(nearestDoor); e.preventDefault();}
    if (e.code === 'Escape') leaveWalk();
  });
  document.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => {keys.clear(); dragging = null;});
  document.addEventListener('visibilitychange', () => {if (document.hidden) {keys.clear(); dragging = null;}});
  canvas.addEventListener('pointerdown', e => {
    if (!walk) return; canvas.focus(); dragging = {x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY}; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!walk || !dragging) return;
    yaw -= (e.clientX - dragging.x) * .004;
    pitch = Math.max(-1.1, Math.min(1.1, pitch - (e.clientY - dragging.y) * .004));
    dragging.x = e.clientX; dragging.y = e.clientY; orient(); drawMap();
  });
  canvas.addEventListener('pointerup', e => {
    if (walk && dragging && Math.hypot(e.clientX - dragging.startX, e.clientY - dragging.startY) < 6) clickDoor(e);
    dragging = null;
  });
  for (const event of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(event, () => dragging = null);
  for (const b of document.querySelectorAll('[data-move]')) {
    b.addEventListener('pointerdown', e => {if (!walk) return; e.preventDefault(); b.setPointerCapture(e.pointerId); keys.add(b.dataset.move);});
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(event, () => keys.delete(b.dataset.move));
  }
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop); const dt = Math.min((now - last) / 1000, .05); last = now;
    updateDoors(dt);
    if (walk) {
      const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      const sideways = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      const step = 1.15 * dt / Math.max(1, Math.hypot(forward, sideways));
      if (forward || sideways) {
        nav.move((-Math.sin(yaw) * forward + Math.cos(yaw) * sideways) * step, (-Math.cos(yaw) * forward - Math.sin(yaw) * sideways) * step);
        camera.position.set(nav.state.x, nav.state.height + nav.eye, nav.state.z); readout();
      }
      orient();
    } else controls.update();
    renderer.render(scene, camera);
    const box = canvas.getBoundingClientRect();
    for (const label of labels) if (!label.element.hidden) {
      const p = label.position.clone().project(camera);
      label.element.style.left = ((p.x * .5 + .5) * box.width) + 'px'; label.element.style.top = ((-p.y * .5 + .5) * box.height) + 'px';
      label.element.style.visibility = p.z < 1 ? 'visible' : 'hidden';
    }
  }
  selectFloor(floor); $('loading').hidden = true; $('walk-btn').disabled = false;
  $('render-status').textContent = `${meshes.length} メッシュ · ${doorStates.length} 可動建具 · ローカル表示`;
  // Inspectable QA interface. It has no network access and contains only this model.
  window.__tour = {ready: true, plan, model, scene, meshes, renderer, camera, controls, nav, doors: doorStates, errors,
    enterWalk, leaveWalk, selectFloor, roomView, spawn, activateDoor,
    setDoorProgress(id, progress) {const d = doorStates.find(d => d.id === id); setDoorProgress(d, progress); d.target = progress; applyDoor(d); renderer.shadowMap.needsUpdate = true;},
    look(y, p = 0) {yaw = y; pitch = p; orient(); drawMap();},
    stepDoors(dt) {updateDoors(dt);},
    move(dx, dz) {nav.move(dx, dz); camera.position.set(nav.state.x, nav.state.height + nav.eye, nav.state.z); readout();},
    get state() {return {floor, walk, low, ceilings, yaw, pitch, navigation: {...nav.state}};}};
  requestAnimationFrame(loop);
}
