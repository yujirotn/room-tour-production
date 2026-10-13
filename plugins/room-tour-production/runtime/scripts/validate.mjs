import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function inside(p, polygon) {
  let hit=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    const cross=(p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]);
    if(Math.abs(cross)<1e-8&&p[0]>=Math.min(a[0],b[0])-1e-8&&p[0]<=Math.max(a[0],b[0])+1e-8&&p[1]>=Math.min(a[1],b[1])-1e-8&&p[1]<=Math.max(a[1],b[1])+1e-8)return true;
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }return hit;
}
function segmentInside(a,b,poly){
  const axis=Math.abs(b[0]-a[0])>1e-8?0:1, delta=b[axis]-a[axis];
  if(Math.abs(delta)<1e-8)return inside(a,poly);
  const cuts=[0,1,...poly.map(p=>(p[axis]-a[axis])/delta).filter(t=>t>0&&t<1)].sort((x,y)=>x-y);
  return cuts.every(t=>inside([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],poly))&&cuts.slice(1).every((t,i)=>{const m=(t+cuts[i])/2;return inside([a[0]+(b[0]-a[0])*m,a[1]+(b[1]-a[1])*m],poly);});
}
function shapeInside(poly,boundary){return poly.every((a,i)=>segmentInside(a,poly[(i+1)%poly.length],boundary));}
export function validatePlan(p){
  const errors=[],ids=new Set();
  const bad=(label,message)=>errors.push(`${label}: ${message}`);
  const id=(v,label)=>{if(typeof v!=='string'||!v.trim())bad(label,'idが必要');else if(ids.has(v))bad(label,'idの重複');else ids.add(v);};
  const finite=(n)=>typeof n==='number'&&Number.isFinite(n);
  const point=(v)=>Array.isArray(v)&&v.length===2&&v.every(finite);
  const polygon=(poly,label)=>{
    if(!Array.isArray(poly)||poly.length<4||!poly.every(point)){bad(label,'4点以上の直交多角形が必要');return false;}
    let area=0;
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length];area+=a[0]*b[1]-b[0]*a[1];
      if(Math.hypot(b[0]-a[0],b[1]-a[1])<1e-6||Math.abs(b[0]-a[0])>1e-6&&Math.abs(b[1]-a[1])>1e-6)bad(label,'斜辺・重複点はv1対応外');
      for(let j=i+2;j<poly.length;j++){
        if(i===0&&j===poly.length-1)continue;
        const c=poly[j],d=poly[(j+1)%poly.length];
        const orient=(x,y,z)=>(y[0]-x[0])*(z[1]-x[1])-(y[1]-x[1])*(z[0]-x[0]);
        const abC=orient(a,b,c),abD=orient(a,b,d),cdA=orient(c,d,a),cdB=orient(c,d,b);
        const on=(x,y,z)=>z[0]>=Math.min(x[0],y[0])-1e-8&&z[0]<=Math.max(x[0],y[0])+1e-8&&z[1]>=Math.min(x[1],y[1])-1e-8&&z[1]<=Math.max(x[1],y[1])+1e-8;
        if(abC*abD<0&&cdA*cdB<0||Math.abs(abC)<1e-8&&on(a,b,c)||Math.abs(abD)<1e-8&&on(a,b,d)||Math.abs(cdA)<1e-8&&on(c,d,a)||Math.abs(cdB)<1e-8&&on(c,d,b))bad(label,'自己交差・接触する多角形');
      }
    }if(Math.abs(area)<1e-6)bad(label,'面積がゼロ');return true;
  };
  if(p?.version!=='1.0'||p?.units!=='m')bad('plan','version=1.0、units=mが必要');
  if(!p?.project?.name||typeof p.project.name!=='string')bad('project','nameが必要');
  if(!Array.isArray(p?.floors)||!p.floors.length)return [...errors,'floors: 1階以上が必要'];
  const elevations=new Set();
  for(const f of p.floors){
    const label=`floor ${f.id}`;id(f.id,label);if(f.id==='all')bad(label,'allは全階表示の予約語');
    if(!finite(f.elevation)||!finite(f.wallHeight)||f.wallHeight<1.8||f.wallHeight>6)bad(label,'elevationとwallHeight(1.8〜6m)が必要');
    if(elevations.has(f.elevation))bad(label,'同じ床高さの階は統合する');elevations.add(f.elevation);
    const validBoundary=polygon(f.boundary,label+' boundary');
    if(!Array.isArray(f.rooms)||!f.rooms.length)bad(label,'roomsが必要');
    for(const r of f.rooms||[]){id(r.id,'room');if(!r.name)bad(r.id,'部屋名が必要');const ok=polygon(r.polygon,r.id);if(!point(r.position)||ok&&!inside(r.position,r.polygon))bad(r.id,'positionは部屋内部に指定');if(ok&&validBoundary&&!shapeInside(r.polygon,f.boundary))bad(r.id,'部屋が床境界外');}
    if(!Array.isArray(f.walls)||!f.walls.length)bad(label,'wallsが必要');
    for(const w of f.walls||[]){
      id(w.id,'wall');if(!point(w.start)||!point(w.end)){bad(w.id,'壁のstart/endが必要');continue;}
      const length=Math.hypot(w.end[0]-w.start[0],w.end[1]-w.start[1]);
      if(length<.01||Math.abs(w.end[0]-w.start[0])>1e-6&&Math.abs(w.end[1]-w.start[1])>1e-6)bad(w.id,'直交壁のみv1対応');
      if(!finite(w.thickness)||w.thickness<.04||w.thickness>.5)bad(w.id,'壁厚0.04〜0.5mが必要');
      if(validBoundary&&!segmentInside(w.start,w.end,f.boundary))bad(w.id,'壁が床境界外');
      const openings=[...(w.openings||[])].sort((a,b)=>a.offset-b.offset);let previous=0;
      for(const o of openings){
        id(o.id,'opening');
        if(!['door','window'].includes(o.kind))bad(o.id,'door/windowのみ対応');
        if(![o.offset,o.width,o.height,o.bottom].every(finite)||o.offset<0||o.width<.1||o.height<.1||o.bottom<0||o.offset+o.width>length+1e-6||o.bottom+o.height>f.wallHeight+1e-6)bad(o.id,'開口寸法または壁内の位置が不正');
        if(o.offset<previous-1e-6)bad(o.id,'開口が重複');previous=o.offset+o.width;
        if(o.kind==='door'){
          if(!['hinged','sliding'].includes(o.operation))bad(o.id,'door operationはhinged/sliding');
          if(o.bottom!==0)bad(o.id,'段差付きdoorはv1対応外');
          if(o.operation==='hinged'&&(!['start','end'].includes(o.hinge)||![1,-1].includes(o.swing)))bad(o.id,'hingeとswingを明示');
          if(o.operation==='sliding'&&(![1,-1].includes(o.slide)||o.slide===1&&o.offset+2*o.width>length||o.slide===-1&&o.offset-o.width<0))bad(o.id,'slide方向と戸の収納距離を確認');
        }else if(o.operation!=='fixed')bad(o.id,'可動窓はv1対応外。fixedを指定');
      }
    }
    for(const fixture of f.fixtures||[]){
      id(fixture.id,'fixture');if(!['kitchen','sofa','table','bed','toilet','basin','bath','cabinet'].includes(fixture.type))bad(fixture.id,'未対応設備');
      if(!point(fixture.position)||!Array.isArray(fixture.size)||fixture.size.length!==3||!fixture.size.every(x=>finite(x)&&x>.02))bad(fixture.id,'position/sizeが不正');
      else if(validBoundary){const angle=finite(fixture.rotation)?fixture.rotation:0,c=Math.cos(angle),s=Math.sin(angle);const footprint=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>[fixture.position[0]+c*x*fixture.size[0]/2-s*z*fixture.size[1]/2,fixture.position[1]+s*x*fixture.size[0]/2+c*z*fixture.size[1]/2]);if(!shapeInside(footprint,f.boundary))bad(fixture.id,'設備が床境界外');if(fixture.size[2]>f.wallHeight)bad(fixture.id,'設備が天井を越える');}
      if(fixture.rotation!==undefined&&!finite(fixture.rotation))bad(fixture.id,'rotationはラジアン');
    }
  }
  for(const s of p.stairs||[]){
    id(s.id,'stair');const from=p.floors.find(f=>f.id===s.fromFloor),to=p.floors.find(f=>f.id===s.toFloor);
    if(!from||!to||to.elevation<=from.elevation){bad(s.id,'上階・下階の参照が不正');continue;}
    if(!point(s.start)||!point(s.end)||!finite(s.width)||s.width<.6||!Number.isInteger(s.steps)||s.steps<3){bad(s.id,'直線階段の寸法が不正');continue;}
    if(Math.abs(s.end[0]-s.start[0])>1e-6&&Math.abs(s.end[1]-s.start[1])>1e-6)bad(s.id,'直交する直線階段のみ対応');
    const run=Math.hypot(s.end[0]-s.start[0],s.end[1]-s.start[1]);if((to.elevation-from.elevation)/s.steps>.22||run/s.steps<.2)bad(s.id,'参考検算: 蹴上0.22m以下・踏面0.2m以上が必要');
    const dx=(s.end[0]-s.start[0])/run,dz=(s.end[1]-s.start[1])/run;const outline=[[s.start[0]-dz*s.width/2,s.start[1]+dx*s.width/2],[s.start[0]+dz*s.width/2,s.start[1]-dx*s.width/2],[s.end[0]+dz*s.width/2,s.end[1]-dx*s.width/2],[s.end[0]-dz*s.width/2,s.end[1]+dx*s.width/2]];
    if(!shapeInside(outline,from.boundary)||!shapeInside(outline,to.boundary))bad(s.id,'階段の幅を含む形状が床境界外');
    if(to.elevation-from.elevation<from.wallHeight+.15)bad(s.id,'階高には天井上の厚さが必要');
  }
  return [...new Set(errors)];
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const input=process.argv[2];if(!input){console.error('Usage: node scripts/validate.mjs PLAN.json');process.exit(2);}
  const errors=validatePlan(JSON.parse(fs.readFileSync(input,'utf8')));if(errors.length){console.error(errors.join('\n'));process.exit(1);}console.log('入力検証: OK');
}
