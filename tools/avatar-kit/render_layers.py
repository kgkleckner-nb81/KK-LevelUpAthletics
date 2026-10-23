# Blender script that renders the avatar-kit layers from NORTH14_Final.blend (Blender 5.2).
# Run inside Blender (for example through the Claude Blender connection) with the file open and
# the "NORTH14_Customizable" scene active. It needs a camera named TmpCam, three sun lights and
# a world; see README.md for the exact camera and render settings. Example:
#   exec(open("tools/avatar-kit/render_layers.py").read())
#   render2("body_A","body",'A'); render2("top_baseball_green","top_baseball",'A','green'); restore()
import bpy, math, os
SP=os.path.expanduser("~/avatar-kit-renders")  # where the PNG layers are written; create it first
sc=bpy.data.scenes['NORTH14_Customizable']; C=bpy.data.objects['Appearance_Controls']
GROUPS={
 'body':['BaseBody'],'hair_classic':['Hair_Classic'],'hair_cap':['Hair_CapSafe'],'cap':['Cap','Decoration_Cap_Crest'],
 'top_baseball':['Jersey_Baseball','Jersey_Buttons','Jersey_Collar_Band','Trim_Collar','Trim_Placket_-0.009','Trim_Placket_0.009','Trim_Cuff_L','Trim_Cuff_R','Decoration_NORTH','Decoration_14'],
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
meshes=[o for o in sc.objects if o.type=='MESH']
def render(name,group,pal='A',team='green'):
    for k,v in {**PAL[pal],**TEAM[team],**STATE[group]}.items(): C[k]=v
    C['TrimColor']=(0.85,0.57,0.1); C['PantsColor']=(0.48,0.5,0.53); C['ShoeAccentColor']=(0.83,0.85,0.83)
    bpy.context.view_layer.update()
    want=set(GROUPS[group])
    for o in meshes:
        on=o.name in want; o.visible_camera=on; o.visible_shadow=on
    sc.render.filepath=f"{SP}/{name}.png"; bpy.ops.render.render(write_still=True); print("rendered",name)

# ---- v2: holdout body for garment layers, feet masked on the body layer, softer exposure
def prep_scene():
    sc.view_settings.view_transform='Standard'; sc.view_settings.exposure=-0.55; sc.view_settings.look='None'
    for n,e in (("TmpKey",2.8),("TmpFill",1.1),("TmpRim",1.0)):
        o=bpy.data.objects.get(n)
        if o: o.data.energy=e
def render2(name,group,pal='A',team='green'):
    prep_scene()
    for k,v in {**PAL[pal],**TEAM[team],**STATE[group]}.items(): C[k]=v
    C['TrimColor']=(0.85,0.57,0.1); C['PantsColor']=(0.48,0.5,0.53); C['ShoeAccentColor']=(0.83,0.85,0.83)
    body=bpy.data.objects['BaseBody']
    # temp modifier: hide only the feet (the shoes cover them) on the body layer
    tmp=body.modifiers.get('TMP_HIDE_Feet')
    if tmp: body.modifiers.remove(tmp)
    if group=='body':
        m=body.modifiers.new('TMP_HIDE_Feet','MASK'); m.vertex_group='HIDE_Shoes'; m.invert_vertex_group=True
        # keep it right after the armature modifier so the mask is applied to the posed mesh
    bpy.context.view_layer.update()
    want=set(GROUPS[group])
    for o in meshes:
        if o.name=='BaseBody':
            o.is_holdout=(group not in ('body','shoes')); o.visible_camera=(group!='shoes'); o.visible_shadow=True
        else:
            on=o.name in want; o.visible_camera=on; o.visible_shadow=on
    sc.render.filepath=f"{SP}/{name}.png"; bpy.ops.render.render(write_still=True); print("rendered",name)
    tmp=body.modifiers.get('TMP_HIDE_Feet')
    if tmp: body.modifiers.remove(tmp)
def restore():
    b=bpy.data.objects['BaseBody']; b.is_holdout=False
    t=b.modifiers.get('TMP_HIDE_Feet')
    if t: b.modifiers.remove(t)
    for o in meshes: o.visible_camera=True; o.visible_shadow=True
    C['Outfit']=1; C['Hair']=True; C['Cap']=True; C['BodyHiding']=True
