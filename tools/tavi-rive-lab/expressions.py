"""Facial-only expression port for the current Tavi rig.

Library clips never own body, head orientation, attention targets, or gait.
Continuous face values and discrete mouth selection are exported separately.
Run this module to make an isolated native review fixture, without regenerating
the parent's interactive, movement, or seated projects.
"""
import argparse
import copy
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[2]
CATALOG_PATH=Path(__file__).with_name('expression-catalog.json')
NEUTRAL=dict(browLeft=0,browRight=0,blinkLeft=0,blinkRight=0,lidLeft=0,lidRight=0,
             mouthCurve=0.1,mouthX=0,mouthY=0,browTiltL=0,browTiltR=0,
             mouthOpen=0.4,mouthWide=0,mouthTilt=0,mouthPop=0,mouthShape=0)
JOYSTICKS={'browLeft','browRight','blinkLeft','blinkRight','lidLeft','lidRight','mouthCurve','mouthX','mouthY'}

GLYPHS={
 'A':['0,7 2.5,0 5,7','1,4 4,4'],'B':['0,7 0,0 4,0 5,1 5,3 4,3.5 0,3.5','4,3.5 5,4.5 5,6 4,7 0,7'],
 'C':['5,0 1,0 0,1 0,6 1,7 5,7'],'D':['0,7 0,0 3,0 5,2 5,5 3,7 0,7'],
 'E':['5,0 0,0 0,7 5,7','0,3.5 4,3.5'],'F':['5,0 0,0 0,7','0,3.5 4,3.5'],
 'G':['5,0 1,0 0,1 0,6 1,7 5,7 5,4 3,4'],'H':['0,0 0,7','5,0 5,7','0,3.5 5,3.5'],
 'I':['0,0 5,0','2.5,0 2.5,7','0,7 5,7'],'J':['0,0 5,0 5,6 4,7 1,7 0,6'],
 'K':['0,0 0,7','5,0 0,4 5,7'],'L':['0,0 0,7 5,7'],'M':['0,7 0,0 2.5,4 5,0 5,7'],
 'N':['0,7 0,0 5,7 5,0'],'O':['1,0 4,0 5,1 5,6 4,7 1,7 0,6 0,1 1,0'],
 'P':['0,7 0,0 4,0 5,1 5,3 4,4 0,4'],'Q':['1,0 4,0 5,1 5,6 4,7 1,7 0,6 0,1 1,0','3,5 5,7'],
 'R':['0,7 0,0 4,0 5,1 5,3 4,4 0,4','2.5,4 5,7'],
 'S':['5,0 1,0 0,1 0,3 5,4 5,6 4,7 0,7'],'T':['0,0 5,0','2.5,0 2.5,7'],
 'U':['0,0 0,6 1,7 4,7 5,6 5,0'],'V':['0,0 2.5,7 5,0'],'W':['0,0 1,7 2.5,4 4,7 5,0'],
 'X':['0,0 5,7','5,0 0,7'],'Y':['0,0 2.5,3.5 5,0','2.5,3.5 2.5,7'],
 'Z':['0,0 5,0 0,7 5,7'],'-':['1,3.5 4,3.5'],' ':[]}

def catalog():return json.loads(CATALOG_PATH.read_text(encoding='utf-8'))['expressions']

def controls(name,level='typical'):
    """Complete controls, preserving native blink/lid conventions and brow visibility."""
    if name=='neutral':return dict(NEUTRAL)
    entry=catalog()[name]
    typical={**NEUTRAL,**entry['typical']}
    result={**typical,**entry.get('strong',{})} if level=='strong' else typical
    if level=='subtle':
        result={key:(value if key=='mouthShape' else NEUTRAL[key]+(value-NEUTRAL[key])*0.5)
                for key,value in typical.items()}
    # Original positive brow extremes disappear behind the glasses. Preserve
    # anger/skepticism through tilt and lids, with a readable brow above the rim.
    for name in ('browLeft','browRight'):result[name]=max(-1.25,min(0.35,result[name]))
    return result

