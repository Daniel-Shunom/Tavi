"""Isolated front/profile/rear turn authoring on the original 2D rig."""
import copy
import math
import xml.etree.ElementTree as ET
from locomotion import smooth
from rear_climbing import install_rear_art
from climbing import prune_holds
from seating import seated_skirt_corrective


def create_turnaround_project(board,neutral,sample,animation,new_id,write_project,folder):
    target=copy.deepcopy(board)
    for sm in target.findall('StateMachine'):target.remove(sm)
    objects={e.get('id'):e for e in target.iter() if e.get('id')}
    head=objects['0:437'];original_head=list(head)
    install_rear_art(target,new_id,hide_front=False)
    back_art=[e for e in head if e not in original_head]
    # Keep the continuous original crown outside the face-reveal mask.
    original_head.remove(objects['0:596'])
    back=ET.Element('Node',name='turn/rear hair artwork',opacity='0',id='68:1')
    for item in back_art:head.remove(item);back.append(item)
    head.append(back)
    front=ET.Element('Node',name='turn/front head artwork',id='68:2')
    for item in original_head:head.remove(item);front.append(item)
    head.insert(0,front)
    # A curved occlusion boundary progressively reveals back hair. It removes
    # the far facial features spatially, without dissolving two faces together.
    mask=ET.SubElement(head,'Shape',name='turn/facial visibility silhouette',id='68:3')
    path=ET.SubElement(mask,'PointsPath',isClosed='true',id='68:4')
    points=[(-260,-280),(260,-280),(260,-170),(260,-90),(260,-20),(260,100),
            (-260,100),(-260,-20),(-260,-90),(-260,-170)]
    for index,(x,y) in enumerate(points):
        ET.SubElement(path,'CubicDetachedVertex',x=str(x),y=str(y),
            inRotation=str(-math.pi/2 if index<6 else math.pi/2),inDistance='18' if index in (2,3,4,7,8,9) else '0',
            outRotation=str(math.pi/2 if index<6 else -math.pi/2),outDistance='18' if index in (2,3,4,7,8,9) else '0',id=f'68:{100+index}')
    # Clips attach to drawable shapes, not a transform group.
    for shape in front.iter('Shape'):
        ET.SubElement(shape,'ClippingShape',sourceId='68:3',id=new_id())
    cloth=seated_skirt_corrective(target)
    objects={e.get('id'):e for e in target.iter() if e.get('id')}
    # Authored holds at front, three-quarter, profile, rear three-quarter, rear.
    phases=[(0,36),(math.pi/4,48),(math.pi/2,42),(3*math.pi/4,48),(math.pi,42),
            (math.pi,48),(5*math.pi/4,42),(3*math.pi/2,48),(7*math.pi/4,42),(2*math.pi,48),(2*math.pi,36)]
    duration=sum(length for angle,length in phases);frames=[]
    for frame in range(0,duration+1,2):
        start=0;previous=0
        for destination,length in phases:
            if frame<=start+length:break
            start+=length;previous=destination
        u=max(0,min(1,(frame-start)/length))
        theta=previous+(destination-previous)*smooth(u)
        head_theta=theta+.10*math.sin(theta)
        direction=-math.sin(theta);head_direction=-math.sin(head_theta)
        rear=(1-math.cos(head_theta))/2
        facing={**neutral,**sample('tavi/turnHead',(.85*head_direction+1)/2),**sample('tavi/turnBody',(direction+1)/2)}
        def key(id,prop,value):facing[(id,prop)]=('KeyFrameDouble',str(value))
        key('0:9414','x',100);key('0:9414','y',0)
        key('0:2207','x',-1+3*math.sin(2*theta))
        key('0:2206','rotation',.018*math.sin(2*theta))
        key('68:1','opacity',smooth(min(1,rear/.08)))
        key('68:1','x',-8*head_direction)
        key('68:1','scaleX',1-.06*abs(head_direction))
        key('68:2','x',24*head_direction)
        key('68:2','opacity',0 if rear>.92 else 1)
        # Left and right presentations are exact geometric counterparts.
        side=1 if head_direction<=0 else -1
        edge=260-520*smooth(max(0,min(1,(rear-.08)/.84)))
        bulge=math.sin(math.pi*rear)
        edge_bulge=(0,0,12,20,-8,0,0,-8,20,12)
        for index,(x,y) in enumerate(points):
            if side==1:x=edge+edge_bulge[index]*bulge if 0<index<6 else -260
            else:x=260 if 0<index<6 else -edge-edge_bulge[index]*bulge
            key(f'68:{100+index}','x',x)
        # Preserve the approved weighted torso turn and fitted skirt. Additional
        # contour compression would double the shoulder anchors' deformation.
        for id,attrs in cloth:
            for prop,value in attrs.items():key(id,prop,value)
        key('29:100','y',-22-2*((1-math.cos(theta))/2))
        for id in ('47:100','47:180','47:200','47:280'):key(id,'opacity',0)
        for id in ('0:13111','0:13103','0:13159','0:13171'):key(id,'opacity',1-smooth(max(0,min(1,(rear-.35)/.3))))
        frames.append((frame,facing))
    clip=prune_holds(animation('tavi/turn/front-profile-rear-review',frames,duration,loop='loop'))
    target.append(clip)
    sm=ET.SubElement(target,'StateMachine',name='Tavi full turnaround authoring',id='68:10')
    layer=ET.SubElement(sm,'StateMachineLayer',name='Front profile rear',id='68:11')
    entry=ET.SubElement(layer,'EntryState',x='0',y='0',id='68:12')
    ET.SubElement(entry,'StateTransition',stateToId='68:13',id='68:14')
    ET.SubElement(layer,'AnimationState',animationId=clip.get('id'),x='220',y='0',id='68:13')
    target.set('defaultStateMachineId','68:10');target.set('width','800');target.set('height','600')
    write_project(folder,target)
    (folder/'rive.yaml').write_text('name: tavi-turnaround-authoring\nmain: "lyla animation"\n')
