"""
scena.py — wspólne narzędzia Blendera (moduł ``bpy``) do renderów grafiki zastępczej.

Po co to jest
-------------
Grafika zastępcza ma wyglądać jak docelowa z ChatGPT: „high-end stylized 3D”, polerowane złoto, emalia, szkło,
światło z lewej-góry z cyjanowym i magentowym rimem (01 § 4.2). Tu jest jedno studio fotograficzne, którego
używają wszystkie modele: kamera, światła, otoczenie odbijające się w złocie i biblioteka materiałów.

Działa w Blenderze uruchamianym jako moduł Pythona (``pip install bpy``), bez okna — render na CPU (Cycles).
"""

from __future__ import annotations

import math

import bpy  # noqa: I001 — bpy musi być pierwszy (ładuje bmesh i mathutils)
import bmesh
from mathutils import Vector

# ------------------------------------------------------------------------------------------------
# Kolory (01 § 3): tokeny marki + palety gier
# ------------------------------------------------------------------------------------------------
KOLORY = {
    "bg0": "#07060F", "bg1": "#120B2A", "bg2": "#1E1442",
    "gold1": "#FFE08A", "gold2": "#F5C542", "gold3": "#B8860B",
    "magenta": "#FF2E88", "cyan": "#21E6FF", "zielony": "#3DFF8F",
    "key": "#FFC489", "fill": "#6E64B8",
    "s1_czerwien": "#E3122B", "s1_wisnia": "#C8102E", "s1_zolty": "#FFD23F", "s1_fiolet": "#7B2CBF",
    "s2_lapis": "#1B3FA0", "s2_turkus": "#2EC4B6", "s2_piaskowiec": "#C89B5A", "s2_pochodnia": "#FFA45C",
    "s3_szafir": "#2F6BFF", "s3_szmaragd": "#19D17A", "s3_ametyst": "#A64DFF", "s3_topaz": "#FFB23D",
    "s3_rubin": "#FF2D55", "s3_diament": "#E8FBFF", "s3_teal": "#19F5D2", "s3_opal": "#FF8AD8",
}


def lin(h: str, a: float = 1.0):
    """Kolor hex sRGB → liniowy RGBA (Blender liczy światło liniowo)."""
    h = KOLORY.get(h, h).lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return (*c, a)


# Schematy świateł (01 § 4.2 i modyfikacje per gra): (kolor key, kolor rimu głównego, kolor rimu akcentowego,
# siła rimu akcentowego względem key).
SWIATLA = {
    "global": ("#FFC489", "#7FEFFF", "#FF2E88", 0.45, 1.0),
    "s1": ("#FFE3C4", "#5CEBFF", "#FF2E88", 0.7, 1.0),
    "s2": ("#FFA45C", "#2EC4B6", "#FFB347", 0.45, 1.0),
    "s2_noc": ("#B9CCFF", "#9FE8FF", "#2EC4B6", 0.5, 0.25),   # scatter S2: chłodne nocne światło (01 § 10.4)
    "s3": ("#FFD38A", "#19F5D2", "#A64DFF", 0.55, 1.0),
}