def resolve(values,sample):
    result={}
    for name,value in values.items():
        if name=='mouthShape':time=(10*value+5)/210
        elif name in ('blinkLeft','blinkRight'):time=((-1+2*value)+1.25)/2.5
        elif name in ('lidLeft','lidRight'):time=((1-2*value)+1.25)/2.5
        elif name in JOYSTICKS:time=(value+1.25)/2.5
        elif name in ('mouthOpen','mouthPop'):time=value
        else:time=(value+1)/2
        result.update(sample('tavi/'+name,time))
    return result

def is_discrete(key,value):return value[0]=='KeyFrameId' or key==('0:552','opacity')

def append_expression_library(board,sample,animation):
    """Append ported facial endpoints; return the names/IDs for callers to layer.

    Use the continuous clip in the face layer and the matching mouth clip in a
    discrete selection layer. Do not blend closed-line opacity over open mouths.
    """
    clips={}
    for name in ('neutral',*catalog()):
        clips[name]={}
        for level in ('subtle','typical','strong'):
            values=resolve(controls(name,level),sample)
            continuous={key:value for key,value in values.items() if not is_discrete(key,value)}
            mouth={key:value for key,value in values.items() if is_discrete(key,value)}
            clips[name][level]={}
            for part,data in (('continuous',continuous),('mouth',mouth)):
                clip=animation(f'tavi/emote/{name}/{level}/{part}',[(0,data),(60,data)],60)
                board.append(clip);clips[name][level][part]=clip.get('id')
    return clips

