"""Build an isolated expressive Tavi workspace from the current 2D source.

No changes to the fallback source or runtime asset. Uses the original character
artwork; all additional review animations and pose definitions are original work.
"""
from pathlib import Path
import copy
import hashlib
import json
import shutil
import xml.etree.ElementTree as ET
from turns import refine_turn
from shoulders import attach_shirt
from hair import refine_hair
from hair_views import project_hair_turn, rig_hair
from face_polish import clear_lenses
from joints import refine_joints, install_joint_review
from locomotion import create_walk_project
from arm_depth import refine_arm_depth
from motion_review import create_motion_project
from seating import create_seating_project
from expressions import create_expression_review
from ground_seating import create_ground_project
from climbing import create_climbing_project
from turnaround import create_turnaround_project
from runtime import create_runtime_project

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'art/tavi-rive-lab'
SOURCE = ROOT / 'art/mascot-remix/scene.rml'
ASSET = ROOT / 'src/renderer/characters/mascot-v2/mascot-v2.riv'
FALLBACK = WORK / 'fallback'
FALLBACK.mkdir(parents=True, exist_ok=True)
for source, name in ((SOURCE, 'scene.rml'), (ASSET, 'mascot-v2.riv')):
    destination = FALLBACK / name
    if not destination.exists():
        shutil.copy2(source, destination)
snapshot = {name: hashlib.sha256((FALLBACK / name).read_bytes()).hexdigest()
            for name in ('scene.rml', 'mascot-v2.riv')}
snapshot_path = FALLBACK / 'sha256.json'
if snapshot_path.exists():
    assert json.loads(snapshot_path.read_text()) == snapshot, 'Fallback changed; stop rather than overwrite its hashes'
else:
    snapshot_path.write_text(json.dumps(snapshot, indent=2) + '\n')
shutil.copy2(ROOT / 'art/mascot-remix/ATTRIBUTION.md', WORK / 'ATTRIBUTION.md')
shutil.copy2(ROOT / 'art/mascot-remix/AGENTS.md', WORK / 'AGENTS.md')

tree = ET.fromstring((FALLBACK / 'scene.rml').read_bytes())
original = next(board for board in tree.findall('Artboard') if board.get('name') == 'lyla animation')
board = copy.deepcopy(original)
# Isolate rendering from the original customization UI and its stale bindings.
for parent in list(board.iter()):
    for child in list(parent):
        if child.tag == 'StateMachine' or child.tag.startswith('DataBind'):
            parent.remove(child)
        elif child.tag == 'DrawRules':
            valid = [target for target in child.findall('DrawTarget') if target.get('drawableId')]
            if not valid:
                parent.remove(child)
            else:
                for target in list(child):
                    if target.tag == 'DrawTarget' and not target.get('drawableId'):
                        invalid = target.get('id')
                        replacement = valid[0].get('id')
                        for element in board.iter():
                            for name, value in list(element.attrib.items()):
                                if value == invalid and name != 'id':
                                    element.set(name, replacement)
                        child.remove(target)
for attr in ('viewModelId', 'viewModelInstanceId', 'selectedAnimations', 'expandedComponents'):
    board.attrib.pop(attr, None)
board.set('defaultStateMachineId', '20:1')
board.set('isComponent', 'false')
board.set('rotation','0')

# Make the eye aperture readable beneath the retained translucent glasses.
# Sclera follows the eye group; the glint follows its own pupil's local target.
for group_id, pupil_id, x, y, base_id in (
    ('0:487', '0:507', 7.68855, 10.1555, 10),
    ('0:517', '0:537', -7.6149998, 10.1555, 20),
):
    group = next(item for item in board.iter() if item.get('id') == group_id)
    pupil = next(item for item in group if item.get('id') == pupil_id)
    sclera = ET.Element('Shape', x=str(x), y=str(y), name='tavi/eye-white', id=f'21:{base_id}')
    ET.SubElement(sclera, 'Ellipse', width='44', height='35', id=f'21:{base_id+1}')
    fill = ET.SubElement(sclera, 'Fill', id=f'21:{base_id+2}')
    ET.SubElement(fill, 'SolidColor', colorValue='FFFFF8F5', id=f'21:{base_id+3}')
    group.insert(list(group).index(pupil)+1, sclera)
    glint = ET.Element('Shape', x='-4', y='-5', name='tavi/eye-highlight', id=f'21:{base_id+4}')
    ET.SubElement(glint, 'Ellipse', width='5', height='5', id=f'21:{base_id+5}')
    fill = ET.SubElement(glint, 'Fill', id=f'21:{base_id+6}')
    ET.SubElement(fill, 'SolidColor', colorValue='FFFFFFFF', id=f'21:{base_id+7}')
    ET.SubElement(glint, 'TranslationConstraint', targetId=pupil_id, sourceSpaceValue='local',
                  destSpaceValue='local', offset='true', id=f'21:{base_id+8}')
    group.insert(list(group).index(pupil), glint)
