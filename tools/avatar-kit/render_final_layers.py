# Renders the avatar-kit layers from the creator's final model (NORTH14_Final.blend, revision 2026-11-02) with Blender 5.2.
# Run in the background, once per pose (about a minute each):
#   OUT=/tmp/layers_ready POSE=ready AZ=0   SHRINK=0.012 GLASSES=1 blender -b NORTH14_Final.blend --python tools/avatar-kit/render_final_layers.py
#   OUT=/tmp/layers_hips  POSE=hips  AZ=-25 SHRINK=0.012 GLASSES=1 blender -b NORTH14_Final.blend --python tools/avatar-kit/render_final_layers.py
# Env: OUT = output folder; POSE = ready | hips; AZ = camera angle in degrees around the athlete (hips uses -25);
#      SHRINK = metres the holdout body is shrunk for garment layers (0.012 stops the tight garments being cut);
#      GLASSES=1 also renders the neon glasses layer; POSE_FILE and GLASSES_FILE = the .blend files holding the
#      Pose_Hands_On_Hips action and the glasses objects (defaults below, from the LUA-Accessories folder).
# Camera: orthographic, 2.45 m frame centered at z = 0.805 m, 900x1200, transparent film, Eevee 32 samples,
# Standard view transform, exposure -0.55, three sun lights that turn with the camera.
import bpy, math, os
from mathutils import Vector, Matrix
OUT=os.environ['OUT']; AZ=float(os.environ.get('AZ','0')); POSE=os.environ.get('POSE','ready')
sc=bpy.data.scenes['NORTH14_Customizable']; bpy.context.window.scene=sc if bpy.context.window else None
C=bpy.data.objects['Appearance_Controls']; rig=bpy.data.objects['NORTH14_Rig']
if POSE=='hips':
    with bpy.data.libraries.load(os.environ.get('POSE_FILE','/Users/kurtkleckner/Desktop/Claude Projects/LUA-Accessories/NORTH14_Final_v4_hands_on_hips_pose.blend')) as (s,d): d.actions=['Pose_Hands_On_Hips']
    rig.animation_data.action=bpy.data.actions['Pose_Hands_On_Hips']
else:
    rig.animation_data.action=bpy.data.actions['Pose_Athletic_Ready']
sc.frame_set(1)
GROUPS={
 'body':['BaseBody'],'hair':['Hair'],'cap':['Cap','Decoration_Cap_Crest'],
 'top_baseball':['Jersey_Baseball','Jersey_Buttons','Trim_Placket_L','Trim_Placket_R','Trim_Cuff_L','Trim_Cuff_R','Decoration_NORTH','Decoration_14'],
 'bottom_baseball':['Pants_Baseball','Belt_Baseball','Belt_Loops','Belt_Buckle','Trim_Pants_L','Trim_Pants_R'],
 'shoes':['Shoes_L','Shoes_R'],'basketball':['Jersey_Basketball','Shorts_Basketball','Socks']}
PAL={'A':dict(SkinTone=(0.68,0.4,0.25),HairColor=(0.115,0.042,0.012),IrisColor=(0.055,0.26,0.53)),
     'B':dict(SkinTone=(0.22,0.095,0.047),HairColor=(0.015,0.011,0.009),IrisColor=(0.075,0.24,0.115))}
TEAM={'green':dict(TeamColor=(0.008,0.075,0.025),ShoeColor=(0.008,0.075,0.025)),
      'blue':dict(TeamColor=(0.02,0.04,0.2),ShoeColor=(0.02,0.04,0.2))}
STATE={'body':dict(Outfit=1,Hair=False,Cap=False,BodyHiding=False),
 'hair_classic':dict(Outfit=1,Hair=True,Cap=False,BodyHiding=False),'hair_cap':dict(Outfit=1,Hair=True,Cap=True,BodyHiding=False),
 'cap':dict(Outfit=1,Hair=False,Cap=True,BodyHiding=False),'top_baseball':dict(Outfit=1,Hair=False,Cap=False,BodyHiding=False),
 'bottom_baseball':dict(Outfit=1,Hair=False,Cap=False,BodyHiding=False),'shoes':dict(Outfit=1,Hair=False,Cap=False,BodyHiding=False),
 'basketball':dict(Outfit=2,Hair=False,Cap=False,BodyHiding=False)}
R=Matrix.Rotation(math.radians(AZ),3,'Z')
def light(name,loc,rot,energy):
    d=bpy.data.lights.new(name,'SUN'); d.energy=energy; o=bpy.data.objects.new(name,d); sc.collection.objects.link(o)
    o.location=R@Vector(loc); o.rotation_euler=(math.radians(rot[0]),math.radians(rot[1]),math.radians(rot[2]+AZ))
