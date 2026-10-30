"""Verify expression ports own only facial properties and preserve source provenance."""
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from expressions import CATALOG_PATH, controls, resolve, source_sampler, is_discrete, append_expression_library

ROOT=Path(__file__).resolve().parents[2]
catalog=json.loads(CATALOG_PATH.read_text(encoding='utf-8'))
for path,digest in catalog['sourceSha256'].items():
    assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest,f'Source changed: re-export {path}'
board=ET.parse(ROOT/'art/tavi-rive-lab/project/scene.rml').getroot().find('Artboard')
sample=source_sampler(board)
allowed={'0:1591','0:1593','0:1909','0:1913','0:1983','0:1982','0:2739','0:2647','0:12152',
         '0:478','0:476','0:484','0:482','7:78','7:77','7:79','7:80','0:552'}
signature=None
for name in ('neutral',*catalog['expressions']):
    for level in ('subtle','typical','strong'):
        channels=controls(name,level)
        assert set(channels)==set(controls('neutral'))
        assert channels['browLeft']<=0.35 and channels['browRight']<=0.35
        values=resolve(channels,sample)
        assert all(id in allowed for id,prop in values),'Body, gaze or orientation ownership leaked into expression'
        if signature is None:signature=set(values)
        assert set(values)==signature,f'Incomplete endpoint: {name}/{level}'
        selection={key:value for key,value in values.items() if is_discrete(key,value)}
        assert len(selection)==2 and ('0:552','opacity') in selection
        line=float(selection[('0:552','opacity')][1])
        assert line==(1 if channels['mouthShape']==0 else 0),'Closed line overlaps open mouth'
        assert all(key not in selection for key,value in values.items() if not is_discrete(key,value))
counter=0
def animation(name,frames,duration):
    global counter
    counter+=1
    return ET.Element('LinearAnimation',name=name,duration=str(duration),id=f'99:{counter}')
clips=append_expression_library(board,sample,animation)
assert len(clips)==35 and counter==210
print('34 canonical emotes plus neutral; 105 complete endpoints; 210 separate face/mouth clips.')
print('Facial ownership, exclusive mouth selection, brow visibility and five source hashes verified.')
