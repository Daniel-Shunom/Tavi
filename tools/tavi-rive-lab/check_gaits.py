"""Validate emitted sprint/skip contacts, reach, hand direction, and closure."""
import math
from pathlib import Path
import xml.etree.ElementTree as ET
from gaits import gait_sample, PROFILES

root=Path(__file__).resolve().parents[2]
board=ET.parse(root/'art/tavi-rive-lab/locomotion/scene.rml').getroot().find('Artboard')
objects={e.get('id'):e for e in board.iter() if e.get('id')}
parents={c:p for p in board.iter() for c in p}
for mode,cfg in PROFILES.items():
    clip=next(a for a in board.findall('LinearAnimation') if a.get('name')==f'tavi/{mode}/contact-review')
    tracks={(obj.get('objectId'),prop.get('property')):list(prop)
            for obj in clip.findall('KeyedObject') for prop in obj.findall('KeyedProperty')}
    def sample(id,prop,frame,default=None):
        keys=tracks.get((id,prop))
        if not keys:return float(objects[id].get(prop,0 if default is None else default))
        a=keys[0];b=keys[-1]
        for key in keys:
            if float(key.get('frame',0))<=frame:a=key
            if float(key.get('frame',0))>=frame:b=key;break
        if a.tag!='KeyFrameDouble':return a.get('value')
        first,last=float(a.get('frame',0)),float(b.get('frame',0))
        t=0 if first==last else (frame-first)/(last-first)
        return float(a.get('value',0))+(float(b.get('value',0))-float(a.get('value',0)))*t
    def matrix(id,frame):
        chain=[];item=objects[id]
        while item is not board:chain.append(item);item=parents[item]
        result=(1,0,0,1,0,0)
        for item in reversed(chain):
            id=item.get('id');angle=sample(id,'rotation',frame)
            sx=sample(id,'scaleX',frame,1);sy=sample(id,'scaleY',frame,1)
            local=(math.cos(angle)*sx,math.sin(angle)*sx,-math.sin(angle)*sy,math.cos(angle)*sy,
                   sample(id,'x',frame),sample(id,'y',frame))
            a,b=result,local
            result=(a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],
                    a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5])
        return result
    max_reach=0;max_drift=0;flight=0
    for direction,start in ((1,74),(-1,194+cfg['beats']*cfg['beat'])):
        for elapsed in range(cfg['beats']*cfg['beat']+1):
            frame=start+elapsed;gait=gait_sample(mode,elapsed,direction)
            if not gait['support']:flight+=1
            for side,foot,hip in (('L','0:2559','0:2519'),('R','0:2506','0:2494')):
                x,y=matrix(foot,frame)[4:];hx,hy=matrix(hip,frame)[4:]
                distance=math.hypot(x-hx,y-hy);max_reach=max(max_reach,distance)
                base=288.5 if side=='L' else 322.5
                expected_x=100+(cfg['distance'] if direction<0 else 0)+base+gait['feet'][side][0]
                expected_y=525.5+gait['feet'][side][1]
                assert math.hypot(x-expected_x,y-expected_y)<.04,f'{mode}: foot order/path changed at {frame} ({side})'
                limit=(71.474152+67.434799)*(0.99500012 if side=='L' else 1)
                assert distance<limit+0.03,f'{mode} {side} unreachable at {frame}: {distance} > {limit}'
                if side in gait['support']:
                    base=288.5 if side=='L' else 322.5
                    expected=100+(cfg['distance'] if direction<0 else 0)+base+gait['feet'][side][0]
                    drift=math.hypot(x-expected,y-525.5);max_drift=max(max_drift,drift)
                    assert drift<0.03,f'{mode} stance slip at {frame}: {drift}'
                    assert abs(sample(foot,'rotation',frame))<1e-5
            if mode=='sprint':
                for forearm in ('0:2080','0:2341'):
                    assert direction*matrix(forearm,frame)[0]>0.1,f'Hand points backward at {frame}'
            else:
                assert -0.49<sample('0:2080','rotation',frame)<-0.39
                for upper,lower in (('0:2079','0:2080'),('0:2340','0:2341')):
                    assert matrix(upper,frame)[1]>0.1,'Skip elbows must sit below shoulders'
                    assert matrix(lower,frame)[1]<-0.1,'Skip forearms must angle up'
                assert sample('0:2850','y',frame)>0.25,'Upward head pitch missing'
        for bone in ('0:2519','0:2520','0:2494','0:2495'):
            assert not any((bone,p) in tracks for p in ('length','scaleX','scaleY'))
    assert flight>20,'Missing airborne phases'
    duration=float(clip.get('duration'))
    for id,prop in tracks:
        a,b=sample(id,prop,0),sample(id,prop,duration)
        assert abs(a-b)<1e-6 if isinstance(a,float) else a==b,f'{mode} does not close: {id}.{prop}'
    print(f'{mode}: reach <= {max_reach:.3f}u; stance drift <= {max_drift:.8f}u; flight and loop verified')
print('Sprint hands face travel; skip has outstretched bent arms and upward head pitch. Leg lengths unchanged.')
