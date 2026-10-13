# Blender公式MCPの接続

2026-10-14に[Blender公式ページ](https://www.blender.org/lab/mcp-server/)、[公式Setup](https://projects.blender.org/lab/blender_mcp/wiki/Setup)、公式ソース、[Codex MCP資料](https://developers.openai.com/codex/mcp)の本文を確認した。同じPC上のCodexから、起動中のBlenderを操作する手順。ここでは手順を保存しており、Windows/macOSでの実接続は未検証。

MCPを使ってBlenderを操作したいと依頼されたときに読む。通常の同梱CLI生成とブラウザ内覧はMCPを要求しない。「手順を保存して」「説明して」という依頼では端末の設定を変更しない。

## 接続の構成

```text
Codex ⇔ MCP/stdio ⇔ 公式blender-mcpサーバー ⇔ TCP ⇔ BlenderのMCPアドオン
```

BlenderにはLLM接続機能が標準内蔵されていない。必要な3要素はBlenderのアドオン、MCPサーバー、MCP対応AIクライアント。公式の提供元は`projects.blender.org/lab/blender_mcp`であり、同名の第三者プロジェクトを混ぜない。

| 用途 | 用意するもの |
| --- | --- |
| Blender側 | Blender5.1以降、公式MCPアドオン。このプラグインの生成検証版はBlender5.1系 |
| サーバーを公式ソースから起動 | Git、uv、Python3.10以降。Pythonはuvが対応版を管理できる |
| AI側 | ローカルのCodexアプリ・CLI・IDEなど、stdio対応クライアント |

公式はLLM生成コードがBlender内でガードなしに実行され、データの削除や外部送信を防ぐ仕組みがないと警告している。作業コピーを保存し、必要なデータだけを扱う環境を使う。公式は仮想マシン等の隔離環境を推奨している。導入・接続の依頼とホストの権限に従い、モデル変更の範囲もユーザーの依頼を守る。

## 1. 公式アドオンを導入し、Blender側を開始する

1. [公式ページのAdd-on](https://www.blender.org/lab/mcp-server/#add-on)から導入する。確認時の公開版はv1.0.3。[公式リリース](https://projects.blender.org/lab/blender_mcp/releases)で更新を確認し、アドオンとサーバーを対応する版に揃える。
2. 公式ページのドラッグ操作は、1回目がBlender Labリポジトリの追加、2回目がアドオンの導入。ダウンロードしたZIPをBlenderの「Install from Disk」で導入する方法もある。[拡張の公式導入資料](https://docs.blender.org/manual/en/latest/editors/preferences/extensions.html#install)を読む。
3. BlenderをGUIで起動し、PreferencesのAdd-onsで公式の「MCP」を有効化して設定を開く。
4. アドオンが要求するオンラインアクセスをPreferences → System → Networkの「Allow Online Access」で許可する。ソースでは`bpy.app.online_access`が無効なら起動を拒否する。ホストや組織のネットワーク方針を守る。
5. 設定のHost/Portは同じPC内の接続先にする。確認時の既定値は`localhost:9876`。Auto Startが有効なら自動開始する。停止中なら「Start MCP Bridge Server」を選び、「Server is running」を確認する。

通常のAuto Startはバックグラウンドモードでは働かない。本ガイドはGUIで起動したBlenderを対象とする。アドオンが実行されていることと、別プロセスのMCPサーバーが起動していることをそれぞれ確認する。

## 2. 公式サーバーとuvを用意する

[uv公式導入資料](https://docs.astral.sh/uv/getting-started/installation/)と[Git公式配布](https://git-scm.com/downloads/)を使い、既存の対応環境を再利用する。uvのWindows例は`winget install --id astral-sh.uv --exact`、既にHomebrewを使うMacの例は`brew install uv`。既存の運用方針に沿った導入方法を選び、導入後に新しい端末で`uv --version`を確認する。

公式ソース内の`mcp/`がサーバーのプロジェクト。以下は確認したv1.0.3のタグを新規保存先へ取得する例。配布版を更新するときは対応するタグ・アドオン・手順を再確認する。既存の同名フォルダや同名MCP設定がある場合は内容を確認して再利用し、無断で上書きしない。初回の`uv sync`は依存を取得し、必要に応じて対応Pythonも取得する。これはBlender内蔵Pythonとは別のサーバー用環境。

Windows PowerShell:

```powershell
$blenderMcpSource = Join-Path $env:USERPROFILE "blender_mcp"
git clone --branch v1.0.3 --depth 1 https://projects.blender.org/lab/blender_mcp.git $blenderMcpSource
$blenderMcpProject = Join-Path $blenderMcpSource "mcp"
$blenderMcpUv = (Get-Command uv.exe -CommandType Application | Select-Object -First 1).Source
& $blenderMcpUv --directory $blenderMcpProject sync
```

macOS:

```bash
blender_mcp_source="$HOME/blender_mcp"
git clone --branch v1.0.3 --depth 1 https://projects.blender.org/lab/blender_mcp.git "$blender_mcp_source"
blender_mcp_project="$blender_mcp_source/mcp"
blender_mcp_uv="$(command -v uv)"
"$blender_mcp_uv" --directory "$blender_mcp_project" sync
```

公式は`.mcpb`対応クライアント向けのサーバーバンドルも提供する。Codexでの`.mcpb`直接導入は、この手順では確認していない。ここでは公式Setupのstdio方式をCodexへ適用する。

## 3. Codexへstdioサーバーを登録する

先ほどの端末変数を保持した状態で実行する。Codex CLIが利用できる場合の例。

Windows PowerShell:

```powershell
codex mcp add blender_lab -- $blenderMcpUv --directory $blenderMcpProject run blender-mcp
codex mcp get blender_lab --json
codex mcp list --json
```

macOS:

```bash
codex mcp add blender_lab -- "$blender_mcp_uv" --directory "$blender_mcp_project" run blender-mcp
codex mcp get blender_lab --json
codex mcp list --json
```

公式Setupの起動コマンドは`uv --directory <公式ソース>/mcp run blender-mcp`。stdioプロセスはCodexが起動するため、別端末で同じプロセスを常駐起動する手順は不要。Blender GUIとアドオンのBridgeは起動したまま使う。

CLIがないアプリ利用者は、Codexの設定に次の内容を追加する方法もある。既定の設定ファイルはmacOSの`~/.codex/config.toml`、Windowsの`%USERPROFILE%\.codex\config.toml`。既存の設定を保持し、実在する絶対パスを使用する。同じCodexホストではアプリ・CLI・IDEが設定を共有する。別端末では設定と保存先を確認し直す。

macOSの例:

```toml
[mcp_servers.blender_lab]
command = "/absolute/path/to/uv"
args = ["--directory", "/absolute/path/to/blender_mcp/mcp", "run", "blender-mcp"]
startup_timeout_sec = 60
```

Windowsの例。単一引用符のTOML文字列を使い、バックスラッシュを保持する:

```toml
[mcp_servers.blender_lab]
command = 'C:\path\to\uv.exe'
args = ['--directory', 'C:\path\to\blender_mcp\mcp', 'run', 'blender-mcp']
startup_timeout_sec = 60
```

`$HOME`や`%USERPROFILE%`をJSON/TOMLのパスへそのまま書くと、クライアントが展開しない場合がある。シェルで求めた実パスを使う。Windowsで`codex.ps1`の実行制限に当たる場合は、利用可能な`codex.cmd`・ネイティブ実行ファイル・設定ファイル編集を選び、実行ポリシーの恒久変更を必須にしない。

確認時のBlender BridgeのTCP既定値は`localhost:9876`。これはCodexに`--url http://localhost:9876`で登録するHTTP MCPエンドポイントではない。BridgeのHost/Portを変えたときは、サーバープロセスの`BLENDER_MCP_HOST`・`BLENDER_MCP_PORT`も揃える。Codexのstdio設定なら、対象サーバーの`env`を使える:

```toml
[mcp_servers.blender_lab.env]
BLENDER_MCP_HOST = "localhost"
BLENDER_MCP_PORT = "9876"
```

WSLを使う場合は、Blender Bridgeとサーバーが通信できる実行環境を揃える。WindowsのBlenderとWSLのサーバーを混在させた接続は未検証。同じPC内のWindowsネイティブ環境で始める。別PCやクラウドからの接続は、本ガイドのstdio・localhost設定をそのまま使わず、公式の対応transportと接続経路を確認する。

## 4. 接続を確認する

1. Blenderのアドオンが実際に待受していることを確認する。
2. Codexの新しいセッションでMCPを読み込み、CLIなら`/mcp`でactiveなサーバーと公開ツールを確認する。アプリではMCP設定を反映したセッションでツールの利用可否を確認する。
3. 公式の読み取りツール`get_objects_summary`で、Blenderの現在のコレクションとオブジェクトが返ることを確認する。初回は次のように依頼する。

> Blender MCPの接続を確認して。get_objects_summaryで現在のシーンのコレクション・オブジェクト名と種類だけを読み取り、結果を示して。モデルの変更・削除・保存はしないで。

設定一覧への表示、MCPの初期化、Blenderシーンの取得成功を分けて記録する。接続成功は実際にBlenderからデータが返った段階。起動したアドオンだけを見て接続完了としない。

接続できない場合は、uvの実行パス、公式ソースの`mcp/`、依存取得、Blenderアドオンの有効状態・オンラインアクセス・Host/Port・開始状態を順に確認する。エラーを記録し、設定やファイアウォールを無断で変更しない。

接続後のモデル編集は依頼範囲に従う。3D内覧の完成条件は引き続き[品質チェック](quality.md)の原図照合・材質・全室歩行・全建具開閉で確認する。接続成功だけでは3Dモデルや内覧の品質検証は完了しない。

## 根拠と確認状態

- [Blender公式MCPページ](https://www.blender.org/lab/mcp-server/): 3要素、Blender5.1以降、アドオン導入、公式の実行リスク。
- [公式Setup](https://projects.blender.org/lab/blender_mcp/wiki/Setup): stdioのclone先とuv起動引数。
- [公式ソース](https://projects.blender.org/lab/blender_mcp): v1.0.3タグの`mcp/pyproject.toml`のPython要件・entrypoint、`addon/blender_mcp_addon/__init__.py`のGUI設定・開始、`mcp/blmcp/tools_helpers/connection.py`のTCP既定値・環境変数、`mcp/blmcp/tools/get_objects_summary.py`の読み取りツールを確認。接続に使うAPI・manual・prompt資料もタグに収録されている。
- [Codex MCP](https://developers.openai.com/codex/mcp): stdio登録、設定場所と共有、`command/args/env`、CLIの確認。`codex mcp add/get/list --help`でも構文を確認。
- [uv公式導入資料](https://docs.astral.sh/uv/getting-started/installation/): WindowsのWinGetとMacのHomebrew導入、uvのPython管理。

保存した手順は公式資料・ソース・CLIヘルプで確認済み。この端末へのMCP登録、アドオン導入、Windows/macOS実機での接続・モデル操作は実施していない。MCPサーバー・アドオン・個人の設定ファイルは配布ZIPへ同梱しない。
