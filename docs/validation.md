# v1.0.0 検証記録

2026-10-14、macOS、Blender5.1.2、Node22.17.0、Three0.179.1、esbuild0.25.9、Chrome。

## 生成と構造

- 新規の架空2階住宅を、入力検証→Blender生成→GLB検査→実モデル境界での歩行検査→単一HTMLまで通し生成。
- 413メッシュ、13材質、独自画像テクスチャ4枚、可動建具4つ。
- Cycles96 samples・adaptive0.015・OpenImageDenoise静止画を保存。
- 上階床・下階天井の階段穴、全壁の開口を確認。
- HTMLのJavaScript構文正常。埋込PLANはサンプルJSON、埋込GLBは生成GLBとバイト一致。外部画像・モデルURIなし。
- 公式Agent Plugins1.0スキーマでmanifest検証。Codex互換manifest、marketplace、スキルの配置と参照を確認。

## 自動テスト

21件成功。入力の誤寸法/重複ID/部屋外開始位置/非単純多角形/境界外設備/階段、建具の閉・開・途中状態と人体への接触停止、壁への衝突、階段昇降・側方離脱防止、3階の重層階段、HTMLの特殊文字とscript終了タグを検証。

実GLBの334個の衝突形状で、全6室の開始位置と階段上下動作も成功。自動検査は図面の正確性や意匠品質の全保証ではない。

## 実ブラウザ

全6室に移動、4建具を全開→全閉まで実操作。WASD、ドラッグ、Eキー、戸クリック、建具一覧、階切替、Escを確認。

LDK戸の前で閉状態はX2.82mで停止、開くとX3.10mのLDK側へ通行。閉鎖範囲に人体があると途中停止し、建具一覧・近傍操作とも「途中で停止」を表示。階段は下端から上階の床まで歩いて上り、1階へ歩いて戻った。

室内の木目・金具・枠・巾木・ガラスを確認。初回に見つかった壁セルの継ぎ目と木目方向を修正し、最終モデル・HTMLで再確認。

- [操作記録](demo/browser-validation.json)
- [モデル検査](demo/model-validation.json)
- [実モデル歩行検査](demo/navigation-validation.json)
- [品質manifest](demo/quality-manifest.json)
- [最終全体画面](demo/browser-overview.png)
- [歩行・戸開閉画面](demo/walk-and-door.png)
- [Cycles静止画](demo/preview.png)

macOSでの検証。Windows/LinuxでのBlender実行とCodexアプリへの実インストールは未検証。サンプルは実在住宅の転用ではなく、実案件では原図との照合と案件ごとの操作検証が必要。

## v1.1.0 初期設定の追加

2026-10-14。GitHubをAIへ渡す依頼文、AGENTS.md、制作スキルの初期設定手順、OS別の読み取り専用チェック、Node導入後のdoctorを追加した。診断スクリプトはダウンロード・インストール・OS設定変更を行わない。不足ソフトの公式配布元と手順を示し、AIが利用者の依頼とホストの権限に沿って導入を進める。

- Nodeテストは30件成功。追加9件はWindowsのBlender探索、空白・日本語を含む実行パス、対応バージョン、欠落依存、package.json非公開の依存パッケージ、実行可能なesbuildの確認を検証。
- macOSでdoctorの成功と、存在しないBlender指定時の失敗・公式導入案内を確認。
- 更新したCLIから架空住宅のBlenderモデル・GLB・HTMLを通し生成し、モデル検査と全室・階段の歩行検査も成功。GLBのnodes・meshes・materials・accessorsはv1.0.0サンプルと一致。
- ブラウザ表示・歩行・建具のコードは変更していない。公開デモと上記の実ブラウザ検証記録はv1.0.0のものを継続して使用する。

Windowsのパス探索はテスト上の確認であり、Windows実機での導入・生成・操作確認を代替しない。Codexへの実インストールも未検証。