# ------------------------------------------------------------------------------------------------
# Scena, światła, kamera
# ------------------------------------------------------------------------------------------------
def nowa_scena(rozdz=(512, 512), probki=48, swiatlo="global", przezroczyste=True, karty=True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = probki
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 12
    sc.cycles.glossy_bounces = 6
    sc.cycles.transmission_bounces = 12
    sc.cycles.transparent_max_bounces = 8
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.sample_clamp_indirect = 8.0
    sc.render.film_transparent = przezroczyste
    sc.render.resolution_x, sc.render.resolution_y = rozdz
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "8"
    # Khronos PBR Neutral: zachowuje nasycenie kolorów bazowych (emalia, neon) i łagodnie kompresuje odblaski —
    # najbliżej „cukierkowego” wyglądu topowych slotów (AgX za mocno odbarwia jasne żółcie i neony).
    try:
        sc.view_settings.view_transform = "Khronos PBR Neutral"
    except TypeError:
        sc.view_settings.view_transform = "Standard"
    _swiat(sc)
    _swiatla(sc, swiatlo)
    if karty:
        _karty_odbic()
    return sc


def _swiat(sc):
    """Otoczenie studia: ciemny fiolet u dołu, jaśniejsze „niebo” u góry — tyle odbija się w złocie."""
    w = bpy.data.worlds.new("studio")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -1.0
    mr.inputs["From Max"].default_value = 1.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    el = ramp.color_ramp.elements
    # od dołu: ciemny fiolet → jasny pas horyzontu (daje złotu jasną linię odbicia) → jasne „niebo” studia
    el[0].position, el[0].color = 0.0, lin("#4E3420")
    el[1].position, el[1].color = 1.0, lin("#F2EAF6")
    for poz, kol in ((0.38, "#3C2C3C"), (0.49, "#9A8AA6"), (0.55, "#3E3258"), (0.78, "#A49ABF")):
        e = el.new(poz)
        e.color = lin(kol)
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = 0.85
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs[0], out.inputs[0])


def _celuj(obj, cel=(0, 0, 0)):
    d = Vector(cel) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def swiatlo_obszarowe(nazwa, poz, kolor, moc, rozmiar=3.0, cel=(0, 0, 0)):
    dane = bpy.data.lights.new(nazwa, "AREA")
    dane.energy = moc
    dane.size = rozmiar
    dane.color = lin(kolor)[:3]
    ob = bpy.data.objects.new(nazwa, dane)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = poz
    _celuj(ob, cel)
    return ob


def _swiatla(sc, schemat):
    key, rim1, rim2, sila2, sila_fill = SWIATLA[schemat]
    swiatlo_obszarowe("key", (-4.5, -5.5, 5.5), key, 1400, 4.0)
    swiatlo_obszarowe("fill", (5.5, -5.0, 1.0), KOLORY["fill"], 380 * sila_fill, 5.0)
    swiatlo_obszarowe("rim", (4.5, 4.0, 3.0), rim1, 900, 2.0)
    swiatlo_obszarowe("rim2", (-4.5, 3.5, -2.5), rim2, 1100 * sila2, 2.0)


def _karty_odbic():
    """Niewidoczne dla kamery jasne „softboxy” — dają złotu jasne i ciemne pasy odbić (wygląd polerowanego metalu)."""
    def karta(nazwa, poz, rozm, kolor, moc):
        bpy.ops.mesh.primitive_plane_add(size=1, location=poz)
        ob = bpy.context.object
        ob.name = nazwa
        ob.scale = (*rozm, 1)
        _celuj(ob)
        ob.rotation_euler.rotate_axis("X", math.pi)   # płaszczyzna świeci w stronę obiektu
        ob.visible_camera = False
        ob.visible_shadow = False
        ob.data.materials.append(emisja(kolor, moc))
    karta("karta_gora", (-2.0, -3.0, 6.0), (5, 2.2), "#FFF1DC", 2.2)
    karta("karta_prawa", (6.0, -1.0, 1.5), (1.0, 5), "#D6E8FF", 1.4)
    karta("karta_lewa", (-6.0, -2.0, 0.5), (1.4, 4), "#FFE2C0", 1.0)
    karta("karta_dol", (0.5, -3.5, -5.5), (6, 2.5), "#FFB878", 0.9)   # ciepłe odbicie od dołu (złoto nie czernieje)


def tlo_dla_szkla(kolor_gora="#E8F6FF", kolor_dol="#5A4C8C", moc=2.5, odl=4.0, rozmiar=14.0):
    """Jasna plansza za obiektem, niewidoczna dla kamery, ale widoczna PRZEZ szkło (promienie transmisji):
    klejnoty załamują jasne tło i świecą, zamiast wyglądać na ciemne bryłki."""
    bpy.ops.mesh.primitive_plane_add(size=rozmiar, location=(0, odl, 0.5), rotation=(math.pi / 2, 0, 0))
    ob = bpy.context.object
    ob.name = "tlo_szkla"
    ob.visible_camera = False
    ob.visible_shadow = False
    ob.visible_diffuse = False
    ob.visible_glossy = False
    m = bpy.data.materials.new("tlo_szkla")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = lin(kolor_dol)
    ramp.color_ramp.elements[1].color = lin(kolor_gora)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = moc
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Y"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs[0])
    ob.data.materials.append(m)
    return ob


