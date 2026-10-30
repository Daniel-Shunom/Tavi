"""Deterministic first walking experiment with world-space stance contacts."""
import copy
import math
import xml.etree.ElementTree as ET

STEP_FRAMES=28
STEPS=6
STEP_DISTANCE=30
LIFT=20
# Weight (character-motion skill): hips sit a little low and travel clearly
# through each step, lowest just after contact (down), highest at push-off (up).
# The highest point keeps the old 4u clearance so every leg still reaches.
WALK_BODY=12
BOB=8
ARM_SWING=0.30
FORE_REST=0.25
FORE_DRAG=1.1
LEAN=0.03
SWAY=0.02
LAG_FRAMES=4
HEAD_LAG_FRAMES=3
HEAD_FOLLOW=0.8
HEAD_LEVEL=0.7


def smooth(t):
    return t*t*(3-2*t)


def distance_progress(t):
    ramp=0.1
    if t<ramp:return t*t/(2*ramp*(1-ramp))
    if t>1-ramp:return 1-(1-t)**2/(2*ramp*(1-ramp))
    return (t-ramp/2)/(1-ramp)


def walk_bob(t):
    """Hip drop per step at continuous step time t: lowest just after contact
    (the down), highest just after passing, where the legs gather under the
    hips (both shins share one lean, so the rig cannot rise with feet spread).
    The time warp lands the weight quickly and lets the rise float."""
    return WALK_BODY+BOB*math.sin(2*math.pi*(t+0.13+0.05*math.sin(2*math.pi*t)))


def walk_arm(t,direction):
    return direction*ARM_SWING*math.cos(math.pi*t)


def walk_sway(t):
    """Torso roll over the stance leg; one side per step."""
    return SWAY*math.sin(math.pi*t)


def walk_secondary(t,direction):
    """Overlap on the walk: torso lean and sway, forearms dragging their upper
    arms, and a head that trails the hips and stays nearly level."""
    lag=LAG_FRAMES/STEP_FRAMES;head_lag=HEAD_LAG_FRAMES/STEP_FRAMES
    trail=max(0,t-lag);head_t=max(0,t-head_lag)
    return dict(torso=direction*LEAN+walk_sway(t),
                fore=FORE_REST+FORE_DRAG*(walk_arm(trail,direction)-walk_arm(t,direction)),
                head_y=HEAD_FOLLOW*(walk_bob(head_t)-walk_bob(t)),
                head_rotation=-HEAD_LEVEL*walk_sway(head_t))


