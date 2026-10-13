"""Package only the distributable plugin, excluding local generated/customer data."""
import argparse
import json
import zipfile
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('--out',type=Path,required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]/'plugins'/'room-tour-production'
manifest=json.loads((root/'plugin.json').read_text())
assert manifest['name']==root.name
excluded={'node_modules','output','__pycache__','.git'}
files=[]
for file in sorted(root.rglob('*')):
    relative=file.relative_to(root)
    if any(p in excluded for p in relative.parts) or file.suffix in {'.pyc','.zip','.pdf','.dxf','.dwg'} or file.name=='.DS_Store':continue
    if file.is_symlink():raise SystemExit('Symlinks are not allowed: '+str(relative))
    if file.is_file():files.append(file)
if args.out.resolve().is_relative_to(root):raise SystemExit('Archive must be outside plugin root')
args.out.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(args.out,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for file in files:z.write(file,root.name+'/'+str(file.relative_to(root)))
with zipfile.ZipFile(args.out) as z:
    assert z.testzip() is None
    assert root.name+'/plugin.json' in z.namelist()
    assert root.name+'/.codex-plugin/plugin.json' in z.namelist()
print(json.dumps({'archive':str(args.out),'files':len(files),'bytes':args.out.stat().st_size}))