def kamera(odleglosc=12.0, wzniesienie_st=7.0, orto=True, skala=2.4, ogniskowa=85):
    """Kamera frontalna, 5–10° nad środkiem obiektu (01 § 4.3); domyślnie rzut prostokątny (orto)."""
    dane = bpy.data.cameras.new("kam")
    if orto:
        dane.type = "ORTHO"
        dane.ortho_scale = skala
    else:
        dane.lens = ogniskowa
    dane.clip_end = 200
    ob = bpy.data.objects.new("kam", dane)
    bpy.context.scene.collection.objects.link(ob)
    e = math.radians(wzniesienie_st)
    ob.location = (0, -odleglosc * math.cos(e), odleglosc * math.sin(e))
    _celuj(ob)
    bpy.context.scene.camera = ob
    return ob


def kadruj(kam, margines=0.08, obiekty=None):
    """Ustawia skalę kamery orto tak, by wszystkie siatki zmieściły się w kadrze z marginesem."""
    bpy.context.view_layer.update()          # bez tego matrix_world kamery i obiektów jest nieaktualna
    mw = kam.matrix_world
    inv = mw.inverted()
    xs, ys = [], []
    for ob in (obiekty or bpy.context.scene.objects):
        if ob.type not in ("MESH", "CURVE", "FONT") or not ob.visible_camera:
            continue
        deps = bpy.context.evaluated_depsgraph_get()
        ev = ob.evaluated_get(deps)
        try:
            me = ev.to_mesh()
        except RuntimeError:
            continue
        for v in me.vertices:
            p = inv @ (ev.matrix_world @ v.co)
            xs.append(p.x)
            ys.append(p.y)
        ev.to_mesh_clear()
    if not xs:
        return
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    sc = bpy.context.scene
    proporcja = sc.render.resolution_x / sc.render.resolution_y
    szer = (max(xs) - min(xs))
    wys = (max(ys) - min(ys))
    rozmiar = max(szer, wys * proporcja) if proporcja >= 1 else max(szer / proporcja, wys)
    kam.data.ortho_scale = rozmiar * (1 + 2 * margines)
    kam.location = mw @ Vector((cx, cy, 0))


def renderuj(sciezka):
    bpy.context.scene.render.filepath = str(sciezka)
    bpy.ops.render.render(write_still=True)


# ------------------------------------------------------------------------------------------------
# Materiały (01 § 4.4)
# ------------------------------------------------------------------------------------------------
def _principled(nazwa):
    m = bpy.data.materials.new(nazwa)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    return m, p


def zloto(chropowatosc=0.17, odcien="#FFC94A", nazwa="zloto"):
    """Polerowane, ciepłe żółte złoto (nie miedź, nie różowe, nie cytrynowe) — 01 § 3.4."""
    m, p = _principled(nazwa)
    p.inputs["Base Color"].default_value = lin(odcien)
    p.inputs["Metallic"].default_value = 1.0
    p.inputs["Roughness"].default_value = chropowatosc
    return m


def zloto_satyna():
    m = zloto(0.36, nazwa="zloto_satyna")
    p = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    p.inputs["Anisotropic"].default_value = 0.6
    return m


def chrom(chropowatosc=0.05):
    m, p = _principled("chrom")
    p.inputs["Base Color"].default_value = lin("#E6ECF5")
    p.inputs["Metallic"].default_value = 1.0
    p.inputs["Roughness"].default_value = chropowatosc
    return m