refine_turn(board)
cloth_anchors=attach_shirt(board)
refine_hair(board)
project_hair_turn(board)
rig_hair(board)
clear_lenses(board)
refine_joints(board)
refine_arm_depth(board)
animations = {item.get('name'): item for item in board.findall('LinearAnimation')}

def sample(track, time):
    """Resolve a source control track to actual component property values."""
    animation = animations[track]
    frame = float(animation.get('duration', 60)) * time
    result = {}
    for obj in animation.findall('KeyedObject'):
        for prop in obj.findall('KeyedProperty'):
            keys = list(prop)
            if not keys:
                continue
            before = keys[0]
            after = keys[-1]
            for key in keys:
                if float(key.get('frame', 0)) <= frame:
                    before = key
                elif float(key.get('frame', 0)) > frame:
                    after = key
                    break
            kind = before.tag
            value = before.get('value')
            if kind == 'KeyFrameDouble' and before.get('interpolationType') != 'hold':
                a, b = float(before.get('frame', 0)), float(after.get('frame', 0))
                t = max(0, min(1, (frame - a) / (b - a))) if b > a else 0
                value = str(float(value) + (float(after.get('value')) - float(value)) * t)
            result[(obj.get('objectId'), prop.get('property'))] = (kind, value)
    return result

NEUTRAL = dict(browLeft=0, browRight=0, blinkLeft=0, blinkRight=0,
               lidLeft=0, lidRight=0, mouthCurve=0.1, mouthX=0, mouthY=0,
               browTiltL=0, browTiltR=0, mouthOpen=0.4, mouthWide=0,
               mouthTilt=0, mouthPop=0, mouthShape=0)
POSES = {
    'neutral': {},
    'joy': dict(browLeft=-0.35, browRight=-0.35, blinkLeft=0.25, blinkRight=0.25,
                lidLeft=0.3, lidRight=0.3, mouthShape=3, mouthOpen=0.8, mouthWide=0.25),
    'surprise': dict(browLeft=-1, browRight=-1, mouthShape=6, mouthOpen=0.9, mouthWide=-0.25),
    'concern': dict(browLeft=-0.25, browRight=-0.25, browTiltL=-0.95, browTiltR=-0.95,
                    mouthShape=9, mouthOpen=0.55, mouthWide=-0.2),
    'focus': dict(browLeft=0.35, browRight=0.35, browTiltL=0.75, browTiltR=0.75,
                  lidLeft=0.2, lidRight=0.2, mouthShape=15, mouthOpen=0.35, mouthWide=-0.3),
    'sleepy': dict(browLeft=0.15, browRight=0.15, blinkLeft=0.72, blinkRight=0.72,
                   lidLeft=0.15, lidRight=0.15, mouthCurve=-0.1, mouthWide=-0.2),
    'playful': dict(browLeft=-0.65, browRight=0.15, blinkRight=0.7,
                    mouthShape=10, mouthTilt=0.3, mouthOpen=0.55),
}
JOYSTICKS = {'browLeft','browRight','blinkLeft','blinkRight','lidLeft','lidRight',
             'mouthCurve','mouthX','mouthY'}
