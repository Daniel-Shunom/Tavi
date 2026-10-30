"""Verify emitted knee controls preserve calf reach, attachment, and foot paths."""
from pathlib import Path
from bisect import bisect_right
import math
import xml.etree.ElementTree as ET
from climbing import Rig,point
from climbing_legs import A,B

ROOT=Path(__file__).resolve().parents[2]
board=ET.parse(ROOT/'art/tavi-rive-lab/locomotion/scene.rml').getroot().find('Artboard')
template=Rig(board,{})
for mode in ('walk','sprint','skip'):
    clip=next(a for a in board.findall('LinearAnimation') if a.get('name')==f'tavi/{mode}/contact-review')
    tracks={(o.get('objectId'),p.get('property')):list(p) for o in clip.findall('KeyedObject') for p in o.findall('KeyedProperty')}
    times={k:[float(v.get('frame',0)) for v in keys] for k,keys in tracks.items()}
    def values(frame):
        result={}
        for key,keys in tracks.items():
            i=max(0,bisect_right(times[key],frame)-1);j=min(i+1,len(keys)-1);a,b=keys[i],keys[j]
            q=0 if i==j else (frame-times[key][i])/(times[key][j]-times[key][i])
            result[key]=(a.tag,str(float(a.get('value'))+(float(b.get('value'))-float(a.get('value')))*q)) if a.tag=='KeyFrameDouble' else (a.tag,a.get('value'))
        return result
    max_gap=0
    for frame in range(0,int(clip.get('duration'))+1):
        rig=Rig(board,values(frame),template)
        for base,hip,foot in ((100,'0:2519','0:2559'),(200,'0:2494','0:2506')):
            upper=rig.world(rig.objects[f'69:{base}']);lower=rig.world(rig.objects[f'69:{base+1}'])
            assert math.dist(point(upper,0,0),point(rig.world(rig.objects[hip]),0,0))<.03,'Thigh detached'
            gap=math.dist(point(lower,B,0),point(rig.world(rig.objects[foot]),0,0));max_gap=max(max_gap,gap)
            assert gap<.07,f'{mode}: calf/foot attachment gap at {frame}: {gap}'
            for id in (f'69:{base}',f'69:{base+1}'):
                assert rig.attr(rig.objects[id],'scaleX',1)<=1.0001,'Motion artificially lengthens a limb'
        assert abs(rig.attr(rig.objects['69:100'],'length'))==0
    print(f'{mode}: high/tucked knees; original segment reach; ankle gap <= {max_gap:.5f}u')
print('Knee controls preserve limb reach and ankle attachment through both travel directions.')
