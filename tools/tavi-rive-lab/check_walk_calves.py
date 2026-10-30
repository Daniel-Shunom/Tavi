"""Reject X-shaped crossings between the emitted walking calf segments."""
from pathlib import Path
from bisect import bisect_right
import math
import xml.etree.ElementTree as ET
from climbing import Rig,point
from climbing_legs import A,B

ROOT=Path(__file__).resolve().parents[2]
def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def intersects(a,b,c,d):return cross(a,b,c)*cross(a,b,d)<-1e-6 and cross(c,d,a)*cross(c,d,b)<-1e-6

for project in ('walking','locomotion'):
    board=ET.parse(ROOT/f'art/tavi-rive-lab/{project}/scene.rml').getroot().find('Artboard')
    clip=next(a for a in board.findall('LinearAnimation') if a.get('name')=='tavi/walk/contact-review')
    tracks={(o.get('objectId'),p.get('property')):list(p) for o in clip.findall('KeyedObject') for p in o.findall('KeyedProperty')}
    times={k:[float(v.get('frame',0)) for v in keys] for k,keys in tracks.items()}
    def values(frame):
        result={}
        for key,keys in tracks.items():
            i=max(0,bisect_right(times[key],frame)-1);j=min(i+1,len(keys)-1);a,b=keys[i],keys[j]
            q=0 if i==j else (frame-times[key][i])/(times[key][j]-times[key][i])
            result[key]=(a.tag,str(float(a.get('value'))+(float(b.get('value'))-float(a.get('value')))*q)) if a.tag=='KeyFrameDouble' else (a.tag,a.get('value'))
        return result
    template=Rig(board,values(0));failures=[];infeasible=[];max_gap=0
    for frame in range(int(clip.get('duration'))+1):
        rig=Rig(board,values(frame),template);segments=[];lo=-math.pi/2;hi=math.pi/2
        for base,hip_id,foot_id in ((100,'0:2519','0:2559'),(200,'0:2494','0:2506')):
            hip=point(rig.world(rig.objects[hip_id]),0,0);foot=point(rig.world(rig.objects[foot_id]),0,0)
            knee=point(rig.world(rig.objects[f'69:{base+1}']),0,0)
            segments.append((knee,foot))
            max_gap=max(max_gap,math.dist(point(rig.world(rig.objects[f'69:{base+1}']),B,0),foot))
            dx,dy=foot[0]-hip[0],foot[1]-hip[1];distance=math.hypot(dx,dy)
            angle=math.atan2(dx,dy);half=math.acos(max(-1,min(1,(distance*distance+B*B-A*A)/(2*B*distance))))
            lo=max(lo,angle-half);hi=min(hi,angle+half)
        if lo>hi+1e-6:infeasible.append(frame)
        if intersects(*segments[0],*segments[1]):failures.append(frame)
    print(f'{project}: {len(failures)} crossed-calf frames; first={failures[:10]}; shared-shin feasibility failures={infeasible[:10]}',flush=True)
    assert not failures,'Walking calves form an X; inspect these frames'
    assert not infeasible,'Parallel walking calves require a revised stance'
    assert max_gap<.07,'Calf detached from shoe'
print('Walking calf paths stay coordinated without X crossings in either direction.')