def emalia(kolor, chropowatosc=0.3, lakier=1.0, nazwa=None, sss=0.0):
    """Nasycony kolor pod grubą bezbarwną warstwą lakieru (owoce S1, pole emblematu, awatary)."""
    m, p = _principled(nazwa or f"emalia_{kolor}")
    p.inputs["Base Color"].default_value = lin(kolor)
    p.inputs["Roughness"].default_value = chropowatosc
    p.inputs["Coat Weight"].default_value = lakier
    p.inputs["Coat Roughness"].default_value = 0.04
    if sss:
        p.inputs["Subsurface Weight"].default_value = sss
        p.inputs["Subsurface Radius"].default_value = (0.3, 0.1, 0.05)
        p.inputs["Subsurface Scale"].default_value = 0.08
    return m


def szklo(kolor="#FFFFFF", ior=1.75, chropowatosc=0.0, cienka_warstwa=0.0, nazwa=None):
    """Kryształ / klejnot: pełna transmisja, kolor przez barwienie przepuszczanego światła; cienka warstwa
    (thin film) daje tęczowe refleksy zamiast dyspersji."""
    m, p = _principled(nazwa or f"szklo_{kolor}")
    p.inputs["Base Color"].default_value = lin(kolor)
    p.inputs["Transmission Weight"].default_value = 1.0
    p.inputs["IOR"].default_value = ior
    p.inputs["Roughness"].default_value = chropowatosc
    if cienka_warstwa:
        p.inputs["Thin Film Thickness"].default_value = cienka_warstwa
        p.inputs["Thin Film IOR"].default_value = 1.45
    return m


def emisja(kolor, moc=5.0, nazwa=None):
    m = bpy.data.materials.new(nazwa or f"emisja_{kolor}_{moc}")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = lin(kolor)
    e.inputs["Strength"].default_value = moc
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], o.inputs[0])
    return m


def matowy(kolor, chropowatosc=0.8, nazwa=None, szum=0.0):
    """Kamień, drewno, tkanina: niski połysk; opcjonalny szum wypukłości (stylizowana chropowatość)."""
    m, p = _principled(nazwa or f"mat_{kolor}")
    p.inputs["Base Color"].default_value = lin(kolor)
    p.inputs["Roughness"].default_value = chropowatosc
    if szum:
        nt = m.node_tree
        n = nt.nodes.new("ShaderNodeTexNoise")
        n.inputs["Scale"].default_value = 18.0
        b = nt.nodes.new("ShaderNodeBump")
        b.inputs["Strength"].default_value = szum
        nt.links.new(n.outputs["Fac"], b.inputs["Height"])
        nt.links.new(b.outputs["Normal"], p.inputs["Normal"])
    return m


def przypisz(ob, mat):
    ob.data.materials.clear()
    ob.data.materials.append(mat)
    return ob


# ------------------------------------------------------------------------------------------------
# Geometria
# ------------------------------------------------------------------------------------------------
def z_bmesh(nazwa, bm, gladko=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)     # spójne normalne na zewnątrz (inaczej płaskie światło)
    me = bpy.data.meshes.new(nazwa)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(nazwa, me)
    bpy.context.scene.collection.objects.link(ob)
    if gladko:
        for p in me.polygons:
            p.use_smooth = True
    return ob


def tokarka(nazwa, profil, segmenty=96, zebra=0, glebokosc_zeber=0.0, zamknij=True, gladko=True):
    """Bryła obrotowa z profilu [(promień, wysokość), …] od dołu do góry. ``zebra`` = liczba pionowych żeber
    (cebula ma 5–7 delikatnych żeber), ``glebokosc_zeber`` = względna głębokość rowków."""
    bm = bmesh.new()
    pierscienie = []
    for (r, z) in profil:
        pier = []
        for i in range(segmenty):
            t = 2 * math.pi * i / segmenty
            rr = r
            if zebra:
                rr = r * (1 - glebokosc_zeber * (0.5 - 0.5 * math.cos(zebra * t)) ** 3)
            pier.append(bm.verts.new((rr * math.cos(t), rr * math.sin(t), z)))
        pierscienie.append(pier)
    for a, b in zip(pierscienie[:-1], pierscienie[1:]):
        for i in range(segmenty):
            j = (i + 1) % segmenty
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if zamknij:
        dol = bm.verts.new((0, 0, profil[0][1]))
        gora = bm.verts.new((0, 0, profil[-1][1]))
        for i in range(segmenty):
            j = (i + 1) % segmenty
            bm.faces.new((pierscienie[0][j], pierscienie[0][i], dol))
            bm.faces.new((pierscienie[-1][i], pierscienie[-1][j], gora))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return z_bmesh(nazwa, bm, gladko)


