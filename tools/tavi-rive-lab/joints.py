"""Local rounded bends between rigid limb segments; retain original skeleton."""
import math
import xml.etree.ElementTree as ET


def refine_joints(board):
    objects={e.get('id'):e for e in board.iter() if e.get('id')}
    for index,(shape_id,radius) in enumerate((('0:669',8),('0:2342',8),
                                             ('0:2544',10),('0:679',10))):
        shape=objects[shape_id]
        path=shape.find('PointsPath')
        skin=path.find('Skin')
        upper,lower=skin.findall('Tendon')
        sx,sy=float(skin.get('tx',0)),float(skin.get('ty',0))
        joint=(float(lower.get('tx'))-sx,float(lower.get('ty'))-sy)
        ux=float(lower.get('tx'))-float(upper.get('tx'))
        uy=float(lower.get('ty'))-float(upper.get('ty'))
        length=math.hypot(ux,uy);ux/=length;uy/=length
        vx,vy=float(lower.get('xx',1)),float(lower.get('xy',0))
        length=math.hypot(vx,vy);vx/=length;vy/=length
        old=[v for v in path if 'Vertex' in v.tag]
        start=(float(old[0].get('x',0)),float(old[0].get('y',0)))
        end=(float(old[-1].get('x',0)),float(old[-1].get('y',0)))
        if index>=2:
            # The original round leg cap extended through the shoe opening
            # at oblique shin angles. End the concealed skin inside the cuff;
            # the ankle/foot bones and visible limb proportions stay intact.
            end=(end[0]-8*vx,end[1]-8*vy)
        pre=(joint[0]-radius*ux,joint[1]-radius*uy)
        post=(joint[0]+radius*vx,joint[1]+radius*vy)
        a=math.atan2(uy,ux);b=math.atan2(vy,vx)
        before=math.dist(start,pre)/3;after=math.dist(post,end)/3
        data=[(start,a+math.pi,0,a,before,1,old[0].get('id')),
              (pre,a+math.pi,before,a,radius,1,f'39:{index*20+1}'),
              (post,b+math.pi,radius,b,after,2,f'39:{index*20+2}'),
              (end,b+math.pi,after,b,0,2,old[-1].get('id'))]
        for vertex in old:path.remove(vertex)
        for i,(point,ir,ind,outr,outd,tendon,id) in enumerate(data):
            vertex=ET.Element('CubicDetachedVertex',x=str(point[0]),y=str(point[1]),
                inRotation=str(ir),inDistance=str(ind),outRotation=str(outr),outDistance=str(outd),
                name=('limb start','bend entry','bend exit','limb end')[i],id=id)
            ET.SubElement(vertex,'CubicWeight',indices=str(tendon),values='255',
                inIndices=str(tendon),inValues='255',outIndices=str(tendon),outValues='255',id=f'39:{index*20+10+i}')
            path.insert(i,vertex)
        stroke=shape.find('Stroke')
        stroke.set('join','round');stroke.set('cap','round')
        shape.set('name',('tavi/armL.surface','tavi/armR.surface','tavi/legL.surface','tavi/legR.surface')[index])
    attach_sock_cuffs(board,objects)


