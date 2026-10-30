"""Isolated, orthographically projected cross-legged floor-sitting experiment."""
import copy
import math
import xml.etree.ElementTree as ET
from locomotion import smooth
from seating import seated_skirt_corrective

DROP=126.217996
PANTS_X=306.6529846
PANTS_Y=397.277005
# Each foot tucks under the opposite knee, so the shins read as a cross
# rather than both feet stacking into one block at the centre.
FOOT_TUCK=34

def project(x,z,direction):
    yaw=direction*0.65
    return x*math.cos(yaw)+z*math.sin(yaw)

def shoe_outline(shape,pose):
    vertices=[v for v in shape.find('PointsPath') if 'Vertex' in v.tag]
    def a(vertex,key):
        return float(pose.get((vertex.get('id'),key),('',vertex.get(key,0)))[1])
    result=[]
    for i,start in enumerate(vertices):
        end=vertices[(i+1)%len(vertices)]
        x0,y0=a(start,'x'),a(start,'y');x3,y3=a(end,'x'),a(end,'y')
        x1=x0+math.cos(a(start,'outRotation'))*a(start,'outDistance')
        y1=y0+math.sin(a(start,'outRotation'))*a(start,'outDistance')
        x2=x3+math.cos(a(end,'inRotation'))*a(end,'inDistance')
        y2=y3+math.sin(a(end,'inRotation'))*a(end,'inDistance')
        for j in range(21):
            t=j/20;s=1-t
            x=s**3*x0+3*s*s*t*x1+3*s*t*t*x2+t**3*x3
            y=s**3*y0+3*s*s*t*y1+3*s*t*t*y2+t**3*y3
            result.append((float(shape.get('x',0))+float(shape.get('scaleX',1))*x,
                           float(shape.get('y',0))+float(shape.get('scaleY',1))*y))
    return result

def calf_swap(q):
    return max(0,min(1,(q-0.55)/0.1))

def floor_shape(direction):
    far=44+38*abs(direction);hem=50+28*abs(direction)
    right=[(0,-.75),(37,-1.75),(far,10),(hem+2,30),(hem,44.8),(12*direction,44.8),
           (-50,44.8),(-52,30),(-44,10),(-37,-1.75)]
    if direction<0:return [(-right[(-i)%10][0],right[(-i)%10][1]) for i in range(10)]
    return right

