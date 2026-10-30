"""Author mesh facial controls and bake a planted two-hand brace for the stage.

Run after blender_setup.py. Original authoring controls stay in the .blend;
the browser receives a baked clip and morph targets, not Blender constraints.
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'build/avatar-blender'
bpy.ops.wm.open_mainfile(filepath=str(OUT / 'kaykit-authoring.blend'))
rig = next(obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')
rig.animation_data.action = bpy.data.actions['Idle_A']
rig.animation_data.action_slot = rig.animation_data.action.slots[0]
bpy.context.scene.frame_set(0)
bpy.context.view_layer.update()
idle = {bone.name: bone.matrix_basis.copy() for bone in rig.pose.bones}
head = bpy.data.objects['Ranger_Head']
islands = json.loads((OUT / 'face-islands.json').read_text())['components']
# Validate the source-specific islands before making any local deformation.
eyes = [islands[i] for i in (10, 11)]
assert all(len(eye['indices']) == 40 and eye['center'][1] < -0.35 for eye in eyes)
base_positions = [vertex.co.copy() for vertex in head.data.vertices]
if head.data.shape_keys:
    head.shape_key_clear()
basis = head.shape_key_add(name='Basis', from_mix=False)
for name in ('blink', 'happy', 'surprised', 'lookLeft', 'lookRight', 'lookUp', 'lookDown'):
    key = head.shape_key_add(name=name, from_mix=False)
    key.relative_key = basis
    for index, position in enumerate(base_positions):
        key.data[index].co = position
    for eye in eyes:
        center = Vector(eye['center'])
        for index in eye['indices']:
            point = key.data[index].co
            if name == 'blink':
                point.z = center.z + (point.z - center.z) * 0.06
            elif name == 'happy':
                point.z = center.z + (point.z - center.z) * 0.65
            elif name == 'surprised':
                point.z = center.z + (point.z - center.z) * 1.2
            elif name == 'lookLeft':
                point.x -= 0.018
            elif name == 'lookRight':
                point.x += 0.018
            elif name == 'lookUp':
                point.z += 0.014
            elif name == 'lookDown':
                point.z -= 0.014
    if name in ('happy', 'surprised'):
        for component in (islands[15], islands[16]):
            for index in component['indices']:
                key.data[index].co.z += 0.025 if name == 'happy' else 0.045
        for index in islands[13]['indices']:
            point = key.data[index].co
            if name == 'surprised':
                point.z -= 0.035
            else:
                point.z += 0.035 * min(1, abs(point.x - 0.0225) / 0.13)

rig.animation_data.action = None
for bone in rig.pose.bones:
    bone.rotation_mode = 'QUATERNION'
    bone.matrix_basis = idle[bone.name]
    for frame in (0, 120):
        for channel in ('location', 'rotation_quaternion', 'scale'):
            bone.keyframe_insert(data_path=channel, frame=frame, group=bone.name)
source_action = rig.animation_data.action
source_action.name = 'Tavi_Brace_Controls'
source_action.use_fake_user = True
controls = []
constraints = []
for side, sign in (('l', 1), ('r', -1)):
    wrist = rig.pose.bones['wrist.' + side]
    # The model is Z-up in Blender and faces -Y. The targets share a fixed
    # plane in front of the chest; both wrists stay there throughout the hold.
    target = bpy.data.objects.new('Brace wrist ' + side, None)
    bpy.context.collection.objects.link(target)
    target.location = (sign * 0.22, -0.44, 0.94)
    target.empty_display_type = 'SPHERE'
    target.empty_display_size = 0.035
    controls.append(target)
    ik = rig.pose.bones['wrist.' + side].constraints.new('IK')
    ik.name = 'Planted brace ' + side
    ik.target = target
    ik.chain_count = 3
    ik.use_stretch = False
    ik.iterations = 100
    for frame, influence in ((0, 0), (12, 0), (36, 1), (84, 1), (114, 0), (120, 0)):
        ik.influence = influence
        ik.keyframe_insert(data_path='influence', frame=frame)
    constraints.append(ik)

bpy.context.view_layer.objects.active = rig
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.ops.nla.bake(frame_start=0, frame_end=120, step=1, only_selected=False,
                visual_keying=True, clear_constraints=False, use_current_action=False,
                bake_types={'POSE'})
brace = rig.animation_data.action
brace.name = 'Tavi_Brace'
brace.use_fake_user = True
for constraint in constraints:
    constraint.mute = True
rig.animation_data.action = brace
if brace.slots:
    rig.animation_data.action_slot = brace.slots[0]
samples = []
for frame in (36, 48, 60, 72, 84):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    samples.append({side: list(rig.matrix_world @ rig.pose.bones['hand.' + side].head)
                    for side in ('l', 'r')})
report = {'hold_samples': samples, 'targets': [list(obj.location) for obj in controls],
          'expression_controls': [key.name for key in head.data.shape_keys.key_blocks][1:]}
(OUT / 'contact-report.json').write_text(json.dumps(report, indent=2))
rig.animation_data.action = None
track = rig.animation_data.nla_tracks.new()
track.name = brace.name
strip = track.strips.new(brace.name, 0, brace)
if brace.slots:
    strip.action_slot = brace.slots[0]
track.mute = True
for bone in rig.pose.bones:
    bone.matrix_basis.identity()
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    if obj.type in ('ARMATURE', 'MESH'):
        obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'public/models/avatar-lab/kaykit/Tavi_Ranger.blend.glb'),
    export_format='GLB', use_selection=True, export_animation_mode='NLA_TRACKS',
    export_force_sampling=True)
rig.animation_data.action = brace
rig.animation_data.action_slot = brace.slots[0]
bpy.context.scene.frame_start = 0
bpy.context.scene.frame_end = 120
bpy.context.scene.frame_set(60)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'kaykit-contact-authoring.blend'))
print('TAVI_CONTACT_AND_FACE_COMPLETE')
