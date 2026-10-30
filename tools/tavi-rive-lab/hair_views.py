"""Direction-sensitive hair: project the hair sections around one head volume.

The original turn slid every hair section sideways by the same few units, and
the fringe and side locks moved against the face. Here each vertex (and each
bezier handle) of the fringe and the rear locks is given a depth on an
ellipsoid head and rotated about the head's vertical axis by the same yaw the
face features use. Front hair travels and wraps with the face, the far side
foreshortens, and rear locks slide the other way.

The head turns about the neck, which sits behind the face, so the hair mass
(crown and the bob's outline) swings against the turn: the back of the head
fills out on the trailing side and the outline tucks in on the facing side.
Interior points blend from the volume projection to this outline motion, so
no seam opens between them.
"""
import math
import xml.etree.ElementTree as ET

# Face features lead by ~25.8u at full turn on a face of radius ~95u.
YAW=math.asin(25.8/95)
CENTER_X=-0.45            # crown centre in head space
CROWN_Y=-124.8
RX=125.0                  # half width of the hair volume
RY=150.0
FRONT=('0:438','0:447')   # fringe halves
REAR=('0:685','0:695','0:705','0:715','0:725','0:734','0:744','0:754','0:764')
SIDES=(('0:2121',-1),('0:2119',1))
SIDE_DEPTH=40.0           # side locks hang just ahead of the ears
# Outline motion at full turn (sin(YAW) ~ 0.27): the mass behind the neck
# swings back, the trailing side fills out, the facing side tucks in.
MASS_BEHIND=38.0          # -> ~10u swing against the turn
TRAIL_FILL=30.0           # -> ~8u extra on the trailing side
LEAD_TUCK=12.0            # -> ~3u tuck on the facing side
CROWN='0:596'
FRAMES=range(0,61,3)


def radius_at(y,front):
    """Horizontal radius of the hair volume at height y: an ellipsoid around the
    crown for front hair, a cylinder for the rear bob that hangs below it."""
    if not front:return RX
    v=(y-CROWN_Y)/RY
    return RX*math.sqrt(max(0.05,1-v*v))


def turn_point(x,y,t,front):
    """Rotate a hair point about the head's vertical axis. Points keep their
    longitude on a circle of the local radius, so nothing ever swings past the
    head's outline (the rear bob turns the other way: it faces away)."""
    # Locks and handles that already reach past the volume define their own
    # circle, so the front view stays exactly as authored.
    r=max(radius_at(y,front),abs(x-CENTER_X)/0.98)
    u=(x-CENTER_X)/r
    longitude=math.asin(u) if front else math.pi-math.asin(u)
    turned=longitude+YAW*t
    # A front point that would pass the outline parks on it (it is tucked
    # under the side hair there); rear points likewise stay behind.
    if front:turned=max(-math.pi/2,min(math.pi/2,turned))
    elif turned<math.pi/2:turned=math.pi/2
    elif turned>3*math.pi/2:turned=3*math.pi/2
    # The outline of a round volume does not rotate: fade the turn out toward
    # it, so silhouette points stay put and never flatten into a straight edge.
    weight=(1-u*u)**2
    return x+weight*(CENTER_X+r*math.sin(turned)-x)+(1-weight)*outline_shift(x,t)


def outline_shift(x,t):
    """How the hair's outline moves as the head turns about the neck."""
    s=math.sin(YAW*t)
    side=1 if x>=CENTER_X else -1
    reach=min(1.0,abs(x-CENTER_X)/RX)
    trailing=side*s<0
    spread=(TRAIL_FILL if trailing else -LEAD_TUCK)*abs(s)*side*reach
    return -MASS_BEHIND*s+spread

