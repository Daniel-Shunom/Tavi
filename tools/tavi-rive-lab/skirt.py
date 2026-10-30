"""Continuous skirt fitted over the visible pelvis, driven by hip anchors."""
import math
import xml.etree.ElementTree as ET

def fit_skirt(board,objects,shirt_x,shirt_y):
    pants=objects['0:635']
    hip=objects['0:2207']
    px,py=float(pants.get('x',0)),float(pants.get('y',0))
    wx,wy=shirt_x-px,shirt_y+31-py
    # Keep the original pelvis visible underneath: coverage must come from
    # fitted garment geometry, not hiding the body that used to poke through.
    for id in ('0:636','0:646','0:2041','27:1','27:2020','27:2030'):
        objects[id].set('hidden','true')
    waist_target=next(e for e in board.iter() if e.get('id')=='29:5')
    ET.SubElement(hip,'Node',name='tavi/cloth/pelvis-target',x=waist_target.get('x'),
                  y=str(float(waist_target.get('y'))+30),id='37:2')
    bone=ET.SubElement(pants,'RootBone',name='tavi/cloth/pelvis',x=str(wx),y=str(wy+30),length='0',id='37:1')
    ET.SubElement(bone,'TranslationConstraint',name='pelvis attachment',targetId='37:2',
                  sourceSpaceValue='world',destSpaceValue='world',offset='false',id='37:3')
    shape=ET.Element('Shape',name='tavi/continuous-skirt',id='37:10')
    path=ET.SubElement(shape,'PointsPath',isClosed='true',id='37:11')
    # Waist boundary matches the shirt hem, with concealed 0.75u overlap.
    # Symmetric bell contour: aligned side tangents and a rounded hem return.
    # The hip stays generous enough to clear the pelvis at every turn angle.
    hip_tangent=1.35
    points=[
        (0,-0.75,math.pi,12,0,12,255),
        (37,-1.75,math.pi,12,math.pi/2,6,255),
        (44,20,hip_tangent-math.pi,8,hip_tangent,11,96),
        (50,54,-math.pi/2,11,math.pi/2,9,20),
        (46,72,0,6,math.pi,16,0),
        (0,74,0,18,math.pi,18,0),
        (-46,72,0,16,math.pi,6,0),
        (-50,54,math.pi/2,9,-math.pi/2,11,20),
        (-44,20,math.pi-hip_tangent,11,-hip_tangent,8,96),
        (-37,-1.75,math.pi/2,6,0,12,255),
    ]
    for index,(x,y,ir,ind,outr,outd,waist) in enumerate(points):
        vertex=ET.SubElement(path,'CubicDetachedVertex',x=str(wx+x),y=str(wy+y),
                             inRotation=str(ir),inDistance=str(ind),outRotation=str(outr),outDistance=str(outd),id=f'37:{100+index}')
        # Central design: one geometric silhouette carried by waist/pelvis.
        # Individual thigh motion must not pull it into shorts, points, or a
        # different bell shape. Sitting owns its separate authored lap contour.
        if index in (0,1,9):weights=(255,0,0,0)
        elif index in (2,8):weights=(96,159,0,0)
        else:weights=(0,255,0,0)
        values=sum(weight<<(8*slot) for slot,weight in enumerate(weights))
        indices=str(1|(2<<8)|(3<<16)|(4<<24))
        ET.SubElement(vertex,'CubicWeight',indices=indices,values=str(values),inIndices=indices,inValues=str(values),
                      outIndices=indices,outValues=str(values),id=f'37:{200+index}')
    skin=ET.SubElement(path,'Skin',id='37:12')
    ET.SubElement(skin,'Tendon',boneId='29:4',tx=str(wx),ty=str(wy),name='waist',id='37:300')
    ET.SubElement(skin,'Tendon',boneId='37:1',tx=str(wx),ty=str(wy+30),name='pelvis',id='37:301')
    # Standing IK bind frames in pants space, with local +X running down the
    # thigh. These are the original thigh bones, not separate cloth animation.
    for id,bone,x,sx in (('37:302','0:2519',-18.5000343,0.99500012),
                         ('37:303','0:2494',15.5,1)):
        ET.SubElement(skin,'Tendon',boneId=bone,xx='0',yx='-1',xy=str(sx),yy='0',
            tx=str(x),ty='-11',name='thigh attachment',id=id)
    fill=ET.SubElement(shape,'Fill',id='37:13')
    ET.SubElement(fill,'SolidColor',colorValue=objects['0:645'].get('colorValue'),id='37:14')
    pants.insert(0,shape)
    # Draw order is independent of arm transforms. The turn layer selects the
    # far target; only that arm passes behind the lower garment. The near arm
    # retains its shirt target, remaining in front of the skirt.
    for rules in board.iter('DrawRules'):
        if (rules.get('name') or '').startswith('tavi/turn-arm-'):
            targets=rules.findall('DrawTarget')
            targets[1].set('drawableId','37:10')
            targets[1].set('name','far arm behind skirt')
    turn=next(a for a in board.findall('LinearAnimation') if a.get('name')=='tavi/turnBody')
    for id,property,values in [('37:1','scaleX',[(0,1),(30,1),(60,1)])]:
        item=ET.SubElement(turn,'KeyedObject',objectId=id)
        prop=ET.SubElement(item,'KeyedProperty',property=property)
        for frame,value in values:ET.SubElement(prop,'KeyFrameDouble',frame=str(frame),value=str(value),interpolationType='linear')
