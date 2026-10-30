"""Ledge sitting with shared contact and a frontal perspective projection."""
import copy
import math
import xml.etree.ElementTree as ET
from locomotion import smooth


def install_seated_projection(board):
    objects={e.get('id'):e for e in board.iter() if e.get('id')}
    pants=objects['0:635'];controls=[]
    for index,(upper,lower,hipx,footx,shape,ankle) in enumerate((
        ('0:2519','0:2520',-18.5000343,-18.1529846,'0:2544','41:102'),
        ('0:2494','0:2495',15.5,15.8470154,'0:679','41:122'))):
        base=100+index*100
        # These are view-projection controls in this copied pose project only.
        # They do not copy an IK chain before its solve, and never enter gaits.
        standing_scale=0.99500012 if index==0 else 1
        ET.SubElement(pants,'RootBone',name='seated/front-projection upper',x=str(hipx),y='-11',
            rotation=str(math.pi/2),scaleX=str(standing_scale),length='0',id=f'50:{base}')
        ET.SubElement(pants,'RootBone',name='seated/front-projection shin',x=str(footx),
            y=str(-11+71.474152*standing_scale),rotation=str(math.pi/2),length='0',id=f'50:{base+1}')
        controls.append((f'50:{base}',f'50:{base+1}',standing_scale))
        for tendon in objects[shape].iter('Tendon'):
            tendon.set('boneId',f'50:{base if tendon.get("boneId")==upper else base+1}')
        objects[f'37:{302+index}'].set('boneId',f'50:{base}')
        objects[ankle].set('targetId',f'50:{base+1}')
    return controls


def seated_skirt_corrective(board):
    """Use a lap corrective on a copied pose mesh, not the gait's thigh weights."""
    path=next(e for e in board.iter() if e.get('id')=='37:11')
    data=[]
    for vertex in (v for v in path if 'Vertex' in v.tag):
        weight=vertex.find('CubicWeight');waist=int(weight.get('values'))&255
        values=str(waist|((255-waist)<<8))
        for key,value in dict(indices='513',values=values,inIndices='513',inValues=values,
                              outIndices='513',outValues=values).items():weight.set(key,value)
        data.append((vertex.get('id'),{key:float(vertex.get(key,0)) for key in
                    ('x','y','inRotation','inDistance','outRotation','outDistance')}))
    return data


def lap_shape(direction):
    front=[(0,-.75,math.pi,12,0,12),(37,-1.75,math.pi,12,math.pi/2,6),
           (44,15,-1.79,5,1.35,6),(48,30,-math.pi/2,6,math.pi/2,4),
           (46,43,0,4,math.pi,16),(0,45,0,16,math.pi,16),
           (-46,43,0,16,math.pi,4),(-48,30,math.pi/2,4,-math.pi/2,6),
           (-44,15,1.79,6,-1.35,5),(-37,-1.75,math.pi/2,6,0,12)]
    if direction==0:return front
    # Fabric lies on the thigh: the top line runs just above it, rounds over
    # the knee, and falls a little past the knee instead of standing up as a
    # wedge. The hem rests on the seat and lifts slightly toward the back.
    right=[(0,-.75,math.pi,12,0,12),(37,-1.75,math.pi,12,-.85,24),
           (96,-16,math.pi,18,0,9),(113,6,-math.pi/2,10,math.pi/2,10),
           (106,44,-1.45,14,math.pi,12),(30,46,0,26,math.pi,26),
           (-42,44,0,14,math.pi,5),(-46,28,math.pi/2,6,-math.pi/2,5),
           (-43,14,math.pi/2,5,-math.pi/2,6),(-37,-1.75,math.pi/2,6,0,12)]
    if direction>0:return right
    result=[]
    for i in range(10):
        x,y,ir,ind,outr,outd=right[(-i)%10]
        result.append((-x,y,math.pi-outr,outd,math.pi-ir,ind))
    return result