# A side-swept fringe in head space: (x, y, corner). Corners are clump tips and
# the part; everything else is smooth. Temple tips dip into the side hair, so
# the face's square top corners never show, in any view.
FRINGE={
    # Main sweep from a part on the screen-left, flowing right into two clumps.
    # Its top stays at the original fringe height, inside the crown's flat
    # colour band, so no edge shows against the crown gradient.
    '0:447':[(-30,-198,True),(40,-198,False),(94,-176,False),(107,-127,True),
             (80,-148,False),(56,-141,True),(36,-156,False),(10,-139,True),
             (-10,-157,False),(-24,-148,True)],
    # Short side: the part (tucked under the sweep, so no seam) down to two
    # smaller clumps at the left temple.
    '0:438':[(-6,-198,True),(-4,-163,True),(-48,-142,True),(-66,-152,False),
             (-103,-127,True),(-106,-174,False),(-70,-198,False)],
}
# Side locks follow the face's round outline: "(" and ")", tips curling in.
FACE_X,FACE_Y,FACE_R=0.15,-92.8,95.0
LOCK_HALF=10.0
SIDE_LOCKS=(('0:466','0:2119',1),('0:2125','0:2121',-1))


def bezier_outline(points):
    """Closed cubic outline: Catmull-Rom handles on smooth points, short
    edge-aligned handles on corners (pointed, but never knife-sharp)."""
    out=[]
    n=len(points)
    for i,(x,y,corner) in enumerate(points):
        px,py,_=points[i-1];nx,ny,_=points[(i+1)%n]
        if corner:
            back=math.hypot(px-x,py-y)*0.18;ahead=math.hypot(nx-x,ny-y)*0.18
            out.append((x,y,math.atan2(py-y,px-x),back,math.atan2(ny-y,nx-x),ahead))
        else:
            tx,ty=(nx-px)/2,(ny-py)/2;length=math.hypot(tx,ty)
            back=math.hypot(px-x,py-y)/3;ahead=math.hypot(nx-x,ny-y)/3
            angle=math.atan2(ty,tx)
            out.append((x,y,angle+math.pi,back,angle,ahead))
    return out


def reshape_side_locks(board,offset):
    """Bend the skinned side-lock strokes (bind pose only; weights and bones
    are untouched) so their inner edge traces the cheek instead of a ruler."""
    objects={e.get('id'):e for e in board.iter() if e.get('id')}
    radius=(94.5+94.880463)/2
    for shape_id,node_id,sign in SIDE_LOCKS:
        shape=objects[shape_id];path=next(c for c in shape if c.tag.endswith('Path'))
        # Skinned vertices sit in the skin's bind space: the path's stored
        # rotation never applies, so local x is screen x. Measure from the
        # shape, with the lock root at its rest radius.
        _,oy=offset(shape);ox=sign*radius
        vertices=[v for v in path if 'Vertex' in v.tag]
        def outline(y):
            # The stroke's inner edge (half its width in) traces the cheek.
            return sign*(math.sqrt(max(0.0,FACE_R**2-(y-FACE_Y)**2))+LOCK_HALF)+FACE_X
        for vertex in vertices:
            y=oy+float(vertex.get('y',0))
            vertex.set('x',str(round(outline(y)-ox,4)))
        top,middle,bottom=vertices
        # Tangents of the outline at each point keep the arc smooth.
        middle.set('inRotation',str(-math.pi/2));middle.set('inDistance','30')
        middle.set('outRotation',str(math.pi/2));middle.set('outDistance','30')
        bx,by=float(bottom.get('x')),float(bottom.get('y'))
        mx,my=float(middle.get('x')),float(middle.get('y'))
        bottom.set('inRotation',str(math.atan2(my-by,(mx-bx)*1.6)));bottom.set('inDistance','28')


def unify_lock_shading(board):
    """Side locks used a lighter gradient tip that read as a separate piece.
    Give both stops the hair's base colour, in the setup pose and in every
    hair palette, so the locks belong to one continuous hair mass."""
    objects={e.get('id'):e for e in board.iter() if e.get('id')}
    stops=('0:472','0:473','0:2138','0:2139')
    base=objects['0:446'].get('colorValue')
    for id in stops:objects[id].set('colorValue',base)
    for clip in board.findall('LinearAnimation'):
        if not clip.get('name','').startswith('hair '):continue
        keyed={o.get('objectId'):o for o in clip.findall('KeyedObject')}
        if '0:446' not in keyed:continue
        colour=next(keyed['0:446'].iter('KeyFrameColor')).get('value')
        for id in stops:
            if id in keyed:
                for key in keyed[id].iter('KeyFrameColor'):key.set('value',colour)


