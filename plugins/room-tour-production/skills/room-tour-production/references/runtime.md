# 同梱処理の実行

スキルのルートから`../../runtime`が処理ディレクトリ。作業先は案件フォルダにする。プラグインのキャッシュ内を編集して成果物を保存しない。

1. Blender5.1系、Node.js22以降、npmが使えることを確認。
2. runtimeを案件の作業用ディレクトリへコピーし、必要な依存を導入。
3. 同梱の固定バージョンを`npm ci --ignore-scripts`で導入する。Three0.179.1・esbuild0.25.9。
4. `node scripts/validate.mjs /absolute/path/plan.json`。
5. `node scripts/build.mjs --plan /absolute/path/plan.json --out /absolute/path/output`。
6. 任意で`--render`を追加し、Cycles静止画も保存する。
7. 最終HTMLをブラウザで開いて操作検証。必要なら`python3 -m http.server 8768 --bind 127.0.0.1 --directory /absolute/path/output`でローカル配信する。

BlenderはmacOSの標準アプリ位置またはPATHを使用し、`--blender`/`BLENDER_BIN`も指定可能。外部ダウンロードや顧客データ送信は生成処理に含まれない。初回npmインストールにはネット接続が必要。

生成物: model.blend, model.glb, walkthrough.html, plan.json, material/texture資材、品質manifest、model-validation.json。GLBの材質・画像・階metadata・可動meshを検査する。HTMLはThree.jsとモデルを内包し、画像・モデルを外部へ取得しない。

`npm test`は入力検証・歩行・建具の基本動作を検証する。図面の忠実度、すべての部屋の開始位置、意匠・画面描画は案件で追加確認する。生成成功は納品検品の完了と区別する。