def pose_values(direction,amount,foot_amount,neutral,sample,objects,projection,cloth):
    values={**neutral,**sample('tavi/turnHead',(0.85*direction+1)/2),
            **sample('tavi/turnBody',(direction+1)/2)}
    def key(id,prop,value):values[(id,prop)]=('KeyFrameDouble',str(value))
    key('0:9414','x',100)
    key('0:2207','x',-1-15*direction*amount)
    key('0:2207','y',-150+12*amount)
    key('0:2206','rotation',0)
    for upper,lower,standing_scale in projection:
        # Keep the shin's ankle at the actual shoe target throughout the
        # transition, not only in the held pose. Hip settling and foot lifting
        # deliberately have different timing.
        knee_y=525.5-42.788196*foot_amount-(397.277005+12*amount)-67.434799
        key(upper,'scaleX',(knee_y+11)/71.474152)
        key(lower,'y',knee_y)
    for side,id,base in (('L','0:2559',288.5),('R','0:2506',322.5)):
        key(id,'x',base+direction*50*foot_amount)
        # Neutral thighs project toward the viewer, with full-length shins.
        lift=42.788196 if direction==0 else 68
        key(id,'y',525.5-lift*foot_amount)
        key(id,'rotation',direction*0.025*foot_amount)
    for upper,lower,sign in (('0:2079','0:2080',-1),('0:2340','0:2341',1)):
        a=float(objects[upper].get('rotation',0));b=float(objects[lower].get('rotation',0))
        key(upper,'rotation',a+(1.2-a)*amount)
        target_bend=1.4 if sign*direction>0 else 1.2
        key(lower,'rotation',b+(target_bend-b)*amount)
    for id,near in (('47:100',max(0,direction)),('47:180',max(0,direction)),
                    ('47:200',max(0,-direction)),('47:280',max(0,-direction))):
        key(id,'opacity',amount if direction==0 else near)
    # Deep hip flexion needs a continuous lap silhouette, not rigid rotation
    # of the hem with the thigh. The waistband remains fully waist-bound.
    wx=0.79351809;wy=-22.907013
    for index,((id,base),target) in enumerate(zip(cloth,lap_shape(direction))):
        for prop,target_value in zip(('x','y','inRotation','inDistance','outRotation','outDistance'),target):
            if prop=='x':target_value+=wx
            if prop=='y':target_value+=wy
            if prop.endswith('Rotation'):
                target_value+=2*math.pi*round((base[prop]-target_value)/(2*math.pi))
            value=base[prop]+(target_value-base[prop])*foot_amount
            # Mid-lift IK bends the knee farther forward than the held pose.
            # Apply overlap after the main morph so early lift/late lowering
            # have the same coverage as the middle of the knee's arc.
            forward=(2,3,4) if direction>0 else (6,7,8)
            if direction and prop=='x' and index in forward:
                value+=direction*20*math.sin(math.pi*foot_amount)
            key(id,prop,value)
    # Actual support is the bottom of the retained pelvis, not the visual knee.
    key('51:1','opacity',amount)
    key('51:1','x',406.25348459-(36*direction))
    key('51:2','width',180 if direction==0 else 100)
    return values


def create_seating_project(board,neutral,sample,animation,new_id,write_project,folder,view='front'):
    target=copy.deepcopy(board)
    projection=install_seated_projection(target) if view=='front' else []
    cloth=seated_skirt_corrective(target)
    objects={e.get('id'):e for e in target.iter() if e.get('id')}
    phases=[('idle',18),('sit-'+view,60),('hold-'+view,150),('stand-'+view,60),('idle-end',18)]
    duration=sum(n for _,n in phases);frames=[]
    for frame in range(0,duration+1,2):
        start=0
        for name,length in phases:
            if frame<=start+length:break
            start+=length
        u=max(0,min(1,(frame-start)/length));q=smooth(u)
        direction={'right':1,'left':-1,'front':0}[view]
        body=feet=0
        if name.startswith('sit-'):
            body=smooth(min(1,u/0.6))
            feet=smooth(max(0,min(1,(u-0.45)/0.55)))
        elif name.startswith('hold-'):body=feet=1
        elif name.startswith('stand-'):
            feet=1-smooth(min(1,u/0.55))
            body=1-smooth(max(0,min(1,(u-0.45)/0.55)))
        frames.append((frame,pose_values(direction,body,feet,neutral,sample,objects,projection,cloth)))
    for sm in target.findall('StateMachine'):target.remove(sm)
    target.set('width','800')
    ledge=ET.Element('Shape',name='review ledge - not part of avatar',x='406.25348459',y='436',opacity='0',id='51:1')
    ET.SubElement(ledge,'Rectangle',width='100',height='10',cornerRadiusTL='3',cornerRadiusTR='3',id='51:2')
    fill=ET.SubElement(ledge,'Fill',id='51:3')
    ET.SubElement(fill,'SolidColor',colorValue='FF5E536B',id='51:4')
    target.append(ledge)
    clip=animation('tavi/perch/contact-review',frames,duration,loop='loop')
    for prop in clip.iter('KeyedProperty'):
        keys=list(prop)
        for i,key in enumerate(keys[1:-1],1):
            if keys[i-1].get('value')==key.get('value')==keys[i+1].get('value'):prop.remove(key)
    target.append(clip)
    sm=ET.SubElement(target,'StateMachine',name='Tavi seated pose review',id='51:10')
    layer=ET.SubElement(sm,'StateMachineLayer',name='Sit and stand',id='51:11')
    entry=ET.SubElement(layer,'EntryState',x='0',y='0',id='51:12')
    ET.SubElement(entry,'StateTransition',stateToId='51:13',id='51:14')
    ET.SubElement(layer,'AnimationState',animationId=clip.get('id'),x='220',y='0',id='51:13')
    target.set('defaultStateMachineId','51:10')
    write_project(folder,target)
    (folder/'rive.yaml').write_text('name: tavi-seated-'+view+'\nmain: "lyla animation"\n')
    return target,clip