def reshape_fringe(board,offset,new_id):
    objects={e.get('id'):e for e in board.iter() if e.get('id')}
    for shape_id,points in FRINGE.items():
        shape=objects[shape_id]
        path=next(c for c in shape if c.tag.endswith('Path'))
        ox,oy=offset(path)
        for vertex in list(path):
            if 'Vertex' in vertex.tag:path.remove(vertex)
        for x,y,in_angle,in_length,out_angle,out_length in bezier_outline(points):
            ET.SubElement(path,'CubicDetachedVertex',x=str(round(x-ox,4)),y=str(round(y-oy,4)),
                          inRotation=str(round(in_angle,6)),inDistance=str(round(in_length,4)),
                          outRotation=str(round(out_angle,6)),outDistance=str(round(out_length,4)),
                          id=new_id())
        path.set('isClosed','true')


def project_hair_turn(board):
    objects={e.get('id'):e for e in board.iter() if e.get('id')}
    parents={c:p for p in board.iter() for c in p}
    head=objects['0:437']
    turn=next(a for a in board.findall('LinearAnimation') if a.get('name')=='tavi/turnHead')
    # The rear mass and fringe groups no longer slide as flat cutouts.
    for item in list(turn):
        if item.get('objectId') in ('0:596','0:684','0:1296','0:2121','0:2119'):turn.remove(item)
    serial=[0]
    def new_id():
        serial[0]+=1
        return f'73:{serial[0]}'

    def offset(element):
        """Head-space translation of an element's local origin (translations only;
        asserted, since a rotated or scaled ancestor would need a full matrix)."""
        x=y=0.0;item=element
        while item is not head:
            for key in ('rotation',):
                assert abs(float(item.get(key,0)))<1e-9,f'{item.get("name")} is rotated'
            for key in ('scaleX','scaleY'):
                assert abs(float(item.get(key,1))-1)<1e-9,f'{item.get("name")} is scaled'
            x+=float(item.get('x',0));y+=float(item.get('y',0))
            item=parents[item]
        return x,y

    reshape_fringe(board,offset,new_id)
    reshape_side_locks(board,offset)
    unify_lock_shading(board)

    def keyed(id,prop,values):
        obj=next((o for o in turn.findall('KeyedObject') if o.get('objectId')==id),None)
        if obj is None:obj=ET.SubElement(turn,'KeyedObject',objectId=id,id=new_id())
        target=ET.SubElement(obj,'KeyedProperty',property=prop,id=new_id())
        for frame,value in zip(FRAMES,values):
            ET.SubElement(target,'KeyFrameDouble',frame=str(frame),value=str(round(value,6)),
                          interpolationType='linear',id=new_id())

    for shape_id in FRONT+REAR+(CROWN,):
        front=shape_id in FRONT
        for path in objects[shape_id]:
            if not path.tag.endswith('Path'):continue
            ox,oy=offset(path)
            for vertex in path:
                if 'Vertex' not in vertex.tag:continue
                vx,vy=float(vertex.get('x',0)),float(vertex.get('y',0))
                hx,hy=ox+vx,oy+vy
                xs=[];handles={'in':[],'out':[]}
                for frame in FRAMES:
                    t=frame/30-1
                    px=(hx+outline_shift(hx,t)) if shape_id==CROWN else turn_point(hx,hy,t,front)
                    xs.append(px-ox)
                    if vertex.tag!='CubicDetachedVertex':continue
                    for side in ('in','out'):
                        angle=float(vertex.get(side+'Rotation',0));length=float(vertex.get(side+'Distance',0))
                        cx,cy=hx+math.cos(angle)*length,hy+math.sin(angle)*length
                        qx=(cx+outline_shift(cx,t)) if shape_id==CROWN else turn_point(cx,cy,t,front)
                        handles[side].append((qx-px,cy-hy))
                keyed(vertex.get('id'),'x',xs)
                for side,points in handles.items():
                    if not points or float(vertex.get(side+'Distance',0))==0:continue
                    keyed(vertex.get('id'),side+'Rotation',unwrap(points,float(vertex.get(side+'Rotation',0))))
                    keyed(vertex.get('id'),side+'Distance',[math.hypot(dx,dy) for dx,dy in points])

    # Side locks are bone-driven strokes; move their roots along the same turn.
    # At rest they keep the radius hair.py placed them on.
    radius=(94.5+94.880463)/2
    for id,sign in SIDES:
        keyed(id,'x',[side_x(sign*radius,frame/30-1)+0.5*outline_shift(sign*radius,frame/30-1) for frame in FRAMES])


