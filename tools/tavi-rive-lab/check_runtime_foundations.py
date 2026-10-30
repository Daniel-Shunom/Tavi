"""Check the runtime uses approved authored motion, with seamless planted loops."""
import xml.etree.ElementTree as ET
from pathlib import Path
from runtime_foundations import sampler

root=Path('art/tavi-rive-lab')
board=ET.parse(root/'runtime/scene.rml').getroot().find('Artboard')
clips={a.get('name'):a for a in board.findall('LinearAnimation')}
count=0
for kind,beat,stride,support in [('walk',28,60,28),('sprint',20,104,8),('skip',48,160,16)]:
    for direction,view in [(1,'right'),(-1,'left')]:
        clip=clips[f'tavi/runtime/gait/{kind}-{view}'];sample=sampler(clip)
        length=2*beat;assert int(clip.get('duration'))==length
        first,last=sample(0),sample(length)
        for key,value in first.items():
            if value[0]=='KeyFrameDouble':assert abs(float(value[1])-float(last[key][1]))<1e-7,(kind,view,'loop pop',key)
            else:assert value==last[key],(kind,view,key)
        foot='0:2559' if direction>0 else '0:2506'
        contacts=[float(sample(frame)[(foot,'x')][1])+direction*stride*frame/length for frame in range(support+1)]
        assert max(contacts)-min(contacts)<1e-7,(kind,view,'stance slide')
        ids={o.get('objectId') for o in clip.findall('KeyedObject')}
        assert {'69:100','69:101','69:200','69:201'}<=ids
        assert not any(id.startswith('37:') for id in ids),'Gait must retain the approved waist-weighted skirt'
        count+=1

for pose,frame in [('perch',120),('floor',150)]:
    for view in ('front','left','right'):
        folder=('seating' if view=='front' else 'seating-'+view) if pose=='perch' else 'ground-'+view
        source=ET.parse(root/folder/'scene.rml').getroot().find('Artboard')
        original=next(a for a in source.findall('LinearAnimation') if a.get('name') in ('tavi/perch/contact-review','tavi/ground/contact-review'))
        expected=sampler(original)(frame);actual=sampler(clips[f'tavi/runtime/pose/{pose}-{view}'])(60)
        for key,value in expected.items():
            if key[0] in {'0:2207','0:2559','0:2506','0:2079','0:2080','0:2340','0:2341'}:
                # Angles may be normalized by whole turns for a smooth blend.
                difference=float(actual[key][1])-float(value[1])
                if key[1]=='rotation':
                    import math
                    difference=math.remainder(difference,2*math.pi)
                assert abs(difference)<1e-7,(pose,view,key)
        count+=1
print(f'{count} approved motion/pose foundations verified; no loop pops or planted-foot drift')
