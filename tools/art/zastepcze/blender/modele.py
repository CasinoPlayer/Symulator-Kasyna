"""
modele.py — modele 3D grafiki zastępczej (Blender ``bpy``): matcapy, symbole S1/S2/S3, moneta, emblemat.

Każda funkcja ``m_<nazwa>()`` buduje scenę i zwraca kamerę; ``render.py`` ustawia rozdzielczość i zapisuje PNG
do ``art/zastepcze/_render/``. Modele są proste (prymitywy, bryły obrotowe, krzywe), ale materiały i światło
są takie jak w biblii stylu, więc wynik czyta się jak „stylized 3D” z topowych slotów.
"""

from __future__ import annotations

import math
import random
import sys
from pathlib import Path

import bpy  # noqa: I001 — bpy musi być pierwszy (ładuje bmesh i mathutils)
import bmesh
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from scena import (bryla_z_obrysu, chrom, emalia, emisja, kadruj, kamera, klejnot, krzywa, kula, lin, matowy,  # noqa: E402
                   nowa_scena, obrys_funkcji, obrys_okregu, profil_cebuli, przypisz, szklo,
                   tlo_dla_szkla, tokarka, torus, walec, wygladz, z_bmesh, zloto, zloto_satyna, _principled)

ZASTEPCZE = Path(__file__).resolve().parents[1]


# ================================================================================================
# Matcapy (kule materiałów do cieniowania obrazów 2,5D)
# ================================================================================================
def _mat_dif():
    m, p = _principled("dif")
    p.inputs["Base Color"].default_value = (0.8, 0.8, 0.8, 1)
    p.inputs["Roughness"].default_value = 1.0
    p.inputs["Specular IOR Level"].default_value = 0.0
    return m


def _mat_spek():
    m, p = _principled("spek")
    p.inputs["Base Color"].default_value = (0, 0, 0, 1)
    p.inputs["Roughness"].default_value = 0.25
    p.inputs["Coat Weight"].default_value = 1.0
    p.inputs["Coat Roughness"].default_value = 0.05
    return m


def _bialezloto():
    m, p = _principled("bialezloto")
    p.inputs["Base Color"].default_value = lin("#EFE8DA")
    p.inputs["Metallic"].default_value = 1.0
    p.inputs["Roughness"].default_value = 0.12
    return m


MATCAPY = {
    **{f"zloto_{g}": (zloto, g) for g in ("global", "s1", "s2", "s3")},
    **{f"zloto_satyna_{g}": (zloto_satyna, g) for g in ("global", "s2")},
    "chrom": (chrom, "s1"),
    "bialezloto": (_bialezloto, "s3"),
    "szklo": (lambda: emalia("#1E1442", 0.06, nazwa="szklo_ciemne"), "global"),
    **{f"emalia_dif_{g}": (_mat_dif, g) for g in ("global", "s1", "s2", "s3")},
    **{f"emalia_spek_{g}": (_mat_spek, g) for g in ("global", "s1", "s2", "s3")},
}


def m_matcap(nazwa):
    fn, gra = MATCAPY[nazwa]
    nowa_scena((384, 384), 48, gra)
    kula("kula", 1.0, seg=160, mat=fn())
    if not nazwa.startswith(("zloto", "chrom", "bialezloto")):
        return kamera(wzniesienie_st=0.0, skala=2.0)
    # softbox „za kamerą” (tylko metale): płaskie lico liter (normalna do widza) odbija jasne złoto,
    # a nie ciemne studio
    bpy.ops.mesh.primitive_plane_add(size=1, location=(-0.4, -7.0, 0.9))
    karta = bpy.context.object
    karta.scale = (3.2, 1.6, 1)
    karta.rotation_euler = (math.radians(-90 + 8), 0, 0)
    karta.visible_camera = False
    karta.visible_shadow = False
    kolor_karty = "#FFE6B8" if nazwa.startswith("zloto") else "#E8F0FF"   # chrom i białe złoto: neutralne światło
    karta.data.materials.append(emisja(kolor_karty, 1.15, "karta_przod"))
    return kamera(wzniesienie_st=0.0, skala=2.0)


# ================================================================================================
# S1 „Cebulowy 777” — owoce z cukierkowej emalii, złoty dzwonek, złota cebula
# ================================================================================================
def _lisc(nazwa, poz, rot, skala=0.32, kolor="#2E9E3E"):
    """Listek: spłaszczona elipsoida z lekkim wygięciem (modyfikator Simple Deform)."""
    ob = kula(nazwa, 0.5, poz, (skala * 0.42, skala * 0.07, skala), seg=48, mat=emalia(kolor, 0.35))
    ob.rotation_euler = rot
    d = ob.modifiers.new("wygiecie", "SIMPLE_DEFORM")
    d.deform_method = "BEND"
    d.angle = math.radians(35)
    d.deform_axis = "X"
    return ob


def m_s1_wisnie():
    nowa_scena((512, 512), 48, "s1")
    w = emalia("#C8102E", 0.22, sss=0.1)
    kula("w1", 0.36, (-0.36, 0.05, -0.42), (1, 1, 0.93), mat=w)
    kula("w2", 0.38, (0.36, -0.08, -0.36), (1, 1, 0.93), mat=w)
    og = emalia("#3E8E2E", 0.4)
    krzywa("og1", [(-0.34, 0.05, -0.1), (-0.3, 0.05, 0.25), (-0.12, 0.0, 0.62), (0.08, 0.0, 0.78)], 0.028, mat=og)
    krzywa("og2", [(0.35, -0.08, -0.02), (0.32, -0.04, 0.3), (0.2, 0.0, 0.6), (0.08, 0.0, 0.78)], 0.028, mat=og)
    krzywa("og3", [(0.08, 0.0, 0.78), (0.05, 0.0, 0.86)], 0.03, mat=og)
    _lisc("lisc", (0.22, 0.0, 0.88), (math.radians(10), math.radians(-25), math.radians(-62)), 0.42)
    k = kamera()
    kadruj(k, 0.05)
    return k