def properties(pose):
    result = {}
    for name, value in {**NEUTRAL, **pose}.items():
        if name == 'mouthShape': time = (10 * value + 5) / 210
        elif name in ('blinkLeft', 'blinkRight'): time = ((-1 + 2*value) + 1.25) / 2.5
        elif name in ('lidLeft', 'lidRight'): time = ((1 - 2*value) + 1.25) / 2.5
        elif name in JOYSTICKS: time = (value + 1.25) / 2.5
        elif name in ('mouthOpen', 'mouthPop'): time = value
        else: time = (value + 1) / 2
        result.update(sample('tavi/' + name, time))
    return result

resolved = {name: properties(pose) for name, pose in POSES.items()}
assert len({json.dumps(sorted(pose.items())) for pose in resolved.values()}) == len(POSES)
counter = 100
def new_id():
    global counter
    counter += 1
    return '20:' + str(counter)

def animation(name, poses, duration, loop='oneShot'):
    anim = ET.Element('LinearAnimation', name=name, id=new_id(), fps='60',
                      duration=str(duration), loopValue=loop)
    owned = {}
    for frame, values in poses:
        for (object_id, prop), (kind, value) in values.items():
            if object_id not in owned:
                owned[object_id] = ET.SubElement(anim, 'KeyedObject', objectId=object_id, id=new_id())
            obj = owned[object_id]
            target = next((item for item in obj if item.get('property') == prop), None)
            if target is None:
                target = ET.SubElement(obj, 'KeyedProperty', property=prop, id=new_id())
            ET.SubElement(target, kind, value=value, frame=str(frame),
                          interpolationType='linear' if kind == 'KeyFrameDouble' else 'hold', id=new_id())
    return anim

def install_machine(target, animation_id):
    sm = ET.SubElement(target, 'StateMachine', name='Tavi expression review', id='20:1')
    layer = ET.SubElement(sm, 'StateMachineLayer', name='Expression', id='20:2')
    entry = ET.SubElement(layer, 'EntryState', x='0', y='0', id='20:3')
    ET.SubElement(entry, 'StateTransition', stateToId='20:4', id='20:5')
    ET.SubElement(layer, 'AnimationState', x='220', y='0', animationId=animation_id, id='20:4')

def write_project(folder, target):
    folder.mkdir(parents=True, exist_ok=True)
    root = ET.Element('Rive', version='1', kind='fragment')
    root.append(target)
    ET.indent(root, space='  ')
    (folder / 'scene.rml').write_text(ET.tostring(root, encoding='unicode') + '\n', encoding='utf-8')
    (folder / 'rive.yaml').write_text('name: tavi-expression-lab\nmain: "lyla animation"\n')
    (folder / '.gitignore').write_text('build/\n')

# Author complete neutral-to-pose tracks for reuse, not just a looping demo.
for name, values in resolved.items():
    frames = []
    for frame in range(0, 61, 5):
        t = frame / 60
        t = t*t*(3-2*t)
        blended = {}
        for key, (kind, value) in values.items():
            start = resolved['neutral'][key][1]
            blended[key] = (kind, str(float(start) + (float(value)-float(start))*t)) if kind == 'KeyFrameDouble' else (kind, value if frame >= 30 else start)
        frames.append((frame, blended))
    board.append(animation('tavi/expression/' + name, frames, 60))

review = []
names = list(resolved)
for index, name in enumerate(names):
    values = resolved[name]
    previous = resolved[names[index-1]] if index else resolved['neutral']
    for offset in range(0, 46, 5):
        t = offset / 45
        t = t*t*(3-2*t)
        blended = {}
        for key, (kind, value) in values.items():
            start = previous[key][1]
            blended[key] = (kind, str(float(start)+(float(value)-float(start))*t)) if kind == 'KeyFrameDouble' else (kind, value if offset >= 25 else start)
        review.append((index*180+offset, blended))
    review.append((index*180+179, values))
review.append((len(names)*180, resolved['neutral']))
demo = animation('tavi/review/expressions', review, len(names)*180+60, 'loop')
board.append(demo)
install_machine(board, demo.get('id'))
write_project(WORK / 'project', board)
# Rive recursively gathers RML in a project directory. Keep snapshots and
# independent pose projects beside, rather than inside, the runnable project.
for generated in ('scene.rml', 'rive.yaml'):
    legacy = WORK / generated
    if legacy.is_file():
        legacy.unlink()

