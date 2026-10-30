"""Near forearms pass in front of garments without exposing shoulder caps."""
import copy
import math
import xml.etree.ElementTree as ET


def refine_arm_depth(board):
    objects={e.get('id'):e for e in board.iter() if e.get('id')}
    turn=next(a for a in board.findall('LinearAnimation') if a.get('name')=='tavi/turnBody')
    for index,(side,sign,shape_id) in enumerate((('L',-1,'0:669'),('R',1,'0:2342'))):
        overlay=copy.deepcopy(objects[shape_id])
        path=overlay.find('PointsPath')
        vertices=[v for v in path if 'Vertex' in v.tag]
        # Keep the shoulder and upper arm in the existing garment layer.
        # Forearm entry is the same rounded elbow surface as the underlay.
        path.remove(vertices[0])
        serial=100+index*100
        mapping={e.get('id'):f'47:{serial+i}' for i,e in enumerate(overlay.iter()) if e.get('id')}
        for element in overlay.iter():
            for key,value in list(element.attrib.items()):
                if value in mapping:element.set(key,mapping[value])
        overlay.set('name','tavi/near-forearm-'+side)
        overlay.set('opacity','0')
        # This is an overlapping depth portion, not a new joint. A second
        # round cap at its elbow entry would add a false bump to the silhouette.
        overlay.find('Stroke').set('cap','butt')
        rules=ET.SubElement(overlay,'DrawRules',name='forearm in front of garment',
            drawTargetId=f'47:{serial+71}',id=f'47:{serial+70}')
        ET.SubElement(rules,'DrawTarget',drawableId='29:10',placementValue='before',id=f'47:{serial+71}')
        objects['0:2206'].insert(0,overlay)
        # A separate weighted wrist cap keeps the hand end round when a bent
        # sprinting forearm crosses the torso. Its elbow entry remains uncapped.
        end=vertices[-1];cx,cy=float(end.get('x')),float(end.get('y'))
        radius=float(overlay.find('Stroke').get('thickness'))/2
        cap=ET.Element('Shape',name='tavi/near-wrist-'+side,opacity='0',id=f'47:{serial+80}')
        cap_path=ET.SubElement(cap,'PointsPath',isClosed='true',id=f'47:{serial+81}')
        for i in range(4):
            angle=i*math.pi/2
            vertex=ET.SubElement(cap_path,'CubicDetachedVertex',x=str(cx+radius*math.cos(angle)),
                y=str(cy+radius*math.sin(angle)),inRotation=str(angle-math.pi/2),outRotation=str(angle+math.pi/2),
                inDistance=str(radius*0.55228475),outDistance=str(radius*0.55228475),id=f'47:{serial+40+i}')
            ET.SubElement(vertex,'CubicWeight',indices='2',values='255',inIndices='2',inValues='255',
                outIndices='2',outValues='255',id=f'47:{serial+44+i}')
        skin=copy.deepcopy(path.find('Skin'))
        for i,item in enumerate(skin.iter()):item.set('id',f'47:{serial+90+i}')
        cap_path.append(skin)
        fill=ET.SubElement(cap,'Fill',id=f'47:{serial+87}')
        old_color=next(objects[shape_id].iter('SolidColor')).get('id')
        ET.SubElement(fill,'SolidColor',colorValue=objects[old_color].get('colorValue'),id=f'47:{serial+88}')
        rules=ET.SubElement(cap,'DrawRules',drawTargetId=f'47:{serial+86}',id=f'47:{serial+85}')
        ET.SubElement(rules,'DrawTarget',drawableId='29:10',placementValue='before',id=f'47:{serial+86}')
        objects['0:2206'].insert(0,cap)
        for shape in (overlay,cap):
            keyed=ET.SubElement(turn,'KeyedObject',objectId=shape.get('id'))
            prop=ET.SubElement(keyed,'KeyedProperty',property='opacity')
            for frame in range(0,61,3):
                near=max(0,-sign*(frame/30-1))
                ET.SubElement(prop,'KeyFrameDouble',frame=str(frame),value=str(near),interpolationType='linear')
        # Palette animations must recolor both visible depth portions together.
        for animation in board.findall('LinearAnimation'):
            for obj in list(animation.findall('KeyedObject')):
                if obj.get('objectId')!=old_color:continue
                for target in (mapping[old_color],f'47:{serial+88}'):
                    clone=copy.deepcopy(obj)
                    clone.set('objectId',target)
                    for item in clone.iter():item.attrib.pop('id',None)
                    animation.append(clone)
