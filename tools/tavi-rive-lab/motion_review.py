"""Native motion selector. Changes modes at a shared resting loop boundary."""
import copy
import xml.etree.ElementTree as ET
from locomotion import smooth
from gaits import gait_sample, PROFILES
from motion_legs import project_motion_legs

GLYPHS={
 'W':[[(0,0),(1,7),(2.5,4),(4,7),(5,0)]],
 'A':[[(0,7),(2.5,0),(5,7)],[(1,4),(4,4)]],
 'L':[[(0,0),(0,7),(5,7)]],
 'K':[[(0,0),(0,7)],[(5,0),(0,4),(5,7)]],
 'S':[[(5,0),(1,0),(0,1),(0,3),(5,4),(5,6),(4,7),(0,7)]],
 'P':[[(0,7),(0,0),(4,0),(5,1),(5,3),(4,4),(0,4)]],
 'R':[[(0,7),(0,0),(4,0),(5,1),(5,3),(4,4),(0,4)],[(2.5,4),(5,7)]],
 'I':[[(0,0),(5,0)],[(2.5,0),(2.5,7)],[(0,7),(5,7)]],
 'N':[[(0,7),(0,0),(5,7),(5,0)]],
 'T':[[(0,0),(5,0)],[(2.5,0),(2.5,7)]]}

def action_clip(mode,board,neutral,sample,animation):
    cfg=PROFILES[mode];travel=cfg['distance'];beat=cfg['beat'];beats=cfg['beats']
    phases=[('idle',20),('turn-right',36),('prepare-right',18),('move-right',beat*beats),
            ('settle-right',24),('hold-right',24),('turn-left',54),('prepare-left',18),
            ('move-left',beat*beats),('settle-left',24),('hold-left',24),('turn-front',36),('idle-end',20)]
    duration=sum(n for _,n in phases)
    objects={e.get('id'):e for e in board.iter() if e.get('id')}
    body_rest=float(objects['0:2207'].get('y'));arm_rest=float(objects['0:2079'].get('rotation'))
    fore_rest=float(objects['0:2080'].get('rotation',0))
    frames=[]
    for frame in range(0,duration+1):
        start=0
        for name,length in phases:
            if frame<=start+length:break
            start+=length
        u=max(0,min(1,(frame-start)/length));ease=smooth(u)
        if name=='turn-right':direction=ease
        elif name=='turn-left':direction=1-2*ease
        elif name=='turn-front':direction=-1+ease
        elif name.endswith('right'):direction=1
        elif name.endswith('left'):direction=-1
        else:direction=0
        root=100+(travel if name in ('settle-right','hold-right','turn-left','prepare-left') else 0)
        body=0;activity=0;arm=arm_rest;fore=fore_rest
        feet={'L':(288.5,525.5,0),'R':(322.5,525.5,0)}
        if name.startswith('prepare-'):
            activity=ease;body=cfg['body']*activity
            target_arm=arm_rest+direction*0.44 if mode=='sprint' else 0.20
            arm=arm_rest+(target_arm-arm_rest)*activity
            target_fore=1.85 if mode=='sprint' else -0.44
            fore=fore_rest+(target_fore-fore_rest)*activity
        elif name.startswith('settle-'):
            activity=1-ease;body=cfg['body']*activity
            target_arm=arm_rest+direction*0.44 if mode=='sprint' else 0.20
            arm=arm_rest+(target_arm-arm_rest)*activity
            fore=fore_rest+((1.85 if mode=='sprint' else -0.44)-fore_rest)*activity
            trailing='L' if direction>0 else 'R'
            x,_,_=feet[trailing]
            feet[trailing]=(x-direction*cfg['tail_dx']*activity,525.5-cfg['tail_lift']*activity,direction*cfg['tail_pitch']*activity)
        elif name.startswith('move-'):
            activity=1;gait=gait_sample(mode,frame-start,1 if direction>0 else -1)
            origin=100+(travel if direction<0 else 0)
            root=origin+gait['root'];body=gait['body'];fore=gait['fore']
            arm=(arm_rest+gait['arm']) if mode=='sprint' else gait['arm']
            for side,base in (('L',288.5),('R',322.5)):
                x,y,pitch=gait['feet'][side]
                feet[side]=(base+x-gait['root'],525.5+y,pitch)
        values={**neutral,**sample('tavi/turnHead',(0.85*direction+1)/2),
                **sample('tavi/turnBody',(direction+1)/2)}
        values.update(sample('tavi/faceY',((0.30*activity if mode=='skip' else 0)+1.25)/2.5))
        def key(id,prop,value):values[(id,prop)]=('KeyFrameDouble',str(value))
        key('0:9414','x',root);key('0:2207','y',body_rest+body)
        key('0:2206','rotation',direction*0.08*activity if mode=='sprint' else 0)
        for upper,lower,sign in (('0:2079','0:2080',-1),('0:2340','0:2341',1)):
            clearance=0.16*activity*max(0,-sign*direction) if mode=='sprint' else 0
            key(upper,'rotation',arm-clearance)
            if mode=='sprint':
                # Mirrored arm hierarchies need opposite elbow signs so BOTH
                # forearms/fists point toward travel, not toward one another.
                flex=fore_rest+(fore-fore_rest)*(-sign*direction)
                key(lower,'rotation',flex)
            else:key(lower,'rotation',fore)
        for side,id in (('L','0:2559'),('R','0:2506')):
            x,y,pitch=feet[side]
            key(id,'x',x);key(id,'y',y);key(id,'rotation',pitch)
        for solo,rest,palm in (('7:6','7:1','7:2'),('7:44','7:39','7:40')):
            values[(solo,'activeComponentId')]=('KeyFrameId',palm if mode=='skip' and activity>0.5 else rest)
        frames.append((frame,values))
    clip=animation('tavi/'+mode+'/contact-review',frames,duration,loop='loop')
    for prop in clip.iter('KeyedProperty'):
        keys=list(prop)
        for i,key in enumerate(keys[1:-1],1):
            if keys[i-1].get('value')==key.get('value')==keys[i+1].get('value'):prop.remove(key)
    return clip

