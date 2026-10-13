import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {assembleHTML} from './assemble-html.mjs';
import {validatePlan} from './validate.mjs';
import {inspectGLB} from './inspect-glb.mjs';
import {verifyModel} from './verify-model.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function args(argv){const opts={};for(let i=0;i<argv.length;i++){const a=argv[i];if(a==='--render')opts.render=true;else if(['--plan','--out','--blender'].includes(a)){if(!argv[i+1]||argv[i+1].startsWith('--'))throw new Error(a+'に値が必要');opts[a.slice(2)]=argv[++i];}else throw new Error('不明な引数: '+a);}return opts;}
function findBlender(explicit){
  if(explicit)return explicit;if(process.env.BLENDER_BIN)return process.env.BLENDER_BIN;
  if(process.platform==='darwin'&&fs.existsSync('/Applications/Blender.app/Contents/MacOS/Blender'))return '/Applications/Blender.app/Contents/MacOS/Blender';
  return 'blender';
}
try{
  const opts=args(process.argv.slice(2));if(!opts.plan||!opts.out)throw new Error('Usage: node scripts/build.mjs --plan PLAN.json --out OUTPUT [--blender EXECUTABLE] [--render]');
  const input=path.resolve(opts.plan),out=path.resolve(opts.out);
  if(fs.existsSync(path.join(out,'walkthrough.html')))throw new Error('出力先に成果物があります。別の--outを指定してください');
  const plan=JSON.parse(fs.readFileSync(input,'utf8')),errors=validatePlan(plan);if(errors.length)throw new Error(errors.join('\n'));
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify(plan,null,2)+'\n');
  const version=spawnSync(findBlender(opts.blender),['--version'],{encoding:'utf8'});if(version.error||version.status!==0)throw new Error('Blenderが見つかりません。--blenderまたはBLENDER_BINを指定してください');
  console.log(version.stdout.split('\n')[0]);
  const command=['--background','--python',path.join(root,'blender/build_model.py'),'--','--plan',input,'--out',out];if(opts.render)command.push('--render');
  const result=spawnSync(findBlender(opts.blender),command,{stdio:'inherit'});if(result.error||result.status!==0)throw new Error('Blender生成に失敗: '+(result.error?.message||result.status));
  const model=fs.readFileSync(path.join(out,'model.glb')),inspection=inspectGLB(model,plan);if(inspection.errors.length)throw new Error(inspection.errors.join('\n'));
  fs.writeFileSync(path.join(out,'model-validation.json'),JSON.stringify(inspection,null,2)+'\n');
  const navigation=verifyModel(model,plan);fs.writeFileSync(path.join(out,'navigation-validation.json'),JSON.stringify(navigation,null,2)+'\n');if(!navigation.passed)throw new Error(navigation.errors.join('\n'));
  await assembleHTML(root,out,plan,model);
  console.log('生成完了: '+path.join(out,'walkthrough.html'));
}catch(e){console.error(e.message);process.exit(1);}
