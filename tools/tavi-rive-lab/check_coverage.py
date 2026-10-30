"""Native Rive coverage check. Requires Pillow; never alters the live rig.

The fixture highlights the original pelvis/leg geometry in green. Green pixels
in the covered hip region are a failure; visible green lower legs are a positive
control proving the fixture actually rendered. Five turn samples are checked
with both shoulders raised. This complements visual QA; it is not a blanket
claim about every animation or future costume.
"""
import argparse
from pathlib import Path
import os
import subprocess
import xml.etree.ElementTree as ET

from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--skip-render',action='store_true')
args=parser.parse_args()
project=ROOT/'build/tavi-coverage-check'
project.mkdir(parents=True,exist_ok=True)
tree=ET.parse(ROOT/'art/tavi-rive-lab/interactive/scene.rml')
for element in tree.getroot().iter('SolidColor'):
    if element.get('id') in ('0:663','0:9523','0:9524'):
        element.set('colorValue','FF00FF00')
tree.write(project/'scene.rml',encoding='unicode')
(project/'rive.yaml').write_text('name: coverage-check\nmain: "lyla animation"\n')
rive=Path(os.environ['USERPROFILE'])/'.rive/bin/rive.exe'
cases={
    'left':['--pointer=click@90,29','--advance=70','--pointer=click@528,580','--advance=60'],
    'right':['--pointer=click@510,29','--advance=70','--pointer=click@528,580','--advance=60'],
}
for name,frames in (('quarter-left',14),('mid',27),('quarter-right',41)):
    cases[name]=[*cases['left'],'--pointer=click@510,29',f'--advance={frames}']
for name,steps in cases.items():
    capture=ROOT/f'build/tavi-coverage-{name}.png'
    if not args.skip_render:
        result=subprocess.run([str(rive),str(project),f'--screenshot={capture}','--advance=10',*steps],
                              check=True,capture_output=True,text=True)
    with Image.open(capture) as image:
        image=image.convert('RGB')
        def count(box):
            pixels=image.crop(box)
            return sum(g>80 and g-r>70 and g-b>70
                       for r,g,b in pixels.get_flattened_data())
        leaks=count((200,330,400,430))
        control=count((200,470,400,510))
    print(f'{name}: {leaks} exposed pixels in covered region; {control} positive-control pixels')
    if leaks or control<100:
        raise SystemExit('Coverage check failed: inspect '+str(capture))
print('Five native turn samples passed with both shoulders raised.')
