"""Validate authored turn visibility, mirrored occlusion, and fitted clothing."""
from pathlib import Path
from bisect import bisect_right
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[2]
board=ET.parse(ROOT/'art/tavi-rive-lab/turnaround/scene.rml').getroot().find('Artboard')
objects={e.get('id'):e for e in board.iter() if e.get('id')}
parents={c:p for p in board.iter() for c in p}
clip=next(a for a in board.findall('LinearAnimation') if a.get('name')=='tavi/turn/front-profile-rear-review')
tracks={(o.get('objectId'),p.get('property')):list(p) for o in clip.findall('KeyedObject') for p in o.findall('KeyedProperty')}
def value(id,prop,frame):
    keys=tracks[(id,prop)];times=[float(k.get('frame',0)) for k in keys]
    i=max(0,bisect_right(times,frame)-1);j=min(i+1,len(keys)-1);a,b=keys[i],keys[j]
    if a.tag!='KeyFrameDouble':return a.get('value')
    q=0 if i==j else (frame-times[i])/(times[j]-times[i])
    return float(a.get('value'))+(float(b.get('value'))-float(a.get('value')))*q
for id,prop in tracks:
    first,last=value(id,prop,0),value(id,prop,480)
    assert abs(first-last)<1e-6 if isinstance(first,float) else first==last,f'Turn loop resets {id}.{prop}'
assert value('68:1','opacity',0)==0 and value('68:2','opacity',0)==1
assert value('68:1','opacity',220)==1 and value('68:2','opacity',220)==0
assert parents[objects['0:596']].get('id')=='0:437','Crown is cut by facial reveal mask'
for left,right in ((0,1),(1,0),(2,9),(3,8),(4,7),(5,6),(6,5),(7,4),(8,3),(9,2)):
    assert abs(value(f'68:{100+left}','x',126)+value(f'68:{100+right}','x',354))<1e-6,'Asymmetric profile visibility'
for vertex in objects['37:11']:
    if 'Vertex' not in vertex.tag:continue
    for prop in ('x','y','inRotation','inDistance','outRotation','outDistance'):
        keys=tracks.get((vertex.get('id'),prop),[])
        assert len({k.get('value') for k in keys})<=1,'Turn distorts fitted skirt'
for id in ('0:9414','0:2207','0:2206'):
    assert not any((id,prop) in tracks for prop in ('scaleX','scaleY')),'Turn flips/scales whole body'
for project in ('walking','locomotion','interactive','seating','seating-left','seating-right'):
    source=(ROOT/f'art/tavi-rive-lab/{project}/scene.rml').read_text(encoding='utf8')
    assert 'climb-only/projected-leg' not in source,f'Climbing projection leaked into {project}'
print('Turn visibility, mirrored profiles, continuous crown, fitted skirt, and loop verified. Climbing controls remain isolated.')
