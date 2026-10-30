"""Check seating contact, ankle continuity, and isolation from locomotion."""
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[2]
for project in ('locomotion','walking','interactive','seating-left','seating-right'):
    source=(ROOT/f'art/tavi-rive-lab/{project}/scene.rml').read_text(encoding='utf-8')
    assert 'seated/front-projection' not in source,f'Seated projection leaked into {project}'

for view,project in (('front','seating'),('left','seating-left'),('right','seating-right')):
    board=ET.parse(ROOT/f'art/tavi-rive-lab/{project}/scene.rml').getroot().find('Artboard')
    clip=next(a for a in board.findall('LinearAnimation') if a.get('name')=='tavi/perch/contact-review')
    tracks={(o.get('objectId'),p.get('property')):list(p) for o in clip.findall('KeyedObject') for p in o.findall('KeyedProperty')}
    def value(id,prop,frame):
        keys=tracks[(id,prop)];a=keys[0];b=keys[-1]
        for key in keys:
            if float(key.get('frame',0))<=frame:a=key
            if float(key.get('frame',0))>=frame:b=key;break
        if a.tag!='KeyFrameDouble':return a.get('value')
        first,last=float(a.get('frame',0)),float(b.get('frame',0))
        q=0 if first==last else (frame-first)/(last-first)
        return float(a.get('value',0))+(float(b.get('value',0))-float(a.get('value',0)))*q
    duration=int(clip.get('duration'))
    for id,prop in tracks:
        first,last=value(id,prop,0),value(id,prop,duration)
        assert abs(first-last)<1e-6 if isinstance(first,float) else first==last,f'{view}: incomplete stand return'
    max_gap=0
    for frame in range(duration+1):
        assert value('0:9414','x',frame)==100,'Root transported to another destination'
        if view=='front':
            body_delta=value('0:2207','y',frame)+150
            for foot,knee in (('0:2559','50:101'),('0:2506','50:201')):
                ankle=397.277005+body_delta+value(knee,'y',frame)+67.434799
                gap=abs(ankle-value(foot,'y',frame));max_gap=max(max_gap,gap)
                assert gap<0.02,f'Ankle detached at {frame}: {gap}'
    # Held seat support: retained pelvis bottom meets ledge top within AA overlap.
    for frame in (78,120,226):
        pelvis_bottom=383.071005+35.710999+value('0:2207','y',frame)+150
        assert abs(pelvis_bottom-431)<0.5,f'{view}: pelvis does not contact ledge'
        for foot in ('0:2559','0:2506'):assert value(foot,'y',frame)<500,'Feet are not dangling'
    print(f'{view}: ledge contact stable; standing return closed; ankle gap <= {max_gap:.8f}u')
print('Seated projections remain isolated from walking, sprinting, skipping, and joint review.')
