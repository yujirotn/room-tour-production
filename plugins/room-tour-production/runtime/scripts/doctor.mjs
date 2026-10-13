import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {environmentReport} from './environment.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
try{
  const opts={};
  for(let i=2;i<process.argv.length;i++){
    if(process.argv[i]==='--json')opts.json=true;
    else if(process.argv[i]==='--blender'&&process.argv[i+1]&&!process.argv[i+1].startsWith('--'))opts.blender=process.argv[++i];
    else throw new Error('Usage: node scripts/doctor.mjs [--json] [--blender EXECUTABLE]');
  }
  const report=environmentReport({root,blender:opts.blender});
  if(opts.json)console.log(JSON.stringify(report,null,2));
  else{
    console.log('環境確認（ソフトの導入・変更は行いません）: '+report.platform);
    for(const check of report.checks){
      console.log((check.ok?'OK':'不足/要確認')+' '+check.name+(check.version?' '+check.version:''));
      if(check.command)console.log('  実行ファイル: '+check.command);
      if(!check.ok&&check.detail)console.log('  '+check.detail);
      if(!check.ok&&check.download)console.log('  公式配布元: '+check.download);
    }
    for(const step of report.nextSteps)console.log('次の手順: '+step);
    console.log(report.ready?'生成に必要な環境を確認しました。図面検証・生成・ブラウザ操作を続けてください。':'不足項目を解消したら、この確認をもう一度実行してください。');
  }
  process.exitCode=report.ready?0:1;
}catch(error){console.error(error.message);process.exitCode=2;}
