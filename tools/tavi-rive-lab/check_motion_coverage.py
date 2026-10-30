"""Native knee/upper-leg coverage samples for the original skirt and tucked knees."""
from pathlib import Path
import argparse
import os
import subprocess
import xml.etree.ElementTree as ET
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
CASES={'climb-front':('climbing-front',150),'climb-rear':('climbing-rear',210),
       'climb-down':('climbing-rear',450),'walk-right':('walking',140),
       'skip-step':('locomotion',86),'skip-launch':('locomotion',98),
       'skip-flight':('locomotion',110),'skip-contact':('locomotion',138),
       'skip-wide':('locomotion',162),'skip-left':('locomotion',422)}
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--case',choices=CASES)
args=parser.parse_args()
rive=Path(os.environ['USERPROFILE'])/'.rive/bin/rive.exe'
for name,(source,frame) in CASES.items():
    if args.case and args.case!=name:continue
    tree=ET.parse(ROOT/f'art/tavi-rive-lab/{source}/scene.rml')
    board=tree.getroot().find('Artboard');objects={e.get('id'):e for e in board.iter() if e.get('id')}
    for id in ('0:663','0:9523','0:9524'):objects[id].set('colorValue','FF00FF00')
    marker=ET.SubElement(board,'Shape',x='15',y='585',id='99:1')
    ET.SubElement(marker,'Ellipse',width='12',height='12',id='99:2')
    fill=ET.SubElement(marker,'Fill',id='99:3')
    ET.SubElement(fill,'SolidColor',colorValue='FF00FF00',id='99:4')
    project=ROOT/f'build/motion-coverage-{name}';project.mkdir(parents=True,exist_ok=True)
    tree.write(project/'scene.rml',encoding='unicode')
    (project/'rive.yaml').write_text('name: motion-coverage\nmain: "lyla animation"\n')
    capture=ROOT/f'build/motion-coverage-{name}.png'
    subprocess.run([str(rive),str(project),f'--screenshot={capture}',f'--advance={frame}'],capture_output=True,check=True)
    image=Image.open(capture).convert('RGB')
    color=objects['37:14'].get('colorValue')[-6:]
    rgb=tuple(int(color[i:i+2],16) for i in (0,2,4))
    cloth=[(x,y) for y in range(image.height) for x in range(image.width) if image.getpixel((x,y))==rgb]
    assert cloth,'Garment did not render'
    hem=max(y for x,y in cloth)
    def green(box):return sum(g>80 and g-r>70 and g-b>70 for r,g,b in image.crop(box).get_flattened_data())
    leaks=green((40,0,image.width,hem-1));control=green((5,575,25,595))
    print(f'{name}: {leaks} exposed leg/pelvis pixels above hem {hem}; {control} control pixels',flush=True)
    assert control>50,'Native fixture did not render'
    assert leaks<=1,'Knee coverage failed; inspect '+str(capture)
print('Sampled climbing, walking, and skipping poses retain knee/upper-leg coverage.')
