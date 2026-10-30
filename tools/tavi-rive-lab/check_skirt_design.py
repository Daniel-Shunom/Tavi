"""Protect the central geometric skirt across motions that need no lap fold."""
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[2]
reference=None
for project in ('interactive','walking','locomotion','climbing-front','climbing-left','climbing-right','climbing-rear','turnaround'):
    board=ET.parse(ROOT/f'art/tavi-rive-lab/{project}/scene.rml').getroot().find('Artboard')
    objects={e.get('id'):e for e in board.iter() if e.get('id')}
    contour={}
    for vertex in objects['37:11']:
        if 'Vertex' not in vertex.tag:continue
        contour[vertex.get('id')]=tuple(float(vertex.get(p,0)) for p in ('x','y','inRotation','inDistance','outRotation','outDistance'))
        weight=vertex.find('CubicWeight')
        for name in ('values','inValues','outValues'):
            packed=int(weight.get(name));assert packed>>16==0,f'{project}: thigh pulls skirt'
            assert (packed&255)+((packed>>8)&255)==255,'Incomplete skin weights'
    if reference is None:reference=contour
    assert contour==reference,f'{project}: base silhouette differs'
    for animation in board.findall('LinearAnimation'):
        if not animation.get('name','').startswith(('tavi/climb/','tavi/walk/','tavi/sprint/','tavi/skip/','tavi/turn/front-profile')):continue
        for obj in animation.findall('KeyedObject'):
            if obj.get('objectId') not in contour:continue
            for prop in obj.findall('KeyedProperty'):
                assert len({float(k.get('value')) for k in prop})<=1,f'{project}: motion distorts skirt contour'
    print(project+': central skirt contour retained; waist/pelvis ownership only')
print('Geometric skirt design remains consistent across ordinary poses and locomotion.')