def side_x(x,t):
    """Side locks hang ahead of the ears, at a fixed depth in front of the axis."""
    angle=YAW*t
    return CENTER_X+(x-CENTER_X)*math.cos(angle)+SIDE_DEPTH*math.sin(angle)


def unwrap(points,base):
    """Handle angles for each key, kept continuous from the authored angle so a
    linear tween never spins a handle the long way round across +-pi."""
    angles=[];previous=base
    for dx,dy in points:
        angle=math.atan2(dy,dx)
        angle+=2*math.pi*round((previous-angle)/(2*math.pi))
        angles.append(angle);previous=angle
    return angles


# --- Hair skeleton -----------------------------------------------------------
# The hair used to be animated piecewise: the face offset dragged only the
# fringe and side locks, squash scaled only the rear locks, and swoop spun each
# rear lock about its own pivot. Every pose but one pulled it apart. Here the
# fringe, crown and bob are skinned to one small skeleton under the head:
#   mass  - the skull's hair volume: crown and bob; squashes; drifts slightly
#           against the face offset (the back of the head swings the other way)
#   front - inside the face control, so the fringe moves exactly with the face
#   bob L/R - children of mass that sway the hanging ends of the bob as one
# Weights blend fringe interior -> front, temple tips -> mass, bob tops -> mass,
# bob ends -> bob bones. Turn shapes remain vertex animation in bind space.
MASS_POS=(3.7340448,-68.038124)   # the old squash pivot
FRONT_Y=-150.0
BOB_PIVOTS=((-62.0,-118.0),(62.0,-118.0))
BOB_TOP,BOB_SPAN=-120.0,90.0
FACE_DRIFT=0.3                     # mass moves this much against the face offset
FRINGE_ROOT,FRINGE_FADE=-198.0,30.0
# The face offset slides the features ~22u but the skin outline barely moves;
# side locks frame the skin, so they follow only a share of the offset.
SIDE_LOCK_FOLLOW='0.25'
SWOOP_SHARE=0.7


def pack(weights):
    """Up to four (tendon_index, weight) pairs -> (indices, values) packed so the
    bytes total exactly 255, as the runtime does not renormalize."""
    pairs=sorted(((i,w) for i,w in weights if w>1e-4),key=lambda p:-p[1])[:4]
    total=sum(w for _,w in pairs)
    raw=[[i,round(255*w/total)] for i,w in pairs]
    raw[0][1]+=255-sum(v for _,v in raw)
    indices=values=0
    for slot,(i,v) in enumerate(raw):
        indices|=(i+1)<<(8*slot);values|=v<<(8*slot)
    return str(indices),str(values)