light("TmpKey",(-3,-5,6),(50,0,-30),2.8); light("TmpFill",(4,-3,3),(70,0,50),1.1); light("TmpRim",(0,5,5),(110,0,0),1.0)
w=bpy.data.worlds.new('TmpW'); w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(0.8,0.82,0.86,1); w.node_tree.nodes['Background'].inputs[1].default_value=1.0; sc.world=w
cam=bpy.data.objects.new('TmpCam',bpy.data.cameras.new('TmpCam')); sc.collection.objects.link(cam); sc.camera=cam
a=math.radians(AZ); loc=Vector((12*math.sin(a),-12*math.cos(a),0.805)); cam.location=loc
cam.rotation_euler=(Vector((0,0,0.805))-loc).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=2.45
sc.render.engine='BLENDER_EEVEE'; sc.render.resolution_x=900; sc.render.resolution_y=1200; sc.render.resolution_percentage=100
sc.render.film_transparent=True; sc.render.image_settings.color_mode='RGBA'
sc.view_settings.view_transform='Standard'; sc.view_settings.exposure=-0.55; sc.view_settings.look='None'
try: sc.eevee.taa_render_samples=32
except Exception: pass
meshes=[o for o in sc.objects if o.type=='MESH']
body=bpy.data.objects['BaseBody']
def render(name,group,pal='A',team='green'):
    key=group
    for k,v in {**PAL[pal],**TEAM[team],**STATE[key]}.items(): C[k]=v
    C['TrimColor']=(0.85,0.57,0.1); C['PantsColor']=(0.48,0.5,0.53); C['ShoeAccentColor']=(0.83,0.85,0.83)
    tmp=body.modifiers.get('TMP_HIDE_Feet')
    if tmp: body.modifiers.remove(tmp)
    for _n in ('TMP_SHRINK',):
        _t=body.modifiers.get(_n)
        if _t: body.modifiers.remove(_t)
    if group=='body':
        m=body.modifiers.new('TMP_HIDE_Feet','MASK'); m.vertex_group='HIDE_Shoes'; m.invert_vertex_group=True
    if group in ('top_baseball','bottom_baseball','basketball'):
        sh=body.modifiers.new('TMP_SHRINK','DISPLACE'); sh.direction='NORMAL'; sh.mid_level=0.0; sh.strength=-float(os.environ.get('SHRINK','0.006'))
    C.update_tag(); bpy.context.view_layer.update()
    g={'hair_classic':'hair','hair_cap':'hair'}.get(group,group); want=set(GROUPS[g])
    for o in meshes:
        if o.name=='BaseBody':
            o.is_holdout=(group not in ('body','shoes')); o.visible_camera=(group!='shoes'); o.visible_shadow=True
        else:
            on=o.name in want; o.visible_camera=on; o.visible_shadow=on
    sc.render.filepath=f"{OUT}/{name}.png"; bpy.ops.render.render(write_still=True)
    t=body.modifiers.get('TMP_HIDE_Feet')
    if t: body.modifiers.remove(t)
    t=body.modifiers.get('TMP_SHRINK')
    if t: body.modifiers.remove(t)
jobs=[('body_A','body','A','green'),('body_B','body','B','green'),
 ('shoes_green','shoes','A','green'),('shoes_blue','shoes','A','blue'),
 ('bottom_baseball','bottom_baseball','A','green'),
 ('top_baseball_green','top_baseball','A','green'),('top_baseball_blue','top_baseball','A','blue'),
 ('basketball_green','basketball','A','green'),('basketball_blue','basketball','A','blue'),
 ('hair_A_classic','hair_classic','A','green'),('hair_A_cap','hair_cap','A','green'),
 ('hair_B_classic','hair_classic','B','green'),('hair_B_cap','hair_cap','B','green'),
 ('cap_green','cap','A','green'),('cap_blue','cap','A','blue')]
for j in jobs: render(*j)
# GLASSES_JOB: bring the neon glasses over from the accessories file and render them as their own layer
if os.environ.get('GLASSES')=='1':
    with bpy.data.libraries.load(os.environ.get('GLASSES_FILE','/Users/kurtkleckner/Desktop/Claude Projects/LUA-Accessories/NORTH14_Final_v4_pose_and_glasses.blend')) as (src,dst):
        dst.objects=['Glasses_Neon_Frame','Glasses_Neon_Lens']
    gl=[]
    for ob in dst.objects:
        if ob is None: continue
        sc.collection.objects.link(ob); gl.append(ob)
        if ob.animation_data:
            for fc in list(ob.animation_data.drivers): ob.animation_data.drivers.remove(fc)
        ob.hide_viewport=False; ob.hide_render=False
        for m in ob.data.materials:
            if m and m.node_tree and m.node_tree.animation_data:
                for fc in list(m.node_tree.animation_data.drivers): m.node_tree.animation_data.drivers.remove(fc)
    # fix colors (drivers removed)
    for ob in gl:
        for m in ob.data.materials:
            nt=m.node_tree
            if 'Frame_BSDF' in nt.nodes:
                b=nt.nodes['Frame_BSDF']; b.inputs['Base Color'].default_value=(1.0,0.04,0.45,1); b.inputs['Emission Color'].default_value=(1.0,0.04,0.45,1)
            if 'Lens_Tint' in nt.nodes: nt.nodes['Lens_Tint'].inputs[7].default_value=(0.3,0.78,0.95,1)
    # park the rig in the ready pose to compute the bone-parent inverse, then restore the render pose
    keep=rig.animation_data.action
    rig.animation_data.action=bpy.data.actions['Pose_Athletic_Ready']; sc.frame_set(1); bpy.context.view_layer.update()
    pb=rig.pose.bones['Socket_Glasses']; base=rig.matrix_world@pb.matrix@Matrix.Translation((0,pb.bone.length,0))
    for ob in gl:
        ob.parent=rig; ob.parent_type='BONE'; ob.parent_bone='Socket_Glasses'; ob.matrix_parent_inverse=base.inverted()
    rig.animation_data.action=keep; sc.frame_set(1)
    for k,v in dict(Outfit=1,Hair=False,Cap=False,BodyHiding=False).items(): C[k]=v
    C.update_tag(); bpy.context.view_layer.update()
    tmp=body.modifiers.get('TMP_SHRINK')
    if tmp: body.modifiers.remove(tmp)
    names={o.name for o in gl}
    for o in [o for o in sc.objects if o.type=='MESH']:
        if o.name=='BaseBody': o.is_holdout=True; o.visible_camera=True; o.visible_shadow=True
        else: on=o.name in names; o.visible_camera=on; o.visible_shadow=on
    sc.render.filepath=f"{OUT}/glasses_neon.png"; bpy.ops.render.render(write_still=True)
print('ALL_DONE',POSE)