def profil_funkcji(f, z0, z1, n=48):
    return [(max(0.0, f(i / (n - 1))), z0 + (z1 - z0) * i / (n - 1)) for i in range(n)]


def profil_cebuli(R=0.5, H=1.0, n=60):
    """Sylwetka cebuli: pękata u dołu (maks. ~33% wysokości), zwężająca się w szpic. Lekko spłaszczone dno."""
    def r(t):
        if t <= 0:
            return 0.06 * R
        v = math.sin(math.pi * t ** 0.62) ** 1.05
        if t < 0.08:
            v = max(v, 0.06 + (t / 0.08) * (math.sin(math.pi * 0.08 ** 0.62) ** 1.05 - 0.06))
        return R * v
    pts = [(r(i / (n - 1)), H * i / (n - 1)) for i in range(n)]
    pts[-1] = (0.0, H)
    return pts


def krzywa(nazwa, punkty, grubosc=0.03, promienie=None, rozdz=24, zamknieta=False, mat=None):
    """Rurka wzdłuż krzywej (ogonki owoców, ręce maskotki, wąsy, czubek cebuli). ``promienie`` = zwężanie."""
    cu = bpy.data.curves.new(nazwa, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = grubosc
    cu.bevel_resolution = 6
    cu.resolution_u = rozdz
    cu.use_fill_caps = True
    sp = cu.splines.new("NURBS")
    sp.points.add(len(punkty) - 1)
    for i, p in enumerate(punkty):
        sp.points[i].co = (*p, 1.0)
        if promienie:
            sp.points[i].radius = promienie[i]
    sp.use_endpoint_u = True
    sp.order_u = min(4, len(punkty))
    sp.use_cyclic_u = zamknieta
    ob = bpy.data.objects.new(nazwa, cu)
    bpy.context.scene.collection.objects.link(ob)
    if mat:
        cu.materials.append(mat)
    return ob


def kula(nazwa, r=0.5, poz=(0, 0, 0), skala=(1, 1, 1), seg=64, mat=None):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=poz, segments=seg, ring_count=seg // 2)
    ob = bpy.context.object
    ob.name = nazwa
    ob.scale = skala
    bpy.ops.object.shade_smooth()
    if mat:
        przypisz(ob, mat)
    return ob


def walec(nazwa, r=0.5, h=0.2, poz=(0, 0, 0), rot=(0, 0, 0), seg=96, mat=None, faza=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=poz, rotation=rot, vertices=seg)
    ob = bpy.context.object
    ob.name = nazwa
    if faza:
        mod = ob.modifiers.new("faza", "BEVEL")
        mod.width = faza
        mod.segments = 4
        mod.limit_method = "ANGLE"
    bpy.ops.object.shade_smooth()
    ob.data.shade_smooth()
    if faza:
        ob.modifiers.new("ws", "WEIGHTED_NORMAL") if hasattr(bpy.types, "WeightedNormalModifier") else None
    if mat:
        przypisz(ob, mat)
    return ob


def torus(nazwa, R=0.5, r=0.05, poz=(0, 0, 0), rot=(0, 0, 0), mat=None, seg=96):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=poz, rotation=rot,
                                     major_segments=seg, minor_segments=24)
    ob = bpy.context.object
    ob.name = nazwa
    bpy.ops.object.shade_smooth()
    if mat:
        przypisz(ob, mat)
    return ob


def prostopadloscian(nazwa, wym=(1, 1, 1), poz=(0, 0, 0), rot=(0, 0, 0), faza=0.04, mat=None, segmenty=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=poz, rotation=rot)
    ob = bpy.context.object
    ob.name = nazwa
    ob.scale = wym
    bpy.ops.object.transform_apply(scale=True)
    if faza:
        mod = ob.modifiers.new("faza", "BEVEL")
        mod.width = faza
        mod.segments = segmenty
    bpy.ops.object.shade_smooth()
    try:
        ob.data.set_sharp_from_angle(angle=math.radians(40))
    except AttributeError:
        pass
    if mat:
        przypisz(ob, mat)
    return ob


