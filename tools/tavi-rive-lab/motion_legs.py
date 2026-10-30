"""Stylized knee ownership: retain foot travel, tuck knee bends into depth."""
import math
import xml.etree.ElementTree as ET
from bisect import bisect_right
from climbing import Rig,point,inverse_point
from climbing_legs import A,B,lift_projected_knee


def tucked_knee(hip,foot):
    dx,dy=foot[0]-hip[0],foot[1]-hip[1]
    distance=math.hypot(dx,dy)
    assert distance<=A+B+.001,f'Motion leg overreach: {distance}'
    along=(A*A-B*B+distance*distance)/(2*distance)
    radius=math.sqrt(max(0,A*A-along*along))
    cx=hip[0]+along*dx/distance
    extent=radius*abs(dy)/distance
    desired=hip[0]+max(-14,min(14,.3*dx))
    kx=max(cx-extent,min(cx+extent,desired))
    return lift_projected_knee(hip,foot,kx)


def walking_knees(hips,feet):
    """A low-recovery walk with coordinated calf directions, not a skip pose.

    Both shins share a small lean chosen within each thigh's reach envelope.
    Each knee therefore follows its own ankle as the swing foot passes behind
    the support foot; the visible calves cannot form a crossing X.
    """
    low=-math.pi/2;high=math.pi/2
    for hip,foot in zip(hips,feet):
        dx,dy=foot[0]-hip[0],foot[1]-hip[1];distance=math.hypot(dx,dy)
        angle=math.atan2(dx,dy)
        half=math.acos(max(-1,min(1,(distance*distance+B*B-A*A)/(2*B*distance))))
        low=max(low,angle-half);high=min(high,angle+half)
    assert low<=high+1e-6,'Walking stance exceeds coordinated calf reach'
    lean=max(low,min(high,0))
    calf=(B*math.sin(lean),B*math.cos(lean))
    return [(foot[0]-calf[0],foot[1]-calf[1]) for foot in feet]


def project_motion_legs(board,clip,new_id):
    objects={e.get('id'):e for e in board.iter() if e.get('id')}
    if '69:100' not in objects:
        for base,upper,shape,ankle in ((100,'0:2519','0:2544','41:102'),(200,'0:2494','0:679','41:122')):
            for joint in range(2):
                ET.SubElement(objects['0:635'],'RootBone',name='motion-only/tucked-knee-'+str(joint),length='0',id=f'69:{base+joint}')
            for tendon in objects[shape].iter('Tendon'):
                tendon.set('boneId',f'69:{base if tendon.get("boneId")==upper else base+1}')
            objects[ankle].set('targetId',f'69:{base+1}')
    if any(obj.get('objectId')=='69:100' for obj in clip.findall('KeyedObject')):return
    tracks={(o.get('objectId'),p.get('property')):list(p) for o in clip.findall('KeyedObject') for p in o.findall('KeyedProperty')}
    # A subpixel settling offset also resolves the old slightly overextended
    # standing target, without changing foot contacts or physical bone lengths.
    for key in tracks.get(('0:2207','y'),[]):key.set('value',str(float(key.get('value'))+.5))
    times={k:[float(v.get('frame',0)) for v in keys] for k,keys in tracks.items()}
    def values(frame):
        result={}
        for key,keys in tracks.items():
            i=max(0,bisect_right(times[key],frame)-1);j=min(i+1,len(keys)-1);a,b=keys[i],keys[j]
            q=0 if i==j else (frame-times[key][i])/(times[key][j]-times[key][i])
            result[key]=(a.tag,str(float(a.get('value'))+(float(b.get('value'))-float(a.get('value')))*q)) if a.tag=='KeyFrameDouble' else (a.tag,a.get('value'))
        return result
    template=Rig(board,values(0));output={}
    # Solve every displayed frame so a fast sprint cannot separate the calf
    # from the planted shoe between two more widely sampled knee controls.
    for frame in range(0,int(clip.get('duration'))+1):
        rig=Rig(board,values(frame),template)
        pants=rig.world(rig.objects['0:635'])
        hips=[point(rig.world(rig.objects[id]),0,0) for id in ('0:2519','0:2494')]
        feet=[point(rig.world(rig.objects[id]),0,0) for id in ('0:2559','0:2506')]
        knees=walking_knees(hips,feet) if clip.get('name')=='tavi/walk/contact-review' else [tucked_knee(h,f) for h,f in zip(hips,feet)]
        for base,hip,foot,knee in zip((100,200),hips,feet,knees):
            for joint,start,end,length in ((0,hip,knee,A),(1,knee,foot,B)):
                start=inverse_point(pants,*start);end=inverse_point(pants,*end)
                dx,dy=end[0]-start[0],end[1]-start[1]
                for prop,value in (('x',start[0]),('y',start[1]),('rotation',math.atan2(dy,dx)),('scaleX',math.hypot(dx,dy)/length)):
                    output.setdefault((f'69:{base+joint}',prop),[]).append((frame,value))
    for (id,prop),keys in output.items():
        obj=next((o for o in clip.findall('KeyedObject') if o.get('objectId')==id),None)
        if obj is None:obj=ET.SubElement(clip,'KeyedObject',objectId=id,id=new_id())
        target=ET.SubElement(obj,'KeyedProperty',property=prop,id=new_id())
        for frame,value in keys:
            ET.SubElement(target,'KeyFrameDouble',frame=str(frame),value=str(value),interpolationType='linear',id=new_id())
