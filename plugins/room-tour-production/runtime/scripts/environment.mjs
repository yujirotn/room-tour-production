import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';

export function findBlender({explicit,platform=process.platform,env=process.env,exists=fs.existsSync,list=fs.readdirSync}={}){
  if(explicit)return explicit;
  if(env.BLENDER_BIN)return env.BLENDER_BIN;
  if(platform==='darwin'){
    const app='/Applications/Blender.app/Contents/MacOS/Blender';
    if(exists(app))return app;
  }
  if(platform==='win32'){
    const bases=[env.ProgramW6432,env.ProgramFiles,env.LOCALAPPDATA&&path.win32.join(env.LOCALAPPDATA,'Programs')].filter(Boolean);
    const versioned=[],unversioned=[];
    for(const base of [...new Set(bases)]){
      const foundation=path.win32.join(base,'Blender Foundation');
      let directories=[];
      try{directories=list(foundation).filter(name=>/^Blender 5\.1(?:\.\d+)?$/.test(name)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));}catch{}
      for(const folder of directories)versioned.push(path.win32.join(foundation,folder,'blender.exe'));
      unversioned.push(path.win32.join(foundation,'Blender','blender.exe'));
    }
    for(const executable of [...versioned,...unversioned])if(exists(executable))return executable;
  }
  return 'blender';
}

export function inspectBlender(command,run=spawnSync){
  const result=run(command,['--version'],{encoding:'utf8',timeout:15000,windowsHide:true});
  const output=String(result.stdout??'');
  const version=output.match(/\bBlender\s+(\d+\.\d+(?:\.\d+)?)/)?.[1]??null;
  return {name:'Blender',ok:!result.error&&result.status===0&&/^5\.1(?:\.|$)/.test(version??''),command,version,detail:result.error?.message??(version?'5.1系を使用します。':'Blenderのバージョンを取得できません。'),download:'https://download.blender.org/release/Blender5.1/'};
}

export function inspectDependencies(root){
  const require=createRequire(path.join(root,'package.json'));
  const expected=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).dependencies;
  return ['three','esbuild'].map(name=>{
    try{
      let directory=path.dirname(require.resolve(name)),manifest;
      while(true){
        const file=path.join(directory,'package.json');
        if(fs.existsSync(file)){
          const candidate=JSON.parse(fs.readFileSync(file,'utf8'));
          if(candidate.name===name){manifest=candidate;break;}
        }
        const parent=path.dirname(directory);if(parent===directory)throw new Error(name+'のpackage.jsonが見つかりません。');
        directory=parent;
      }
      const installed=manifest.version;
      if(installed!==expected[name])return {name,ok:false,version:installed,detail:'固定バージョン '+expected[name]+' が必要です。'};
      if(name==='esbuild')require('esbuild').transformSync('const ready = true;',{loader:'js'});
      return {name,ok:true,version:installed};
    }catch(error){return {name,ok:false,detail:error.message};}
  });
}

export function environmentReport({root,blender,platform=process.platform,nodeVersion=process.versions.node,env=process.env,exists=fs.existsSync,list=fs.readdirSync,run=spawnSync,dependencies=inspectDependencies}={}){
  const node={name:'Node.js',ok:Number(nodeVersion.split('.')[0])>=22,version:nodeVersion,download:'https://nodejs.org/en/download'};
  const command=findBlender({explicit:blender,platform,env,exists,list});
  const checks=[node,inspectBlender(command,run),...dependencies(root)];
  const nextSteps=[];
  if(!node.ok)nextSteps.push('Node.js 22以降を公式サイトから導入し、ターミナルを開き直してください。');
  if(!checks[1].ok)nextSteps.push('Blender 5.1系を公式配布元から導入し、--blenderで実行ファイルを指定してください。');
  if(checks.slice(2).some(c=>!c.ok))nextSteps.push((platform==='win32'?'npm.cmd':'npm')+' ci --ignore-scripts をruntimeで実行してください。他のOSのnode_modulesはコピーしないでください。');
  return {ready:checks.every(c=>c.ok),platform,checks,nextSteps};
}
