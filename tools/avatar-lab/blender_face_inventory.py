"""Inspect connected head mesh islands before authoring facial deformation."""
import bpy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "build/avatar-blender"
bpy.ops.wm.open_mainfile(filepath=str(OUT / "kaykit-authoring.blend"))
head = bpy.data.objects['Ranger_Head']
mesh = head.data
adj = [set() for _ in mesh.vertices]
for edge in mesh.edges:
    a, b = edge.vertices
    adj[a].add(b)
    adj[b].add(a)
visited = set()
components = []
for start in range(len(adj)):
    if start in visited:
        continue
    stack = [start]
    visited.add(start)
    indices = []
    while stack:
        v = stack.pop()
        indices.append(v)
        for n in adj[v]:
            if n not in visited:
                visited.add(n)
                stack.append(n)
    coords = [mesh.vertices[i].co for i in indices]
    lo = [min(v[a] for v in coords) for a in range(3)]
    hi = [max(v[a] for v in coords) for a in range(3)]
    components.append({'indices': indices, 'min': lo, 'max': hi,
                       'center': [(a+b)/2 for a,b in zip(lo,hi)]})
(OUT / 'face-islands.json').write_text(json.dumps({'matrix': [list(row) for row in head.matrix_world],
    'components': components}, indent=2))
print('FACE_INVENTORY_COMPLETE')