def create_ground_project(board,neutral,sample,animation,new_id,write_project,folder,view):
    target=copy.deepcopy(board)
    for machine in target.findall('StateMachine'):target.remove(machine)
    objects={e.get('id'):e for e in target.iter() if e.get('id')}
    direction={'front':0,'left':-1,'right':1}[view]
    cloth=seated_skirt_corrective(target)
    pants=objects['0:635'];bindings=[]
    for index,(upper,lower,shape_id,ankle,shoe_id,assembly,hipx,footbase,side) in enumerate((
        ('0:2519','0:2520','0:2544','41:102','0:13091','0:13134',-18.5000343,288.5,-1),
        ('0:2494','0:2495','0:679','41:122','0:13183','0:13158',15.5,322.5,1))):
        base=100+index*100
        for joint in range(2):
            ET.SubElement(pants,'RootBone',name='ground-only/projected-leg',length='0',id=f'60:{base+joint}')
        for tendon in objects[shape_id].iter('Tendon'):
            tendon.set('boneId',f'60:{base if tendon.get("boneId")==upper else base+1}')
        objects[ankle].set('targetId',f'60:{base+1}')
        # Only the calf crosses in front of the lap; the thigh stays clothed.
        overlay=copy.deepcopy(objects[shape_id]);path=overlay.find('PointsPath')
        path.remove(next(v for v in path if 'Vertex' in v.tag))
        remap={e.get('id'):f'62:{base+i}' for i,e in enumerate(overlay.iter()) if e.get('id')}
        for e in overlay.iter():
            for key,value in list(e.attrib.items()):
                if value in remap:e.set(key,remap[value])
        overlay.set('name','ground-only/foreground-calf');overlay.set('opacity','0')
        overlay.find('Stroke').set('cap','butt')
        rule=ET.SubElement(overlay,'DrawRules',drawTargetId=f'62:{base+81}',id=f'62:{base+80}')
        ET.SubElement(rule,'DrawTarget',drawableId='37:10',placementValue='before',id=f'62:{base+81}')
        pants.insert(0,overlay)
        rule=ET.SubElement(objects[assembly],'DrawRules',drawTargetId=f'62:{base+91}',id=f'62:{base+90}')
        ET.SubElement(rule,'DrawTarget',drawableId='37:10',placementValue='before',id=f'62:{base+91}')
        bindings.append((base,hipx,footbase,side,overlay.get('id'),shoe_outline(objects[shoe_id],sample('tavi/turnBody',(direction+1)/2))))
    duration=360;frames=[]
    for frame in range(0,duration+1,2):
        q=smooth(max(0,min(1,(frame-18)/90))) if frame<=252 else 1-smooth(max(0,min(1,(frame-252)/90)))
        values={**neutral,**sample('tavi/turnHead',(0.85*direction+1)/2),**sample('tavi/turnBody',(direction+1)/2)}
        def key(id,prop,value):values[(id,prop)]=('KeyFrameDouble',str(value))
        key('0:9414','x',100);key('0:2207','x',-1);key('0:2207','y',-150+DROP*q);key('0:2206','rotation',0)
        for base,hipx,footbase,side,overlay_id,outline in bindings:
            hip=(hipx+(-1.5+project(side*17,0,direction)-hipx)*q,-11)
            standing_knee=(footbase-PANTS_X,525.5-PANTS_Y-67.434799)
            knee_world_y=458.065201+(386.277005+DROP+4.5-458.065201)*q
            knee_x=standing_knee[0]+(-1.5+project(side*55,60,direction)-standing_knee[0])*q
            knee=(knee_x,knee_world_y-(PANTS_Y+DROP*q))
            foot_x=footbase+(PANTS_X-1.5+project(-side*FOOT_TUCK,40,direction)-footbase)*q
            foot_y=525.5;theta=0
            for _ in range(12):
                theta=math.atan2(foot_y-knee_world_y,foot_x-(PANTS_X+knee_x))-math.pi/2
                foot_y=545-max(x*math.sin(theta)+y*math.cos(theta) for x,y in outline)
            foot=(foot_x-PANTS_X,foot_y-(PANTS_Y+DROP*q))
            for joint,start,end,length in ((0,hip,knee,71.474152),(1,knee,foot,67.434799)):
                dx,dy=end[0]-start[0],end[1]-start[1]
                id=f'60:{base+joint}'
                key(id,'x',start[0]);key(id,'y',start[1]);key(id,'rotation',math.atan2(dy,dx))
                key(id,'scaleX',min(1,math.hypot(dx,dy)/length))
            foot_id='0:2559' if side<0 else '0:2506'
            key(foot_id,'x',foot_x);key(foot_id,'y',foot_y);key(foot_id,'rotation',theta)
            # The crossed calf comes forward once the knee is past the lap edge; a
            # short swap avoids a see-through double leg during the sit.
            key(overlay_id,'opacity',calf_swap(q) if direction==0 or side*direction<0 else 0)
        for upper,lower in (('0:2079','0:2080'),('0:2340','0:2341')):
            key(upper,'rotation',float(objects[upper].get('rotation'))+(0.7-float(objects[upper].get('rotation')))*q)
            rest=float(objects[lower].get('rotation',0));key(lower,'rotation',rest+(1.2-rest)*q)
        for id,near in (('47:100',max(0,direction)),('47:180',max(0,direction)),('47:200',max(0,-direction)),('47:280',max(0,-direction))):
            key(id,'opacity',near+(1-near)*q if direction==0 else near)
        for (id,attrs),(x,y) in zip(cloth,floor_shape(direction)):
            key(id,'x',attrs['x']+(x+.79351809-attrs['x'])*q)
            key(id,'y',attrs['y']+(y-22.907013-attrs['y'])*q)
        frames.append((frame,values))
    clip=animation('tavi/ground/contact-review',frames,duration,loop='loop');target.append(clip)
    sm=ET.SubElement(target,'StateMachine',name='Tavi ground seated review',id='63:1')
    layer=ET.SubElement(sm,'StateMachineLayer',name='Ground sit and stand',id='63:2')
    entry=ET.SubElement(layer,'EntryState',x='0',y='0',id='63:3')
    ET.SubElement(entry,'StateTransition',stateToId='63:4',id='63:5')
    ET.SubElement(layer,'AnimationState',animationId=clip.get('id'),x='220',y='0',id='63:4')
    target.set('defaultStateMachineId','63:1');target.set('width','800')
    floor=ET.Element('Shape',name='review floor',id='63:10');path=ET.SubElement(floor,'PointsPath',id='63:11')
    ET.SubElement(path,'StraightVertex',x='150',y='545',id='63:12');ET.SubElement(path,'StraightVertex',x='650',y='545',id='63:13')
    stroke=ET.SubElement(floor,'Stroke',thickness='1',id='63:14');ET.SubElement(stroke,'SolidColor',colorValue='FF635C69',id='63:15');target.append(floor)
    write_project(folder,target)
    (folder/'rive.yaml').write_text('name: tavi-ground-'+view+'\nmain: "lyla animation"\n')