# Native CLI close-ups are deterministic and remain separate from the demo rig.
for name, values in resolved.items():
    target = copy.deepcopy(board)
    for sm in target.findall('StateMachine'):
        target.remove(sm)
    pose = animation('tavi/review/held-pose', [(0, values), (60, values)], 60)
    target.append(pose)
    install_machine(target, pose.get('id'))
    target.set('height', '410')
    content = next(node for node in target.findall('Node') if node.get('name') == 'ALL')
    content.set('x', '-150')
    content.set('y', '-75')
    content.set('scaleX', '1.5')
    content.set('scaleY', '1.5')
    write_project(WORK / 'poses' / name, target)

for name, value in (('joy-left', -0.7), ('joy-right', 0.7)):
    target = copy.deepcopy(board)
    for sm in target.findall('StateMachine'):
        target.remove(sm)
    values = dict(resolved['joy'])
    values.update(sample('tavi/turnHead', (value+1)/2))
    values.update(sample('tavi/turnBody', (value+1)/2))
    pose = animation('tavi/review/held-turn', [(0, values), (60, values)], 60)
    target.append(pose)
    install_machine(target, pose.get('id'))
    target.set('height', '410')
    content = next(node for node in target.findall('Node') if node.get('name') == 'ALL')
    for attr, setting in dict(x='-150', y='-75', scaleX='1.5', scaleY='1.5').items():
        content.set(attr, setting)
    write_project(WORK / 'poses' / name, target)

turn_poses = {}
for name, value in (('left',-1),('front',0),('right',1)):
    values = sample('tavi/turnHead', (0.85*value+1)/2)
    values.update(sample('tavi/turnBody', (value+1)/2))
    turn_poses[name] = values
    target = copy.deepcopy(board)
    for sm in target.findall('StateMachine'):
        target.remove(sm)
    full_pose = {**resolved['neutral'], **values}
    pose = animation('tavi/review/direction-'+name, [(0,full_pose),(60,full_pose)],60)
    target.append(pose)
    install_machine(target,pose.get('id'))
    write_project(WORK/'directions'/name,target)

# An interactive native Rive review. The selector chooses a complete held pose;
# strength blends identical property sets against neutral, with eased state
# changes. No browser-only pose logic or replacement character is involved.
interactive = copy.deepcopy(board)
interactive.set('height', '720')
for sm in interactive.findall('StateMachine'):
    interactive.remove(sm)
held = {}
mouth_held = {}
def is_mouth_selection(key, value):
    return value[0] == 'KeyFrameId' or key == ('0:552', 'opacity')
for name, values in resolved.items():
    continuous = {key: value for key, value in values.items() if not is_mouth_selection(key, value)}
    discrete = {key: value for key, value in values.items() if is_mouth_selection(key, value)}
    pose = animation('tavi/held/' + name, [(0, continuous), (60, continuous)], 60)
    interactive.append(pose)
    held[name] = pose.get('id')
    mouth_pose = animation('tavi/mouth-selection/' + name, [(0, discrete), (60, discrete)], 60)
    interactive.append(mouth_pose)
    mouth_held[name] = mouth_pose.get('id')
sm = ET.SubElement(interactive, 'StateMachine', name='Tavi expressive controls', id='20:1')
ET.SubElement(sm, 'StateMachineNumber', name='expression', value='0', id='22:1')
ET.SubElement(sm, 'StateMachineNumber', name='strength', value='100', id='22:2')
layer = ET.SubElement(sm, 'StateMachineLayer', name='Authored expression', id='22:3')
entry = ET.SubElement(layer, 'EntryState', x='0', y='0', id='22:4')
ET.SubElement(entry, 'StateTransition', stateToId='22:100', id=new_id())

def button(parent, name, x, y, width, height, index):
    shape = ET.Element('Shape', name=name, x=str(x), y=str(y), id=f'23:{100+index}')
    ET.SubElement(shape, 'Rectangle', width=str(width), height=str(height),
                  cornerRadiusTL='12', id=new_id())
    fill = ET.SubElement(shape, 'Fill', id=new_id())
    ET.SubElement(fill, 'SolidColor', colorValue='FFDFD3EC', id=new_id())
    parent.insert(0, shape)
    return shape

