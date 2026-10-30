"""One continuous shirt mesh, bound to shoulder translation anchors and torso."""
import math
import xml.etree.ElementTree as ET
from skirt import fit_skirt

def attach_shirt(board):
    objects={e.get('id'):e for e in board.iter() if e.get('id')}
    parents={c:p for p in board.iter() for c in p}
    shirt=objects['0:613']
    # Retain legacy parts/IDs for old clips and palette reference, but render
    # only the continuous garment. The active mesh has no center cut or seam.
    objects['0:614'].set('hidden','true')
    objects['0:625'].set('hidden','true')
    removed=set()
    for shape in list(shirt):
        if shape.tag=='Shape' and shape.get('name')=='tavi/turn-side-plane':
            removed.add(shape.get('id'));shirt.remove(shape)
    for animation in board.findall('LinearAnimation'):
        for keyed in list(animation):
            if keyed.tag=='KeyedObject' and keyed.get('objectId') in removed:
                animation.remove(keyed)
    for rules in board.iter('DrawRules'):
        if (rules.get('name') or '').startswith('tavi/turn-arm-'):
            for target in rules.findall('DrawTarget'):
                target.set('drawableId','29:10')

    def local(e):
        angle=float(e.get('rotation',0));sx=float(e.get('scaleX',1));sy=float(e.get('scaleY',1))
        return (math.cos(angle)*sx,math.sin(angle)*sx,-math.sin(angle)*sy,math.cos(angle)*sy,
                float(e.get('x',0)),float(e.get('y',0)))
    def multiply(a,b):
        return (a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
                a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],
                a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5])
    def relative_to_upper(e):
        chain=[]
        while e is not objects['0:2206']:
            chain.append(e);e=parents[e]
        value=(1,0,0,1,0,0)
        for item in reversed(chain):value=multiply(value,local(item))
        return value
    shirt_x,shirt_y=float(shirt.get('x',0)),float(shirt.get('y',0))
    anchors=[('29:1','torso',None,0,0)]
    for id,name,target in (('29:2','left shoulder','0:2079'),('29:3','right shoulder','0:2340')):
        matrix=relative_to_upper(objects[target])
        anchors.append((id,name,target,matrix[4]-shirt_x,matrix[5]-shirt_y))
    # The waist target belongs to the hip/body, not the leaning upper torso.
    # Its rest position matches the lower hem in the shirt's bind frame.
    upper=objects['0:2206']
    waist_x=float(upper.get('x',0))+shirt_x
    waist_y=float(upper.get('y',0))+shirt_y+31
    ET.SubElement(objects['0:2207'],'Node',name='tavi/cloth/waist-target',
                  x=str(waist_x),y=str(waist_y),id='29:5')
    anchors.append(('29:4','waist','29:5',0,31))
    for id,name,target,x,y in anchors:
        bone=ET.SubElement(shirt,'RootBone',name='tavi/cloth/'+name,x=str(x),y=str(y),length='0',id=id)
        if target:
            ET.SubElement(bone,'TranslationConstraint',name='shoulder attachment',targetId=target,
                          sourceSpaceValue='world',destSpaceValue='world',offset='false',id=id.replace('29:','31:'))
    shape=ET.Element('Shape',name='tavi/continuous-shirt',id='29:10')
    path=ET.SubElement(shape,'PointsPath',isClosed='true',id='29:11')
    # Point, incoming/outgoing handles, and shoulder influence (remaining
    # influence belongs to torso). Both anchor weights sum exactly to 255.
    data=[
        (0,-22,0,7,math.pi,7,4,255),
        (-13.5,-24,0,3.5,2.82,4,4,255),
        (-32,-24.5,-0.32,4,math.pi/2,5,1,255),
        (-33,-2,-math.pi/2,5,math.pi/2,6,1,155),
        (-37,30,-math.pi/2,6,0,12,3,255),
        (0,31,math.pi,12,0,12,3,255),
        (37,30,math.pi,12,-math.pi/2,6,3,255),
        (33,-2,math.pi/2,6,-math.pi/2,5,2,155),
        (32,-24.5,math.pi/2,5,-2.82,4,2,255),
        (13.5,-24,0.32,4,2.82,3.5,4,255),
    ]
    for index,(x,y,ir,ind,outr,outd,side,weight) in enumerate(data):
        vertex=ET.SubElement(path,'CubicDetachedVertex',x=str(x),y=str(y),
                             inRotation=str(ir),inDistance=str(ind),outRotation=str(outr),outDistance=str(outd),id=f'29:{100+index}')
        # Every neckline rim point AND both of its handles follow only the
        # neck base. Shoulder influence starts outside that complete rim.
        base=1
        indices=base if weight==0 else base|((side+1)<<8)
        values=255 if weight==0 else (255-weight)|(weight<<8)
        ET.SubElement(vertex,'CubicWeight',indices=str(indices),values=str(values),
                      inIndices=str(indices),inValues=str(values),outIndices=str(indices),outValues=str(values),id=f'29:{200+index}')
    # Add control points across the complete shoulder ridge, not just its far
    # corner. Each handle also gets its own spatially graded neck/shoulder mix.
    shoulder_points=[(110,-20,-24.15,1),(111,-26,-24.35,1),
                     (112,26,-24.35,2),(113,20,-24.15,2)]
    for id,x,y,side in shoulder_points:
        vertex=ET.Element('CubicDetachedVertex',x=str(x),y=str(y),inRotation='0',inDistance='2.5',
                          outRotation=str(math.pi),outDistance='2.5',id=f'29:{id}')
        successor='29:102' if side==1 else '29:109'
        index=next(i for i,e in enumerate(path) if e.get('id')==successor)
        path.insert(index,vertex)
    ridge={'29:101':1,'29:110':1,'29:111':1,'29:102':1,
           '29:108':2,'29:112':2,'29:113':2,'29:109':2}
    for vertex in list(path):
        side=ridge.get(vertex.get('id'))
        if not side:continue
        x=float(vertex.get('x'))
        if vertex.get('id')=='29:101':vertex.set('outRotation',str(math.pi));vertex.set('outDistance','2.5')
        # A continuous tangent rounds the shoulder cap instead of leaving a
        # ninety-degree cusp that becomes a pointed peak when lifted at yaw.
        if vertex.get('id') in ('29:102','29:108'):
            vertex.set('inRotation','0');vertex.set('inDistance','2.5')
            vertex.set('outRotation',str(math.pi));vertex.set('outDistance','2.5')
        if vertex.get('id')=='29:109':vertex.set('inRotation','0');vertex.set('inDistance','2.5')
        def packed(position):
            influence=round(255*max(0,min(1,(abs(position)-13.5)/18.5)))
            return (255-influence)|(influence<<8)
        weight=vertex.find('CubicWeight')
        if weight is None:weight=ET.SubElement(vertex,'CubicWeight',id=f'29:{int(vertex.get("id").split(":")[1])+100}')
        indices=5|((side+1)<<8)
        values=packed(x)
        incoming=packed(x+math.cos(float(vertex.get('inRotation',0)))*float(vertex.get('inDistance',0)))
        outgoing=packed(x+math.cos(float(vertex.get('outRotation',0)))*float(vertex.get('outDistance',0)))
        # Preserve the opening-facing handle's full neck ownership.
        if vertex.get('id')=='29:101':incoming=255
        if vertex.get('id')=='29:109':outgoing=255
        for name,value in dict(indices=indices,values=values,inIndices=indices,inValues=incoming,outIndices=indices,outValues=outgoing).items():weight.set(name,str(value))
    skin=ET.SubElement(path,'Skin',xx='1',yy='1',tx='0',ty='0',id='29:12')
    for index,(id,name,target,x,y) in enumerate(anchors):
        ET.SubElement(skin,'Tendon',boneId=id,xx='1',yy='1',tx=str(x),ty=str(y),name=name,id=f'29:{300+index}')
    ET.SubElement(skin,'Tendon',boneId='35:2',xx='1',yy='1',tx='0',ty='-22',name='neck base',id='29:304')
    fill=ET.SubElement(shape,'Fill',id='29:13')
    color=objects['0:624'].get('colorValue')
    ET.SubElement(fill,'SolidColor',colorValue=color,id='29:14')
    shirt.insert(0,shape)
    turn=next(a for a in board.findall('LinearAnimation') if a.get('name')=='tavi/turnBody')
    for id,prop,values in (
        ('29:1','scaleX',[(0,0.88),(30,1),(60,0.88)]),
        ('29:4','scaleX',[(0,0.96),(30,1),(60,0.96)]),
        ('35:2','scaleX',[(0,0.88),(30,1),(60,0.88)]),
    ):
        obj=ET.SubElement(turn,'KeyedObject',objectId=id)
        keyed=ET.SubElement(obj,'KeyedProperty',property=prop)
        for frame,value in values:ET.SubElement(keyed,'KeyFrameDouble',frame=str(frame),value=str(value),interpolationType='linear')

    # The neck is a deforming bridge: upper points follow the head joint;
    # lower points follow the shirt collar. Previously it was a static shape
    # on the torso while the face turned sideways above it.
    neck=objects['0:605']
    neck.set('x',str(shirt_x))
    neck_x,neck_y=float(neck.get('x')),float(neck.get('y'))
    head=objects['0:5358']
    top_x=neck_x-float(head.get('x'))
    top_y=neck_y-19.9685-float(head.get('y'))
    ET.SubElement(head,'RootBone',name='tavi/neck/head-anchor',x=str(top_x),y=str(top_y),length='0',id='35:1')
    # One independent neck-base control owns both neck skin and shirt opening.
    # It lives with the upper body rather than being driven by the garment.
    ET.SubElement(objects['0:2206'],'RootBone',name='tavi/neck/collar-anchor',
                  x=str(shirt_x),y=str(shirt_y-22),length='0',id='35:2')
    path=neck.find('PointsPath')
    neck_vertices=[v for v in path if 'Vertex' in v.tag]
    for vertex,(x,y) in zip(neck_vertices,((10,-19.9685),(-10,-19.9685),(-14,13.5705),(0,19.9315),(14,13.5705))):
        vertex.set('x',str(x));vertex.set('y',str(y))
    for index,vertex in enumerate(neck_vertices):
        upper=255 if index in (0,1) else 0 if index==3 else 40
        packed=upper|((255-upper)<<8)
        kind='CubicWeight' if vertex.tag.startswith('Cubic') else 'Weight'
        attributes=dict(indices='513',values=str(packed),id=f'35:{10+index}')
        if kind=='CubicWeight':attributes.update(inIndices='513',inValues=str(packed),outIndices='513',outValues=str(packed))
        ET.SubElement(vertex,kind,**attributes)
    skin=ET.SubElement(path,'Skin',tx=str(neck_x),ty=str(neck_y),id='35:20')
    ET.SubElement(skin,'Tendon',boneId='35:1',tx=str(neck_x),ty=str(neck_y-19.9685),id='35:21')
    ET.SubElement(skin,'Tendon',boneId='35:2',tx=str(shirt_x),ty=str(shirt_y-22),id='35:22')
    head_turn=next(a for a in board.findall('LinearAnimation') if a.get('name')=='tavi/turnHead')
    obj=ET.SubElement(head_turn,'KeyedObject',objectId='35:1')
    # Yaw changes face perspective, not the neck's vertical axis.
    for prop,function in (('scaleX',lambda t:1-0.1*abs(t)),):
        keyed=ET.SubElement(obj,'KeyedProperty',property=prop)
        for frame in range(0,61,3):ET.SubElement(keyed,'KeyFrameDouble',frame=str(frame),value=str(function(frame/30-1)),interpolationType='linear')
    bind_skirt_waist(board,objects,shirt_x,shirt_y)
    fit_skirt(board,objects,shirt_x,shirt_y)
    return anchors

