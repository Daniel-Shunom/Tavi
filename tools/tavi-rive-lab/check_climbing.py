"""Measure contacts on the emitted climbing clips, not just generator formulas."""
from pathlib import Path
from bisect import bisect_right
import math
import xml.etree.ElementTree as ET
from climbing import Rig,point,climb_sample,BASE_Y,RISE

ROOT=Path(__file__).resolve().parents[2]
for view,direction in (('front',0),('left',-1),('right',1),('rear',0)):
    board=ET.parse(ROOT/f'art/tavi-rive-lab/climbing-{view}/scene.rml').getroot().find('Artboard')
    clip=next(a for a in board.findall('LinearAnimation') if a.get('name')==f'tavi/climb/up-down-{view}')
    tracks={(o.get('objectId'),p.get('property')):list(p) for o in clip.findall('KeyedObject') for p in o.findall('KeyedProperty')}
    times={key:[float(k.get('frame',0)) for k in keys] for key,keys in tracks.items()}
    def values(frame):
        result={}
        for key,keys in tracks.items():
            i=max(0,bisect_right(times[key],frame)-1);j=min(i+1,len(keys)-1)
            a,b=keys[i],keys[j];q=0 if i==j else (frame-times[key][i])/(times[key][j]-times[key][i])
            result[key]=(a.tag,str(float(a.get('value'))+(float(b.get('value'))-float(a.get('value')))*q)) if a.tag=='KeyFrameDouble' else (a.tag,a.get('value'))
        return result
    initial=values(0);template=Rig(board,initial)
    assert '67:101' in template.objects,'Climbing is still using lateral walking-plane knees'
    if view=='rear':
        head=template.objects['0:437']
        for shape in head.iter('Shape'):
            if shape.get('id')!='0:596' and not shape.get('name','').startswith('climb-only/rear'):
                assert shape.get('hidden')=='true','Front artwork leaked into the rear view'
        assert template.objects['66:1'].get('name')=='climb-only/rear hair silhouette'
        texture=template.objects['66:30']
        assert len(list(texture.iter('Shape')))>=9,'Rear hair lost layered locks'
        assert len(list(texture.iter('GradientStop')))>=2,'Rear hair lost original shading'
        for id in ('47:100','47:180','47:200','47:280'):
            assert all(float(k.get('value'))==0 for k in tracks[(id,'opacity')]),'Rear arm crosses over back hair'
    shoulders=[point(template.world(template.objects[id]),0,0) for id in ('0:2079','0:2340')]
    rail={'L':shoulders[0][0]-56,'R':shoulders[1][0]+56}
    hand_y=min(y for x,y in shoulders)-18;foot_y=hand_y+6*RISE-18
    max_hand=max_foot=max_reach=0.
    for start,reverse in ((92,False),(368,True)):
        for elapsed in range(241):
            frame=start+elapsed;state=values(frame);rig=Rig(board,state,template)
            gait=climb_sample(240-elapsed if reverse else elapsed)
            for side,fore,foot,hip,sign in (('L','0:2080','0:2559','0:2519',-1),('R','0:2341','0:2506','0:2494',1)):
                if side!=gait['moving_hand']:
                    wrist=point(rig.world(rig.objects[fore]),rig.attr(rig.objects[fore],'length'),0)
                    drift=math.dist(wrist,(rail[side],hand_y+gait['hands'][side]));max_hand=max(max_hand,drift)
                    assert drift<.06,f'{view}: grip slides at {frame}: {drift}'
                position=point(rig.world(rig.objects[foot]),0,0)
                hip_position=point(rig.world(rig.objects[hip]),0,0)
                control='67:100' if side=='L' else '67:200'
                knee_id='67:101' if side=='L' else '67:201'
                knee=point(rig.world(rig.objects[knee_id]),0,0)
                if direction==0:assert abs(knee[0]-hip_position[0])<.03,'Knee bends sideways'
                else:assert -.01<=direction*(knee[0]-hip_position[0])<25,'Knee bends away from surface'
                projected_ankle=point(rig.world(rig.objects[knee_id]),67.434799,0)
                assert math.dist(projected_ankle,position)<.06,'Projected shin detached from shoe'
                assert all(rig.attr(rig.objects[id],'scaleX',1)<=1.001 for id in (control,knee_id)),'Projected leg stretches'
                if side!=gait['moving_foot']:
                    expected=(hip_position[0]+direction*6,foot_y+gait['feet'][side])
                    drift=math.dist(position,expected);max_foot=max(max_foot,drift)
                    assert drift<.06,f'{view}: foothold slides at {frame}: {drift}'
                reach=math.dist(position,hip_position);max_reach=max(max_reach,reach)
                limit=(71.474152+67.434799)*(.99500012 if side=='L' else 1)
                assert reach<limit+.05,f'{view}: leg overreaches at {frame}: {reach}'
    for key in tracks:
        a,b=values(0)[key],values(700)[key]
        assert abs(float(a[1])-float(b[1]))<1e-6 if a[0]=='KeyFrameDouble' else a==b,f'{view}: loop resets {key}'
    for bone in ('0:2079','0:2080','0:2340','0:2341','0:2519','0:2520','0:2494','0:2495'):
        assert not any((bone,p) in tracks for p in ('length','scaleX','scaleY'))
    for vertex in template.objects['37:11']:
        if 'Vertex' not in vertex.tag:continue
        for prop in ('x','y','inRotation','inDistance','outRotation','outDistance'):
            keys=tracks.get((vertex.get('id'),prop),[])
            assert len({key.get('value') for key in keys})<=1,'Climbing distorts the fitted skirt contour'
    for action,travel in (('up',-144),('down',144)):
        action_clip=next(a for a in board.findall('LinearAnimation') if a.get('name')==f'tavi/climb/{action}/{view}')
        root=next(o for o in action_clip.findall('KeyedObject') if o.get('objectId')=='0:9414')
        y=next(p for p in root if p.get('property')=='y')
        assert abs(float(y[0].get('value')))<1e-6
        assert abs(float(y[-1].get('value'))-travel)<1e-6
    print(f'{view}: hand drift <= {max_hand:.5f}u; foot drift <= {max_foot:.5f}u; leg reach <= {max_reach:.3f}u; up/down and loop verified')
print('Climbing preserves original limb lengths in all four views.')
