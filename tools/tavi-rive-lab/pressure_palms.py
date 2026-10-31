"""Foundation-only pressure hand artwork, adapted from the approved hand palette."""
from pathlib import Path
import copy
import json
import hashlib
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'art/tavi-rive-lab'


def create_pressure_projects():
    source = ET.parse(WORK / 'runtime/scene.rml').getroot()
    board = source.find('Artboard')
    assert not any(e.get('id', '').startswith('90:') for e in source.iter())
    arm = next(e for e in source.iter() if e.get('name') == 'tavi/armL.surface')
    color = arm.find('Stroke/SolidColor').get('colorValue')
    profile = json.loads((ROOT / 'src/renderer/characters/tavi-foundation/pressure-palm.json').read_text())
    assert abs(float(arm.find('Stroke').get('thickness')) / 2 - profile['wristInset']) < 1e-6
    assert hashlib.sha256((ROOT / 'src/renderer/characters/tavi-refined/tavi-refined.riv').read_bytes()).hexdigest() == profile['baseAssetSha256']
    palm = ET.Element('Node', name='tavi/contact/palm', opacity='0', id='90:1')
    for index, (name, x, y, width, height) in enumerate([
        ('pressure pad', 0, -profile['height']/2, profile['width'], profile['height']), ('thumb pad', -7, -10, 10, 8),
    ]):
        base = 10 + index * 10
        shape = ET.SubElement(palm, 'Shape', name=name, x=str(x), y=str(y), id=f'90:{base}')
        ET.SubElement(shape, 'Rectangle', width=str(width), height=str(height), cornerRadiusTL='4', id=f'90:{base+1}')
        fill = ET.SubElement(shape, 'Fill', id=f'90:{base+2}')
        ET.SubElement(fill, 'SolidColor', colorValue=color, id=f'90:{base+3}')
    hand_solo = next(e for e in board.iter() if e.get('name') == 'tavi/handL')
    hand_solo.insert(0, palm)
    clip = ET.SubElement(board, 'LinearAnimation', name='tavi/runtime/palm-pressure', fps='60', duration='60', id='90:40')
    keyed = ET.SubElement(clip, 'KeyedObject', objectId='90:1', id='90:41')
    prop = ET.SubElement(keyed, 'KeyedProperty', property='opacity', id='90:42')
    for frame, value in [(0, 0), (60, 1)]:
        ET.SubElement(prop, 'KeyFrameDouble', frame=str(frame), value=str(value), interpolationType='linear', id=f'90:{43+frame}')
    choose = ET.SubElement(clip, 'KeyedObject', objectId=hand_solo.get('id'), id='90:120')
    choose_prop = ET.SubElement(choose, 'KeyedProperty', property='activeComponentId', id='90:121')
    ET.SubElement(choose_prop, 'KeyFrameId', frame='0', value='90:1', id='90:122')
    rest = next(e for e in board.findall('LinearAnimation') if e.get('name') == 'tavi/runtime/rest')
    hand_reset = ET.SubElement(rest, 'KeyedObject', objectId=hand_solo.get('id'), id='90:130')
    hand_reset_prop = ET.SubElement(hand_reset, 'KeyedProperty', property='activeComponentId', id='90:131')
    ET.SubElement(hand_reset_prop, 'KeyFrameId', frame='0', value=hand_solo.get('activeComponentId'), id='90:132')
    reset = ET.SubElement(rest, 'KeyedObject', objectId='90:1', id='90:110')
    reset_prop = ET.SubElement(reset, 'KeyedProperty', property='opacity', id='90:111')
    ET.SubElement(reset_prop, 'KeyFrameDouble', frame='0', value='0', id='90:112')
    assert not any('Script' in e.tag or e.tag == 'CustomProperty' for e in source.iter())
    def write(folder, root, name, main):
        folder.mkdir(parents=True, exist_ok=True)
        ET.indent(root, space='  ')
        (folder / 'scene.rml').write_text(ET.tostring(root, encoding='unicode') + '\n', encoding='utf-8')
        (folder / 'rive.yaml').write_text(f'name: {name}\nmain: "{main}"\n', encoding='utf-8')
    write(WORK / 'pressure-palms', source, 'tavi-foundation', 'lyla animation')
    review = ET.Element('Rive', version='1', kind='fragment')
    art = ET.SubElement(review, 'Artboard', name='Pressure palm', width='120', height='80', styleId='90:201', id='90:200')
    ET.SubElement(art, 'LayoutComponentStyle', name='Palm preview style', id='90:201')
    hand = copy.deepcopy(palm)
    hand.set('opacity', '1'); hand.set('x', '60'); hand.set('y', '60')
    hand.set('scaleX', '3'); hand.set('scaleY', '3')
    art.append(hand)
    write(WORK / 'pressure-palm-review', review, 'tavi-pressure-palm', 'Pressure palm')
    return WORK / 'pressure-palms'


if __name__ == '__main__':
    folder = create_pressure_projects()
    if '--export' in sys.argv:
        cli = Path.home() / '.rive/bin/rive.exe'
        subprocess.run([str(cli), str(folder), '--verify'], check=True)
        subprocess.run([str(cli), 'inspect', str(folder), '--summary'], check=True)
        subprocess.run([str(cli), str(folder), '--once'], check=True)
        shutil.copyfile(folder / 'build/tavi-foundation.riv', ROOT / 'src/renderer/characters/tavi-foundation/tavi-foundation.riv')
