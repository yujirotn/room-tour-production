# 同梱処理の実行

初回は[初期設定](setup.md)でOSと不足ソフトを確認する。新規生成にはNode.js22以降・npm・Blender5.1系が必要。Blender内蔵Pythonを使うので別途Pythonは不要。完成HTMLの閲覧には生成環境を要求しない。

スキルのルートから`../../runtime`が処理ディレクトリ。runtimeを案件用ディレクトリへコピーして実行し、プラグインのキャッシュや公開repoへ顧客成果物を保存しない。以下はコピーしたruntime内で実行する。OSやCPUが異なる環境の`node_modules`はコピーせず、コピー先で依存を導入する。

## macOS/Linux

```bash
node scripts/doctor.mjs --json
npm ci --ignore-scripts
node scripts/doctor.mjs --json
npm test
node scripts/validate.mjs "/absolute/path/plan.json"
node scripts/build.mjs --plan "/absolute/path/plan.json" --out "/absolute/path/output"
```

macOSは標準のBlenderアプリ位置、他環境はPATHから検出する。異なる場所なら診断・生成の両方に`--blender "/path/to/blender"`を指定する。

## Windows PowerShell

Blenderの実在する実行ファイルを指定する。次の例のパスは環境に合わせて変更する。

```powershell
$blenderPath = "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
node scripts/doctor.mjs --json --blender $blenderPath
npm.cmd ci --ignore-scripts
node scripts/doctor.mjs --json --blender $blenderPath
npm.cmd test
node scripts/validate.mjs "C:\RoomTour\case\plan.json"
node scripts/build.mjs --plan "C:\RoomTour\case\plan.json" --out "C:\RoomTour\case\output" --blender $blenderPath
```

WSLではNode/npmとBlenderをWSL側に揃える。Windows側にあるだけでWSLの依存を満たしたと判断しない。Windows実機での生成・ブラウザ操作は未検証。

## 生成と検品

同梱依存はThree.js0.179.1・esbuild0.25.9。初回のnpm依存導入にはネット接続が必要。診断は読み取り専用で、外部ダウンロードや設定変更を行わない。診断で依存が不足していたら導入後に再実行し、成功を確認して生成へ進む。

`--render`を生成コマンドに追加するとCycles静止画も保存する。既存HTMLがある出力先は上書きせず停止する。

生成物は`model.blend`、`model.glb`、`walkthrough.html`、`plan.json`、画像材質、品質manifest、`model-validation.json`。GLBの材質・画像・階metadata・可動meshを検査する。HTMLはThree.js・モデル・画像を内包し、外部取得も顧客データ送信も行わない。

最終HTMLをブラウザで直接開き、[品質チェック](quality.md)に沿って図面比較、各室の歩行、全建具の開閉、意匠と描画を確認する。`npm test`の成功やモデル生成成功は、案件の最終検品と区別する。
