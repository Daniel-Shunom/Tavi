"""Authored rear artwork for the isolated climbing view, on the existing bones."""
import copy
import math
import xml.etree.ElementTree as ET


def install_rear_art(board,new_id,hide_front=True):
    objects={e.get('id'):e for e in board.iter() if e.get('id')}
    head=objects['0:437']
    # Reuse the actual layered lock artwork and its gradients, not a flat
    # substitute or generic stripe texture. Isolate its attachment from the
    # old front-view distance followers while keeping its authored geometry.
    texture=copy.deepcopy(objects['0:5961'])
    for parent in list(texture.iter()):
        for child in list(parent):
            if child.tag in ('DrawRules','TranslationConstraint','DistanceConstraint'):parent.remove(child)
    remap={e.get('id'):new_id() for e in texture.iter() if e.get('id')}
    remap[texture.get('id')]='66:30'
    for element in texture.iter():
        for key,value in list(element.attrib.items()):
            if value in remap:element.set(key,remap[value])
        if element.tag=='Shape':
            element.attrib.pop('hidden',None)
            element.set('name','climb-only/rear texture/'+element.get('name','lock'))
    texture.set('name','climb-only/rear original layered locks')
    texture.set('opacity','.5')
    palette_copies={}
    for shape in texture.iter('Shape'):
        vertices=[(float(v.get('y',0))+float(p.get('y',0)))
                  for p in shape.findall('PointsPath') for v in p if 'Vertex' in v.tag]
        if not vertices:continue
        top=min(vertices)
        bottom=max(vertices)
        for fill in shape.findall('Fill'):
            color=fill.find('SolidColor')
            if color is None:continue
            fill.remove(color)
            gradient=ET.SubElement(fill,'LinearGradient',startY=str(top),endY=str(bottom),id=new_id())
            ET.SubElement(gradient,'GradientStop',colorValue='00D80B4C',position='0',id=new_id())
            # Keep this copied paint's original palette ID as the base stop.
            color.tag='GradientStop';color.set('position','.30');gradient.append(color)
            tip=copy.deepcopy(objects['0:2139']);tip.set('position','1');tip.set('id',new_id())
            gradient.append(tip)
            palette_copies.setdefault('0:2139',[]).append(tip.get('id'))
    # Keep the existing palette clips owning the corresponding copied paints.
    for animation in board.findall('LinearAnimation'):
        for obj in list(animation.findall('KeyedObject')):
            destinations=([remap[obj.get('objectId')]] if obj.get('objectId') in remap else [])+palette_copies.get(obj.get('objectId'),[])
            for destination in destinations:
                duplicate=copy.deepcopy(obj);duplicate.set('objectId',destination)
                for element in duplicate.iter():
                    if element.get('id'):element.set('id',new_id())
                animation.append(duplicate)
    # The front artwork remains available in the source; this copied view
    # renders a continuous rear silhouette, not a face covered by a flat mask.
    if hide_front:
        for shape in head.iter('Shape'):shape.set('hidden','true')
        # The same crown bounds the skull in every view; only the lower rear
        # hair and face visibility change. This also matches turnaround ends.
        objects['0:596'].attrib.pop('hidden',None)
    hair=ET.Element('Shape',name='climb-only/rear hair silhouette',y='-110',id='66:1')
    path=ET.SubElement(hair,'PointsPath',isClosed='true',id='66:2')
    points=[(0,-222),(96,-199),(139,-145),(148,-72),(140,-10)]
    # The rear hem repeats the curl scallops of the front and side views, so
    # the back of the head reads as the same hair rather than a smooth cap.
    # Dips are cusps between lobes; the crown and sides stay one smooth curve.
    dips=[(126,22),(78,38),(26,44),(-26,44),(-78,38),(-126,22)]
    lobes=[16,20,22,20,16]
    def vertex(x,y,inr,ind,outr,outd):
        ET.SubElement(path,'CubicDetachedVertex',x=str(x),y=str(y+110),
            inRotation=str(inr),outRotation=str(outr),
            inDistance=str(ind),outDistance=str(outd),id=new_id())
    smooth=points+[None]+[(-140,-10),(-148,-72),(-139,-145),(-96,-199)]
    def tangent(i):
        ring=[p for p in smooth if p]
        previous=ring[(i-1)%len(ring)];following=ring[(i+1)%len(ring)]
        if smooth.index(ring[i])==4:following=dips[0]
        if ring[i]==(-140,-10):previous=dips[-1]
        dx=(following[0]-previous[0])/6;dy=(following[1]-previous[1])/6
        return math.atan2(dy,dx),math.hypot(dx,dy)
    ring=[p for p in smooth if p]
    for i,(x,y) in enumerate(ring):
        if (x,y)==(-140,-10):
            for j,(dx,dy) in enumerate(dips):
                inr,ind=(-math.pi/2+.3,12) if j==0 else (math.pi/2-.3,1.1*lobes[j-1])
                outr,outd=(-math.pi/2-.3,12) if j==len(dips)-1 else (math.pi/2+.3,1.1*lobes[j])
                vertex(dx,dy,inr,ind,outr,outd)
        angle,distance=tangent(i)
        vertex(x,y,angle+math.pi,distance,angle,distance)
    fill=copy.deepcopy(objects['0:798'])
    for element in fill.iter():
        if element.get('id'):element.set('id',new_id())
        if element.tag.endswith('Gradient'):
            for axis in ('X','Y'):
                offset=float(objects['0:596'].get(axis.lower(),0))-float(hair.get(axis.lower(),0))
                for end in ('start','end'):
                    prop=end+axis;element.set(prop,str(float(element.get(prop,0))+offset))
    hair.append(fill)
    head.insert(0,hair)
    head.insert(0,texture)
    # Back of the same garment and shoes: shallow nape opening, no front laces.
    if hide_front:
        objects['29:10'].set('name','climb-only/continuous shirt back')
        objects['29:100'].set('y','-24')
        for id in ('0:13111','0:13103','0:13159','0:13171'):objects[id].set('hidden','true')
    # Raised arms belong on the surface side of the hair/body in a rear view.
    # Keep the original complete arm skins, with natural hair occlusion.
    for id in ('47:100','47:180','47:200','47:280'):objects[id].set('opacity','0')
    return {('29:100','y'):('KeyFrameDouble','-24')}