def rig_hair(board):
    objects={e.get('id'):e for e in board.iter() if e.get('id')}
    parents={c:p for p in board.iter() for c in p}
    head=objects['0:437'];face=objects['0:829']
    fx,fy=float(face.get('x')),float(face.get('y'))
    serial=[0]
    def new_id():
        serial[0]+=1
        return f'74:{serial[0]}'
    mass=ET.SubElement(head,'RootBone',name='tavi/hair/mass',x=str(MASS_POS[0]),y=str(MASS_POS[1]),length='1',id=new_id())
    bobs=[ET.SubElement(mass,'RootBone',name=f'tavi/hair/bob-{side}',x=str(px-MASS_POS[0]),y=str(py-MASS_POS[1]),length='1',id=new_id())
          for side,(px,py) in zip('LR',BOB_PIVOTS)]
    front=ET.SubElement(face,'RootBone',name='tavi/hair/front',x=str(CENTER_X-fx),y=str(FRONT_Y-fy),length='1',id=new_id())
    bones=[(mass,MASS_POS),(front,(CENTER_X,FRONT_Y)),(bobs[0],BOB_PIVOTS[0]),(bobs[1],BOB_PIVOTS[1])]

    def offset(element):
        x=y=0.0;item=element
        while item is not head:
            x+=float(item.get('x',0));y+=float(item.get('y',0));item=parents[item]
        return x,y

    def weights(hx,hy,shape_id):
        if shape_id in FRONT:
            r=max(radius_at(hy,True),abs(hx-CENTER_X)/0.98)
            # A gentler falloff than the turn's, so a clump and its neighbouring
            # notch shift together instead of shearing a gap between them.
            u=(hx-CENTER_X)/r;w=max(0.0,1-u*u)
            # The fringe's top tucks under the crown and stays with it; the
            # face carries the clumps. The fringe stretches between them.
            k=max(0.0,min(1.0,(hy-FRINGE_ROOT)/FRINGE_FADE));w*=k*k*(3-2*k)
            return [(0,1-w),(1,w)]
        if shape_id==CROWN:return [(0,1.0)]
        k=max(0.0,min(1.0,(hy-BOB_TOP)/BOB_SPAN));k=k*k*(3-2*k)
        s=max(0.0,min(1.0,(hx-BOB_PIVOTS[0][0])/(BOB_PIVOTS[1][0]-BOB_PIVOTS[0][0])))
        return [(0,1-k),(2,k*(1-s)),(3,k*s)]

    for shape_id in FRONT+REAR+(CROWN,):
        shape=objects[shape_id]
        for path in shape:
            if not path.tag.endswith('Path'):continue
            assert path.find('Skin') is None
            ox,oy=offset(path)
            for vertex in path:
                if 'Vertex' not in vertex.tag:continue
                hx,hy=ox+float(vertex.get('x',0)),oy+float(vertex.get('y',0))
                indices,values=pack(weights(hx,hy,shape_id))
                if vertex.tag=='StraightVertex':
                    ET.SubElement(vertex,'Weight',indices=indices,values=values,id=new_id())
                else:
                    ET.SubElement(vertex,'CubicWeight',indices=indices,values=values,inIndices=indices,inValues=values,
                                  outIndices=indices,outValues=values,id=new_id())
            skin=ET.SubElement(path,'Skin',tx=str(ox),ty=str(oy),id=new_id())
            for bone,(bx,by) in bones:
                ET.SubElement(skin,'Tendon',boneId=bone.get('id'),tx=str(bx),ty=str(by),
                              name=bone.get('name'),id=new_id())

    objects['0:1309'].set('strength',SIDE_LOCK_FOLLOW)
    clips={a.get('name'):a for a in board.findall('LinearAnimation')}
    def key(clip,target,prop,frames_values):
        obj=ET.SubElement(clip,'KeyedObject',objectId=target.get('id'),id=new_id())
        p=ET.SubElement(obj,'KeyedProperty',property=prop,id=new_id())
        for frame,value in frames_values:
            ET.SubElement(p,'KeyFrameDouble',frame=str(frame),value=str(value),interpolationType='linear',id=new_id())
    def frames(clip,id,prop):
        for obj in clip.findall('KeyedObject'):
            if obj.get('objectId')!=id:continue
            for p in obj.findall('KeyedProperty'):
                if p.get('property')==prop:
                    return [(float(k.get('frame',0)),float(k.get('value',0))) for k in p]
        return []
    # Squash the whole hair volume, not just the rear locks.
    squash=clips['hair squash']
    for obj in squash.findall('KeyedObject'):
        if obj.get('objectId')=='0:5961':obj.set('objectId',mass.get('id'))
    # Swoop sways the bob's ends together instead of spinning each lock.
    swoop=clips['hairswoop']
    sample=frames(swoop,'0:685','rotation')
    for obj in list(swoop.findall('KeyedObject')):
        if obj.get('objectId') in REAR:swoop.remove(obj)
    for bone in bobs:key(swoop,bone,'rotation',[(f,v*SWOOP_SHARE) for f,v in sample])
    # The face offset carries the front bone (it lives in the face control);
    # the hair mass drifts the other way, a fraction of that offset.
    for clip,prop,rest,index in ((clips['face x'],'x',fx,0),(clips['face y'],'y',fy,1)):
        key(clip,mass,prop,[(f,MASS_POS[index]-FACE_DRIFT*(v-rest)) for f,v in frames(clip,'0:829',prop)])
