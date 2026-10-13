import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeNavigation} from '../src/navigation.mjs';
import {makeDoor,setDoorProgress,toggleDoor,stepDoor,doorContains} from '../src/doors.mjs';
const plan=JSON.parse(fs.readFileSync(new URL('../examples/demo-plan.json',import.meta.url),'utf8'));
const doors=()=>plan.floors.flatMap(f=>f.walls.flatMap(w=>(w.openings||[]).filter(o=>o.kind==='door').map(o=>makeDoor(f,w,o))));
test('全開き戸・引戸は閉状態で通行を止め、開状態で開口が通れる',()=>{
  for(const d of doors()){
    const x=(d.collider.ax+d.collider.bx)/2,z=(d.collider.az+d.collider.bz)/2;
    assert.equal(doorContains(d.collider,x,z,d.collider.minY,.16),true,d.id+' closed');
    setDoorProgress(d,1);assert.equal(doorContains(d.collider,x,z,d.collider.minY,.16),false,d.id+' open');
    setDoorProgress(d,.5);assert.equal(d.progress,.5);
    setDoorProgress(d,0);toggleDoor(d);for(let i=0;i<50;i++)stepDoor(d,.02,null);assert.equal(d.progress,1);
    toggleDoor(d);for(let i=0;i<50;i++)stepDoor(d,.02,null);assert.equal(d.progress,0);
  }
});
test('低FPSでも建具が人体を横切らずに途中停止する',()=>{
  for(const d of doors()){
    setDoorProgress(d,.5);const body={x:(d.collider.ax+d.collider.bx)/2,z:(d.collider.az+d.collider.bz)/2,height:d.collider.minY,radius:.16,eye:1.55};
    setDoorProgress(d,0);toggleDoor(d);const result=stepDoor(d,.8,body);assert.equal(result.blocked,true,d.id);assert.equal(d.progress,0);assert.equal(d.target,0);
  }
});
test('閉戸で止まり、開いた同じ開口を歩いて横断できる',()=>{
  const d=doors()[0],nav=makeNavigation(plan,[d.collider]);assert.equal(nav.spawn('ground',[2,3.4]),true);
  nav.move(2.5,0);assert.ok(nav.state.x<3);
  setDoorProgress(d,1);nav.move(2,0);assert.ok(nav.state.x>3.5);
});
test('壁・設備を通り抜けず、大きな移動でも衝突を飛び越さない',()=>{
  const wall={minX:2.4,maxX:2.6,minZ:0,maxZ:7,minY:.3,maxY:2.7};
  const nav=makeNavigation(plan,[wall]);assert.equal(nav.spawn('ground',[1.4,3.4]),true);nav.move(5,0);assert.ok(nav.state.x<2.25);
});
test('階段を連続して昇降し、途中で横へ落下しない',()=>{
  const nav=makeNavigation(plan);assert.equal(nav.spawn('ground',[7.15,6.35]),true);
  nav.move(0,-2.9);assert.equal(nav.state.onStair,true);const before={...nav.state};nav.move(-2,0);assert.ok(Math.abs(nav.state.x-7.15)<.41);assert.equal(nav.state.height,before.height);
  nav.move(7.15-nav.state.x,0);nav.move(0,-3);assert.equal(nav.state.floorId,'upper');assert.equal(nav.state.onStair,false);assert.ok(Math.abs(nav.state.height-3.2)<1e-6);
  nav.move(0,6);assert.equal(nav.state.floorId,'ground');assert.equal(nav.state.onStair,false);assert.ok(Math.abs(nav.state.height-.3)<1e-6);
});
test('全室の開始位置と床境界を扱える',()=>{
  const nav=makeNavigation(plan);for(const f of plan.floors)for(const r of f.rooms)assert.equal(nav.spawn(f.id,r.position),true,r.id);
  nav.spawn('ground',[1.4,3.4]);nav.move(-30,0);assert.ok(nav.state.x>=0);assert.ok(nav.state.x<.03);
});
