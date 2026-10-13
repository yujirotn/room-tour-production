# 初期設定と不足ソフトの導入

制作またはセットアップを依頼されたときに使う。単なるリポジトリ閲覧やコードレビューではソフトを導入しない。ユーザーの指示・既存環境・ホストの権限を優先する。

## 何が必要か

| 用途 | 必要なもの |
| --- | --- |
| 完成済み`walkthrough.html`を閲覧 | WebGL2対応ブラウザ。Node.js・Blender・Git・Codexは不要 |
| 図面から新規生成 | Node.js22以降・npm・Blender5.1系 |
| GitHubをclone / marketplaceで取得 | Git。ZIP展開でruntimeを使う場合は不要 |
| Codexプラグインとして利用 | プラグイン対応Codex環境。runtime単独実行には不要 |

通常のCLI生成ではBlender内蔵Pythonを使用し、別途Pythonの導入は不要。任意のMCPサーバー用Pythonは下の接続手順で確認する。

## Blender MCPを使う場合だけ

BlenderシーンをAIから直接操作するための任意の接続。[Blender公式MCP資料](https://www.blender.org/lab/mcp-server/)に基づく[接続手順](blender-mcp.md)を読む。Blender5.1以降に加え、公式アドオン・LLMクライアント・MCPサーバーが必要で、通常のCLI生成の必須依存には含めない。MCPサーバーの導入方法ごとの依存は接続手順で確認する。

ユーザーが接続を依頼した場合だけ、最新の公式資料とLLM生成コード実行に関する注意を確認し、既存の承認・ホストの権限に従って設定する。接続方法の保存・説明だけでは導入や設定を行わない。PC操作できないAIは公式リンクと使用クライアント向けの手順を案内する。実接続は未検証。

## AIが進める順序

1. OS・CPU・シェル、PC操作ツールと既存ソフトを確認する。WindowsネイティブとWSLを区別する。
2. 不足ソフト名、用途、下記の公式配布元、導入手順を示す。既存の対応バージョンは再利用する。
3. 「初期設定して、不足ソフトを公式から導入して」と依頼されていれば、ホストの権限と環境変更方針に沿って導入を進める。必要な管理者操作が実行できない場合は、その操作を具体的に案内する。
4. 新しい端末を開き、バージョンと実行ファイルの場所を確認する。Node導入後にdoctor、固定npm依存導入後にdoctorとテストを実行する。
5. 架空サンプルを生成してHTMLの歩行・建具開閉を確認した後、[制作スキル](../SKILL.md)へ進む。

端末やPC操作ができないAIは、この順序の公式リンクとコマンドをユーザーに提示する。OS不明なら最初に確認する。ユーザーが実行した結果を受け取るまで、導入・診断・生成の成功を主張しない。

## 公式配布元

- [Node.js公式ダウンロード](https://nodejs.org/en/download): OSとCPUに合う22以降のLTSを選び、Windowsは`.msi`、macOSは`.pkg`など公式インストーラーを使用する。npmを含む構成を選ぶ。
- [Blender公式リリース](https://www.blender.org/download/releases/) / [5.1系の公式配布](https://download.blender.org/release/Blender5.1/): OSとCPUに合う5.1系を選ぶ。[Windows導入資料](https://docs.blender.org/manual/en/5.1/getting_started/installing/windows.html) / [macOS導入資料](https://docs.blender.org/manual/en/5.1/getting_started/installing/macos.html)も読む。WindowsのインストーラーまたはZIP、macOSのディスクイメージを使う。
- [Git公式導入ページ](https://git-scm.com/downloads/): clone/marketplace取得を使う場合だけ参照する。macOSは公式ページが案内する配布方法を使用する。
- [Codex公式導入資料](https://developers.openai.com/codex/cli/): プラグイン利用時だけ導入・サインインする。認証はユーザー自身が行い、アカウント情報を保存しない。

## まず読み取り専用で診断

リポジトリZIPまたはcloneを開き、`plugins/room-tour-production/runtime`へ移動する。Nodeが未導入でも、OS付属シェルで不足ソフトの案内を表示できる。

Windows PowerShell:

```powershell
.\setup\check-windows.ps1
```

macOS:

```bash
bash setup/check-macos.sh
```

必要ならWindowsは`-Blender "C:\path\to\blender.exe"`、macOSは`--blender "/path/to/blender"`を診断スクリプトに渡す。`BLENDER_BIN`も利用できる。

これらは不足確認と公式リンク・手順の表示だけを行う。ダウンロード、インストール、OS設定変更は行わない。PowerShellの実行制限で起動できなければ、組織やホストの方針に従って許可された方法を使う。設定を無断変更せず、下のバージョン確認と公式リンクでも導入を案内できる。

## 導入後に確認してサンプルを生成

macOS/Linux:

```bash
node --version
npm --version
node scripts/doctor.mjs --json
npm ci --ignore-scripts
node scripts/doctor.mjs --json
npm test
npm run demo
```

Windows PowerShellでは、Blenderの実在するパスへ変更して実行する。

```powershell
$blenderPath = "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
node --version
npm.cmd --version
& $blenderPath --version
node scripts/doctor.mjs --json --blender $blenderPath
npm.cmd ci --ignore-scripts
node scripts/doctor.mjs --json --blender $blenderPath
npm.cmd test
node scripts/build.mjs --plan examples/demo-plan.json --out output/demo --blender $blenderPath
```

依存導入前のdoctorでnpmパッケージ不足が出る場合は、`ci --ignore-scripts`後に再診断する。Node/npm・Blender・固定npm依存が揃ったことを確認して生成する。OSやCPUの異なる環境から`node_modules`をコピーしない。初回のnpm依存導入にはネット接続が必要。

`output/demo/walkthrough.html`をブラウザで開く。これは架空サンプルであり、実案件の図面照合を代替しない。出力先に既存のHTMLがある場合は別名の`--out`を指定する。診断だけではWindowsの生成・操作を検証したことにならない。Windows実機は未検証。

WSLを使う場合はNode/npmとBlenderを同じWSL環境へ導入する。Windows版BlenderとWSL版Nodeを混在させず、[Linux導入資料](https://docs.blender.org/manual/en/5.1/getting_started/installing/linux.html)を参照する。`node scripts/doctor.mjs --json --blender "/path/to/blender"`と生成もWSL内で実行する。

プラグイン登録のコマンドと図面の依頼例は[公開README](https://github.com/yujirotn/room-tour-production#インストール)へ。実案件のコマンドは[実行方法](runtime.md)へ進む。
