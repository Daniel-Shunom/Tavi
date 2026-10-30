"""Export the refined rig with its facial library for the existing app engine."""
import copy
import math
import xml.etree.ElementTree as ET
from runtime_foundations import install_foundations
from expressions import append_expression_library


def create_runtime_project(walk,neutral,sample,animation,new_id,write_project,folder):
    target=copy.deepcopy(walk)
    for sm in target.findall('StateMachine'):target.remove(sm)
    target.attrib.pop('defaultStateMachineId',None)
    for shape in list(target):
        if shape.get('id')=='46:10':target.remove(shape)
    target.set('width','600');target.set('height','600')
    objects={e.get('id'):e for e in target.iter() if e.get('id')}
    # Reuse the original gesture timing, but only its arm rotations. Original
    # clips also key feet, hip scale and old draw rules; those must never take
    # ownership of the refined garment, projected legs or attention system.
    gesture_names={'wave Non Looping','celebration','thoughtful','hands on hips',
                   'back and forth','blink 2','blink 3','blink 4','wave','testing'}
    arm_ids={'0:5038','0:4914','0:2079','0:2080','0:2340','0:2341'}
    # Lower-body acting is a separate layer: it may accompany standing gestures,
    # but must yield while travelling or sitting. Keep authored hip/foot timing
    # and native IK bend choices, never the legacy per-leg scale deformation.
    lower_clips=[]
    for clip in target.findall('LinearAnimation'):
        if clip.get('name') not in gesture_names:continue
        lower=copy.deepcopy(clip)
        lower.set('name','tavi/runtime/acting/'+clip.get('name'))
        for obj in list(lower):
            if obj.tag!='KeyedObject':continue
            id=obj.get('objectId')
            allowed={'x','y','rotation'} if id=='0:2207' else {'x','y'} if id in {'0:2559','0:2506'} else {'invertDirection'} if objects.get(id) is not None and objects[id].tag=='IKConstraint' else set()
            for prop in list(obj):
                if prop.get('property') not in allowed:obj.remove(prop)
            if not len(obj):lower.remove(obj)
        for element in lower.iter():
            if element.get('id'):element.set('id',new_id())
        lower_clips.append(lower)
        for obj in list(clip):
            if obj.tag!='KeyedObject':continue
            if obj.get('objectId') not in arm_ids:
                clip.remove(obj);continue
            for prop in list(obj):
                if prop.get('property')!='rotation':obj.remove(prop)
            if not len(obj):clip.remove(obj)
    target.extend(lower_clips)
    for id,name in (('0:2519','tavi/runtime/hipL'),('0:2494','tavi/runtime/hipR'),
                    ('0:635','tavi/runtime/pelvis'),('69:100','tavi/runtime/legL.upper'),
                    ('69:101','tavi/runtime/legL.shin'),('69:200','tavi/runtime/legR.upper'),
                    ('69:201','tavi/runtime/legR.shin'),
                    ('0:2520','tavi/runtime/nativeKneeL'),
                    ('0:2495','tavi/runtime/nativeKneeR')):objects[id].set('name',name)
    ET.SubElement(target,'Node',name='tavi/runtime/mode',id='71:1')
    foreground=ET.Element('Shape',name='runtime forearm depth reference',opacity='0',id='71:10')
    ET.SubElement(foreground,'Ellipse',width='1',height='1',id='71:11')
    target.insert(0,foreground)
    arm_front={}
    for id in ('47:100','47:180','47:200','47:280'):
        for draw in objects[id].iter('DrawTarget'):draw.set('drawableId','71:10')
        arm_front[(id,'opacity')]=('KeyFrameDouble','1')
    target.append(animation('tavi/runtime/arms-front',[(0,arm_front),(60,arm_front)],60))
    walk_clip=next(a for a in target.findall('LinearAnimation') if a.get('name')=='tavi/walk/contact-review')
    rest={}
    for obj in walk_clip.findall('KeyedObject'):
        for prop in obj.findall('KeyedProperty'):
            first=prop[0];rest[(obj.get('objectId'),prop.get('property'))]=(first.tag,first.get('value'))
    rest[('0:9414','x')]=('KeyFrameDouble','0')
    rest[('0:9414','y')]=('KeyFrameDouble','0')
    front_calves={}
    for base,shape_id in ((100,'0:2544'),(200,'0:679')):
        overlay=copy.deepcopy(objects[shape_id]);path=overlay.find('PointsPath')
        path.remove(next(v for v in path if 'Vertex' in v.tag))
        remap={e.get('id'):new_id() for e in overlay.iter() if e.get('id')}
        remap[overlay.get('id')]=f'72:{base}'
        for element in overlay.iter():
            for prop,value in list(element.attrib.items()):
                if value in remap:element.set(prop,remap[value])
        overlay.set('name','tavi/runtime/floor calf');overlay.set('opacity','0')
        overlay.find('Stroke').set('cap','butt')
        rules=ET.SubElement(overlay,'DrawRules',drawTargetId=f'72:{base+1}',id=f'72:{base+2}')
        ET.SubElement(rules,'DrawTarget',drawableId='37:10',placementValue='before',id=f'72:{base+1}')
        objects['0:635'].insert(0,overlay)
        rest[(f'72:{base}','opacity')]=('KeyFrameDouble','0')
        front_calves[(f'72:{base}','opacity')]=('KeyFrameDouble','1')
    target.append(animation('tavi/runtime/rest',[(0,rest),(60,rest)],60))
    target.append(animation('tavi/runtime/floor-calves',[(0,{key:('KeyFrameDouble','0') for key in front_calves}),(60,front_calves)],60))
    append_expression_library(target,sample,animation)
    # Only the garment corrective is layered over the state engine. Its root,
    # feet, facial expression and gaze remain owned by their existing systems.
    for pose,project,frame in (('perch','seating',120),('floor','ground-front',150)):
        for view in ('front','left','right'):
            name=project if pose=='perch' and view=='front' else 'seating-'+view if pose=='perch' else 'ground-'+view
            board=ET.parse(folder.parent/name/'scene.rml').getroot().find('Artboard')
            clip=next(a for a in board.findall('LinearAnimation') if a.get('name') in ('tavi/perch/contact-review','tavi/ground/contact-review'))
            values={}
            for obj in clip.findall('KeyedObject'):
                if obj.get('objectId') not in {f'37:{100+i}' for i in range(10)}:continue
                for prop in obj.findall('KeyedProperty'):
                    key=next((k for k in reversed(list(prop)) if float(k.get('frame',0))<=frame),prop[0])
                    values[(obj.get('objectId'),prop.get('property'))]=(key.tag,key.get('value'))
            base={key:('KeyFrameDouble',objects[key[0]].get(key[1],'0')) for key in values}
            for key,(kind,value) in list(values.items()):
                if key[1].endswith('Rotation'):
                    value=float(value)+2*math.pi*round((float(base[key][1])-float(value))/(2*math.pi))
                    values[key]=(kind,str(value))
            target.append(animation(f'tavi/runtime/skirt/{pose}-{view}',[(0,base),(60,values)],60))
    install_foundations(target,folder,animation,new_id,rest)
    assert not any('Script' in e.tag or e.tag=='CustomProperty' for e in target.iter()),'Runtime asset must remain script-free'
    write_project(folder,target)
    (folder/'rive.yaml').write_text('name: tavi-refined\nmain: "lyla animation"\n')