def m_s1_cytryna():
    nowa_scena((512, 512), 48, "s1")

    def r(t):
        return 0.52 * (math.sin(math.pi * t) ** 0.72) * (1 + 0.06 * math.cos(2 * math.pi * t))
    prof = [(r(i / 63), -0.8 + 1.6 * i / 63) for i in range(64)]
    prof[0] = (0.0, -0.84)
    prof[-1] = (0.0, 0.84)
    c = tokarka("cytryna", prof, segmenty=96)
    # cytrynowa żółć (odcień ~55°): przy bursztynowym #FFCC1A cytryna wyglądała jak mango i zlewała się
    # barwą ze złotym dzwonkiem
    m = emalia("#FFE52E", 0.3)
    nt = m.node_tree
    p = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    sz = nt.nodes.new("ShaderNodeTexNoise")
    sz.inputs["Scale"].default_value = 60.0
    b = nt.nodes.new("ShaderNodeBump")
    b.inputs["Strength"].default_value = 0.08
    nt.links.new(sz.outputs["Fac"], b.inputs["Height"])
    nt.links.new(b.outputs["Normal"], p.inputs["Normal"])
    przypisz(c, m)
    c.rotation_euler = (0, math.radians(90 - 18), 0)
    c.scale = (1.0, 0.92, 1.0)
    _lisc("lisc", (0.62, 0.0, 0.42), (math.radians(0), math.radians(-30), math.radians(-35)), 0.45)
    k = kamera()
    kadruj(k, 0.05)
    return k


def m_s1_sliwka():
    nowa_scena((512, 512), 48, "s1")

    def r(t):
        return 0.55 * math.sin(math.pi * t ** 0.92) ** 0.65
    prof = [(r(i / 63), -0.55 + 1.15 * i / 63) for i in range(64)]
    prof[0], prof[-1] = (0.0, -0.57), (0.0, 0.6)
    s = tokarka("sliwka", prof, segmenty=128)
    # bruzda: wcięcie wzdłuż południka zwróconego lekko w lewo od kamery
    kat0 = math.radians(-90 - 25)
    for v in s.data.vertices:
        th = math.atan2(v.co.y, v.co.x)
        d = math.atan2(math.sin(th - kat0), math.cos(th - kat0))
        g = math.exp(-(d / 0.16) ** 2) * 0.07
        v.co.x *= (1 - g)
        v.co.y *= (1 - g)
    m = emalia("#7B2CBF", 0.3)
    p = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    p.inputs["Sheen Weight"].default_value = 0.6          # mleczny „nalot” śliwki
    p.inputs["Sheen Tint"].default_value = lin("#E6D2FF")
    przypisz(s, m)
    s.rotation_euler = (0, math.radians(-8), 0)
    krzywa("ogonek", [(0.0, 0.0, 0.55), (0.03, 0.0, 0.7), (0.1, 0.0, 0.8)], 0.03, mat=emalia("#6B4A26", 0.5))
    _lisc("lisc", (-0.25, 0.0, 0.78), (0, math.radians(20), math.radians(55)), 0.42)
    k = kamera()
    kadruj(k, 0.05)
    return k


def _pol_walca(nazwa, r, gl, y, mat, faza=0.0):
    """Półwalec (płaska krawędź u góry) zwrócony do kamery — plaster arbuza składa się z trzech takich warstw."""
    ob = walec(nazwa, r, gl, (0, y, 0), (math.pi / 2, 0, 0), seg=128, mat=mat, faza=faza)
    bpy.context.view_layer.objects.active = ob
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0),
                           plane_no=(0, 1, 0), clear_outer=True)
    # zamknięcie przekroju (płaska krawędź plastra)
    krawedzie = [e for e in bm.edges if e.is_boundary]
    if krawedzie:
        bmesh.ops.holes_fill(bm, edges=krawedzie, sides=0)
    bm.to_mesh(ob.data)
    bm.free()
    return ob


def m_s1_arbuz():
    nowa_scena((512, 512), 48, "s1")
    miazsz = emalia("#E8203A", 0.25, sss=0.1)
    biala = emalia("#F2F5D8", 0.4)
    ziel = emalia("#1E7B34", 0.3)
    nt = ziel.node_tree
    p = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    at = nt.nodes.new("ShaderNodeMath")
    at.operation = "ARCTAN2"
    mn = nt.nodes.new("ShaderNodeMath")
    mn.operation = "MULTIPLY"
    mn.inputs[1].default_value = 7.0
    sn = nt.nodes.new("ShaderNodeMath")
    sn.operation = "SINE"
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = lin("#0F4A1E")
    mix.inputs[7].default_value = lin("#2FA04A")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], at.inputs[0])
    nt.links.new(sep.outputs["X"], at.inputs[1])
    nt.links.new(at.outputs[0], mn.inputs[0])
    nt.links.new(mn.outputs[0], sn.inputs[0])
    nt.links.new(sn.outputs[0], mix.inputs[0])
    nt.links.new(mix.outputs[2], p.inputs["Base Color"])
    plaster = bpy.data.objects.new("plaster", None)
    bpy.context.scene.collection.objects.link(plaster)
    for ob in (_pol_walca("miazsz", 1.0, 0.34, -0.02, miazsz, 0.03), _pol_walca("biala", 1.07, 0.30, 0.0, biala, 0.02),
               _pol_walca("skorka", 1.17, 0.27, 0.02, ziel, 0.04)):
        ob.parent = plaster
    pestka = emalia("#120A0A", 0.12)
    for i in range(7):
        kat = math.radians(200 + i * 20)
        rr = 0.62 + 0.08 * (i % 2)
        ob = kula(f"pestka{i}", 0.06, (rr * math.cos(kat), -0.19, rr * math.sin(kat)), (0.55, 0.3, 1.0), seg=24, mat=pestka)
        ob.rotation_euler = (0, -kat + math.pi / 2, 0)
        ob.parent = plaster
    plaster.rotation_euler = (math.radians(-6), 0, math.radians(-8))
    k = kamera()
    kadruj(k, 0.05)
    return k


