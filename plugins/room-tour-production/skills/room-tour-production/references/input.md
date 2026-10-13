# 入力JSON v1

同梱`runtime/examples/demo-plan.json`とリポジトリ`docs/plan-contract.md`が完全な例と契約。平面座標は`[x,z]`、高さはThree.jsのY、すべてメートル。

| 項目 | 必須内容 |
|---|---|
| root | version=`1.0`, units=`m`, project.name, floors |
| floor | 一意id、階名、elevation、wallHeight、boundary、rooms、walls |
| room | 一意id、name、polygon、安全な歩行開始position |
| wall | 一意id、start/end、thickness、openings |
| opening | 一意id、name、kind、offset、width/height/bottom、operation |
| hinged door | hinge=start/end、swing=1/-1 |
| sliding door | slide=1/-1。戸の収納先を含む壁長を確認 |
| fixed window | operation=fixed。窓下端をbottomで指定 |
| fixture | 一意id、type、position、size=[幅,奥行,高さ]、rotation任意 |
| stair | 一意id、fromFloor/toFloor、start/end、width、steps |
| assumptions | 補完した仕様、その根拠と承認状況の説明 |

建具は壁のstartからendへの方向を基準にする。開き戸swingはブラウザのY軸回転方向、引戸slideは壁方向の符号。枠と葉は別mesh、動く全パーツにopeningIdを保持する。固定枠は動かさない。開閉方向が図面で不明な場合は確認するか、ユーザーが許可した参考設定として明示する。

fixture type: kitchen, sofa, table, bed, toilet, basin, bath, cabinet。単純形状の参考設備として生成し、寸法・位置を図面と照合する。sizeや位置を生成処理へ合わせて無断で縮小・移動しない。

階段は直線のみ。上階床・下階天井を開口し、踏板・手摺を配置する。踏面・蹴上の数値チェックは参考検算であり、法令適合の判定ではない。頭上空間と出入口を図面と最終モデルで確認する。

IDは案件内で重複させない。元図の部屋・壁・開口の対応を別の図面照合メモへ記録する。顧客名や図面は公開サンプルへ混ぜない。
