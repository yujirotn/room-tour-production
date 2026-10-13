export function readGLB(buffer){
  if(buffer.length<20||buffer.readUInt32LE(0)!==0x46546c67||buffer.readUInt32LE(4)!==2||buffer.readUInt32LE(8)!==buffer.length)throw new Error('不正なGLB');
  if(buffer.readUInt32LE(16)!==0x4e4f534a)throw new Error('GLB JSONが必要');
  return JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString('utf8'));
}
export function inspectGLB(buffer,plan){
  const gltf=readGLB(buffer),errors=[];
  const nodes=(gltf.nodes||[]).filter(n=>n.mesh!==undefined),roles={};for(const n of nodes){const role=n.extras?.modelRole||'unknown';roles[role]=(roles[role]||0)+1;}
  for(const role of ['wall','floor','ceiling'])if(!roles[role])errors.push('GLBに'+role+'がありません');
  const expected=plan.floors.flatMap(f=>f.walls.flatMap(w=>(w.openings||[]).filter(o=>o.kind==='door').map(o=>o.id)));
  const doors=Object.fromEntries(expected.map(id=>[id,nodes.filter(n=>n.extras?.openingId===id&&n.extras?.modelRole==='door').length]));
  for(const [id,count]of Object.entries(doors))if(!count)errors.push('可動建具メッシュがありません: '+id);
  const materialCount=gltf.materials?.length||0,imageCount=gltf.images?.length||0;
  if(materialCount<4)errors.push('材質が不足');if(!imageCount)errors.push('画像テクスチャがありません');
  for(const f of plan.floors)if(!nodes.some(n=>n.extras?.floorId===f.id))errors.push('階メッシュがありません: '+f.id);
  if(nodes.some(n=>!n.extras?.modelRole))errors.push('役割metadataのないmesh');
  return {passed:errors.length===0,meshCount:nodes.length,materialCount,imageCount,roles,doors,errors};
}
