"""Authored three-quarter body contours; never scale the leg hierarchy."""
import math
import xml.etree.ElementTree as ET

def refine_turn(board):
    objects = {item.get('id'): item for item in board.iter() if item.get('id')}
    old = next(item for item in board.findall('LinearAnimation') if item.get('name') == 'tavi/turnBody')
    index = list(board).index(old)
    board.remove(old)
    track = ET.Element('LinearAnimation', name='tavi/turnBody', duration='60', fps='60', id=old.get('id'))
    serial = 100
    def identifier():
        nonlocal serial
        serial += 1
        return '26:' + str(serial)
    def attr(id, key, default=0):
        return float(objects[id].get(key, default))
    def keyed(id, props):
        item = ET.SubElement(track, 'KeyedObject', objectId=id, id=identifier())
        for prop, function in props.items():
            target = ET.SubElement(item, 'KeyedProperty', property=prop, id=identifier())
            for frame in range(0, 61, 3):
                value = function(frame/30-1)
                ET.SubElement(target, 'KeyFrameDouble', value=str(round(value, 6)), frame=str(frame),
                              interpolationType='linear', id=identifier())
    def vertices(id):
        return [vertex for path in objects[id].findall('PointsPath') for vertex in path if 'Vertex' in vertex.tag]

    # Rebuild the two old leg-derived skirt panels as one continuous garment
    # with a shared seam. Matching seam vertices prevent the exposed triangles
    # left by the original disconnected pant-panel contours.
    panels = {
        '0:614': [(-31,-2),(-32,30),(0,31),(0,-22),(-15,-28),(-30,-23),(-31,-8),(-31,-2)],
        '0:625': [(32,28),(31,30),(0,31),(0,-22),(15,-28),(30,-23),(32,-2)],
        '0:646': [(-31,-20),(0,-20),(0,14),(0,49),(-47,46),(-39,12),(-31,-20)],
        '0:636': [(0,-20),(0,14),(0,49),(47,46),(39,12),(29,-20),(0,-20)],
    }
    for shape, points in panels.items():
        for vertex, (x,y) in zip(vertices(shape),points):
            vertex.tag='CubicDetachedVertex'
            for key in ('inRotation','outRotation','inDistance','outDistance','rotation','distance','radius'):
                vertex.attrib.pop(key,None)
            vertex.set('x',str(x-attr(shape,'x')))
            vertex.set('y',str(y-attr(shape,'y')))
        if shape in ('0:636','0:646'):
            vertex=vertices(shape)[3 if shape=='0:646' else 2]
            vertex.set('outRotation','3.14159265' if shape=='0:646' else '0')
            vertex.set('outDistance','18')
            vertex=vertices(shape)[4 if shape=='0:646' else 3]
            vertex.set('inRotation','0' if shape=='0:646' else '3.14159265')
            vertex.set('inDistance','18')
        else:
            # Only the hem-facing handles curve. The shared center seam must
            # stay straight on BOTH panels or their outgoing handles open a
            # narrow slit down the chest when the seam moves sideways.
            outside,inside=vertices(shape)[1],vertices(shape)[2]
            outside.set('inRotation','-1.57079633');outside.set('inDistance','2')
            outside.set('outRotation','0' if shape=='0:614' else '3.14159265')
            outside.set('outDistance','10')
            inside.set('inRotation','3.14159265' if shape=='0:614' else '0')
            inside.set('inDistance','10')

    # Project the garment contours, not the pants/leg parent or limb scale.
    # Center seam shifts inside a monotonic outline; outer endpoints have zero
    # seam shift, so left and right endpoints retain identical garment width.
    for shapes, projection, seam in ((('0:614','0:625'), 0.86, 6), (('0:636','0:646'), 0.88, 5)):
        coords = [(shape, vertex, attr(shape,'x')+float(vertex.get('x',0)))
                  for shape in shapes for vertex in vertices(shape)]
        low, high = min(row[2] for row in coords), max(row[2] for row in coords)
        center, radius = (low+high)/2, (high-low)/2
        for shape, vertex, x in coords:
            local = attr(shape,'x')
            seam_weight = max(0, 1-((x-center)/radius)**2)
            keyed(vertex.get('id'), {'x': lambda t,x=x,local=local,seam_weight=seam_weight,center=center,projection=projection,seam=seam:
                center+(x-center)*(1-(1-projection)*abs(t))+seam*t*seam_weight-local})

    # Concealed overlap at the waist eliminates the open strip between the
    # separately authored shirt and skirt at the turn endpoints.
    pants = objects['0:635']
    bridge = ET.Element('Shape', name='tavi/waist-overlap', x='-1.5', y='-21', id='27:1')
    ET.SubElement(bridge, 'Rectangle', width='61', height='16', id='27:2')
    fill = ET.SubElement(bridge, 'Fill', id='27:3')
    color = next(objects['0:636'].iter('SolidColor')).get('colorValue')
    ET.SubElement(fill, 'SolidColor', colorValue=color, id='27:4')
    pants.insert(0, bridge)
    objects['27:1'] = bridge
    keyed('27:2', {'width': lambda t: 61*(1-0.14*abs(t))})

    # Palette-independent side planes convey depth without resizing anatomy.
    # Each rectangle is clipped to its actual garment panel, so the shadow
    # cannot detach, leak through the silhouette, or replace clothing colors.
    parents={child:parent for parent in board.iter() for child in parent}
    for shape,sign,opacity,base in (('0:614',-1,0.14,2000),('0:625',1,0.14,2010),
                                  ('0:646',-1,0.11,2020),('0:636',1,0.11,2030)):
        overlay=ET.Element('Shape',name='tavi/turn-side-plane',opacity='0',id=f'27:{base}')
        ET.SubElement(overlay,'Rectangle',width='200',height='200',id=f'27:{base+1}')
        fill=ET.SubElement(overlay,'Fill',id=f'27:{base+2}')
        ET.SubElement(fill,'SolidColor',colorValue='FF172F37',id=f'27:{base+3}')
        ET.SubElement(overlay,'ClippingShape',sourceId=shape,id=f'27:{base+4}')
        parents[objects[shape]].insert(0,overlay)
        keyed(overlay.get('id'),{'opacity':lambda t,sign=sign,opacity=opacity:opacity*max(0,sign*t)})

    for side, sign, arm, rule_base in (('L',-1,'0:2090',1000),('R',1,'0:2339',1100)):
        x, y = attr(arm,'x'), attr(arm,'y')
        # Preserve a shoulder span outside the fixed neckline during a shrug.
        # The previous 13u inset compressed a raised far shoulder into a spike.
        keyed(arm, {'x': lambda t,x=x,sign=sign: x-sign*6*max(0,sign*t),
                    'y': lambda t,y=y,sign=sign: y+2*max(0,sign*t)})
        rules = ET.SubElement(objects[arm], 'DrawRules', name='tavi/turn-arm-'+side,
                              drawTargetId=f'27:{rule_base+1}', id=f'27:{rule_base}')
        ET.SubElement(rules,'DrawTarget',drawableId='0:625',placementValue='after',name='near arm under garment',id=f'27:{rule_base+1}')
        ET.SubElement(rules,'DrawTarget',drawableId='0:625',placementValue='after',name='far arm',id=f'27:{rule_base+2}')
        obj = ET.SubElement(track,'KeyedObject',objectId=rules.get('id'),id=identifier())
        prop = ET.SubElement(obj,'KeyedProperty',property='drawTargetId',id=identifier())
        for frame in (0,24,30,36,60):
            far = sign*(frame/30-1) > 0.1
            ET.SubElement(prop,'KeyFrameId',value=f'27:{rule_base+(2 if far else 1)}',frame=str(frame),interpolationType='hold',id=identifier())

    # Shoe view replacement through matching contour vertices. The ankle/top
    # center stays attached and the sole height is invariant in both views.
    # Left is a reflected contour with vertex correspondence, not a negative
    # scale on a leg or shoe node.
    mirror = [2,1,0,5,4,3]
    for group,foot,sock,laces,base in (
        ('0:13134','0:2559','0:13119',('0:13111','0:13103'),3000),
        ('0:13158','0:2506','0:13201',('0:13159','0:13171'),3100),
    ):
        assembly=objects[group]
        # The old footwear mixed a static parent with separate leg skins for
        # shoe, sock and trim. One foot attachment now owns the entire assembly.
        for parent in list(assembly.iter()):
            for child in list(parent):
                if child.tag in ('Skin','Weight','CubicWeight'):
                    parent.remove(child)
        assembly.set('x','0');assembly.set('y','0')
        ET.SubElement(assembly,'TranslationConstraint',name='tavi/footwear-attachment',
                      targetId=foot,sourceSpaceValue='world',destSpaceValue='world',offset='false',id=f'27:{base}')
        for lace in laces:
            x,y=attr(lace,'x'),attr(lace,'y')
            keyed(lace,{'x':lambda t,x=x:x+3*t,'y':lambda t,y=y:y-0.5*abs(t),
                        'rotation':lambda t:-0.12*t})
        for vertex in vertices(sock):
            x,y=float(vertex.get('x',0)),float(vertex.get('y',0))
            keyed(vertex.get('id'),{'y':lambda t,x=x,y=y:y+1.8*t*(x-13.7)/13.7})
    for shoe in ('0:13091','0:13183'):
        objects[shoe].set('y','-2.5')
        contour = vertices(shoe)
        assert len(contour)==6
        center = (float(contour[0].get('x'))+float(contour[2].get('x')))/2
        sole = 22
        contour[4].set('y',str(sole))
        # Opening clears the full ankle/cuff width. The former narrow upper
        # corners exposed skin at a crouched, oblique ankle.
        right = [(0,2.7),(center,4.1),(2*center,2.7),(31,15),(center+1,sole),(-2,15)]
        left = [(2*center-right[mirror[i]][0],right[mirror[i]][1]) for i in range(6)]
        rest=[(float(v.get('x',0)),float(v.get('y',0))) for v in contour]
        def tangent(points,index):
            if index==3:return math.pi/2
            if index==5:return -math.pi/2
            if index==4:return math.pi
            previous,following=points[(index-1)%6],points[(index+1)%6]
            return math.atan2(following[1]-previous[1],following[0]-previous[0])
        for i,vertex in enumerate(contour):
            x,y = float(vertex.get('x',0)),float(vertex.get('y',0))
            vertex.tag='CubicDetachedVertex'
            vertex.attrib.pop('rotation',None);vertex.attrib.pop('distance',None)
            distance=7 if i==1 else 10 if i==4 else 5 if i in (3,5) else 2
            vertex.set('inDistance',str(distance));vertex.set('outDistance',str(distance))
            base_angle=tangent(rest,i)
            def direction(t,i=i,base_angle=base_angle):
                target=tangent(right if t>=0 else left,i)
                target+=2*math.pi*round((base_angle-target)/(2*math.pi))
                return base_angle+(target-base_angle)*abs(t)
            keyed(vertex.get('id'), {
                'x': lambda t,x=x,i=i,left=left,right=right: x+(right[i][0]-x)*max(0,t)+(left[i][0]-x)*max(0,-t),
                'y': lambda t,y=y,i=i,left=left,right=right: y+(right[i][1]-y)*max(0,t)+(left[i][1]-y)*max(0,-t),
                'inRotation':lambda t,direction=direction:direction(t)+math.pi,
                'outRotation':direction,
            })
    # Existing knee solvers retain direction selection without changing bones,
    # leg-group origins, scales, lengths or the planted world-space foot targets.
    for id in ('0:2560','0:2505'):
        obj=ET.SubElement(track,'KeyedObject',objectId=id,id=identifier())
        prop=ET.SubElement(obj,'KeyedProperty',property='invertDirection',id=identifier())
        ET.SubElement(prop,'KeyFrameBool',value='false',frame='0',id=identifier())
        ET.SubElement(prop,'KeyFrameBool',value='true',frame='30',id=identifier())
    board.insert(index,track)
