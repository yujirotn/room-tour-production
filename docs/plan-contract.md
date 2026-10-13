# 入力契約 v1

公開サンプルは新規の架空住宅。顧客図面・既存案件の座標は使用しない。

- `version: "1.0"`, `units: "m"`, `project: {name}`。
- 平面座標 `[x,z]`、Three.js高さY、Blender高さZ。数値はメートル。
- `floors[]`: `{id,name,elevation,wallHeight,boundary,rooms,walls,fixtures?}`。
- `boundary`: 平面の単純な直交多角形。`rooms[]`: `{id,name,polygon,position}`。polygonも直交。positionは室内の安全な歩行開始位置。壁も直交に限定する。
- `walls[]`: `{id,start,end,thickness,openings?}`。壁高はfloor.wallHeight。
- `openings[]`: `{id,name,kind,offset,width,height,bottom,operation?,hinge?,swing?,slide?}`。
- kind=`door` または `window`。offsetはstartから壁方向の距離。
- door operation=`hinged` または `sliding`。hinge=`start`/`end`、swing=`1`/`-1`、slide=`1`/`-1`。window operation=`fixed`のみ。開閉可能な窓・折戸・曲線階段はv1非対応として入力検証で明示する。
- `fixtures[]`: `{id,type,position,size,rotation?}`。positionは床上の中心[x,z]。sizeは[幅,奥行,高さ]。rotationはラジアン。type=`kitchen`,`sofa`,`table`,`bed`,`toilet`,`basin`,`bath`,`cabinet`。図面記載/承認されたものだけ配置。
- `stairs[]`: `{id,fromFloor,toFloor,start,end,width,steps}`。start/endは平面で昇り方向。直線階段のみ。上階床と下階天井に階段開口を作る。
- `assumptions[]`: 高さ/内装/設備等の補完根拠と承認状況の説明。図面とモデルの照合は案件別。

GLBメッシュextras: `floorId`, `modelRole` (`wall`,`floor`,`ceiling`,`fixture`,`stair`,`door`,`window`,`trim`)、`openingId` (可動建具の子メッシュに指定)。建具の全パーツをまとめて動かす。

Builder入口: Blender `--background --python runtime/blender/build_model.py -- --plan PATH --out DIR`。model.blend/model.glbと品質manifestを生成。CLIが先に入力検証する。
Viewer入口: HTMLの`plan-data` JSON、`model-data` GLB base64。Three.js0.179.1。単一HTML、外部通信なし。GLB全パーツと境界で衝突、直線階段連続移動、開き戸/引戸は個別に操作。操作エラーは画面に表示する。
