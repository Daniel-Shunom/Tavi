"""Check the emitted Rive walking animation, including world-space contacts."""
from pathlib import Path
import math
import argparse
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--native',action='store_true',help='also compare native stance-foot captures')
args=parser.parse_args()
board=ET.parse(ROOT/'art/tavi-rive-lab/locomotion/scene.rml').getroot().find('Artboard')
clip=next(a for a in board.findall('LinearAnimation') if a.get('name')=='tavi/walk/contact-review')
tracks={}
for obj in clip.findall('KeyedObject'):
    for prop in obj.findall('KeyedProperty'):
        tracks[(obj.get('objectId'),prop.get('property'))]=list(prop)

def value(id,property,frame):
    keys=tracks[(id,property)]
    a=keys[0];b=keys[-1]
    for key in keys:
        if float(key.get('frame',0))<=frame:a=key
        if float(key.get('frame',0))>=frame:b=key;break
    if a.tag!='KeyFrameDouble':return a.get('value')
    begin,end=float(a.get('frame',0)),float(b.get('frame',0))
    p=0 if begin==end else (frame-begin)/(end-begin)
    return float(a.get('value',0))+(float(b.get('value',0))-float(a.get('value',0)))*p

objects={e.get('id'):e for e in board.iter() if e.get('id')}
parents={c:p for p in board.iter() for c in p}
def origin(id,frame):
    chain=[];item=objects[id]
    while item is not board:chain.append(item);item=parents[item]
    x=y=0
    for item in chain:
        angle=float(item.get('rotation',0));sx=float(item.get('scaleX',1));sy=float(item.get('scaleY',1))
        dx=value(item.get('id'),'x',frame) if (item.get('id'),'x') in tracks else float(item.get('x',0))
        dy=value(item.get('id'),'y',frame) if (item.get('id'),'y') in tracks else float(item.get('y',0))
        x,y=dx+math.cos(angle)*sx*x-math.sin(angle)*sy*y,dy+math.sin(angle)*sx*x+math.cos(angle)*sy*y
    return x,y

max_drift=0;max_reach=0
for start,direction,first in ((74,1,'L'),(356,-1,'R')):
    for step in range(6):
        swing=first if step%2==0 else ('R' if first=='L' else 'L')
        stance='R' if swing=='L' else 'L'
        anchor=None;previous=None
        for frame in range(start+step*28,start+(step+1)*28+1):
            root=value('0:9414','x',frame)
            for side,id,bone in (('L','0:2559','0:2519'),('R','0:2506','0:2494')):
                x,y=root+value(id,'x',frame),value(id,'y',frame)
                hip=origin(bone,frame)
                reach=math.dist(hip,(x,y));max_reach=max(max_reach,reach)
                limit=(71.474152+67.434799)*(0.99500012 if side=='L' else 1)
                assert reach<limit+0.02, f'{side} leg cannot reach its foot at frame {frame}: {reach} > {limit}'
                if side==stance:
                    if anchor is None:anchor=(x,y)
                    max_drift=max(max_drift,math.dist(anchor,(x,y)))
                    assert abs(value(id,'rotation',frame))<1e-8, 'Planted sole tilted'
                else:
                    if previous is not None:assert direction*(x-previous)>-0.001, 'Swing foot moved backward'
                    previous=x
    travel=value('0:9414','x',start+168)-value('0:9414','x',start)
    assert abs(travel-direction*180)<1e-6
    print(f'{"right" if direction>0 else "left"}: 6 steps, 180u travel; stance drift <= {max_drift:.8f}u')
assert max_drift<0.02
duration=float(clip.get('duration'))
for id,prop in tracks:
    begin,end=value(id,prop,0),value(id,prop,duration)
    assert abs(begin-end)<1e-6 if isinstance(begin,float) else begin==end, f'Loop discontinuity: {id}.{prop}'
print(f'Maximum hip-to-foot reach: {max_reach:.3f}u; all targets reachable. Loop closes without a reset.')
if args.native:
    import os
    import subprocess
    from PIL import Image, ImageChops
    rive=Path(os.environ['USERPROFILE'])/'.rive/bin/rive.exe'
    for name,frames,foot_x in (('right',(84,94),422),('left',(366,376),568)):
        images=[]
        for frame in frames:
            capture=ROOT/f'build/walk-{name}-stance-{frame}.png'
            subprocess.run([str(rive),str(ROOT/'art/tavi-rive-lab/walking'),
                f'--screenshot={capture}',f'--advance={frame}'],capture_output=True,check=True)
            images.append(Image.open(capture).convert('RGB').crop((foot_x-14,543,foot_x+14,548)))
        control=sum(b-r>25 and b-g>10 for r,g,b in images[0].get_flattened_data())
        assert control>10, 'Stance shoe missing from native contact crop'
        changes=sum(max(pixel)>12 for pixel in ImageChops.difference(*images).get_flattened_data())
        assert changes<=2, f'{name}: native sole contact changed by {changes} pixels'
        print(f'{name}: native stance strip stable ({changes} changed pixels, {control} shoe pixels)')
