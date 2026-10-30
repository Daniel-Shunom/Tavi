"""Contact-authored climbing, isolated from the standing and gait projects.

Coordinates are artboard pixels, angles radians, at 60 fps. The review's rope
ladder is a contact guide; character motion never translates that guide.
"""
import copy
import math
import xml.etree.ElementTree as ET
from locomotion import smooth
from seating import seated_skirt_corrective
from rear_climbing import install_rear_art
from climbing_legs import install_surface_legs,surface_knee,A,B,DEPTH_SCALE

BEAT=60
STEPS=4
RISE=36
BASE_Y=180


def ease(t):
    t=max(0,min(1,t))
    return t*t*t*(10+t*(-15+6*t))


def climb_sample(frame):
    """World offsets: one diagonal pair repositions, the other stays pinned."""
    frame=max(0,min(BEAT*STEPS,frame))
    step=min(STEPS-1,int(frame//BEAT));u=(frame-step*BEAT)/BEAT
    hand='L' if step%2==0 else 'R';foot='R' if hand=='L' else 'L'
    hands={'L':0.,'R':-RISE};feet={'L':-RISE,'R':0.}
    for previous in range(step):
        h='L' if previous%2==0 else 'R';f='R' if h=='L' else 'L'
        hands[h]-=2*RISE;feet[f]-=2*RISE
    # Foothold leads; hand releases only after the other grip carries weight.
    fu=max(0,min(1,u/.72));hu=max(0,min(1,(u-.20)/.80))
    feet[foot]-=2*RISE*ease(fu)
    hands[hand]-=2*RISE*ease(hu)
    return dict(root=-RISE*(step+ease(u)),hands=hands,feet=feet,
                moving_hand=hand,moving_foot=foot,
                hand_arc=math.sin(math.pi*hu)**2,
                foot_arc=math.sin(math.pi*fu)**2)


def multiply(a,b):
    return (a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
            a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],
            a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5])


def point(matrix,x,y):
    a,b,c,d,tx,ty=matrix
    return a*x+c*y+tx,b*x+d*y+ty


def inverse_point(matrix,x,y):
    a,b,c,d,tx,ty=matrix;det=a*d-b*c;x-=tx;y-=ty
    return (d*x-c*y)/det,(-b*x+a*y)/det


def prune_holds(clip):
    for prop in clip.iter('KeyedProperty'):
        keys=list(prop)
        for i,key in enumerate(keys[1:-1],1):
            if keys[i-1].get('value')==key.get('value')==keys[i+1].get('value'):prop.remove(key)
    return clip


class Rig:
    """FK evaluation for authored parent transforms; arms have no IK constraint."""
    def __init__(self,board,values,template=None):
        self.board=board;self.values=values
        self.objects=template.objects if template else {e.get('id'):e for e in board.iter() if e.get('id')}
        self.parents=template.parents if template else {c:p for p in board.iter() for c in p}
        self.cache={}

    def attr(self,e,name,default=0):
        return float(self.values.get((e.get('id'),name),('',e.get(name,default)))[1])

    def world(self,e):
        if e is self.board:return (1,0,0,1,0,0)
        if e in self.cache:return self.cache[e]
        parent=self.parents[e];r=self.attr(e,'rotation')
        sx=self.attr(e,'scaleX',1);sy=self.attr(e,'scaleY',1)
        x=self.attr(parent,'length') if e.tag=='Bone' else self.attr(e,'x')
        local=(math.cos(r)*sx,math.sin(r)*sx,-math.sin(r)*sy,math.cos(r)*sy,x,self.attr(e,'y'))
        result=multiply(self.world(parent),local);self.cache[e]=result
        return result

    def arm(self,upper_id,lower_id,target,bend):
        upper=self.objects[upper_id];lower=self.objects[lower_id]
        parent=self.world(self.parents[upper])
        x,y=inverse_point(parent,*target)
        x-=self.attr(upper,'x');y-=self.attr(upper,'y')
        a=self.attr(upper,'length');b=self.attr(lower,'length')
        reach=math.hypot(x,y)
        assert reach<=a+b+.001,f'Climbing grip unreachable: {reach}'
        elbow=bend*math.acos(max(-1,min(1,(x*x+y*y-a*a-b*b)/(2*a*b))))
        shoulder=math.atan2(y,x)-math.atan2(b*math.sin(elbow),a+b*math.cos(elbow))
        return shoulder,elbow


