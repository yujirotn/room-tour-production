import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {findBlender,inspectBlender,inspectDependencies,environmentReport} from '../scripts/environment.mjs';

test('explicit and configured executables preserve spaces and Japanese paths',()=>{
  const explicit='C:\\制作 用\\Blender\\blender.exe';
  assert.equal(findBlender({explicit,env:{BLENDER_BIN:'other'}}),explicit);
  assert.equal(findBlender({platform:'win32',env:{BLENDER_BIN:explicit}}),explicit);
});
test('Windows discovers a 5.1 installation without PATH and prefers the newest patch',()=>{
  const expected='C:\\Program Files\\Blender Foundation\\Blender 5.1.2\\blender.exe';
  assert.equal(findBlender({platform:'win32',env:{ProgramFiles:'C:\\Program Files'},list:()=>['Blender 4.5','Blender 5.1','Blender 5.1.2','Blender 6.0'],exists:p=>p===expected}),expected);
});
test('Windows discovers official unversioned and local-user installations',()=>{
  const unversioned='C:\\Program Files\\Blender Foundation\\Blender\\blender.exe';
  assert.equal(findBlender({platform:'win32',env:{ProgramFiles:'C:\\Program Files'},list:()=>[],exists:p=>p===unversioned}),unversioned);
  const local='C:\\Users\\Demo User\\AppData\\Local\\Programs\\Blender Foundation\\Blender 5.1\\blender.exe';
  assert.equal(findBlender({platform:'win32',env:{LOCALAPPDATA:'C:\\Users\\Demo User\\AppData\\Local'},list:()=>['Blender 5.1'],exists:p=>p===local}),local);
});
test('Windows prefers an existing local 5.1 installation over an incompatible unversioned system installation',()=>{
  const system='C:\\Program Files\\Blender Foundation\\Blender\\blender.exe';
  const local='C:\\Users\\Demo User\\AppData\\Local\\Programs\\Blender Foundation\\Blender 5.1\\blender.exe';
  const command=findBlender({platform:'win32',env:{ProgramFiles:'C:\\Program Files',LOCALAPPDATA:'C:\\Users\\Demo User\\AppData\\Local'},list:p=>p.startsWith('C:\\Users')?['Blender 5.1']:[],exists:p=>p===system||p===local});
  assert.equal(command,local);
});
test('macOS app and PATH fallback remain usable',()=>{
  assert.equal(findBlender({platform:'darwin',env:{},exists:()=>true}),'/Applications/Blender.app/Contents/MacOS/Blender');
  assert.equal(findBlender({platform:'win32',env:{},exists:()=>false}),'blender');
  assert.equal(findBlender({platform:'linux',env:{},exists:()=>false}),'blender');
});
test('Blender is probed as an executable argument, with a timeout, and incompatible versions fail',()=>{
  const command='C:\\Program Files\\Blender Foundation\\Blender\\blender.exe';
  const ok=inspectBlender(command,(file,args,opts)=>{
    assert.equal(file,command);assert.deepEqual(args,['--version']);assert.equal(opts.timeout,15000);assert.equal(opts.shell,undefined);
    return {status:0,stdout:'Blender 5.1.2\r\n'};
  });
  assert.equal(ok.ok,true);
  assert.equal(inspectBlender(command,()=>({status:0,stdout:'Blender 6.0.0'})).ok,false);
  assert.equal(inspectBlender(command,()=>({status:null,error:new Error('ENOENT')})).ok,false);
});
test('doctor reports only missing requirements and Windows npm.cmd recovery',()=>{
  const report=environmentReport({root:'fixture',platform:'win32',nodeVersion:'22.17.0',env:{},exists:()=>false,run:()=>({status:0,stdout:'Blender 5.1.2'}),dependencies:()=>[{name:'three',ok:true},{name:'esbuild',ok:false,detail:'Wrong platform binary'}]});
  assert.equal(report.ready,false);assert.equal(report.nextSteps.length,1);assert.match(report.nextSteps[0],/^npm\.cmd ci/);
  const ready=environmentReport({root:'fixture',platform:'darwin',nodeVersion:'22.17.0',env:{},exists:()=>false,run:()=>({status:0,stdout:'Blender 5.1.2'}),dependencies:()=>[{name:'three',ok:true},{name:'esbuild',ok:true}]});
  assert.equal(ready.ready,true);assert.deepEqual(ready.nextSteps,[]);
});
test('doctor detects an old Node and missing Blender without claiming readiness',()=>{
  const report=environmentReport({root:'fixture',nodeVersion:'20.1.0',env:{},exists:()=>false,run:()=>({status:1,stdout:''}),dependencies:()=>[{name:'three',ok:true},{name:'esbuild',ok:true}]});
  assert.equal(report.ready,false);assert.equal(report.nextSteps.length,2);
});
test('dependency checks handle packages that do not export package.json and execute the binary API',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'room-tour-dependency-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({dependencies:{three:'0.179.1',esbuild:'0.25.9'}}));
  for(const [name,version,source] of [['three','0.179.1','module.exports = {};'],['esbuild','0.25.9','exports.transformSync = () => ({code:"ready"});']]){
    const directory=path.join(root,'node_modules',name);fs.mkdirSync(path.join(directory,'lib'),{recursive:true});
    fs.writeFileSync(path.join(directory,'package.json'),JSON.stringify({name,version,exports:{'.':'./lib/main.cjs'}}));
    fs.writeFileSync(path.join(directory,'lib/main.cjs'),source);
  }
  assert.deepEqual(inspectDependencies(root).map(check=>check.ok),[true,true]);
  fs.writeFileSync(path.join(root,'node_modules','three','package.json'),JSON.stringify({name:'three',version:'0.180.0',exports:{'.':'./lib/main.cjs'}}));
  assert.equal(inspectDependencies(root)[0].ok,false);
});
