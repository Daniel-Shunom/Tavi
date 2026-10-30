"""Keep the original hair sections registered to one symmetric yaw projection."""
import copy
import math
import xml.etree.ElementTree as ET


def refine_hair(board):
    objects={e.get('id'):e for e in board.iter() if e.get('id')}
    turn=next(a for a in board.findall('LinearAnimation') if a.get('name')=='tavi/turnHead')
    replaced={'0:1318','0:438','0:447','0:2121','0:2119','0:1305','0:1310'}
    for item in list(turn):
        if item.get('objectId') in replaced:turn.remove(item)
    # Slack distance followers moved the sections differently in opposite
    # directions. Keep their base translation attachment but remove that slack.
    for id in ('0:1305','0:1310','0:1316','0:1317'):
        objects[id].set('strength','0')
    # Match right-hand rear locks to the left artwork, including their handles.
    # Retain existing shape/path IDs for the original palette and swing tracks.
    for pair,(left,right) in enumerate((('0:695','0:725'),('0:705','0:734'),
                                       ('0:715','0:744'),('0:754','0:764'))):
        source,target=objects[left],objects[right]
        target.set('x',str(-float(source.get('x',0))))
        target.set('y',source.get('y','0'))
        old=target.find('PointsPath');path=copy.deepcopy(source.find('PointsPath'))
        old_ids=[e.get('id') for e in old]
        path.set('id',old.get('id'))
        path.set('x',str(-float(path.get('x',0))))
        path.attrib.pop('isClockwise',None);path.attrib.pop('pathFlags',None)
        for index,vertex in enumerate(path):
            vertex.set('id',old_ids[index] if index<len(old_ids) else f'38:{100+pair*10+index}')
            vertex.set('x',str(-float(vertex.get('x',0))))
            for angle in ('inRotation','outRotation'):
                vertex.set(angle,str(math.pi-float(vertex.get(angle,0))))
        target.remove(old);target.insert(0,path)
    cap_x=float(objects['0:596'].get('x'))
    # Rear-hair origin aligns with the crown, rather than its former offset
    # constraint target. The hair mass recedes opposite the face's 4u lead:
    # this exposes more face on the facing side instead of centering the hair
    # around the turned face as if both were flat, equally moving cutouts.
    rear_x=cap_x-float(objects['0:5961'].get('x'))
    objects['0:684'].set('x',str(rear_x))
    objects['0:1296'].set('x','0')
    def keyed(id,properties):
        obj=ET.SubElement(turn,'KeyedObject',objectId=id)
        for name,function in properties.items():
            prop=ET.SubElement(obj,'KeyedProperty',property=name)
            for frame in range(0,61,3):
                ET.SubElement(prop,'KeyFrameDouble',frame=str(frame),value=str(function(frame/30-1)),interpolationType='linear')
    for id,base in (('0:596',cap_x),('0:684',rear_x),('0:1296',0)):
        keyed(id,{'x':lambda t,base=base:base-8*t,'scaleX':lambda t:1-0.06*abs(t)})
    radius=(94.5+94.880463)/2
    for id,sign in (('0:2121',-1),('0:2119',1)):
        objects[id].set('y','-8')
        keyed(id,{'x':lambda t,sign=sign:sign*radius*(1-0.06*abs(t))-8*t})
    # Fringe halves retain their original artwork and overlap, but no longer
    # acquire different scale/translation keys that can split their join.
