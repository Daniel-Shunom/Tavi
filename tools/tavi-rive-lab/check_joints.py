"""Native joint review: bent silhouettes change while shoe contacts stay fixed."""
from pathlib import Path
import os
import subprocess
from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parents[2]
rive=Path(os.environ['USERPROFILE'])/'.rive/bin/rive.exe'
for name,x in (('left',90),('right',510)):
    captures=[]
    for pose,clicks in (('rest',[]),('bent',['--pointer=click@528,552','--advance=60'])):
        capture=ROOT/f'build/joints-{name}-{pose}.png'
        subprocess.run([str(rive),str(ROOT/'art/tavi-rive-lab/interactive'),
            f'--screenshot={capture}','--advance=10',f'--pointer=click@{x},29','--advance=70',*clicks],
            check=True,capture_output=True)
        captures.append(Image.open(capture).convert('RGB'))
    difference=ImageChops.difference(*captures)
    def changed(box):
        return sum(max(pixel)>12 for pixel in difference.crop(box).get_flattened_data())
    def sole_rows(image):
        rows=[]
        for left,right in ((260,310),(310,355)):
            pixels=[y for y in range(525,545) for x in range(left,right)
                if (lambda rgb:rgb[2]-rgb[0]>25 and rgb[2]-rgb[1]>10)(image.getpixel((x,y)))]
            assert len(pixels)>30, 'Shoe contact control missing from capture'
            rows.append(max(pixels))
        return rows
    rest_contacts,bent_contacts=map(sole_rows,captures)
    elbows=changed((210,350,400,435))
    knees=changed((230,450,385,509))
    assert rest_contacts==bent_contacts, f'{name}: sole height changed: {rest_contacts} -> {bent_contacts}'
    assert elbows>200 and knees>200, f'{name}: bend pose did not execute'
    print(f'{name}: sole rows unchanged {rest_contacts}; {elbows} elbow-region and {knees} knee-region pixels changed')
print('Native joint/contact review passed in both directions.')
