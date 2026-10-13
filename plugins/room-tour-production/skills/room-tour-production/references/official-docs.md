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

## 初期設定の公式資料

- [OpenAI: AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md): repoルートへの指示配置。初期設定はユーザーが利用・導入を依頼したときに限り、ホストの権限を優先する。
- [OpenAI: Codex CLI](https://developers.openai.com/codex/cli/): プラグイン用の導入とサインイン。runtime単独実行やHTML閲覧にはCodexを要求しない。
- [Node.js Download](https://nodejs.org/en/download): OS・CPUに合う22以降のLTSとnpmを案内する。
- [Blender Installing](https://docs.blender.org/manual/en/5.1/getting_started/installing/index.html)、[Windows](https://docs.blender.org/manual/en/5.1/getting_started/installing/windows.html)、[macOS](https://docs.blender.org/manual/en/5.1/getting_started/installing/macos.html): 5.1系の公式配布とOS別導入手順。macOSはIntel/Apple Siliconを区別する。
- [Git Downloads](https://git-scm.com/downloads/): clone/marketplace取得時だけ導入方法を案内する。
- [Microsoft: WinGet install](https://learn.microsoft.com/en-us/windows/package-manager/winget/install): OSの診断とインストールを区別し、版を指定せず最新Blenderを導入しない。自動同意フラグを診断に混ぜない。
- [esbuild: Additional npm flags](https://esbuild.github.io/getting-started/#additional-npm-flags): 固定依存は`npm ci --ignore-scripts`で導入し、optional dependenciesを省略しない。`node_modules`を異なるOS・CPU・Windows/WSL間で流用しない。

具体的な診断と不足ソフトの導入は[初期設定](setup.md)に従う。診断成功とWindows実機での生成・操作検証は区別する。

## 任意のBlender MCP接続

- [Blender公式: MCP Server](https://www.blender.org/lab/mcp-server/): Blender5.1以降・アドオン・LLMクライアント・MCPサーバーの構成。Blender内蔵機能ではない。公式ページからアドオンとサーバーの配布先を辿り、LLM生成コード実行に関する注意を確認する。

具体的な導入方法と公式配布リンクは[Blender MCPの接続手順](blender-mcp.md)へ。接続を依頼された場合だけ設定し、通常のCLI生成の依存へ追加しない。手順保存済みと実接続確認済みを区別する。