for index, name in enumerate(names):
    state = ET.SubElement(layer, 'BlendState1DInput', inputId='22:2',
                          x=str(220+index*180), y='0', id=f'22:{100+index}')
    ET.SubElement(state, 'BlendAnimation1D', animationId=held['neutral'], value='0', id=new_id())
    ET.SubElement(state, 'BlendAnimation1D', animationId=held[name], value='100', id=new_id())
    for destination in range(len(names)):
        if destination == index:
            continue
        transition = ET.SubElement(state, 'BlendStateTransition', stateToId=f'22:{100+destination}',
                                    duration='260', interpolationType='cubic', id=new_id())
        ET.SubElement(transition, 'CubicEaseInterpolator', x1='0.22', y1='1', x2='0.36', y2='1', id=new_id())
        ET.SubElement(transition, 'TransitionNumberCondition', inputId='22:1',
                      opValue='equal', value=str(destination), id=new_id())
    shape = button(interactive, 'Select ' + name, 55+80*index, 630, 62, 48, index)
    listener = ET.SubElement(sm, 'StateMachineListenerSingle', name='Select '+name,
                             targetId=shape.get('id'), listenerTypeValue='click', id=new_id())
    ET.SubElement(listener, 'ListenerNumberChange', inputId='22:1', value=str(index), id=new_id())
    # Small count markers identify buttons without relying on an external font.
    for dot in range(index+1):
        marker = ET.Element('Shape', x=str(43+80*index+4*dot), y='630', id=new_id())
        ET.SubElement(marker, 'Ellipse', width='2.5', height='10', id=new_id())
        fill = ET.SubElement(marker, 'Fill', id=new_id())
        ET.SubElement(fill, 'SolidColor', colorValue='FF4A315E', id=new_id())
        interactive.insert(0, marker)
for index, value in enumerate((35, 65, 100)):
    shape = button(interactive, f'Intensity {value} percent', 110+190*index, 687, 160, 36, 30+index)
    listener = ET.SubElement(sm, 'StateMachineListenerSingle', name=shape.get('name'),
                             targetId=shape.get('id'), listenerTypeValue='click', id=new_id())
    ET.SubElement(listener, 'ListenerNumberChange', inputId='22:2', value=str(value), id=new_id())
    for dot in range(index+1):
        marker = ET.Element('Shape', x=str(102+190*index+8*dot), y='687', id=new_id())
        ET.SubElement(marker, 'Ellipse', width='4', height='4', id=new_id())
        fill = ET.SubElement(marker, 'Fill', id=new_id())
        ET.SubElement(fill, 'SolidColor', colorValue='FF4A315E', id=new_id())
        interactive.insert(0, marker)

# Mouth variants and their visibility switch together. Blending line opacity
# against the neutral mouth would draw a closed line across an open mouth at
# partial intensity. This layer owns both properties exclusively.
mouth_layer = ET.SubElement(sm, 'StateMachineLayer', name='Discrete mouth selection', id='24:1')
mouth_entry = ET.SubElement(mouth_layer, 'EntryState', x='0', y='0', id='24:2')
ET.SubElement(mouth_entry, 'StateTransition', stateToId='24:100', id=new_id())
for index, name in enumerate(names):
    state = ET.SubElement(mouth_layer, 'AnimationState', animationId=mouth_held[name],
                          x=str(220+index*180), y='0', id=f'24:{100+index}')
    for destination in range(len(names)):
        if destination == index:
            continue
        transition = ET.SubElement(state, 'StateTransition', stateToId=f'24:{100+destination}',
                                    duration='0', id=new_id())
        ET.SubElement(transition, 'TransitionNumberCondition', inputId='22:1',
                      opValue='equal', value=str(destination), id=new_id())
