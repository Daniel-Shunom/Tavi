"""Import the CC0 KayKit reference into an editable Blender authoring scene.

Run with Blender --background --python tools/avatar-lab/blender_setup.py.
The generated inventory records what actually imported, rather than assuming
that the downloaded runtime rig includes authoring controls or all animations.
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Quaternion

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "build" / "avatar-blender"
OUTPUT.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 30
bpy.ops.import_scene.gltf(filepath=str(ROOT / "public/models/avatar-lab/kaykit/Ranger.glb"))
rigs = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
if not rigs:
    raise RuntimeError("KayKit import did not produce an armature")

character_objects = set(bpy.context.scene.objects)
for pack in ("Rig_Medium_General.glb", "Rig_Medium_MovementBasic.glb"):
    bpy.ops.import_scene.gltf(filepath=str(ROOT / "public/models/avatar-lab/kaykit" / pack))
movement_objects = set(bpy.context.scene.objects) - character_objects
for action in bpy.data.actions:
    action.use_fake_user = True
walk = next((action for action in bpy.data.actions if "Walking_A" in action.name), None)
if walk is None:
    raise RuntimeError("Matching movement pack did not import Walking_A")
rigs[0].animation_data_create()
rigs[0].animation_data.action = walk
if walk.slots:
    rigs[0].animation_data.action_slot = walk.slots[0]
for obj in movement_objects:
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.context.scene.frame_start = int(walk.frame_range[0])
bpy.context.scene.frame_end = int(walk.frame_range[1])
bpy.context.scene.frame_set(bpy.context.scene.frame_start)

# A restrained original acting study. Keep the pelvis and feet at rest;
# author chest/head attention instead of moving the character's root.
rig = rigs[0]
rig.animation_data.action = next(action for action in bpy.data.actions if action.name == "Idle_A")
rig.animation_data.action_slot = rig.animation_data.action.slots[0]
bpy.context.scene.frame_set(0)
bpy.context.view_layer.update()
idle_pose = {bone.name: bone.matrix_basis.copy() for bone in rig.pose.bones}
rig.animation_data.action = None
for frame, angle in ((0, 0), (30, 0), (60, 22), (90, 22), (135, -18), (165, -18), (210, 0), (240, 0)):
    for bone in rig.pose.bones:
        bone.rotation_mode = "QUATERNION"
        bone.matrix_basis = idle_pose[bone.name]
    for name, weight in (("head", 1.0), ("chest", 0.2)):
        bone = rig.pose.bones[name]
        bone.rotation_quaternion = bone.rotation_quaternion @ Quaternion((0, 1, 0), math.radians(angle * weight))
    for bone in rig.pose.bones:
        for channel in ("location", "rotation_quaternion", "scale"):
            bone.keyframe_insert(data_path=channel, frame=frame, group=bone.name)
curious = rig.animation_data.action
curious.name = "Tavi_LookAround"
curious.use_fake_user = True
rig.animation_data.action = None
for bone in rig.pose.bones:
    bone.matrix_basis.identity()
selected_actions = [next(action for action in bpy.data.actions if action.name == name)
                    for name in ("Idle_A", "Walking_A", "Running_A", "Tavi_LookAround")]
for action in selected_actions:
    track = rig.animation_data.nla_tracks.new()
    track.name = action.name
    strip = track.strips.new(action.name, 0, action)
    if action.slots:
        strip.action_slot = action.slots[0]
    track.mute = True

export_path = ROOT / "public/models/avatar-lab/kaykit/Tavi_Ranger.blend.glb"
# Each NLA track becomes one named runtime clip, including the acting study.
bpy.ops.export_scene.gltf(filepath=str(export_path), export_format="GLB",
                          export_animation_mode="NLA_TRACKS", export_force_sampling=True)
rig.animation_data.action = walk
if walk.slots:
    rig.animation_data.action_slot = walk.slots[0]
bpy.context.scene.frame_set(0)

inventory = {
    "blender": bpy.app.version_string,
    "source": "KayKit Adventurers Ranger (CC0)",
    "active_action": walk.name,
    "rigs": [{
        "name": rig.name,
        "bones": [{"name": bone.name, "parent": bone.parent.name if bone.parent else None}
                  for bone in rig.data.bones],
    } for rig in rigs],
    "actions": [{"name": action.name, "frame_range": list(action.frame_range)}
                for action in bpy.data.actions],
    "meshes": [{"name": obj.name, "vertices": len(obj.data.vertices)}
               for obj in bpy.context.scene.objects if obj.type == "MESH"],
}
for rig in rigs:
    rig.show_in_front = True
    rig.data.display_type = "OCTAHEDRAL"
bpy.context.view_layer.objects.active = rigs[0]
bpy.ops.object.select_all(action="DESELECT")
rigs[0].select_set(True)
bpy.context.scene.render.fps = 30
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / "kaykit-authoring.blend"))
(OUTPUT / "inventory.json").write_text(json.dumps(inventory, indent=2), encoding="utf-8")
print("TAVI_BLENDER_SETUP_COMPLETE", json.dumps(inventory))