def wygladz(ob, poziom=2):
    mod = ob.modifiers.new("subsurf", "SUBSURF")
    mod.levels = poziom
    mod.render_levels = poziom
    return ob


def klejnot(nazwa, obrys, h_korony=0.18, tafla=0.55, h_pawilonu=0.45, rondysta=0.03, pierscien_korony=0.82,
            mat=None):
    """Fasetowany klejnot z dowolnego obrysu 2D (kropla, markiza, serce, sześciokąt…): tafla na górze,
    pierścień korony, rondysta, pawilon zbiegający się w kolecie. Płaskie fasety = błyski na krawędziach."""
    bm = bmesh.new()
    n = len(obrys)
    cx = sum(p[0] for p in obrys) / n
    cy = sum(p[1] for p in obrys) / n

    def pierscien(sk, z, obrot=0.0):
        vs = []
        for i in range(n):
            x, y = obrys[i]
            if obrot:
                x2, y2 = obrys[(i + 1) % n]
                x, y = x + (x2 - x) * obrot, y + (y2 - y) * obrot
            vs.append(bm.verts.new((cx + (x - cx) * sk, cy + (y - cy) * sk, z)))
        return vs
    t = pierscien(tafla, h_korony)                         # tafla (górna płaszczyzna)
    k = pierscien(pierscien_korony, h_korony * 0.45, 0.5)  # pierścień korony (przesunięty o pół kroku)
    g1 = pierscien(1.0, 0.0)                               # rondysta — góra
    g2 = pierscien(1.0, -rondysta)                         # rondysta — dół
    p1 = pierscien(0.55, -rondysta - h_pawilonu * 0.55, 0.5)
    kolet = bm.verts.new((cx, cy, -rondysta - h_pawilonu))
    bm.faces.new(t)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((t[i], t[j], k[i]))                   # fasety gwiaździste
        bm.faces.new((k[i], g1[i], g1[j]))                 # dolne fasety korony
        bm.faces.new((t[j], k[i], g1[j], k[j]))            # latawce
        bm.faces.new((g1[i], g1[j], g2[j], g2[i]))         # pas rondysty
        bm.faces.new((g2[i], g2[j], p1[i]))                # pawilon — góra
        bm.faces.new((p1[i], g2[j], p1[j]))
        bm.faces.new((p1[i], p1[j], kolet))                # pawilon — do koletu
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = z_bmesh(nazwa, bm, gladko=False)
    if mat:
        przypisz(ob, mat)
    return ob


def bryla_z_obrysu(nazwa, punkty, glebokosc=0.1, faza=0.02, mat=None):
    """Płaski kształt 2D (x, z) wyciągnięty w głąb (oś Y) z fazą — np. sylwetka korony czytelna en face."""
    bm = bmesh.new()
    przod = [bm.verts.new((x, -glebokosc / 2, z)) for x, z in punkty]
    tyl = [bm.verts.new((x, glebokosc / 2, z)) for x, z in punkty]
    bm.faces.new(przod)
    bm.faces.new(list(reversed(tyl)))
    n = len(punkty)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((przod[i], przod[j], tyl[j], tyl[i]))
    ob = z_bmesh(nazwa, bm, gladko=False)
    if faza:
        mod = ob.modifiers.new("faza", "BEVEL")
        mod.width = faza
        mod.segments = 3
        mod.limit_method = "ANGLE"
    if mat:
        przypisz(ob, mat)
    return ob


def obrys_okregu(n=16, r=0.5, sx=1.0, sy=1.0):
    return [(r * sx * math.cos(2 * math.pi * i / n + math.pi / 2), r * sy * math.sin(2 * math.pi * i / n + math.pi / 2))
            for i in range(n)]


def obrys_funkcji(f, n=32):
    """Obrys z funkcji parametrycznej t ∈ [0, 1) → (x, y)."""
    return [f(i / n) for i in range(n)]
