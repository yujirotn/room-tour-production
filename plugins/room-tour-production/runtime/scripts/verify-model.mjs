import fs from 'node:fs';
import {Box3,Vector3,Quaternion,Matrix4} from 'three';
import {readGLB,inspectGLB} from './inspect-glb.mjs';
import {makeNavigation} from '../src/navigation.mjs';
import {makeDoor,setDoorProgress} from '../src/doors.mjs';

export function verifyModel(buffer,plan){
  const inspection=inspectGLB(buffer,plan),g=readGLB(buffer),worlds=new Map();
  function traverse(id,parent){const n=g.nodes[id],local=new Matrix4();if(n.matrix)local.fromArray(n.matrix);else local.compose(new Vector3().fromArray(n.translation||[0,0,0]),new Quaternion().fromArray(n.rotation||[0,0,0,1]),new Vector3().fromArray(n.scale||[1,1,1]));const matrix=new Matrix4().multiplyMatrices(parent,local);worlds.set(id,matrix);for(const child of n.children||[])traverse(child,matrix);}
  for(const id of g.scenes[g.scene||0].nodes||[])traverse(id,new Matrix4());
  const obstacles=[];
  for(const [id,matrix]of worlds){const n=g.nodes[id];if(n.mesh===undefined||!['wall','fixture','window','trim'].includes(n.extras?.modelRole))continue;
    const bounds=new Box3();for(const primitive of g.meshes[n.mesh].primitives){const a=g.accessors[primitive.attributes.POSITION];if(!a.min||!a.max)throw new Error('POSITION bounds missing');bounds.union(new Box3(new Vector3().fromArray(a.min),new Vector3().fromArray(a.max)).applyMatrix4(matrix));}
    obstacles.push({minX:bounds.min.x,maxX:bounds.max.x,minY:bounds.min.y,maxY:bounds.max.y,minZ:bounds.min.z,maxZ:bounds.max.z});
  }
  const doors=plan.floors.flatMap(f=>f.walls.flatMap(w=>(w.openings||[]).filter(o=>o.kind==='door').map(o=>makeDoor(f,w,o))));
  obstacles.push(...doors.map(d=>d.collider));const nav=makeNavigation(plan,obstacles),errors=[...inspection.errors],rooms=[],stairs=[];
  for(const f of plan.floors)for(const r of f.rooms){const passed=nav.spawn(f.id,r.position);rooms.push({id:r.id,passed});if(!passed)errors.push('開始位置が設備・壁と干渉: '+r.id);}
  for(const s of plan.stairs||[]){
    const length=Math.hypot(s.end[0]-s.start[0],s.end[1]-s.start[1]),dx=(s.end[0]-s.start[0])/length,dz=(s.end[1]-s.start[1])/length;
    for(const d of doors)setDoorProgress(d,1);
    const start=[s.start[0]-dx*.38,s.start[1]-dz*.38];let passed=nav.spawn(s.fromFloor,start);
    if(passed){nav.move(dx*(length+.8),dz*(length+.8));passed=nav.state.floorId===s.toFloor&&!nav.state.onStair;
      if(passed){nav.move(-dx*(length+.8),-dz*(length+.8));passed=nav.state.floorId===s.fromFloor&&!nav.state.onStair;}}
    stairs.push({id:s.id,passed});if(!passed)errors.push('階段の上下動作がモデルと干渉: '+s.id);
  }
  return {...inspection,rooms,stairs,obstacleCount:obstacles.length,passed:!errors.length,errors};
}
if(process.argv[1]?.endsWith('verify-model.mjs')){
  try{const [, ,planPath,modelPath]=process.argv;if(!planPath||!modelPath)throw new Error('Usage: node scripts/verify-model.mjs PLAN.json MODEL.glb');const result=verifyModel(fs.readFileSync(modelPath),JSON.parse(fs.readFileSync(planPath,'utf8')));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exit(1);}catch(e){console.error(e.message);process.exit(1);}
}
