"""Native seated-clothing coverage check; highlighted geometry stays in fixtures."""
from pathlib import Path
import os
import subprocess
import xml.etree.ElementTree as ET
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
rive=Path(os.environ['USERPROFILE'])/'.rive/bin/rive.exe'
for view in ('left','right'):
    tree=ET.parse(ROOT/f'art/tavi-rive-lab/seating-{view}/scene.rml')
    objects={e.get('id'):e for e in tree.getroot().iter() if e.get('id')}
    for id in ('0:663','0:9523','0:9524'):objects[id].set('colorValue','FF00FF00')
    for sock in ('0:13119','0:13201'):
        for color in objects[sock].iter('SolidColor'):color.set('colorValue','FF00FF00')
    project=ROOT/f'build/seated-coverage-{view}';project.mkdir(parents=True,exist_ok=True)
    tree.write(project/'scene.rml',encoding='unicode')
    (project/'rive.yaml').write_text('name: seated-coverage\nmain: lyla animation\n')
    color=objects['37:14'].get('colorValue')[-6:]
    skirt_rgb=tuple(int(color[i:i+2],16) for i in (0,2,4))
    for frame in (66,72,120,240,246):
        capture=ROOT/f'build/seated-coverage-{view}-{frame}.png'
        subprocess.run([str(rive),str(project),f'--screenshot={capture}',f'--advance={frame}'],capture_output=True,check=True)
        image=Image.open(capture).convert('RGB')
        # Read the actual hem as it rises/falls, rather than treating calves
        # legitimately below the moving garment as exposed upper legs.
        hem=max(y for y in range(370,490) for x in range(240,540) if image.getpixel((x,y))==skirt_rgb)
        def green(box):return sum(g>80 and g-r>70 and g-b>70 for r,g,b in image.crop(box).get_flattened_data())
        leaks=green((240,340,540,hem-1));control=green((240,hem+2,540,530))
        print(f'{view} frame {frame}: {leaks} exposed pixels above hem {hem}; {control} control pixels',flush=True)
        assert control>100,'Highlight fixture did not render'
        assert leaks<=1,'Clothing coverage failure; inspect '+str(capture)
print('Both seated side views and sit/stand transitions cover the body above the hem.')
