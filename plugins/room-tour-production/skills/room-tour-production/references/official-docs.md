# 実装時に読む公式資料

2026-10-14に本文確認。対象実装: Blender 5.1系、Three.js r179、Node.js22以降。バージョンを変える場合は該当版を再確認する。

- [OpenAI: Package your plugin](https://developers.openai.com/plugins/build/plugins): ルートAgent Plugins manifest、Codex互換manifest、スキル発見、repository marketplaceの相対パス。
- [OpenAI: Plugin management](https://learn.chatgpt.com/docs/enterprise/plugin-management#supported-formats): GitHub経由のmarketplace配布と対応形式。
- [Blender glTF](https://docs.blender.org/manual/en/5.1/addons/import_export/scene_gltf2.html): Principled BSDFのMetal/Rough材質、画像・UV、+Y up、カスタムpropertiesのextras保存。現行版では[こちら](https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html)も確認する。
- [Blender Cycles sampling](https://docs.blender.org/manual/en/5.1/render/cycles/render_settings/sampling.html): adaptive sampling、noise threshold、denoising。静止画は96 samples・noise threshold0.015・OpenImageDenoiseを初期設定とする。見た目を確認して案件ごとに調整する。
- [Three.js r179 color management](https://github.com/mrdoob/three.js/blob/r179/manual/en/color-management.html): 光計算はLinear-sRGB、表示と色画像はsRGB。GLTFLoaderが読み込む材質の色空間を保持する。
- [Three.js r179 WebGLRenderer](https://github.com/mrdoob/three.js/blob/r179/docs/api/en/renderers/WebGLRenderer.html): sRGB出力、ACES tone mapping、shadow map。高解像度が適切かブラウザで確認する。
- [Three.js r179 PMREMGenerator](https://github.com/mrdoob/three.js/blob/r179/docs/api/en/extras/PMREMGenerator.html): 粗さに対応した環境反射。RoomEnvironmentから環境マップを生成する。
- [Three.js r179 GLTFLoader](https://github.com/mrdoob/three.js/blob/r179/docs/examples/en/loaders/GLTFLoader.html): GLBモデル、PBR材質、extrasの読み込み。

公式資料はAPIの根拠であり、個別図面の正確性・最終描画品質を保証するものではない。図面照合、材質比較、実際の歩行・開閉の記録を別に残す。