def m_s1_dzwonek():
    nowa_scena((512, 512), 48, "s1")
    prof = [(0.0, 1.02), (0.12, 1.01), (0.24, 0.97), (0.32, 0.9), (0.36, 0.8), (0.38, 0.66), (0.40, 0.5),
            (0.44, 0.34), (0.51, 0.2), (0.61, 0.09), (0.70, 0.02), (0.74, -0.02), (0.73, -0.06), (0.66, -0.07),
            (0.0, -0.07)]
    d = tokarka("dzwon", prof, segmenty=128)
    wygladz(d, 1)
    z = zloto(0.16)
    przypisz(d, z)
    torus("opaska1", 0.455, 0.028, (0, 0, 0.32), mat=zloto(0.12))
    torus("opaska2", 0.40, 0.02, (0, 0, 0.5), mat=zloto(0.12))
    kula("serce", 0.13, (0, 0, -0.13), mat=zloto(0.15))
    torus("uchwyt", 0.11, 0.035, (0, 0, 1.08), (math.pi / 2, 0, 0), mat=z)
    # czerwona satynowa kokarda na szczycie
    k_m = emalia("#C8102E", 0.3)
    p = next(n for n in k_m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    p.inputs["Sheen Weight"].default_value = 0.15
    for s in (-1, 1):
        ob = torus(f"petla{s}", 0.17, 0.05, (s * 0.2, -0.05, 1.12), (math.pi / 2, 0, s * math.radians(20)), mat=k_m)
        ob.scale = (1.0, 0.55, 1.0)
        krzywa(f"wst{s}", [(s * 0.05, -0.08, 1.08), (s * 0.15, -0.12, 0.95), (s * 0.24, -0.1, 0.84)], 0.045,
               [1, 0.9, 0.7], mat=k_m).data.bevel_resolution = 1
    kula("wezel", 0.08, (0, -0.1, 1.12), (1, 0.8, 1), mat=k_m)
    k = kamera()
    kadruj(k, 0.05)
    return k


def _cebula_zlota(nazwa="cebula", R=0.55, H=1.25, zebra=7, mat=None, czubek=True, gl_zeber=0.1):
    c = tokarka(nazwa, profil_cebuli(R, H), zebra=zebra, glebokosc_zeber=gl_zeber)
    wygladz(c, 1)
    przypisz(c, mat or zloto())
    if czubek:
        krzywa(nazwa + "_czubek", [(0, 0, H - 0.06), (0.01, 0, H + 0.08), (0.08, 0, H + 0.2), (0.19, 0, H + 0.2),
                                   (0.2, 0, H + 0.1), (0.12, 0, H + 0.07)], 0.045 * R / 0.55,
               [1, 0.85, 0.7, 0.5, 0.35, 0.2], mat=mat or zloto())
    return c


def m_s1_cebula():
    nowa_scena((512, 512), 48, "s1")
    _cebula_zlota()
    # neonowy pierścień za cebulą: magenta → cyjan (kolor emisji zależny od kąta)
    t = torus("neon", 0.82, 0.035, (0, 0.45, 0.52), (math.pi / 2, 0, 0), seg=160)
    m = bpy.data.materials.new("neon")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -0.85
    mr.inputs["From Max"].default_value = 0.85
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = lin("#FF2E88")
    mix.inputs[7].default_value = lin("#21E6FF")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = 2.6
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    nt.links.new(sep.outputs["X"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], mix.inputs[0])
    nt.links.new(mix.outputs[2], em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs[0])
    przypisz(t, m)
    k = kamera()
    kadruj(k, 0.05)
    return k


# ================================================================================================
# Moneta cebulion (3 ujęcia) i emblemat
# ================================================================================================
def _profil_monety():
    return [(0.0, 0.07), (0.82, 0.07), (0.85, 0.082), (0.89, 0.095), (0.95, 0.094), (0.985, 0.083),
            (1.0, 0.06), (1.0, -0.06), (0.985, -0.083), (0.95, -0.094), (0.89, -0.095), (0.85, -0.082),
            (0.82, -0.07), (0.0, -0.07)]


def _relief_obraz(nazwa, sciezka):
    img = bpy.data.images.load(str(sciezka))
    img.colorspace_settings.name = "Non-Color"
    return img


def _plaszczyzna_reliefu(nazwa, obraz, promien, wys, z, gestosc=360, mat=None):
    """Siatka przemieszczona mapą wysokości (relief cebuli w koronie na awersie monety)."""
    bm = bmesh.new()
    n = gestosc
    verts = {}
    for i in range(n + 1):
        for j in range(n + 1):
            x = -promien + 2 * promien * i / n
            y = -promien + 2 * promien * j / n
            if x * x + y * y <= (promien * 1.01) ** 2:
                verts[(i, j)] = bm.verts.new((x, y, 0))
    for i in range(n):
        for j in range(n):
            q = [verts.get(k) for k in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))]
            if all(q):
                bm.faces.new(q)
    uv = bm.loops.layers.uv.new()
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x / (2 * promien) + 0.5, l.vert.co.y / (2 * promien) + 0.5)
    ob = z_bmesh(nazwa, bm)
    tex = bpy.data.textures.new(nazwa + "_tex", "IMAGE")
    tex.image = obraz
    tex.extension = "EXTEND"
    mod = ob.modifiers.new("relief", "DISPLACE")
    mod.texture = tex
    mod.texture_coords = "UV"
    mod.strength = wys
    mod.mid_level = 0.0
    ob.location.z = z
    if mat:
        przypisz(ob, mat)
    return ob


