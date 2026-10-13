import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTemplate} from '../scripts/assemble-html.mjs';
test('ドル記号やplaceholder名が入力・バンドルにあっても生成を壊さない',()=>{
  const plan={project:{name:"Price $' $& {{MODEL}} <b>"}},js="const $=true;console.log($&&true); // $& $' {{PLAN}}";
  const html=renderTemplate('<title>{{TITLE}}</title><script id="plan-data" type="application/json">{{PLAN}}</script><script>{{SCRIPT}}</script>',plan,Buffer.from('data'),js);
  const json=html.match(/type="application\/json">([\s\S]*?)<\/script>/)[1];assert.deepEqual(JSON.parse(json),plan);assert.ok(html.includes(js));assert.ok(html.includes('&lt;b&gt;'));
});
test('script終了タグをJSONとviewerの中から出さない',()=>{
  const plan={project:{name:'</script><script>attack</script>'}};
  const html=renderTemplate('<script>{{PLAN}}</script><script>{{SCRIPT}}</script>',plan,Buffer.from(''),"const label='</script>';");
  assert.equal((html.match(/<\/script>/g)||[]).length,2);
});