def attach_sock_cuffs(board,objects):
    # Keep soles on the foot targets. Only the upper cuff follows shin angle,
    # bridging a diagonal lower leg into an upright, planted shoe.
    for index,(assembly,sock,shin,foot) in enumerate((('0:13134','0:13119','0:2520','0:2559'),
                                                 ('0:13158','0:13201','0:2495','0:2506'))):
        base=100+index*20
        parent=objects[assembly];shape=objects[sock]
        objects[foot].set('rotation','0')
        ET.SubElement(parent,'RotationConstraint',name='tavi/footwear-orientation',targetId=foot,
            sourceSpaceValue='world',destSpaceValue='world',offset='false',id=f'41:{base+15}')
        ET.SubElement(parent,'RootBone',name='tavi/ankle/foot',length='0',id=f'41:{base}')
        bone=ET.SubElement(parent,'RootBone',name='tavi/ankle/shin',length='0',rotation=str(-math.pi/2),id=f'41:{base+1}')
        ET.SubElement(bone,'RotationConstraint',name='shin cuff attachment',targetId=shin,
            sourceSpaceValue='world',destSpaceValue='world',offset='true',id=f'41:{base+2}')
        path=shape.find('PointsPath')
        old_ids={v.get('id') for v in path if 'Vertex' in v.tag}
        for anim in board.findall('LinearAnimation'):
            for keyed in list(anim):
                if keyed.get('objectId') in old_ids:anim.remove(keyed)
        path.clear();path.set('isClosed','true');path.set('id',f'42:{base}')
        for attribute,value in (('x','0'),('y','0'),('scaleX','1'),('scaleY','1')):shape.set(attribute,value)
        # Continuous ankle boot: shin-owned rim, blended side curves, and a
        # foot-owned lower edge concealed inside the shoe. No rigid quad tip.
        cuff=[(0,-28,math.pi,5,0,5,255),
              (14.25,-27.5,math.pi,4,math.pi/2,6,255),
              (14.25,-3,-math.pi/2,6,math.pi/2,4,255),
              (11,7,-math.pi/2,4,math.pi,4,160),
              (0,8,0,4,math.pi,4,160),
              (-11,7,0,4,-math.pi/2,4,160),
              (-14.25,-3,math.pi/2,4,-math.pi/2,6,255),
              (-14.25,-27.5,math.pi/2,6,0,4,255)]
        for i,(x,y,ir,ind,outr,outd,shin_weight) in enumerate(cuff):
            vertex=ET.SubElement(path,'CubicDetachedVertex',x=str(x),y=str(y),
                inRotation=str(ir),inDistance=str(ind),outRotation=str(outr),outDistance=str(outd),id=f'42:{base+1+i}')
            values=str((255-shin_weight)|(shin_weight<<8))
            ET.SubElement(vertex,'CubicWeight',indices='513',values=values,inIndices='513',inValues=values,
                outIndices='513',outValues=values,id=f'42:{base+30+i}')
        skin=ET.SubElement(path,'Skin',id=f'41:{base+10}')
        for slot,name in ((0,'foot'),(1,'shin')):
            ET.SubElement(skin,'Tendon',boneId=f'41:{base+slot}',name=name,id=f'41:{base+11+slot}')
        shoe=objects['0:13091' if index==0 else '0:13183']
        shoe_path=shoe.find('PointsPath')
        for i,vertex in enumerate(v for v in shoe_path if 'Vertex' in v.tag):
            # The opening follows the same ankle frame as the cuff; the heel,
            # toe and sole stay on the foot frame. Both handles follow their
            # own rim point, preventing an upright corner beside a bent shin.
            selector='2' if i<3 else '1'
            ET.SubElement(vertex,'CubicWeight',indices=selector,values='255',
                inIndices=selector,inValues='255',outIndices=selector,outValues='255',id=f'44:{base+10+i}')
        skin=ET.SubElement(shoe_path,'Skin',xx=shoe.get('scaleX','1'),yy=shoe.get('scaleY','1'),
            tx=shoe.get('x','0'),ty=shoe.get('y','0'),id=f'44:{base}')
        for slot,name in ((0,'foot'),(1,'ankle rim')):
            ET.SubElement(skin,'Tendon',boneId=f'41:{base+slot}',name=name,id=f'44:{base+1+slot}')
        for lace_index,lace_id in enumerate(('0:13111','0:13103') if index==0 else ('0:13159','0:13171')):
            lace=objects[lace_id];lace_path=lace.find('PointsPath')
            serial=100+index*100+lace_index*20
            for i,vertex in enumerate(v for v in lace_path if 'Vertex' in v.tag):
                ET.SubElement(vertex,'Weight',indices='1',values='255',id=f'45:{serial+10+i}')
            skin=ET.SubElement(lace_path,'Skin',tx=lace.get('x','0'),
                ty=str(float(lace.get('y',0))+float(lace_path.get('y',0))),id=f'45:{serial}')
            ET.SubElement(skin,'Tendon',boneId=f'41:{base+1}',name='lace follows ankle rim',id=f'45:{serial+1}')


def install_joint_review(board,interactive,sm,animation,button,new_id):
    objects={e.get('id'):e for e in board.iter() if e.get('id')}
    ET.SubElement(sm,'StateMachineNumber',name='jointPose',value='0',id='40:1')
    layer=ET.SubElement(sm,'StateMachineLayer',name='Elbow and knee review',id='40:2')
    entry=ET.SubElement(layer,'EntryState',x='0',y='0',id='40:3')
    ET.SubElement(entry,'StateTransition',stateToId='40:100',id=new_id())
    for index,(name,elbows,knees) in enumerate((('rest',False,False),('elbows',True,False),
                                              ('knees',False,True),('both',True,True))):
        values={}
        for upper,lower in (('0:2079','0:2080'),('0:2340','0:2341')):
            values[(upper,'rotation')]=('KeyFrameDouble',str(float(objects[upper].get('rotation',0))-(0.65 if elbows else 0)))
            values[(lower,'rotation')]=('KeyFrameDouble',str(1.65 if elbows else float(objects[lower].get('rotation',0))))
        values[('0:2207','y')]=('KeyFrameDouble',str(float(objects['0:2207'].get('y'))+(24 if knees else 0)))
        anim=animation('tavi/joints/'+name,[(0,values),(60,values)],60)
        interactive.append(anim)
        state=ET.SubElement(layer,'AnimationState',animationId=anim.get('id'),x=str(220+index*220),y='0',id=f'40:{100+index}')
        for destination in range(4):
            if destination==index:continue
            transition=ET.SubElement(state,'StateTransition',stateToId=f'40:{100+destination}',duration='450',
                interpolationType='cubic',id=new_id())
            ET.SubElement(transition,'CubicEaseInterpolator',x1='0.22',y1='1',x2='0.36',y2='1',id=new_id())
            ET.SubElement(transition,'TransitionNumberCondition',inputId='40:1',opValue='equal',value=str(destination),id=new_id())
        x=72+152*index
        shape=button(interactive,'Joints '+name,x,552,120,20,80+index)
        listener=ET.SubElement(sm,'StateMachineListenerSingle',name='Joints '+name,targetId=shape.get('id'),listenerTypeValue='click',id=new_id())
        ET.SubElement(listener,'ListenerNumberChange',inputId='40:1',value=str(index),id=new_id())
        # One stroke for arms; two for legs; three for the combined pose.
        icon=ET.Element('Shape',x=str(x),y='552',id=new_id())
        count=index if index else 1
        for j in range(count):
            path=ET.SubElement(icon,'PointsPath',id=new_id())
            for px,py in ((-5,-4),(0,3),(5,-4)) if index else ((-5,0),(5,0)):
                ET.SubElement(path,'StraightVertex',x=str(px+(j-(count-1)/2)*14),y=str(py),id=new_id())
        stroke=ET.SubElement(icon,'Stroke',thickness='2',cap='round',join='round',id=new_id())
        ET.SubElement(stroke,'SolidColor',colorValue='FF4A315E',id=new_id())
        interactive.insert(0,icon)