def bind_skirt_waist(board,objects,shirt_x,shirt_y):
    """Use the SAME waist deformation on both sides of the shirt/skirt join.

    Weighting the shirt hem alone is insufficient when the skirt's waist is
    still independently keyed. Their bind-space boundary must agree as well.
    """
    pants=objects['0:635']
    px,py=float(pants.get('x',0)),float(pants.get('y',0))
    ET.SubElement(pants,'RootBone',x='0',y='0',length='0',name='tavi/cloth/skirt-support',id='36:1')
    waist_x,waist_y=shirt_x-px,shirt_y+31-py
    # Extend the lower garment 0.75 units underneath the shirt's rim so
    # antialiasing cannot reveal a hairline at the shared boundary.
    left=(waist_x-32,waist_y-1-0.75)
    center=(waist_x,waist_y-0.75)
    right=(waist_x+32,waist_y-1-0.75)
    owned=set()
    for shape_id,upper_points,handle_specs in (
        ('0:646',{0:left,1:center},((0,'outRotation',0),(0,'outDistance',12),(1,'inRotation',math.pi),(1,'inDistance',12))),
        ('0:636',{0:center,5:right,6:center},((5,'outRotation',math.pi),(5,'outDistance',12),(6,'inRotation',0),(6,'inDistance',12))),
    ):
        shape=objects[shape_id]
        path=shape.find('PointsPath')
        vertices=[v for v in path if 'Vertex' in v.tag]
        sx,sy=float(shape.get('x',0)),float(shape.get('y',0))
        for index,(x,y) in upper_points.items():
            vertex=vertices[index]
            vertex.set('x',str(x-sx));vertex.set('y',str(y-sy))
            owned.add(vertex.get('id'))
        for index,property,value in handle_specs:vertices[index].set(property,str(value))
        for index,vertex in enumerate(vertices):
            tendon='2' if index in upper_points else '1'
            ET.SubElement(vertex,'CubicWeight',indices=tendon,values='255',
                          inIndices=tendon,inValues='255',outIndices=tendon,outValues='255',
                          id=f'36:{100+(0 if shape_id=="0:646" else 20)+index}')
        skin=ET.SubElement(path,'Skin',tx=str(sx),ty=str(sy),id=f'36:{200 if shape_id=="0:646" else 210}')
        ET.SubElement(skin,'Tendon',boneId='36:1',id=f'36:{201 if shape_id=="0:646" else 211}')
        ET.SubElement(skin,'Tendon',boneId='29:4',tx=str(waist_x),ty=str(waist_y),id=f'36:{202 if shape_id=="0:646" else 212}')
    turn=next(a for a in board.findall('LinearAnimation') if a.get('name')=='tavi/turnBody')
    for item in list(turn):
        if item.tag=='KeyedObject' and item.get('objectId') in owned:
            turn.remove(item)
    objects['27:1'].set('hidden','true')
