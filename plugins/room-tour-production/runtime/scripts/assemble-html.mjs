import fs from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
export function renderTemplate(template,plan,model,script){
  const title=plan.project.name.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const values={TITLE:title,PLAN:JSON.stringify(plan).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029'),MODEL:model.toString('base64'),SCRIPT:script.replace(/<\/script/gi,'<\\/script')};
  return template.replace(/\{\{(TITLE|PLAN|MODEL|SCRIPT)\}\}/g,(_,key)=>values[key]);
}
export async function assembleHTML(root,out,plan,model){
  const bundle=await build({entryPoints:[path.join(root,'src/viewer.mjs')],bundle:true,write:false,minify:true,format:'iife',target:['es2022'],legalComments:'inline'});
  const template=fs.readFileSync(path.join(root,'src/template.html'),'utf8');
  fs.writeFileSync(path.join(out,'walkthrough.html'),renderTemplate(template,plan,model,bundle.outputFiles[0].text));
  fs.copyFileSync(path.join(root,'THIRD-PARTY-NOTICES.md'),path.join(out,'THIRD-PARTY-NOTICES.md'));
}