def create_expression_review(board,sample,animation,new_id,write_project,folder):
    """Standalone selectable catalog; callers keep it out of movement projects."""
    target=copy.deepcopy(board)
    for machine in target.findall('StateMachine'):target.remove(machine)
    target.set('width','1060');target.set('height','720')
    content=next(n for n in target.findall('Node') if n.get('name')=='ALL')
    content.set('x','-70')
    clips=append_expression_library(target,sample,animation)
    names=list(clips)
    sm=ET.SubElement(target,'StateMachine',name='Tavi canonical facial catalog',id=new_id())
    expression=ET.SubElement(sm,'StateMachineNumber',name='expression',value='0',id=new_id())
    intensity=ET.SubElement(sm,'StateMachineNumber',name='intensity',value='60',id=new_id())
    def label(text,x,y,scale=1.25):
        shape=ET.Element('Shape',name=text+' label',id=new_id())
        left=x-(len(text)*7-2)*scale/2
        for j,char in enumerate(text.upper()):
            for stroke_points in GLYPHS[char]:
                path=ET.SubElement(shape,'PointsPath',id=new_id())
                for point in stroke_points.split():
                    px,py=map(float,point.split(','))
                    ET.SubElement(path,'StraightVertex',x=str(left+(7*j+px)*scale),y=str(y+(py-3.5)*scale),id=new_id())
        stroke=ET.SubElement(shape,'Stroke',thickness='1.3',cap='round',join='round',id=new_id())
        ET.SubElement(stroke,'SolidColor',colorValue='FF4A315E',id=new_id())
        target.insert(0,shape)
        return shape
    def button(text,x,y,width,input,value):
        shape=ET.Element('Shape',name=text,x=str(x),y=str(y),id=new_id())
        ET.SubElement(shape,'Rectangle',width=str(width),height='30',cornerRadiusTL='10',id=new_id())
        fill=ET.SubElement(shape,'Fill',id=new_id());ET.SubElement(fill,'SolidColor',colorValue='FFDFD3EC',id=new_id())
        target.insert(0,shape);lettering=label(text,x,y)
        # Vector lettering can win the hit test above its button. Both surfaces
        # select the same value so clicking a letter is as reliable as the pill.
        for hit in (shape,lettering):
            listener=ET.SubElement(sm,'StateMachineListenerSingle',name=text,targetId=hit.get('id'),listenerTypeValue='click',id=new_id())
            ET.SubElement(listener,'ListenerNumberChange',inputId=input.get('id'),value=str(value),id=new_id())
    for part in ('continuous','mouth'):
        layer=ET.SubElement(sm,'StateMachineLayer',name='Facial values' if part=='continuous' else 'Discrete mouth selection',id=new_id())
        states=[new_id() for _ in names]
        entry=ET.SubElement(layer,'EntryState',x='0',y='0',id=new_id())
        ET.SubElement(entry,'StateTransition',stateToId=states[0],id=new_id())
        for index,name in enumerate(names):
            state=ET.SubElement(layer,'BlendState1DInput',inputId=intensity.get('id'),x=str(220+index*160),y='0',id=states[index])
            stops=((0,'neutral','typical'),(60,name,'typical'),(100,name,'strong')) if part=='continuous' else (
                (0,name,'typical'),(60,name,'typical'),(100,name,'strong'))
            for threshold,pose,level in stops:
                ET.SubElement(state,'BlendAnimation1D',animationId=clips[pose][level][part],value=str(threshold),id=new_id())
            for destination in range(len(names)):
                if destination==index:continue
                transition=ET.SubElement(state,'BlendStateTransition',stateToId=states[destination],duration='260' if part=='continuous' else '0',
                    interpolationType='cubic' if part=='continuous' else 'hold',id=new_id())
                if part=='continuous':ET.SubElement(transition,'CubicEaseInterpolator',x1='0.22',y1='1',x2='0.36',y2='1',id=new_id())
                ET.SubElement(transition,'TransitionNumberCondition',inputId=expression.get('id'),opValue='equal',value=str(destination),id=new_id())
    for index,name in enumerate(names):
        text='NEUTRAL' if name=='neutral' else 'EYE ROLL FACE' if name=='eye-roll' else catalog()[name]['label'].upper()
        button(text,500+150*(index%4),72+45*(index//4),140,expression,index)
    for index,(text,value) in enumerate((('SOFT',35),('BASE',60),('STRONG',100))):
        button(text,100+130*index,650,115,intensity,value)
    target.set('defaultStateMachineId',sm.get('id'))
    write_project(folder,target)
    (folder/'rive.yaml').write_text('name: tavi-facial-catalog\nmain: "lyla animation"\n')
    return clips

def source_sampler(board):
    animations={a.get('name'):a for a in board.findall('LinearAnimation')}
    def sample(name,time):
        clip=animations[name];frame=float(clip.get('duration',60))*time;result={}
        for obj in clip.findall('KeyedObject'):
            for prop in obj.findall('KeyedProperty'):
                keys=list(prop)
                if not keys:continue
                before,after=keys[0],keys[-1]
                for key in keys:
                    if float(key.get('frame',0))<=frame:before=key
                    if float(key.get('frame',0))>=frame:after=key;break
                value=before.get('value','0')
                if before.tag=='KeyFrameDouble' and before.get('interpolationType')!='hold':
                    a,b=float(before.get('frame',0)),float(after.get('frame',0))
                    p=0 if a==b else max(0,min(1,(frame-a)/(b-a)))
                    value=str(float(value)+(float(after.get('value','0'))-float(value))*p)
                result[(obj.get('objectId'),prop.get('property'))]=(before.tag,value)
        return result
    return sample

def write_review(name,level,view,folder,include_library=False):
    board=ET.parse(ROOT/'art/tavi-rive-lab/project/scene.rml').getroot().find('Artboard')
    sample=source_sampler(board)
    if include_library:
        serial=0
        def make_clip(name,frames,duration):
            nonlocal serial
            serial+=1
            clip=ET.Element('LinearAnimation',name=name,duration=str(duration),fps='60',id=f'54:{serial}')
            targets={}
            for frame,pose in frames:
                for (id,prop),(kind,value) in pose.items():
                    if (id,prop) not in targets:
                        obj=ET.SubElement(clip,'KeyedObject',objectId=id)
                        targets[(id,prop)]=ET.SubElement(obj,'KeyedProperty',property=prop)
                    ET.SubElement(targets[(id,prop)],kind,frame=str(frame),value=value,
                        interpolationType='linear' if kind=='KeyFrameDouble' else 'hold')
            return clip
        append_expression_library(board,sample,make_clip)
    for machine in board.findall('StateMachine'):board.remove(machine)
    values=resolve(controls(name,level),sample)
    direction={'left':-0.85,'front':0,'right':0.85}[view]
    values.update(sample('tavi/turnHead',(direction+1)/2))
    values.update(sample('tavi/turnBody',({'left':-1,'front':0,'right':1}[view]+1)/2))
    clip=ET.SubElement(board,'LinearAnimation',name=f'ported/{name}/{level}/{view}',duration='60',fps='60',id='53:1')
    for (object_id,prop),(kind,value) in values.items():
        obj=ET.SubElement(clip,'KeyedObject',objectId=object_id)
        p=ET.SubElement(obj,'KeyedProperty',property=prop)
        ET.SubElement(p,kind,frame='0',value=value,interpolationType='hold')
    sm=ET.SubElement(board,'StateMachine',name='Ported facial expression',id='53:2')
    layer=ET.SubElement(sm,'StateMachineLayer',name='Held facial pose',id='53:3')
    entry=ET.SubElement(layer,'EntryState',x='0',y='0',id='53:4')
    ET.SubElement(entry,'StateTransition',stateToId='53:5')
    ET.SubElement(layer,'AnimationState',x='220',y='0',animationId='53:1',id='53:5')
    board.set('defaultStateMachineId','53:2');board.set('height','410')
    content=next(n for n in board.findall('Node') if n.get('name')=='ALL')
    for key,value in dict(x='-150',y='-75',scaleX='1.5',scaleY='1.5').items():content.set(key,value)
    root=ET.Element('Rive',version='1',kind='fragment');root.append(board)
    folder.mkdir(parents=True,exist_ok=True);ET.indent(root,space='  ')
    ET.ElementTree(root).write(folder/'scene.rml',encoding='unicode')
    (folder/'rive.yaml').write_text('name: tavi-facial-port\nmain: "lyla animation"\n')
    return folder

def write_catalog_review(folder):
    """CLI adapter using the latest generated rig; main build calls the builder directly."""
    board=ET.parse(ROOT/'art/tavi-rive-lab/project/scene.rml').getroot().find('Artboard')
    sample=source_sampler(board);serial=0
    def new_id():
        nonlocal serial
        serial+=1;return f'55:{serial}'
    def animation(name,frames,duration):
        clip=ET.Element('LinearAnimation',name=name,duration=str(duration),fps='60',id=new_id())
        targets={}
        for frame,pose in frames:
            for (id,prop),(kind,value) in pose.items():
                if (id,prop) not in targets:
                    obj=ET.SubElement(clip,'KeyedObject',objectId=id,id=new_id())
                    targets[(id,prop)]=ET.SubElement(obj,'KeyedProperty',property=prop,id=new_id())
                ET.SubElement(targets[(id,prop)],kind,frame=str(frame),value=value,
                    interpolationType='linear' if kind=='KeyFrameDouble' else 'hold',id=new_id())
        return clip
    def write_project(folder,target):
        root=ET.Element('Rive',version='1',kind='fragment');root.append(target);ET.indent(root,space='  ')
        folder.mkdir(parents=True,exist_ok=True);ET.ElementTree(root).write(folder/'scene.rml',encoding='unicode')
    create_expression_review(board,sample,animation,new_id,write_project,folder)
    return folder

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pose',choices=['neutral',*catalog()],default='skeptical')
    parser.add_argument('--level',choices=['subtle','typical','strong'],default='typical')
    parser.add_argument('--view',choices=['left','front','right'],default='front')
    parser.add_argument('--output',type=Path,default=ROOT/'build/expression-port-review')
    parser.add_argument('--library',action='store_true',help='include all 210 library clips for native validation')
    parser.add_argument('--catalog-review',action='store_true',help='write the selectable 35-state native catalog')
    args=parser.parse_args()
    print(write_catalog_review(args.output) if args.catalog_review else write_review(args.pose,args.level,args.view,args.output,args.library))