def _material_reliefu(obraz):
    """Relief polerowany (jasne odblaski), pole satynowe (miękki połysk) — 01 § 2.5."""
    m, p = _principled("zloto_relief")
    p.inputs["Base Color"].default_value = lin("#FFC94A")
    p.inputs["Metallic"].default_value = 1.0
    nt = m.node_tree
    tx = nt.nodes.new("ShaderNodeTexImage")
    tx.image = obraz
    tx.extension = "EXTEND"
    uvn = nt.nodes.new("ShaderNodeUVMap")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.0
    mr.inputs["From Max"].default_value = 0.12
    mr.inputs["To Min"].default_value = 0.36
    mr.inputs["To Max"].default_value = 0.13
    nt.links.new(uvn.outputs["UV"], tx.inputs["Vector"])
    nt.links.new(tx.outputs["Color"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], p.inputs["Roughness"])
    return m


def _moneta(obrot_st):
    import tekstury
    sciezka = tekstury.relief_monety()
    obraz = _relief_obraz("relief_monety", sciezka)
    rodzic = bpy.data.objects.new("moneta", None)
    bpy.context.scene.collection.objects.link(rodzic)
    # rant ząbkowany: ~110 żłobień = modulacja promienia na pasie krawędzi
    prof = _profil_monety()
    korpus = tokarka("korpus", prof, segmenty=880, zebra=0)
    for v in korpus.data.vertices:
        r = math.hypot(v.co.x, v.co.y)
        if r > 0.995 and abs(v.co.z) < 0.065:
            th = math.atan2(v.co.y, v.co.x)
            k = 1 - 0.012 * (0.5 - 0.5 * math.cos(110 * th)) ** 2
            v.co.x *= k
            v.co.y *= k
    przypisz(korpus, zloto(0.2))
    korpus.parent = rodzic
    rel = _plaszczyzna_reliefu("awers", obraz, 0.82, 0.05, 0.0701, mat=_material_reliefu(obraz))
    rel.parent = rodzic
    rodzic.rotation_euler = (math.pi / 2, 0, math.radians(obrot_st))
    return rodzic


def m_moneta_przod():
    nowa_scena((512, 512), 48, "global")
    _moneta(0)
    k = kamera(wzniesienie_st=0.0)
    kadruj(k, 0.04)
    return k


def m_moneta_skos():
    nowa_scena((512, 512), 48, "global")
    _moneta(45)
    k = kamera(wzniesienie_st=0.0)
    kadruj(k, 0.04)
    return k


def m_moneta_bok():
    nowa_scena((512, 512), 48, "global")
    _moneta(82)
    k = kamera(wzniesienie_st=0.0)
    kadruj(k, 0.04)
    return k


def _korona(z0=0.0, R=0.3, skala=1.0, gemy=True, y=0.0):
    """Korona en face: sylwetka (obręcz + 5 zębów) wyciągnięta w głąb z fazą, na czubkach naprzemiennie lilie
    (złote kulki) i perły; kamienie na obręczy: magentowy rubin w środku, cyjanowe szafiry po bokach (01 § 2.4)."""
    zl = zloto(0.14)
    w = R
    hb = 0.16 * skala
    zeby = [(-1.0, 0.36), (-0.5, 0.27), (0.0, 0.4), (0.5, 0.27), (1.0, 0.36)]
    bw = 0.17 * w
    pts = [(-w, z0), (w, z0)]
    for dx, wys in reversed(zeby):                 # od prawej do lewej: podstawa → czubek → podstawa
        x = dx * (w - bw)
        pts += [(x + bw, z0 + hb), (x, z0 + hb + wys * skala), (x - bw, z0 + hb)]
    bryla_z_obrysu("korona", pts, 0.08 * skala, 0.012 * skala, zl).location.y = y
    perla = emalia("#FFF4E6", 0.15)
    for i, (dx, wys) in enumerate(zeby):
        x = dx * (w - bw)
        kula(f"czubek{i}", 0.045 * skala, (x, y - 0.01, z0 + hb + wys * skala + 0.02 * skala),
             mat=zl if i % 2 == 0 else perla)
    if gemy:
        for dx, kol, r in ((0.0, "#FF2E88", 0.05), (-0.55, "#21E6FF", 0.04), (0.55, "#21E6FF", 0.04)):
            kula(f"gem{dx}", r * skala, (dx * w, y - 0.05 * skala, z0 + hb * 0.5), (1, 0.7, 1),
                 mat=szklo(kol, 1.6))