# Orientation is independent of expression. Cross-side transitions sample the
# complete turn curve through front rather than blending two narrowed endpoints.
ET.SubElement(sm,'StateMachineNumber',name='direction',value='0',id='28:1')
orientation=ET.SubElement(sm,'StateMachineLayer',name='Three-quarter orientation',id='28:2')
entry=ET.SubElement(orientation,'EntryState',x='0',y='0',id='28:3')
ET.SubElement(entry,'StateTransition',stateToId='28:101',id=new_id())
directions=[('left',-1),('front',0),('right',1)]
idle_states={}
for index,(name,value) in enumerate(directions):
    anim=animation('tavi/view/'+name,[(0,turn_poses[name]),(60,turn_poses[name])],60)
    interactive.append(anim)
    idle_states[name]=ET.SubElement(orientation,'AnimationState',animationId=anim.get('id'),
                                    x=str(220+index*250),y='0',id=f'28:{100+index}')
    shape=button(interactive,'Face '+name,90+210*index,29,130,36,50+index)
    listener=ET.SubElement(sm,'StateMachineListenerSingle',name='Face '+name,targetId=shape.get('id'),
                           listenerTypeValue='click',id=new_id())
    ET.SubElement(listener,'ListenerNumberChange',inputId='28:1',value=str(value),id=new_id())
    icon=ET.Element('Shape',x=str(90+210*index),y='29',id=new_id())
    if value==0:
        ET.SubElement(icon,'Ellipse',width='8',height='8',id=new_id())
        fill=ET.SubElement(icon,'Fill',id=new_id())
        ET.SubElement(fill,'SolidColor',colorValue='FF4A315E',id=new_id())
    else:
        path=ET.SubElement(icon,'PointsPath',id=new_id())
        for x,y in ((-value*4,-6),(value*4,0),(-value*4,6)):
            ET.SubElement(path,'StraightVertex',x=str(x),y=str(y),id=new_id())
        stroke=ET.SubElement(icon,'Stroke',thickness='3',cap='round',join='round',id=new_id())
        ET.SubElement(stroke,'SolidColor',colorValue='FF4A315E',id=new_id())
    interactive.insert(0,icon)
turn_index=0
for start_name,start_value in directions:
    for end_name,end_value in directions:
        if start_name==end_name:
            continue
        frames=[]
        duration=54 if start_value*end_value<0 else 36
        for frame in range(0,duration+1,3):
            progress=frame/duration
            head=progress*progress*(3-2*progress)
            delayed=max(0,(progress-0.06)/0.94)
            body=delayed*delayed*(3-2*delayed)
            h=start_value+(end_value-start_value)*head
            b=start_value+(end_value-start_value)*body
            values=sample('tavi/turnHead',(0.85*h+1)/2)
            values.update(sample('tavi/turnBody',(b+1)/2))
            frames.append((frame,values))
        anim=animation('tavi/turn/'+start_name+'-to-'+end_name,frames,duration)
        interactive.append(anim)
        state=ET.SubElement(orientation,'AnimationState',animationId=anim.get('id'),
                             x='500',y=str(150+turn_index*120),reset='true',id=new_id())
        turn_index+=1
        transition=ET.SubElement(idle_states[start_name],'StateTransition',stateToId=state.get('id'),duration='0',id=new_id())
        ET.SubElement(transition,'TransitionNumberCondition',inputId='28:1',opValue='equal',value=str(end_value),id=new_id())
        ET.SubElement(state,'StateTransition',stateToId=idle_states[end_name].get('id'),
                      enableExitTime='true',exitTimeIsPercetange='true',exitTime='100',duration='0',id=new_id())
