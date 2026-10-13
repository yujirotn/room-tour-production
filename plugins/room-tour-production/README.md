# 住宅ルームツアー

Codexの制作スキルとローカル生成処理を同梱したプラグインです。

入口は [SKILL.md](skills/room-tour-production/SKILL.md)。初回は[初期設定](skills/room-tour-production/references/setup.md)でOSと不足ソフトを確認し、公式配布元から導入して環境診断を行います。AIには「このリポジトリで初期設定して、不足ソフトを公式から導入し、検証後に図面から制作して」と依頼できます。PC操作ができないAIは公式リンクと手順を案内します。

新規生成にはNode.js22以降・npm・Blender5.1系が必要です。PythonはBlender内蔵版を使用します。Gitはclone/GitHub marketplaceの取得時だけ、Codexはプラグイン利用時だけ用意します。完成HTMLの閲覧にはブラウザだけで十分です。

runtimeを作業用フォルダへコピーし、macOS/Linuxは`npm ci --ignore-scripts`、Windowsは`npm.cmd ci --ignore-scripts`で依存を導入します。`node scripts/doctor.mjs --json`で診断後、テストと架空サンプル生成へ進みます。WindowsのBlenderは`--blender`指定を使用してください。詳細は[実行方法](skills/room-tour-production/references/runtime.md)を参照。Windows実機での生成・操作は未検証です。

[v1.1.0のプラグインZIPとデモ](https://github.com/yujirotn/room-tour-production/releases/tag/v1.1.0) / 顧客図面・メーカー部品は同梱していません。

[公開リポジトリと導入方法](https://github.com/yujirotn/room-tour-production) / [MIT](LICENSE) / [第三者ライセンス](runtime/THIRD-PARTY-NOTICES.md)