def m_emblemat():
    nowa_scena((512, 512), 48, "global")
    import tekstury
    rodzic = bpy.data.objects.new("medalion", None)
    bpy.context.scene.collection.objects.link(rodzic)
    # pierścień zewnętrzny (polerowane złoto) + gilosz + emaliowane pole ze „sunburstem”
    pier = tokarka("pierscien", [(0.84, -0.06), (0.86, 0.04), (0.9, 0.09), (0.96, 0.09), (1.0, 0.04), (1.0, -0.06)],
                   segmenty=160, zamknij=False)
    przypisz(pier, zloto(0.12))
    gil = tokarka("gilosz", [(0.79, -0.04), (0.79, 0.035), (0.86, 0.04), (0.86, -0.04)], segmenty=160, zamknij=False)
    przypisz(gil, zloto_satyna())
    pole = walec("pole", 0.8, 0.07, (0, 0, 0), mat=None)
    obraz = _relief_obraz("sunburst", tekstury.sunburst())
    m, p = _principled("emalia_pola")
    p.inputs["Roughness"].default_value = 0.25
    p.inputs["Coat Weight"].default_value = 1.0
    p.inputs["Coat Roughness"].default_value = 0.03
    nt = m.node_tree
    tx = nt.nodes.new("ShaderNodeTexImage")
    tx.image = obraz
    tcn = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (0.625, 0.625, 1)
    mp.inputs["Location"].default_value = (0.5, 0.5, 0)
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = lin("#170F38")
    mix.inputs[7].default_value = lin("#3A2A7A")
    b = nt.nodes.new("ShaderNodeBump")
    b.inputs["Strength"].default_value = 0.25
    nt.links.new(tcn.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], tx.inputs["Vector"])
    nt.links.new(tx.outputs["Color"], mix.inputs[0])
    nt.links.new(tx.outputs["Color"], b.inputs["Height"])
    nt.links.new(mix.outputs[2], p.inputs["Base Color"])
    nt.links.new(b.outputs["Normal"], p.inputs["Normal"])
    przypisz(pole, m)
    for ob in (pier, gil, pole):
        ob.parent = rodzic
    rodzic.rotation_euler = (math.pi / 2, 0, 0)
    # cebula w koronie przed polem
    c = _cebula_zlota("cebula", R=0.42, H=1.0, zebra=5, czubek=False)
    c.location = (0, -0.16, -0.66)
    _korona(z0=0.24, R=0.27, skala=1.25, y=-0.2)
    # gałązki laurowe łukiem pod cebulą
    lis = zloto(0.18)
    for s in (-1, 1):
        for i in range(6):
            a = math.radians(-90 + s * (25 + i * 14))
            r = 0.56
            ob = kula(f"laur{s}{i}", 0.5, (r * math.cos(a), -0.12, r * math.sin(a) - 0.05), (0.035, 0.02, 0.085),
                      seg=24, mat=lis)
            ob.rotation_euler = (0, a + math.pi / 2 + s * 0.5, 0)
    k = kamera(wzniesienie_st=0.0)
    kadruj(k, 0.04)
    return k


# ================================================================================================
# S2 „Złoty Faraon”: relikwia cebuli (WILD), piramida (SCATTER)
# ================================================================================================
def _paski_lapis(n=8):
    """Złoto z pionowymi pasami lapis lazuli wzdłuż żeber (kąt wokół osi → wybór materiału)."""
    m = bpy.data.materials.new("relikwia")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    z1 = nt.nodes.new("ShaderNodeBsdfPrincipled")
    z1.inputs["Base Color"].default_value = lin("#FFC94A")
    z1.inputs["Metallic"].default_value = 1.0
    z1.inputs["Roughness"].default_value = 0.15
    l1 = nt.nodes.new("ShaderNodeBsdfPrincipled")
    l1.inputs["Base Color"].default_value = lin("#1B3FA0")
    l1.inputs["Roughness"].default_value = 0.2
    l1.inputs["Coat Weight"].default_value = 1.0
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    at = nt.nodes.new("ShaderNodeMath")
    at.operation = "ARCTAN2"
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = n / (2 * math.pi)
    fr = nt.nodes.new("ShaderNodeMath")
    fr.operation = "FRACT"
    od = nt.nodes.new("ShaderNodeMath")
    od.operation = "SUBTRACT"
    od.inputs[1].default_value = 0.5
    ab = nt.nodes.new("ShaderNodeMath")
    ab.operation = "ABSOLUTE"
    lt = nt.nodes.new("ShaderNodeMath")
    lt.operation = "LESS_THAN"
    lt.inputs[1].default_value = 0.17
    mixs = nt.nodes.new("ShaderNodeMixShader")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    nt.links.new(sep.outputs["Y"], at.inputs[0])
    nt.links.new(sep.outputs["X"], at.inputs[1])
    nt.links.new(at.outputs[0], mul.inputs[0])
    nt.links.new(mul.outputs[0], fr.inputs[0])
    nt.links.new(fr.outputs[0], od.inputs[0])
    nt.links.new(od.outputs[0], ab.inputs[0])
    nt.links.new(ab.outputs[0], lt.inputs[0])
    nt.links.new(lt.outputs[0], mixs.inputs[0])
    nt.links.new(z1.outputs[0], mixs.inputs[1])
    nt.links.new(l1.outputs[0], mixs.inputs[2])
    nt.links.new(mixs.outputs[0], out.inputs[0])
    return m


def m_s2_relikwia():
    nowa_scena((512, 512), 48, "s2")
    c = tokarka("kopula", profil_cebuli(0.55, 1.2), zebra=8, glebokosc_zeber=0.12)
    wygladz(c, 1)
    przypisz(c, _paski_lapis(8))
    c.location.z = 0.18
    c.rotation_euler = (0, 0, math.radians(22.5))
    krzywa("czubek", [(0, 0, 1.3), (0.0, 0, 1.45), (0.04, 0, 1.55)], 0.04, [1, 0.6, 0.3], mat=zloto())
    kula("kulka", 0.06, (0, 0, 1.32), mat=zloto())
    zl = zloto(0.16)
    podst = tokarka("podstawa", [(0.0, -0.32), (0.5, -0.32), (0.52, -0.28), (0.5, -0.24), (0.42, -0.2), (0.38, -0.05),
                                 (0.44, 0.02), (0.46, 0.08), (0.36, 0.14), (0.3, 0.2), (0.0, 0.2)], segmenty=96)
    przypisz(podst, zl)
    torus("pierscien", 0.43, 0.03, (0, 0, 0.05), mat=zloto(0.1))
    for i in range(8):
        a = 2 * math.pi * i / 8 + math.radians(22.5)
        kula(f"tur{i}", 0.035, (0.47 * math.cos(a), 0.47 * math.sin(a), -0.26), (1, 1, 0.7),
             mat=emalia("#2EC4B6", 0.2))
    k = kamera()
    kadruj(k, 0.05)
    return k


