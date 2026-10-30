"""Package approved lab motion as runtime layers; do not reauthor its poses."""
import copy
import math
import xml.etree.ElementTree as ET
from bisect import bisect_right
from motion_legs import project_motion_legs


def sampler(clip):
    tracks={(o.get('objectId'),p.get('property')):list(p) for o in clip.findall('KeyedObject') for p in o.findall('KeyedProperty')}
    def sample(frame):
        result={}
        for key,keys in tracks.items():
            times=[float(k.get('frame',0)) for k in keys]
            i=max(0,bisect_right(times,frame)-1);j=min(i+1,len(keys)-1)
            a,b=keys[i],keys[j];q=0 if i==j else (frame-times[i])/(times[j]-times[i])
            value=float(a.get('value','0'))+(float(b.get('value','0'))-float(a.get('value','0')))*q if a.tag=='KeyFrameDouble' else a.get('value')
            result[key]=(a.tag,str(value))
        return result
    return sample


def install_foundations(target,folder,animation,new_id,rest):
    runtime_objects={e.get('id'):e for e in target.iter() if e.get('id')}
    board=ET.parse(folder.parent/'locomotion'/'scene.rml').getroot().find('Artboard')
    clips={a.get('name'):a for a in board.findall('LinearAnimation')}
    # The head (0:5358) carries the walk's follow-through; it is keyed relative to rest.
    owned={'0:2207','0:2206','0:5358','0:2559','0:2506','0:2079','0:2080','0:2340','0:2341','7:6','7:44'}
    # Extract two interior steps, excluding the review's staging and acceleration.
    # Only the coordinate-space root is removed. Its displacement is baked into
    # local foot X so runtime distance and stance contacts agree without sliding.
    for kind,beat,beats,distance,settle in [('walk',28,6,60,18),('sprint',20,6,104,24),('skip',48,4,160,24)]:
        source=clips[f'tavi/{"walk" if kind=="walk" else kind}/contact-review'];sample=sampler(source)
        for direction,view in [(1,'right'),(-1,'left')]:
            movement_start=74 if direction>0 else 74+beat*beats+settle+24+54+18
            start=movement_start+beat;length=2*beat
            # Walk and sprint advance each foot by one pair of steps. Skip's
            # authored step-hop advances the pair by 160 artboard units.
            stride=60 if kind=='walk' else 104 if kind=='sprint' else 160
            root0=float(sample(start)[('0:9414','x')][1]);frames=[]
            for frame in range(length+1):
                values=sample(start+frame);root=float(values[('0:9414','x')][1])
                correction=root-root0-direction*stride*frame/length
                out={k:v for k,v in values.items() if not k[0].startswith('69:')}
                for id in ('0:2559','0:2506'):
                    key=(id,'x');out[key]=('KeyFrameDouble',str(float(out[key][1])+correction))
                # The common projector adds its existing half-unit standing fix.
                out[('0:2207','y')]=('KeyFrameDouble',str(float(out[('0:2207','y')][1])-.5))
                frames.append((frame,out))
            clip=animation(f'tavi/runtime/gait/{kind}-{view}',frames,length,loop='loop')
            if kind=='walk':
                # Select the already-approved low-recovery walking projection.
                clip.set('name','tavi/walk/contact-review')
                project_motion_legs(target,clip,new_id)
                clip.set('name',f'tavi/runtime/gait/{kind}-{view}')
            else:project_motion_legs(target,clip,new_id)
            for obj in list(clip.findall('KeyedObject')):
                if obj.get('objectId') not in owned and not obj.get('objectId').startswith('69:'):clip.remove(obj)
            target.append(clip)

    # Held sitting is the authored pose, including its matching shoe rotations,
    # shoulder/elbow placement and projected knees, not a second approximate rig.
    for pose,frame in [('perch',120),('floor',150)]:
        for view in ('front','left','right'):
            project=('seating' if view=='front' else 'seating-'+view) if pose=='perch' else 'ground-'+view
            source_board=ET.parse(folder.parent/project/'scene.rml').getroot().find('Artboard')
            source=next(a for a in source_board.findall('LinearAnimation') if a.get('name') in ('tavi/perch/contact-review','tavi/ground/contact-review'))
            held=sampler(source)(frame);values={}
            objects={e.get('id'):e for e in source_board.iter() if e.get('id')}
            for (id,prop),value in held.items():
                mapped=id
                if id.startswith('60:') and id in {'60:100','60:101','60:200','60:201'}:mapped=id.replace('60:','69:')
                elif id.startswith('50:') and id in {'50:100','50:101','50:200','50:201'}:mapped=id.replace('50:','69:')
                elif id in {'62:100','62:200'} and prop=='opacity':mapped=id.replace('62:','72:')
                elif id not in owned and not id.startswith('37:1') and id not in {'47:100','47:180','47:200','47:280'}:continue
                values[(mapped,prop)]=value
                # Front perch projection properties not explicitly keyed retain
                # the authored helper's setup transform.
                if mapped.startswith('69:'):
                    for name in ('x','y','rotation','scaleX','scaleY'):
                        values.setdefault((mapped,name),('KeyFrameDouble',objects[id].get(name,'1' if name.startswith('scale') else '0')))
            base={key:rest.get(key,('KeyFrameDouble',runtime_objects[key[0]].get(key[1],'1' if key[1].startswith('scale') else '0'))) for key in values}
            for key,(kind,value) in list(values.items()):
                if key[1].endswith('Rotation') or key[1]=='rotation':
                    v=float(value);v+=2*math.pi*round((float(base[key][1])-v)/(2*math.pi));values[key]=(kind,str(v))
            target.append(animation(f'tavi/runtime/pose/{pose}-{view}',[(0,base),(60,values)],60))
            # Mirror the authored calf swap: hidden until 55% of the sit, then a
            # 10% crossfade, instead of a translucent leg across the whole blend.
            for obj in target[-1].findall('KeyedObject'):
                if not obj.get('objectId').startswith('72:'):continue
                for prop in obj.findall('KeyedProperty'):
                    first,last=prop[0],prop[-1]
                    for at,copied in ((33,first),(39,last)):
                        extra=copy.deepcopy(copied);extra.set("frame",str(at));extra.set("id",new_id())
                        prop.insert(list(prop).index(last),extra)