def create_climbing_project(board,neutral,sample,animation,new_id,write_project,folder,view):
    target=copy.deepcopy(board)
    for sm in target.findall('StateMachine'):target.remove(sm)
    target.set('width','800');target.set('height','820')
    direction={'front':0,'left':-1,'right':1,'rear':0}[view]
    rear_values=install_rear_art(target,new_id) if view=='rear' else {}
    cloth=seated_skirt_corrective(target)
    install_surface_legs(target)
    foreground=ET.Element('Shape',name='climb-only depth reference',opacity='0',id='65:20')
    ET.SubElement(foreground,'Ellipse',width='1',height='1',id='65:21')
    fill=ET.SubElement(foreground,'Fill',id='65:22')
    ET.SubElement(fill,'SolidColor',colorValue='00000000',id='65:23')
    target.insert(0,foreground)
    objects={e.get('id'):e for e in target.iter() if e.get('id')}
    for id in ('47:100','47:180','47:200','47:280'):
        for draw in objects[id].iter('DrawTarget'):draw.set('drawableId','65:20')
    facing={**neutral,**sample('tavi/turnHead',(.85*direction+1)/2),**sample('tavi/turnBody',(direction+1)/2)}
    facing.update(rear_values)
    facing[('0:2207','y')]=('KeyFrameDouble','-149.5')
    facing[('0:9414','x')]=('KeyFrameDouble','100')
    facing[('0:9414','y')]=('KeyFrameDouble',str(BASE_Y))
    rig=Rig(target,facing)
    arms=(('L','0:2079','0:2080',-1),('R','0:2340','0:2341',1))
    shoulders={side:point(rig.world(rig.objects[upper]),0,0) for side,upper,_,_ in arms}
    # Two sides of a narrow rope ladder; side views project its width, keeping
    # near/far contacts distinct and attached rather than flipping the rig.
    center=408+direction*24
    rail={'L':shoulders['L'][0]-56,'R':shoulders['R'][0]+56}
    hand_y=min(y for x,y in shoulders.values())-18
    foot_y=hand_y+6*RISE-18
    duration=20+72+BEAT*STEPS+36+BEAT*STEPS+72+20
    frames=[]
    for frame in range(0,duration+1,2):
        grip=1.;gait=climb_sample(0)
        if frame<20:grip=0
        elif frame<92:grip=ease((frame-20)/72)
        elif frame<=332:gait=climb_sample(frame-92)
        elif frame<=368:gait=climb_sample(240)
        elif frame<=608:gait=climb_sample(240-(frame-368))
        elif frame<680:grip=1-ease((frame-608)/72)
        else:grip=0
        values=dict(facing)
        def key(id,prop,value):values[(id,prop)]=('KeyFrameDouble',str(value))
        root=BASE_Y+gait['root']*grip
        key('0:9414','y',root)
        # Gaze leads the next grip / foothold with a restrained head pitch.
        gaze=.16-.28*smooth(max(0,min(1,(frame-332)/36)))
        values.update(sample('tavi/faceY',(gaze*grip+1.25)/2.5))
        current=Rig(target,values,rig)
        for side,upper,lower,sign in arms:
            hx=rail[side]+sign*8*gait['hand_arc']*(side==gait['moving_hand'])
            hy=hand_y+gait['hands'][side]
            # Blend the endpoint from the actual rest wrist before solving;
            # no angular branch switches or instant grip appearance.
            fore=current.objects[lower]
            rest=point(current.world(fore),current.attr(fore,'length'),0)
            contact=(rest[0]+(hx-rest[0])*grip,rest[1]+(hy-rest[1])*grip)
            a,b=current.arm(upper,lower,contact,-1)
            # Choose the nearest angular representation to rest; mirrored
            # parents encode the opposite anatomical elbow direction.
            rest_a=current.attr(current.objects[upper],'rotation')
            a+=2*math.pi*round((rest_a-a)/(2*math.pi))
            key(upper,'rotation',a);key(lower,'rotation',b)
        pants_world=current.world(current.objects['0:635'])
        for side,id,base,hip_id,control in (('L','0:2559',288.5,'0:2519',100),('R','0:2506',322.5,'0:2494',200)):
            arc=gait['foot_arc'] if side==gait['moving_foot'] else 0
            hip=point(current.world(current.objects[hip_id]),0,0)
            depth=(20-12*arc)*grip
            local_x=hip[0]-100+direction*DEPTH_SCALE*(20-12*arc)
            local_y=foot_y+gait['feet'][side]-root
            fx=base+(local_x-base)*grip;fy=525.5+(local_y-525.5)*grip
            key(id,'x',fx);key(id,'y',fy)
            key(id,'rotation',direction*.08*grip)
            foot=(100+fx,root+fy)
            knee=surface_knee(hip,foot,depth,direction)
            for joint,start,end,length in ((0,hip,knee,A),(1,knee,foot,B)):
                start=inverse_point(pants_world,*start);end=inverse_point(pants_world,*end)
                dx,dy=end[0]-start[0],end[1]-start[1]
                key(f'67:{control+joint}','x',start[0]);key(f'67:{control+joint}','y',start[1])
                key(f'67:{control+joint}','rotation',math.atan2(dy,dx))
                key(f'67:{control+joint}','scaleX',math.hypot(dx,dy)/length)
        for id,near in (('47:100',max(0,direction)),('47:180',max(0,direction)),
                        ('47:200',max(0,-direction)),('47:280',max(0,-direction))):
            key(id,'opacity',0 if view=='rear' else grip if direction==0 else near)
        # Knees now bend in depth, so the garment keeps its fitted rest contour.
        # Waist/pelvis skinning follows the body without sideways thigh stretch.
        for id,base in cloth:
            for prop,value in base.items():key(id,prop,value)
        frames.append((frame,values))
    clip=animation('tavi/climb/up-down-'+view,frames,duration,loop='loop')
    prune_holds(clip)
    target.append(clip)
    for action,start,end in (('up',92,332),('down',368,608)):
        action_frames=[]
        start_root=float(dict(frames)[start][('0:9414','y')][1])
        for frame,values in frames:
            if start<=frame<=end:
                values=dict(values)
                values[('0:9414','y')]=('KeyFrameDouble',str(float(values[('0:9414','y')][1])-start_root))
                action_frames.append((frame-start,values))
        target.append(prune_holds(animation('tavi/climb/'+action+'/'+view,action_frames,end-start)))
    # The guide is scene geometry, never parented to the moving character.
    guide=ET.Element('Shape',name='review rope ladder - fixed contact guide',id='65:1')
    for x in rail.values():
        path=ET.SubElement(guide,'PointsPath',id=new_id())
        for y in (325,730):ET.SubElement(path,'StraightVertex',x=str(x),y=str(y),id=new_id())
    for y in range(round(hand_y)-RISE*5,round(foot_y)+1,RISE):
        path=ET.SubElement(guide,'PointsPath',id=new_id())
        for x in rail.values():ET.SubElement(path,'StraightVertex',x=str(x),y=str(y),id=new_id())
    stroke=ET.SubElement(guide,'Stroke',thickness='3',cap='round',id=new_id())
    ET.SubElement(stroke,'SolidColor',colorValue='FF82708C',id=new_id())
    target.append(guide)
    sm=ET.SubElement(target,'StateMachine',name='Tavi climb up and down '+view,id='65:10')
    layer=ET.SubElement(sm,'StateMachineLayer',name='Grip pull release lower',id='65:11')
    entry=ET.SubElement(layer,'EntryState',x='0',y='0',id='65:12')
    ET.SubElement(entry,'StateTransition',stateToId='65:13',id='65:14')
    ET.SubElement(layer,'AnimationState',animationId=clip.get('id'),x='220',y='0',id='65:13')
    target.set('defaultStateMachineId','65:10')
    write_project(folder,target)
    (folder/'rive.yaml').write_text('name: tavi-climbing-'+view+'\nmain: "lyla animation"\n')