def m_s2_piramida():
    # światło pochodni z lewej (jak pozostałe symbole S2), słabe wypełnienie i rim: lewa-frontowa ściana świeci
    # ciepłym piaskowcem, prawa tonie w cieniu — dwie ściany o różnej jasności czytają się jako bryła
    nowa_scena((512, 512), 48, "s2")
    bpy.data.objects["key"].data.color = lin("#FFDDB0")[:3]   # pochodnia bliżej bieli: piaskowiec, nie łosoś
    bpy.data.objects["fill"].data.energy = 90
    bpy.data.objects["rim"].data.energy = 220
    bpy.data.objects["rim2"].data.energy = 120
    bm = bmesh.new()
    s, h = 0.8, 1.22                     # stromo (stylizacja jak w slotach) — niska bryła czytała się jak dach
    v = [bm.verts.new(p) for p in ((-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0), (0, 0, h))]
    bm.faces.new((v[0], v[1], v[4]))
    bm.faces.new((v[1], v[2], v[4]))
    bm.faces.new((v[2], v[3], v[4]))
    bm.faces.new((v[3], v[0], v[4]))
    bm.faces.new((v[3], v[2], v[1], v[0]))
    pir = z_bmesh("piramida", bm, gladko=False)
    m = matowy("#D9B47E", 0.75, nazwa="piaskowiec")      # jaśniejszy piasek: w świetle pochodni daje złoto, nie pomarańcz
    nt = m.node_tree
    p = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    fala = nt.nodes.new("ShaderNodeTexWave")
    fala.wave_type = "BANDS"
    fala.bands_direction = "Z"
    fala.inputs["Scale"].default_value = 5.0
    fala.inputs["Distortion"].default_value = 0.0
    b = nt.nodes.new("ShaderNodeBump")
    b.inputs["Strength"].default_value = 0.6
    nt.links.new(tc.outputs["Object"], fala.inputs["Vector"])
    nt.links.new(fala.outputs["Fac"], b.inputs["Height"])
    nt.links.new(b.outputs["Normal"], p.inputs["Normal"])
    przypisz(pir, m)
    bm = bmesh.new()
    s2, h0 = s * 0.24, h * 0.76
    v = [bm.verts.new(p) for p in ((-s2, -s2, h0), (s2, -s2, h0), (s2, s2, h0), (-s2, s2, h0), (0, 0, h + 0.02))]
    for f in ((0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)):
        bm.faces.new([v[i] for i in f])
    szczyt = z_bmesh("piramidion", bm, gladko=False)
    przypisz(szczyt, zloto(0.12))
    szczyt.scale = (1.04, 1.04, 1.0)
    # obrót −24°: duża ściana frontowa patrzy w key light (lewa-góra), wąska prawa ściana w cień —
    # kontrast dwóch ścian robi z trójkąta bryłę 3D
    pir.rotation_euler = (0, 0, math.radians(-24))
    szczyt.rotation_euler = (0, 0, math.radians(-24))
    k = kamera(wzniesienie_st=9)
    kadruj(k, 0.05)
    return k


# ================================================================================================
# S3 „Kryształowa Kaskada”: klejnoty, kryształowa cebula, pryzmat, kula mnożnika, odłamki, kryształy
# ================================================================================================
def _gem_scena(probki=64):
    nowa_scena((512, 512), probki, "s3")
    tlo_dla_szkla()


def m_s3_szafir():
    _gem_scena()

    def kropla(u):
        a = 2 * math.pi * u
        x = 0.5 * math.sin(a)
        y = -0.6 * math.cos(a)
        if y > 0:
            x *= (1 - y / 0.6) ** 0.85
        return (x, y + 0.08)
    g = klejnot("szafir", obrys_funkcji(kropla, 28), mat=szklo("#3D7BFF", 1.77))
    g.rotation_euler = (math.radians(78), 0, 0)
    k = kamera()
    kadruj(k, 0.05)
    return k


def m_s3_szmaragd():
    _gem_scena()
    w, h, c = 0.42, 0.58, 0.13
    obrys = [(-w + c, -h), (w - c, -h), (w, -h + c), (w, h - c), (w - c, h), (-w + c, h), (-w, h - c), (-w, -h + c)]
    g = klejnot("szmaragd", obrys, h_korony=0.14, tafla=0.62, h_pawilonu=0.36, pierscien_korony=0.86,
                mat=szklo("#19D17A", 1.6))
    g.rotation_euler = (math.radians(78), 0, 0)
    k = kamera()
    kadruj(k, 0.05)
    return k


def m_s3_ametyst():
    _gem_scena()
    # sześciokąt poziomy (wierzchołki z lewej i prawej), szer. : wys. ≈ 1,25 : 1, jasny orchideowy fiolet (01 § 11.4)
    obrys = [(0.6 * math.cos(math.radians(60 * i)), 0.415 * math.sin(math.radians(60 * i))) for i in range(6)]
    g = klejnot("ametyst", obrys, h_korony=0.12, tafla=0.66, h_pawilonu=0.34, pierscien_korony=0.85,
                mat=szklo("#C77DFF", 1.55, cienka_warstwa=380))
    g.rotation_euler = (math.radians(78), 0, 0)
    k = kamera()
    kadruj(k, 0.05)
    return k


def m_s3_topaz():
    _gem_scena()
    # markiza: dwa łuki okręgu spotykające się w ostrych szpicach
    obrys = []
    for i in range(10):
        t = -1 + 2 * i / 10
        obrys.append((0.3 * (1 - t * t) ** 0.75, 0.66 * t))
    for i in range(10):
        t = 1 - 2 * i / 10
        obrys.append((-0.3 * (1 - t * t) ** 0.75, 0.66 * t))
    g = klejnot("topaz", obrys[::1], h_korony=0.16, tafla=0.5, h_pawilonu=0.38, mat=szklo("#FFB23D", 1.55))
    bpy.context.scene.cycles.samples = 160
    g.rotation_euler = (math.radians(78), math.radians(45), 0)
    k = kamera()
    kadruj(k, 0.05)
    return k