def walk_sample(frame,direction):
    """Return root travel and foot world offsets, relative to this trip's start.

    Foot anchors advance only during swing. Stance positions are constant in
    world space; the authored local target subtracts actual root travel.
    """
    frame=max(0,min(STEP_FRAMES*STEPS,frame))
    step=min(STEPS-1,int(frame//STEP_FRAMES))
    u=(frame-step*STEP_FRAMES)/STEP_FRAMES
    first='L' if direction>0 else 'R'
    swinging=first if step%2==0 else ('R' if first=='L' else 'L')
    contacts={'L':0.0,'R':0.0}
    for completed in range(step):
        side=first if completed%2==0 else ('R' if first=='L' else 'L')
        contacts[side]+=direction*2*STEP_DISTANCE
    feet={side:(x,0.0,0.0) for side,x in contacts.items()}
    # Quintic swing timing has zero velocity and acceleration at contact.
    q=u*u*u*(10-15*u+6*u*u)
    feet[swinging]=(contacts[swinging]+direction*2*STEP_DISTANCE*q,
                    -LIFT*math.sin(math.pi*u)**2,
                    direction*0.16*math.sin(2*math.pi*u)*math.sin(math.pi*u))
    t=frame/STEP_FRAMES
    return dict(root=direction*STEPS*STEP_DISTANCE*distance_progress(frame/(STEP_FRAMES*STEPS)),
                feet=feet,stance='R' if swinging=='L' else 'L',
                body=walk_bob(t),arm=walk_arm(t,direction),**walk_secondary(t,direction))


def create_walk_project(board,neutral,sample,animation,write_project,folder,new_id):
    objects={e.get('id'):e for e in board.iter() if e.get('id')}
    # One authored loop: turn, walk right, settle, turn, walk left, settle.
    # The root returns on foot, so the loop never resets across the stage.
    phases=[('idle',20),('turn-right',36),('prepare-right',18),('walk-right',168),
            ('settle-right',18),('hold-right',24),('turn-left',54),
            ('prepare-left',18),('walk-left',168),('settle-left',18),
            ('hold-left',24),('turn-front',36),('idle-end',20)]
    duration=sum(length for _,length in phases)
    root_start=100
    body_rest=float(objects['0:2207'].get('y'))
    head_rest=float(objects['0:5358'].get('y'))
    arm_rest=float(objects['0:2079'].get('rotation'))
    fore_rest=float(objects['0:2080'].get('rotation',0))
    foot_bases={side:(float(objects[id].get('x')),float(objects[id].get('y')))
                for side,id in (('L','0:2559'),('R','0:2506'))}
    frames=[]
    for frame in range(0,duration+1):
        start=0
        for name,length in phases:
            if frame<=start+length:break
            start+=length
        u=max(0,min(1,(frame-start)/length))
        eased=smooth(u)
        if name=='turn-right':direction=eased
        elif name=='turn-left':direction=1-2*eased
        elif name=='turn-front':direction=-1+eased
        elif name.endswith('right'):direction=1
        elif name.endswith('left'):direction=-1
        else:direction=0
        root=root_start+(180 if name in ('settle-right','hold-right','turn-left','prepare-left') else 0)
        body=0;arm=0;fore=fore_rest;activity=0;torso=0;head_y=0;head_rotation=0
        feet={side:(x,y,0) for side,(x,y) in foot_bases.items()}
        if name.startswith('prepare-'):
            # Ease into the first contact pose exactly, so the loop has no pop.
            activity=eased;first=walk_sample(0,direction)
            body=first['body']*eased;arm=first['arm']*eased
            fore=fore_rest+(first['fore']-fore_rest)*eased
            torso=first['torso']*eased
        elif name.startswith('settle-'):
            # Leave the last pose with its overlap still decaying.
            activity=1-eased;last=walk_sample(STEP_FRAMES*STEPS,direction)
            body=last['body']*activity;arm=last['arm']*activity
            fore=fore_rest+(last['fore']-fore_rest)*activity
            torso=last['torso']*activity;head_y=last['head_y']*activity
            head_rotation=last['head_rotation']*activity
        elif name.startswith('walk-'):
            activity=1
            gait=walk_sample(frame-start,1 if name=='walk-right' else -1)
            origin=root_start+(180 if direction<0 else 0)
            root=origin+gait['root'];body=gait['body'];arm=gait['arm'];fore=gait['fore']
            torso=gait['torso'];head_y=gait['head_y'];head_rotation=gait['head_rotation']
            for side,(x,y) in foot_bases.items():
                world_x,dy,pitch=gait['feet'][side]
                feet[side]=(x+world_x-gait['root'],y+dy,pitch)
        values={**neutral,**sample('tavi/turnHead',(0.85*direction+1)/2),
                **sample('tavi/turnBody',(direction+1)/2)}
        def value(id,property,number):values[(id,property)]=('KeyFrameDouble',str(number))
        value('0:9414','x',root)
        value('0:2207','y',body_rest+body)
        value('0:2206','rotation',torso)
        value('0:5358','y',head_rest+head_y)
        value('0:5358','rotation',head_rotation)
        for upper,lower,sign in (('0:2079','0:2080',-1),('0:2340','0:2341',1)):
            # The near arm swings beside the torso, with clearance for its
            # forearm width instead of intersecting the garment's side plane.
            clearance=0.10*activity*max(0,-sign*direction)
            value(upper,'rotation',arm_rest+arm-clearance);value(lower,'rotation',fore)
        for side,id in (('L','0:2559'),('R','0:2506')):
            x,y,pitch=feet[side]
            value(id,'x',x);value(id,'y',y);value(id,'rotation',pitch)
        frames.append((frame,values))
    target=copy.deepcopy(board)
    for machine in target.findall('StateMachine'):target.remove(machine)
    target.set('width','1000')
    clip=animation('tavi/walk/contact-review',frames,duration,loop='loop')
    # Retain ends of constant holds while removing redundant interior keys.
    for prop in clip.iter('KeyedProperty'):
        keys=list(prop)
        for i,key in enumerate(keys[1:-1],1):
            if keys[i-1].get('value')==key.get('value')==keys[i+1].get('value'):
                prop.remove(key)
    target.append(clip)
    from motion_legs import project_motion_legs
    project_motion_legs(target,clip,new_id)
    sm=ET.SubElement(target,'StateMachine',name='Tavi walking review',id='46:1')
    layer=ET.SubElement(sm,'StateMachineLayer',name='Contact walk',id='46:2')
    entry=ET.SubElement(layer,'EntryState',x='0',y='0',id='46:3')
    ET.SubElement(entry,'StateTransition',stateToId='46:4',id='46:5')
    ET.SubElement(layer,'AnimationState',animationId=clip.get('id'),x='220',y='0',id='46:4')
    target.set('defaultStateMachineId','46:1')
    floor=ET.Element('Shape',name='walk review ground',id='46:10')
    path=ET.SubElement(floor,'PointsPath',id='46:11')
    ET.SubElement(path,'StraightVertex',x='150',y='545',id='46:12')
    ET.SubElement(path,'StraightVertex',x='850',y='545',id='46:13')
    stroke=ET.SubElement(floor,'Stroke',thickness='1',id='46:14')
    ET.SubElement(stroke,'SolidColor',colorValue='FF635C69',id='46:15')
    target.append(floor)
    write_project(folder,target)
    (folder/'rive.yaml').write_text('name: tavi-walking-lab\nmain: "lyla animation"\n')
    return target