def create_motion_project(board,walk,neutral,sample,animation,button,new_id,write_project,folder):
    target=copy.deepcopy(walk)
    for sm in target.findall('StateMachine'):target.remove(sm)
    clips=[next(a for a in target.findall('LinearAnimation') if a.get('name')=='tavi/walk/contact-review')]
    # These properties are shared across modes, including each resting pose.
    for id,prop,kind,value in (('0:2206','rotation','KeyFrameDouble','0'),('0:2850','y','KeyFrameDouble','0'),
                              ('7:6','activeComponentId','KeyFrameId','7:1'),
                              ('7:44','activeComponentId','KeyFrameId','7:39')):
        # The walk keys its own torso overlap; never shadow it with a hold.
        if any(o.get('objectId')==id and o.find(f"KeyedProperty[@property='{prop}']") is not None
               for o in clips[0].findall('KeyedObject')):continue
        obj=ET.SubElement(clips[0],'KeyedObject',objectId=id)
        p=ET.SubElement(obj,'KeyedProperty',property=prop)
        ET.SubElement(p,kind,frame='0',value=value,interpolationType='hold')
    for mode in ('sprint','skip'):
        clip=action_clip(mode,board,neutral,sample,animation)
        project_motion_legs(target,clip,new_id)
        target.append(clip);clips.append(clip)
    sm=ET.SubElement(target,'StateMachine',name='Tavi locomotion review',id='48:1')
    ET.SubElement(sm,'StateMachineNumber',name='motionMode',value='2',id='48:2')
    layer=ET.SubElement(sm,'StateMachineLayer',name='Walk sprint skip',id='48:3')
    entry=ET.SubElement(layer,'EntryState',x='0',y='0',id='48:4')
    ET.SubElement(entry,'StateTransition',stateToId='48:102',id=new_id())
    for index,(mode,clip) in enumerate(zip(('WALK','SPRINT','SKIP'),clips)):
        state=ET.SubElement(layer,'AnimationState',animationId=clip.get('id'),x=str(220+250*index),y='0',id=f'48:{100+index}')
        for destination in range(3):
            if destination==index:continue
            transition=ET.SubElement(state,'StateTransition',stateToId=f'48:{100+destination}',duration='0',
                enableExitTime='true',exitTimeIsPercetange='true',exitTime='100',id=new_id())
            ET.SubElement(transition,'TransitionNumberCondition',inputId='48:2',opValue='equal',value=str(destination),id=new_id())
        x=250+250*index
        shape=button(target,mode,x,28,180,34,90+index)
        listener=ET.SubElement(sm,'StateMachineListenerSingle',name=mode,targetId=shape.get('id'),listenerTypeValue='click',id=new_id())
        ET.SubElement(listener,'ListenerNumberChange',inputId='48:2',value=str(index),id=new_id())
        label=ET.Element('Shape',name=mode+' label',id=new_id())
        for j,char in enumerate(mode):
            for points in GLYPHS[char]:
                path=ET.SubElement(label,'PointsPath',id=new_id())
                for px,py in points:ET.SubElement(path,'StraightVertex',x=str(x-(len(mode)*14-4)/2+j*14+px*2),y=str(21+py*2),id=new_id())
        stroke=ET.SubElement(label,'Stroke',thickness='1.8',cap='round',join='round',id=new_id())
        ET.SubElement(stroke,'SolidColor',colorValue='FF4A315E',id=new_id())
        target.insert(0,label)
        label_listener=ET.SubElement(sm,'StateMachineListenerSingle',name=mode+' label click',targetId=label.get('id'),listenerTypeValue='click',id=new_id())
        ET.SubElement(label_listener,'ListenerNumberChange',inputId='48:2',value=str(index),id=new_id())
        fill_id=next(shape.iter('SolidColor')).get('id')
        for active,animation_clip in enumerate(clips):
            obj=ET.SubElement(animation_clip,'KeyedObject',objectId=fill_id)
            prop=ET.SubElement(obj,'KeyedProperty',property='colorValue')
            ET.SubElement(prop,'KeyFrameColor',frame='0',value='FFBCA1D2' if active==index else 'FFE2D8EC',interpolationType='hold')
    target.set('defaultStateMachineId','48:1')
    write_project(folder,target)
    (folder/'rive.yaml').write_text('name: tavi-motion-lab\nmain: "lyla animation"\n')