def _serce(u):
    t = 2 * math.pi * u
    x = 16 * math.sin(t) ** 3
    y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
    return (x / 32, y / 32 + 0.03)


def m_s3_rubin():
    _gem_scena()
    obrys = obrys_funkcji(_serce, 40)
    g = klejnot("rubin", obrys, h_korony=0.15, tafla=0.5, h_pawilonu=0.4, mat=szklo("#FF2D55", 1.76))
    # złota filigranowa oprawa: obwódka po obrysie + 4 łapki
    pts = [(x * 1.03, y * 1.03, -0.01) for (x, y) in obrys] + [(obrys[0][0] * 1.03, obrys[0][1] * 1.03, -0.01)]
    krzywa("oprawa", pts, 0.018, mat=zloto(0.14), zamknieta=True)
    for u in (0.12, 0.38, 0.62, 0.88):
        x, y = _serce(u)
        krzywa(f"lapka{u}", [(x * 1.05, y * 1.05, -0.04), (x * 1.0, y * 1.0, 0.06), (x * 0.88, y * 0.88, 0.12)],
               0.025, [1, 0.8, 0.6], mat=zloto(0.14))
    rodzic = bpy.data.objects.new("rodzic", None)
    bpy.context.scene.collection.objects.link(rodzic)
    for ob in list(bpy.context.scene.objects):
        if ob.type in ("MESH", "CURVE") and ob.name != "tlo_szkla" and not ob.name.startswith("karta"):
            ob.parent = rodzic
    rodzic.rotation_euler = (math.radians(78), 0, 0)
    del g
    k = kamera()
    kadruj(k, 0.05)
    return k


def m_s3_diament():
    """Diament z PROFILU (korona z taflą, rondysta, ostry pawilon) — ikoniczna sylwetka „💎”. Widok z góry dawał
    okrągły krążek w oprawie, łudząco podobny do kuli mnożnika (01 § 5.2, test sylwetek)."""
    _gem_scena()
    g = klejnot("diament", obrys_okregu(24, 0.6), h_korony=0.26, tafla=0.56, h_pawilonu=0.66, pierscien_korony=0.8,
                mat=szklo("#EEFBFF", 2.42, cienka_warstwa=320))
    g.rotation_euler = (math.radians(16), 0, math.radians(7))     # tafla lekko do kamery — widać jej elipsę
    k = kamera()
    kadruj(k, 0.05)
    return k


def _bz():
    m, p = _principled("biale_zloto")
    p.inputs["Base Color"].default_value = lin("#EFE8DA")
    p.inputs["Metallic"].default_value = 1.0
    p.inputs["Roughness"].default_value = 0.1
    return m


def m_s3_cebula():
    _gem_scena()
    zewn = tokarka("krysztal", profil_cebuli(0.56, 1.25), zebra=7, glebokosc_zeber=0.08)
    wygladz(zewn, 1)
    przypisz(zewn, szklo("#FFF3D6", 1.5, cienka_warstwa=420))
    for i, (sk, kolr) in enumerate(((0.72, "#FFC94A"), (0.5, "#FFD970"))):
        w = tokarka(f"warstwa{i}", profil_cebuli(0.56 * sk, 1.25 * sk), zebra=7, glebokosc_zeber=0.06)
        przypisz(w, zloto(0.2, kolr, nazwa=f"zw{i}"))
        w.location.z = 0.04 + i * 0.03
    torus("pierscien", 0.09, 0.025, (0, 0, 1.12), mat=zloto(0.12))
    krzywa("czubek", [(0, 0, 1.15), (0.01, 0, 1.3), (0.09, 0, 1.43), (0.2, 0, 1.42), (0.21, 0, 1.32), (0.13, 0, 1.29)],
           0.04, [1, 0.85, 0.7, 0.5, 0.35, 0.2], mat=zloto(0.14))
    k = kamera()
    kadruj(k, 0.05)
    return k


def m_s3_pryzmat():
    """Pryzmat „Serce Jaskini”: trójgraniasty kryształ stojący na podstawie (wierzchołek w górę);
    poświatę „serca” i tęczę dokłada kompozycja w gen_s3 (łatwiej sterować kolorem niż światłem w szkle)."""
    _gem_scena()
    bpy.ops.mesh.primitive_cylinder_add(vertices=3, radius=0.62, depth=0.42, location=(0, 0, 0))
    pr = bpy.context.object
    mod = pr.modifiers.new("faza", "BEVEL")
    mod.width = 0.025
    mod.segments = 2
    przypisz(pr, szklo("#F2FBFF", 1.62, cienka_warstwa=520))
    # pierwszy wierzchołek walca leży na osi +Y: obrót o 90° wokół X kładzie oś walca wzdłuż Y (trójkątna
    # ściana do kamery) z wierzchołkiem w górę; skręt wokół Z pokazuje grubość bryły
    pr.rotation_euler = (math.radians(90), 0, math.radians(14))
    k = kamera()
    kadruj(k, 0.05, obiekty=[pr])
    return k


def m_s3_kula():
    _gem_scena()
    kula("kula", 0.6, mat=szklo("#F2FAFF", 1.45, cienka_warstwa=250), seg=128)
    kula("srodek", 0.34, mat=emisja("#F4F8FF", 1.0))
    zl = zloto(0.14)
    torus("klatka1", 0.645, 0.026, rot=(math.radians(90), 0, math.radians(38)), mat=zl)
    torus("klatka2", 0.645, 0.026, rot=(math.radians(90), 0, math.radians(-38)), mat=zl)
    torus("pas", 0.64, 0.024, rot=(math.radians(12), 0, 0), mat=zl)
    kula("szpic_g", 0.05, (0, 0, 0.66), mat=zl)
    kula("szpic_d", 0.05, (0, 0, -0.66), mat=zl)
    k = kamera()
    kadruj(k, 0.05)
    return k