# Independent attachment test: move the shoulder roots while the continuous
# shirt follows through its skin. Hem vertices remain weighted to the waist.
ET.SubElement(sm,'StateMachineNumber',name='shoulderTest',value='0',id='32:1')
shoulder_layer=ET.SubElement(sm,'StateMachineLayer',name='Shoulder attachment test',id='32:2')
entry=ET.SubElement(shoulder_layer,'EntryState',x='0',y='0',id='32:3')
ET.SubElement(entry,'StateTransition',stateToId='32:100',id=new_id())
shoulder_modes=[('rest',False,False),('left',True,False),('right',False,True),('both',True,True)]
for index,(name,left,right) in enumerate(shoulder_modes):
    values={}
    for id,raised in (('0:5038',left),('0:4914',right)):
        rest=next(item for item in board.iter() if item.get('id')==id)
        values[(id,'y')]=('KeyFrameDouble',str(float(rest.get('y'))-(12 if raised else 0)))
    anim=animation('tavi/shoulder-test/'+name,[(0,values),(60,values)],60)
    interactive.append(anim)
    state=ET.SubElement(shoulder_layer,'AnimationState',animationId=anim.get('id'),
                       x=str(220+index*200),y='0',id=f'32:{100+index}')
    for destination in range(4):
        if destination==index:continue
        transition=ET.SubElement(state,'StateTransition',stateToId=f'32:{100+destination}',duration='350',interpolationType='cubic',id=new_id())
        ET.SubElement(transition,'CubicEaseInterpolator',x1='0.22',y1='1',x2='0.36',y2='1',id=new_id())
        ET.SubElement(transition,'TransitionNumberCondition',inputId='32:1',opValue='equal',value=str(destination),id=new_id())
    x=72+152*index
    shape=button(interactive,'Shoulder test '+name,x,580,120,30,60+index)
    listener=ET.SubElement(sm,'StateMachineListenerSingle',name='Shoulder test '+name,targetId=shape.get('id'),listenerTypeValue='click',id=new_id())
    ET.SubElement(listener,'ListenerNumberChange',inputId='32:1',value=str(index),id=new_id())
    icon=ET.Element('Shape',x=str(x),y='580',id=new_id())
    for side,raised in ((-1,left),(1,right)):
        points=[(side*12-4,3),(side*12+4,3)] if not raised else [(side*12-4,-1),(side*12,-6),(side*12+4,-1)]
        path=ET.SubElement(icon,'PointsPath',id=new_id())
        for px,py in points:ET.SubElement(path,'StraightVertex',x=str(px),y=str(py),id=new_id())
    stroke=ET.SubElement(icon,'Stroke',thickness='2.5',cap='round',join='round',id=new_id())
    ET.SubElement(stroke,'SolidColor',colorValue='FF4A315E',id=new_id())
    interactive.insert(0,icon)
install_joint_review(board,interactive,sm,animation,button,new_id)
write_project(WORK / 'interactive', interactive)
walk_project=create_walk_project(board,resolved['neutral'],sample,animation,write_project,WORK/'walking',new_id)
create_motion_project(board,walk_project,resolved['neutral'],sample,animation,button,new_id,write_project,WORK/'locomotion')
create_expression_review(board,sample,animation,new_id,write_project,WORK/'expression-catalog')
seated_project,seated_clip=create_seating_project(board,resolved['neutral'],sample,animation,new_id,write_project,WORK/'seating')
for seated_view in ('left','right'):
    create_seating_project(board,resolved['neutral'],sample,animation,new_id,write_project,WORK/('seating-'+seated_view),seated_view)
for ground_view in ('front','left','right'):
    create_ground_project(board,resolved['neutral'],sample,animation,new_id,write_project,WORK/('ground-'+ground_view),ground_view)
for climb_view in ('front','left','right','rear'):
    create_climbing_project(board,resolved['neutral'],sample,animation,new_id,write_project,WORK/('climbing-'+climb_view),climb_view)
create_turnaround_project(board,resolved['neutral'],sample,animation,new_id,write_project,WORK/'turnaround')
create_runtime_project(walk_project,resolved['neutral'],sample,animation,new_id,write_project,WORK/'runtime')

(WORK / 'poses.json').write_text(json.dumps({'neutral': NEUTRAL, 'poses': POSES,
    'fallback_sha256': snapshot, 'references': [
        'https://rive.app/marketplace/669-1300-facial-expression-demo/',
        'https://rive.app/marketplace/19598-36877-character-turn-animation/',
        'https://rive.app/blog/animated-login-screen-design',
    ]}, indent=2) + '\n')
for name, digest in snapshot.items():
    assert hashlib.sha256((FALLBACK / name).read_bytes()).hexdigest() == digest
print(f'Created isolated Rive workspace and {len(POSES)} pose projects. Fallback preserved.')