def _odlamek(nazwa, seed, typ, rozmiar):
    """Losowa wypukła bryła (otoczka wypukła losowych punktów): drzazga, bryłka albo łuska."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    sx, sy, sz = {"drzazga": (0.18, 0.12, 1.0), "brylka": (0.7, 0.6, 0.8), "luska": (0.9, 0.12, 0.7)}[typ]
    for _ in range(14):
        bm.verts.new(((rnd.random() - 0.5) * sx, (rnd.random() - 0.5) * sy, (rnd.random() - 0.5) * sz))
    bmesh.ops.convex_hull(bm, input=bm.verts)
    ob = z_bmesh(nazwa, bm, gladko=False)
    ob.scale = (rozmiar,) * 3
    ob.rotation_euler = (rnd.random() * 1.2, rnd.random() * 6.28, rnd.random() * 6.28)
    return ob


def m_s3_odlamki():
    nowa_scena((1152, 768), 48, "s3")
    tlo_dla_szkla(rozmiar=30)
    mat = szklo("#DDEEFF", 1.5, cienka_warstwa=300)
    typy = ["drzazga"] * 4 + ["brylka"] * 4 + ["luska"] * 4
    random.Random(9).shuffle(typy)
    for i, t in enumerate(typy):
        r, c = divmod(i, 4)
        ob = _odlamek(f"o{i}", 100 + i, t, 1.0 + 0.6 * ((i * 7) % 5) / 4)
        ob.location = (-2.25 + c * 1.5, 0, 1.0 - r * 1.0)
        przypisz(ob, mat)
    k = kamera(wzniesienie_st=0.0, skala=6.0)
    return k


def _krysztal(nazwa, poz, kier, dl, r, mat):
    """Sześciokątny kryształ ze szpicem, wyrastający w kierunku ``kier``."""
    bm = bmesh.new()
    dol = [bm.verts.new((r * math.cos(math.pi / 3 * i), r * math.sin(math.pi / 3 * i), 0)) for i in range(6)]
    gora = [bm.verts.new((r * math.cos(math.pi / 3 * i), r * math.sin(math.pi / 3 * i), dl)) for i in range(6)]
    szpic = bm.verts.new((0, 0, dl + r * 1.6))
    bm.faces.new(list(reversed(dol)))
    for i in range(6):
        j = (i + 1) % 6
        bm.faces.new((dol[i], dol[j], gora[j], gora[i]))
        bm.faces.new((gora[i], gora[j], szpic))
    ob = z_bmesh(nazwa, bm, gladko=False)
    ob.location = poz
    ob.rotation_euler = Vector(kier).normalized().to_track_quat("Z", "Y").to_euler()
    przypisz(ob, mat)
    return ob


def _skupisko(seed, kolory, n=9):
    rnd = random.Random(seed)
    for i in range(n):
        a = rnd.uniform(-1.0, 1.0)
        kier = (math.sin(a) * 0.9, rnd.uniform(-0.3, 0.3), math.cos(a))
        k = rnd.choice(kolory)
        _krysztal(f"k{i}", (rnd.uniform(-0.3, 0.3), rnd.uniform(-0.2, 0.2), 0), kier,
                  rnd.uniform(0.5, 1.3) * (1.2 - abs(a) * 0.4), rnd.uniform(0.09, 0.18),
                  szklo(k, 1.55, cienka_warstwa=rnd.choice([0, 300])))


def m_s3_krysztaly_ametyst():
    _gem_scena(48)
    _skupisko(21, ["#B05CFF", "#C98BFF", "#8E4BD8"], 11)
    kula("rdzen", 0.18, (0, 0.0, 0.15), mat=emisja("#B05CFF", 3.0))
    k = kamera()
    kadruj(k, 0.04)
    return k


def m_s3_krysztaly_szafir():
    _gem_scena(48)
    _skupisko(33, ["#3D7BFF", "#7FB0FF", "#19F5D2"], 10)
    kula("rdzen", 0.18, (0, 0.0, 0.15), mat=emisja("#3D7BFF", 3.0))
    k = kamera()
    kadruj(k, 0.04)
    return k


# Lista renderów: nazwa → (funkcja, opis). Rozdzielczość ustawia sama funkcja.
RENDERY = {f"matcap_{n}": (lambda n=n: m_matcap(n), "matcap") for n in MATCAPY}
RENDERY.update({
    "s1_wisnie": (m_s1_wisnie, ""), "s1_cytryna": (m_s1_cytryna, ""), "s1_sliwka": (m_s1_sliwka, ""),
    "s1_arbuz": (m_s1_arbuz, ""), "s1_dzwonek": (m_s1_dzwonek, ""), "s1_cebula": (m_s1_cebula, ""),
    "moneta_przod": (m_moneta_przod, ""), "moneta_skos": (m_moneta_skos, ""), "moneta_bok": (m_moneta_bok, ""),
    "emblemat": (m_emblemat, ""),
    "s2_relikwia": (m_s2_relikwia, ""), "s2_piramida": (m_s2_piramida, ""),
    "s3_szafir": (m_s3_szafir, ""), "s3_szmaragd": (m_s3_szmaragd, ""), "s3_ametyst": (m_s3_ametyst, ""),
    "s3_topaz": (m_s3_topaz, ""), "s3_rubin": (m_s3_rubin, ""), "s3_diament": (m_s3_diament, ""),
    "s3_cebula": (m_s3_cebula, ""), "s3_pryzmat": (m_s3_pryzmat, ""), "s3_kula": (m_s3_kula, ""),
    "s3_odlamki": (m_s3_odlamki, ""),
    "s3_krysztaly_ametyst": (m_s3_krysztaly_ametyst, ""), "s3_krysztaly_szafir": (m_s3_krysztaly_szafir, ""),
})
