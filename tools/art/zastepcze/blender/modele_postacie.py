"""
modele_postacie.py — postacie i rekwizyty grafiki zastępczej: Pan Cebulion (3 pozy), skrzynia skarbów,
8 awatarów „warzywnej arystokracji” (01 § 2.6, 2.7, 7.10).

Postacie są złożone z prostych brył (bryła obrotowa cebuli, kule, walce) i rurek wzdłuż krzywych (ręce, nogi,
wąsy, brwi). Pozę zmienia się, przesuwając punkty kontrolne krzywych — bez szkieletu animacyjnego, bo każda
poza to i tak jeden nieruchomy obraz (animację „oddechu” i kołysania robi kod gry).
"""

from __future__ import annotations

import math
import random
import sys
from pathlib import Path

import bpy  # noqa: I001
import bmesh  # noqa: F401

sys.path.insert(0, str(Path(__file__).resolve().parent))
from scena import (_principled, bryla_z_obrysu, emalia, emisja, kadruj, kamera, krzywa, kula, lin,  # noqa: E402
                   nowa_scena, profil_cebuli, przypisz, prostopadloscian, szklo, tokarka, torus, walec, wygladz,
                   zloto, zloto_satyna)


# ================================================================================================
# Pan Cebulion
# ================================================================================================
def _skorka_cebuli():
    """Warstwowa, metalicznie złota łuska z perłowym połyskiem (01 § 2.7)."""
    m, p = _principled("skorka")
    p.inputs["Base Color"].default_value = lin("#FFC13A")
    p.inputs["Metallic"].default_value = 0.85
    p.inputs["Roughness"].default_value = 0.22
    p.inputs["Coat Weight"].default_value = 0.6
    p.inputs["Sheen Weight"].default_value = 0.3
    p.inputs["Sheen Tint"].default_value = lin("#FFF1C8")
    return m


def _jedwab(kolor="#1E1442"):
    m = emalia(kolor, 0.38, 0.3, nazwa=f"jedwab_{kolor}")
    p = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    p.inputs["Sheen Weight"].default_value = 0.6
    p.inputs["Sheen Tint"].default_value = lin("#8E7CFF")
    return m


def _cylinder(poz=(0, -0.02, 1.0), przechyl_st=10.0, nazwa="cyl"):
    rodzic = bpy.data.objects.new(nazwa, None)
    bpy.context.scene.collection.objects.link(rodzic)
    j = _jedwab()
    for ob in (walec("rondo", 0.31, 0.035, (0, 0, 0.0), mat=j, faza=0.012),
               walec("glowa_cyl", 0.2, 0.48, (0, 0, 0.255), mat=j, faza=0.02),
               walec("wstazka", 0.205, 0.075, (0, 0, 0.07), mat=zloto_satyna())):
        ob.parent = rodzic
    k = kula("przypinka", 0.035, (0, -0.205, 0.07), (1, 0.4, 1), mat=zloto(0.15))
    k.parent = rodzic
    rodzic.location = poz
    rodzic.rotation_euler = (0, math.radians(przechyl_st), 0)
    return rodzic


def _oko(x, z, otwarte=True, mruga=False, usmiech=False):
    if mruga or usmiech:
        krzywa(f"oko_zamk{x}", [(x - 0.07, -0.445, z), (x, -0.47, z + (0.025 if not usmiech else 0.03)),
                                (x + 0.07, -0.445, z)], 0.012, mat=emalia("#1A0E08", 0.4))
        return
    kula(f"bialko{x}", 0.5, (x, -0.43, z), (0.075, 0.03, 0.052), seg=32, mat=emalia("#FFFDF6", 0.2))
    kula(f"zrenica{x}", 0.5, (x + 0.01, -0.455, z - 0.005), (0.036, 0.02, 0.04), seg=24, mat=emalia("#120806", 0.1))
    kula(f"blik{x}", 0.5, (x - 0.004, -0.47, z + 0.012), (0.011, 0.006, 0.011), seg=12, mat=emisja("#FFFFFF", 3))


def _brwi(lewa_w_gore=0.0, prawa_w_gore=0.0, srodek=0.0):
    m = emalia("#3B2314", 0.5)
    for x, dz in ((-0.12, prawa_w_gore), (0.12, lewa_w_gore)):
        s = 1 if x > 0 else -1
        krzywa(f"brew{x}", [(x - 0.07 * s, -0.43, 0.52 + dz + srodek * 0.6),
                            (x, -0.455, 0.545 + dz + srodek * 0.3), (x + 0.07 * s, -0.43, 0.52 + dz - srodek * 0.2)],
               0.02, [0.7, 1.0, 0.6], mat=m)


def _wasy():
    """Podkręcone wąsy „z korzonków” — jasne złoto, znak rozpoznawczy postaci."""
    m = zloto(0.25, "#FFE08A", nazwa="wasy")
    for s in (-1, 1):
        krzywa(f"was{s}", [(0.0, -0.47, 0.32), (s * 0.08, -0.47, 0.30), (s * 0.17, -0.44, 0.31),
                           (s * 0.22, -0.41, 0.36), (s * 0.19, -0.42, 0.40), (s * 0.16, -0.43, 0.37)],
               0.03, [0.9, 1.0, 0.8, 0.55, 0.35, 0.2], mat=m)


def _usta(zeby=False):
    if zeby:
        kula("usta", 0.5, (0, -0.44, 0.22), (0.1, 0.03, 0.05), seg=32, mat=emalia("#3A0A12", 0.3))
        kula("zeby", 0.5, (0, -0.46, 0.235), (0.085, 0.02, 0.022), seg=32, mat=emalia("#FFFDF6", 0.2))
    else:
        krzywa("usta", [(-0.06, -0.455, 0.235), (0.0, -0.47, 0.22), (0.07, -0.455, 0.24)], 0.011,
               mat=emalia("#3A1A10", 0.4))


def _muszka_i_kolnierz():
    biel = emalia("#F4EBD9", 0.35)
    for s in (-1, 1):
        bryla_z_obrysu(f"kolnierz{s}", [(0, 0.17), (s * 0.13, 0.2), (s * 0.08, 0.1)], 0.02, 0.006, biel).location = (0, -0.39, 0)
    mag = emalia("#FF2E88", 0.3)
    p = next(n for n in mag.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    p.inputs["Sheen Weight"].default_value = 0.4
    for s in (-1, 1):
        bryla_z_obrysu(f"muszka{s}", [(0, 0.15), (s * 0.15, 0.09), (s * 0.15, 0.21)], 0.05, 0.015, mag).location = (0, -0.42, 0)
    kula("wezel", 0.04, (0, -0.45, 0.15), (1, 0.7, 0.9), mat=mag)


def _monokl(wisi=False):
    zl = zloto(0.12)
    if not wisi:
        torus("monokl", 0.085, 0.012, (-0.12, -0.47, 0.42), (math.pi / 2, 0, 0), mat=zl)
        walec("szklo_monokla", 0.08, 0.005, (-0.12, -0.468, 0.42), (math.pi / 2, 0, 0), mat=szklo("#FFFFFF", 1.5))
        krzywa("lancuszek", [(-0.2, -0.47, 0.4), (-0.24, -0.49, 0.25), (-0.12, -0.48, 0.18), (-0.03, -0.46, 0.15)],
               0.006, mat=zl)
    else:
        torus("monokl", 0.085, 0.012, (-0.2, -0.53, 0.0), (math.pi / 2, 0, 0.3), mat=zl)
        krzywa("lancuszek", [(-0.03, -0.46, 0.15), (-0.14, -0.5, 0.06), (-0.2, -0.53, 0.085)], 0.006, mat=zl)


def _reka(nazwa, punkty, rekawiczka=True):
    m = _jedwab("#1E1442")
    krzywa(nazwa, punkty, 0.045, [1.0] * len(punkty), mat=m)
    if rekawiczka:
        x, y, z = punkty[-1]
        kula(nazwa + "_dlon", 0.075, (x, y - 0.01, z), (1, 0.8, 1.05), mat=emalia("#F4EBD9", 0.4))
        kula(nazwa + "_kciuk", 0.032, (x + (0.05 if x > 0 else -0.05), y - 0.04, z + 0.04), mat=emalia("#F4EBD9", 0.4))


def _noga(nazwa, punkty):
    krzywa(nazwa, punkty, 0.05, mat=emalia("#1E1442", 0.45))
    x, y, z = punkty[-1]
    walec(nazwa + "_getr", 0.058, 0.06, (x, y, z + 0.02), mat=emalia("#F4EBD9", 0.4))
    kula(nazwa + "_but", 0.5, (x + (0.03 if x > 0 else -0.03), y - 0.05, z - 0.03), (0.11, 0.17, 0.07), seg=40,
         mat=emalia("#0B0612", 0.12))


def _cialo():
    c = tokarka("bulwa", profil_cebuli(0.47, 1.05), zebra=7, glebokosc_zeber=0.06)
    wygladz(c, 1)
    przypisz(c, _skorka_cebuli())
    return c


def _moneta_prosta(nazwa, poz, rot, r=0.09):
    ob = walec(nazwa, r, r * 0.18, poz, rot, seg=48, mat=zloto(0.18), faza=r * 0.05)
    return ob


def m_maskotka_powitanie():
    nowa_scena((640, 640), 48, "global")
    rodzic = bpy.data.objects.new("postac", None)
    bpy.context.scene.collection.objects.link(rodzic)
    _cialo()
    _oko(-0.12, 0.42)
    _oko(0.12, 0.42, mruga=True)
    _brwi(lewa_w_gore=0.05)
    _wasy()
    _usta()
    _muszka_i_kolnierz()
    _monokl()
    # prawa ręka (lewa strona obrazu) uchyla cylinder, lewa w geście zaproszenia
    _reka("reka_p", [(-0.4, -0.1, 0.38), (-0.6, -0.15, 0.6), (-0.52, -0.2, 0.95), (-0.32, -0.12, 1.08)])
    _reka("reka_l", [(0.42, -0.1, 0.32), (0.62, -0.25, 0.25), (0.78, -0.4, 0.3), (0.86, -0.45, 0.36)])
    _cylinder((-0.12, -0.02, 1.12), -12)
    _noga("noga_p", [(-0.13, 0.0, 0.08), (-0.15, -0.02, -0.15), (-0.16, -0.02, -0.36)])
    _noga("noga_l", [(0.13, 0.0, 0.08), (0.15, -0.02, -0.15), (0.17, -0.02, -0.36)])
    for ob in list(bpy.context.scene.objects):
        if ob.type in ("MESH", "CURVE", "EMPTY") and ob.parent is None and ob.name not in ("postac",) \
                and not ob.name.startswith("karta"):
            ob.parent = rodzic
    rodzic.rotation_euler = (math.radians(8), 0, math.radians(-6))
    k = kamera(wzniesienie_st=6)
    kadruj(k, 0.05)
    return k


def m_maskotka_wygrana():
    nowa_scena((640, 640), 48, "global")
    rodzic = bpy.data.objects.new("postac", None)
    bpy.context.scene.collection.objects.link(rodzic)
    _cialo()
    _oko(-0.12, 0.42, usmiech=True)
    _oko(0.12, 0.42, usmiech=True)
    _brwi(0.06, 0.06)
    _wasy()
    _usta(zeby=True)
    _muszka_i_kolnierz()
    _monokl(wisi=True)
    _reka("reka_p", [(-0.4, -0.1, 0.4), (-0.6, -0.12, 0.7), (-0.72, -0.12, 1.0), (-0.78, -0.12, 1.2)])
    _reka("reka_l", [(0.4, -0.1, 0.4), (0.6, -0.12, 0.7), (0.72, -0.12, 1.0), (0.78, -0.12, 1.2)])
    _cylinder((0.05, 0.0, 1.32), 18)
    _noga("noga_p", [(-0.13, 0.0, 0.08), (-0.24, -0.08, -0.08), (-0.16, 0.05, -0.24)])
    _noga("noga_l", [(0.13, 0.0, 0.08), (0.24, -0.08, -0.08), (0.18, 0.05, -0.24)])
    random.seed(5)
    for i, (x, z) in enumerate([(-0.95, 0.75), (0.95, 0.8), (-0.75, 1.42), (0.7, 1.45), (-0.98, 0.25),
                                (0.98, 0.3), (-0.45, 1.6), (0.38, 1.62)]):
        _moneta_prosta(f"moneta{i}", (x, -0.2, z), (random.uniform(0.6, 1.6), random.uniform(-0.5, 0.5), random.uniform(0, 3)))
    for ob in list(bpy.context.scene.objects):
        if ob.type in ("MESH", "CURVE", "EMPTY") and ob.parent is None and ob.name != "postac" \
                and not ob.name.startswith("karta"):
            ob.parent = rodzic
    k = kamera(wzniesienie_st=6)
    kadruj(k, 0.05)
    return k


def m_maskotka_bankrut():
    nowa_scena((640, 640), 48, "global")
    rodzic = bpy.data.objects.new("postac", None)
    bpy.context.scene.collection.objects.link(rodzic)
    _cialo()
    _oko(-0.12, 0.42)
    _oko(0.12, 0.42)
    _brwi(0.02, 0.02, srodek=0.06)
    _wasy()
    _usta()
    _muszka_i_kolnierz()
    _monokl(wisi=True)
    # wzruszenie ramion: łokcie w bok, dłonie przy biodrach wywracają kieszenie
    _reka("reka_p", [(-0.4, -0.1, 0.38), (-0.66, -0.1, 0.36), (-0.6, -0.2, 0.12), (-0.36, -0.3, 0.06)])
    _reka("reka_l", [(0.4, -0.1, 0.38), (0.66, -0.1, 0.36), (0.6, -0.2, 0.12), (0.36, -0.3, 0.06)])
    krem = emalia("#F4EBD9", 0.45)
    for s in (-1, 1):
        ob = kula(f"kieszen{s}", 0.5, (s * 0.3, -0.36, -0.04), (0.11, 0.04, 0.09), seg=32, mat=krem)
        ob.rotation_euler = (0, s * 0.4, 0)
    _cylinder((0.0, -0.02, 1.0), 10)
    _noga("noga_p", [(-0.13, 0.0, 0.08), (-0.15, -0.02, -0.15), (-0.16, -0.02, -0.36)])
    _noga("noga_l", [(0.13, 0.0, 0.08), (0.15, -0.02, -0.15), (0.17, -0.02, -0.36)])
    kurz = emalia("#B8B0C8", 0.9)
    for i, (x, z, r) in enumerate([(0.42, -0.02, 0.05), (0.48, 0.03, 0.04), (0.5, -0.05, 0.035), (0.45, 0.07, 0.03)]):
        kula(f"kurz{i}", r, (x, -0.35, z), mat=kurz)
    # ćma odlatująca w górę
    cma = emalia("#5A4A78", 0.6)
    for s in (-1, 1):
        ob = kula(f"skrzydlo{s}", 0.5, (0.62 + s * 0.04, -0.3, 0.62), (0.05, 0.01, 0.035), seg=24, mat=cma)
        ob.rotation_euler = (0, s * 0.5, 0)
    for ob in list(bpy.context.scene.objects):
        if ob.type in ("MESH", "CURVE", "EMPTY") and ob.parent is None and ob.name != "postac" \
                and not ob.name.startswith("karta"):
            ob.parent = rodzic
    k = kamera(wzniesienie_st=6)
    kadruj(k, 0.05)
    return k


# ================================================================================================
# Skrzynia skarbów
# ================================================================================================
def m_skrzynia():
    nowa_scena((640, 640), 48, "global")
    lakier = emalia("#3A1E78", 0.25, nazwa="lakier_skrzyni")
    zl = zloto(0.16)
    W, D, H = 1.4, 0.9, 0.62
    prostopadloscian("korpus", (W, D, H), (0, 0, H / 2), mat=lakier, faza=0.03)
    for x in (-W / 2, W / 2):
        for y in (-D / 2, D / 2):
            prostopadloscian(f"rog{x}{y}", (0.16, 0.16, H + 0.02), (x, y, H / 2), mat=zl, faza=0.02)
    for x in (-0.36, 0.36):
        prostopadloscian(f"obrecz{x}", (0.1, D + 0.03, H + 0.01), (x, 0, H / 2), mat=zl, faza=0.015)
    prostopadloscian("listwa", (W + 0.03, D + 0.03, 0.06), (0, 0, H - 0.02), mat=zl, faza=0.012)
    walec("zamek", 0.12, 0.05, (0, -D / 2 - 0.02, H * 0.62), (math.pi / 2, 0, 0), mat=zl, faza=0.01)
    kula("zamek_cebula", 0.05, (0, -D / 2 - 0.06, H * 0.62), (1, 0.6, 1.3), mat=zloto(0.12))
    # wieko uchylone o ~110°, zawias na tylnej górnej krawędzi
    zawias = bpy.data.objects.new("zawias", None)
    bpy.context.scene.collection.objects.link(zawias)
    zawias.location = (0, D / 2, H)
    wieko = walec("wieko", D / 2, W, (0, -D / 2, 0), (0, math.pi / 2, 0), seg=64, mat=lakier)
    bm = bmesh.new()
    bm.from_mesh(wieko.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0),
                           plane_no=(1, 0, 0), clear_inner=True)
    bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary])
    bm.to_mesh(wieko.data)
    bm.free()
    wieko.parent = zawias
    for x in (-0.36, 0.36, -W / 2 + 0.04, W / 2 - 0.04):
        t = torus(f"obr_wieka{x}", D / 2 + 0.005, 0.03, (x, -D / 2, 0), (0, math.pi / 2, 0), mat=zl)
        t.parent = zawias
    zawias.rotation_euler = (math.radians(-110), 0, 0)
    # kopiec monet + klejnoty
    random.seed(11)
    for i in range(150):
        u, v = random.random(), random.random()
        x = (u - 0.5) * (W - 0.15)
        y = (v - 0.5) * (D - 0.15)
        z = H + 0.02 + 0.28 * math.exp(-((x / 0.5) ** 2 + (y / 0.35) ** 2)) + random.uniform(-0.03, 0.03)
        _moneta_prosta(f"m{i}", (x, y, z), (random.uniform(-0.6, 0.6), random.uniform(-0.6, 0.6), random.uniform(0, 3)), 0.075)
    for i, kol in enumerate(["#FF2E88", "#21E6FF", "#FF2E88", "#21E6FF", "#B05CFF"]):
        x = -0.45 + i * 0.22
        kula(f"klejnot{i}", 0.06, (x, -0.15 + 0.1 * (i % 2), H + 0.22 + 0.05 * (i % 2)), mat=szklo(kol, 1.7))
    for i in range(4):
        _moneta_prosta(f"wisz{i}", (-0.45 + i * 0.3, -D / 2 - 0.02, H + 0.02 - 0.06 * (i % 2)),
                       (math.radians(70 + 15 * (i % 2)), 0, random.uniform(-0.3, 0.3)), 0.075)
    bpy.ops.object.light_add(type="POINT", location=(0, 0, H + 0.45))
    bpy.context.object.data.energy = 220
    bpy.context.object.data.color = lin("#FFC24A")[:3]
    bpy.context.object.data.shadow_soft_size = 0.4
    k = kamera(wzniesienie_st=18, skala=2.6)
    kadruj(k, 0.05)
    return k


# ================================================================================================
# Awatary (arkusz 4×2)
# ================================================================================================
def _oczy(x0, z0, y0, r=0.035, ods=0.075):
    for s in (-1, 1):
        kula(f"ob{x0}{z0}{s}", r, (x0 + s * ods, y0, z0), (1, 0.6, 1.15), seg=24, mat=emalia("#FFFDF6", 0.2))
        kula(f"oz{x0}{z0}{s}", r * 0.55, (x0 + s * ods + 0.005, y0 - r * 0.45, z0 - 0.003), (1, 0.5, 1.1), seg=16,
             mat=emalia("#120806", 0.1))


def _medalion(x0, z0, kolor_tla):
    walec(f"tlo{x0}{z0}", 0.5, 0.06, (x0, 0.18, z0), (math.pi / 2, 0, 0), mat=emalia(kolor_tla, 0.25))
    torus(f"otok{x0}{z0}", 0.5, 0.045, (x0, 0.12, z0), (math.pi / 2, 0, 0), mat=zloto(0.14))
    ob = kula(f"barki{x0}{z0}", 0.5, (x0, 0.05, z0 - 0.42), (0.38, 0.12, 0.2), seg=40, mat=emalia("#1E1442", 0.35))
    return ob


def m_awatary():
    nowa_scena((1152, 768), 40, "global")
    random.seed(2)
    poz = [(-1.875 + c * 1.25, 0.65 - r * 1.3) for r in range(2) for c in range(4)]

    # 0 Pani Cebulina — czerwona cebula, perłowe kolczyki, fascynator z piórkiem
    x, z = poz[0]
    _medalion(x, z, "#1BB5C9")
    c = tokarka("cebulina", profil_cebuli(0.22, 0.52), zebra=7, glebokosc_zeber=0.06)
    przypisz(c, emalia("#A0306A", 0.25))
    c.location = (x, -0.05, z - 0.26)
    _oczy(x, z - 0.02, -0.26)
    for s in (-1, 1):
        kula(f"perla{s}", 0.025, (x + s * 0.2, -0.12, z - 0.1), mat=emalia("#FFF4E6", 0.15))
    walec("fasc", 0.06, 0.02, (x + 0.1, -0.05, z + 0.22), (0.4, 0.3, 0), mat=emalia("#1E1442", 0.3))
    krzywa("pioro", [(x + 0.1, -0.05, z + 0.22), (x + 0.2, -0.05, z + 0.33), (x + 0.28, -0.05, z + 0.32)], 0.012,
           [1, 0.8, 0.3], mat=emalia("#FF2E88", 0.5))

    # 1 Hrabia Czosnek — kość słoniowa, postawiony kołnierz peleryny, cienki wąsik
    x, z = poz[1]
    _medalion(x, z, "#3B1E8C")
    c = tokarka("czosnek", profil_cebuli(0.23, 0.5), zebra=8, glebokosc_zeber=0.18)
    przypisz(c, emalia("#F2EAD8", 0.35))
    c.location = (x, -0.05, z - 0.26)
    for s in (-1, 1):
        bryla_z_obrysu(f"kolnierz{s}", [(x + s * 0.12, z - 0.3), (x + s * 0.34, z - 0.02), (x + s * 0.3, z - 0.38)],
                       0.03, 0.01, emalia("#5B1E3A", 0.3)).location.y = 0.02
    _oczy(x, z - 0.03, -0.27)
    krzywa("wasik", [(x - 0.08, -0.28, z - 0.11), (x, -0.29, z - 0.1), (x + 0.08, -0.28, z - 0.11)], 0.008,
           mat=emalia("#3B2314", 0.4))

    # 2 Baron Ziemniak — melonik, poszetka
    x, z = poz[2]
    _medalion(x, z, "#1F4FD1")
    zm = kula("ziemniak", 0.25, (x, -0.05, z - 0.06), (1.0, 0.85, 0.85), seg=48, mat=emalia("#B8864A", 0.5))
    d = zm.modifiers.new("guzy", "DISPLACE")
    tx = bpy.data.textures.new("guzy", "CLOUDS")
    tx.noise_scale = 0.25
    d.texture = tx
    d.strength = 0.04
    _oczy(x, z - 0.02, -0.25)
    walec("melonik_rondo", 0.22, 0.02, (x, -0.05, z + 0.14), mat=emalia("#0B0612", 0.2))
    m = kula("melonik", 0.16, (x, -0.05, z + 0.15), (1, 1, 0.8), seg=40, mat=emalia("#0B0612", 0.2))
    del m
    bryla_z_obrysu("poszetka", [(x + 0.14, z - 0.38), (x + 0.22, z - 0.38), (x + 0.18, z - 0.3)], 0.02, 0.005,
                   emalia("#FF2E88", 0.3)).location.y = -0.08

    # 3 Lady Papryka — czerwona papryka, okulary „kocie oko”, złote kolczyki
    x, z = poz[3]
    _medalion(x, z, "#12A86B")
    c = tokarka("papryka", [(0.05, -0.22), (0.18, -0.18), (0.23, -0.05), (0.24, 0.1), (0.2, 0.2), (0.08, 0.24),
                            (0.0, 0.24)], zebra=4, glebokosc_zeber=0.15)
    wygladz(c, 2)
    przypisz(c, emalia("#D81E2A", 0.2))
    c.location = (x, -0.05, z - 0.06)
    krzywa("szypulka", [(x, -0.05, z + 0.17), (x + 0.02, -0.05, z + 0.25), (x + 0.07, -0.05, z + 0.28)], 0.022,
           mat=emalia("#2E7D32", 0.4))
    _oczy(x, z, -0.27)
    for s in (-1, 1):
        torus(f"okular{s}", 0.055, 0.012, (x + s * 0.075, -0.3, z + 0.005), (math.pi / 2, 0, s * 0.2),
              mat=emalia("#0B0612", 0.2)).scale = (1.25, 1, 0.8)
        kula(f"kolczyk{s}", 0.02, (x + s * 0.23, -0.12, z - 0.08), mat=zloto(0.12))

    # 4 Kapitan Por — biała czapka kapitańska ze złotą kotwicą
    x, z = poz[4]
    _medalion(x, z, "#B3135C")
    walec("por", 0.15, 0.5, (x, -0.05, z - 0.14), mat=emalia("#F2F6E8", 0.35))
    for i, s in enumerate((-1, 0, 1)):
        ob = kula(f"lisc_pora{i}", 0.5, (x + s * 0.08, -0.04, z + 0.18), (0.06, 0.03, 0.22), seg=24,
                  mat=emalia("#3FA34D", 0.35))
        ob.rotation_euler = (0, s * 0.35, 0)
    walec("czapka", 0.19, 0.11, (x, -0.06, z + 0.14), mat=emalia("#FAFAFA", 0.3), faza=0.02)
    walec("daszek", 0.17, 0.02, (x, -0.16, z + 0.09), (0.25, 0, 0), mat=emalia("#0B0612", 0.2))
    kula("kotwica", 0.03, (x, -0.26, z + 0.15), (1, 0.4, 1.2), mat=zloto(0.12))
    _oczy(x, z - 0.04, -0.2)

    # 5 Diuk Bakłażan — aksamitny beret z piórem
    x, z = poz[5]
    _medalion(x, z, "#F5C542")
    c = tokarka("baklazan", [(0.0, -0.3), (0.16, -0.26), (0.21, -0.12), (0.18, 0.05), (0.13, 0.18), (0.08, 0.26),
                             (0.0, 0.28)])
    wygladz(c, 2)
    przypisz(c, emalia("#4B1E6E", 0.15))
    c.location = (x, -0.05, z - 0.08)
    _oczy(x, z - 0.06, -0.24)
    kula("beret", 0.17, (x + 0.04, -0.05, z + 0.21), (1.2, 1.1, 0.45), seg=40, mat=_jedwab("#7A1E3A"))
    krzywa("pioro_b", [(x + 0.12, -0.05, z + 0.24), (x + 0.24, -0.05, z + 0.34), (x + 0.32, -0.05, z + 0.3)],
           0.015, [1, 0.8, 0.3], mat=emalia("#F4EBD9", 0.5))

    # 6 Madame Rzodkiewka — boa z piór
    x, z = poz[6]
    _medalion(x, z, "#0E6E73")
    kula("rzodkiewka", 0.22, (x, -0.05, z - 0.02), (1, 0.9, 0.95), seg=48, mat=emalia("#D0206A", 0.2))
    kula("rzodk_dol", 0.12, (x, -0.06, z - 0.2), (1, 0.9, 0.9), seg=32, mat=emalia("#F4EBD9", 0.3))
    for i, s in enumerate((-1, 1)):
        ob = kula(f"nac{i}", 0.5, (x + s * 0.06, -0.04, z + 0.25), (0.06, 0.03, 0.16), seg=24,
                  mat=emalia("#3FA34D", 0.35))
        ob.rotation_euler = (0, s * 0.4, 0)
    _oczy(x, z + 0.0, -0.24)
    for i in range(16):
        a = math.pi * (1.1 + 0.8 * i / 15)
        kula(f"boa{i}", 0.045, (x + 0.3 * math.cos(a), -0.2, z - 0.28 + 0.12 * math.sin(a) + 0.08),
             mat=emalia("#FF8AD8", 0.8))

    # 7 Pan Pieczarka — kremowy kapelusz grzyba, okulary przeciwsłoneczne, muszka w kropki
    x, z = poz[7]
    _medalion(x, z, "#A3122E")
    walec("trzon", 0.12, 0.3, (x, -0.05, z - 0.14), mat=emalia("#F4EBD9", 0.4))
    kula("kapelusz", 0.26, (x, -0.05, z + 0.05), (1, 0.9, 0.55), seg=48, mat=emalia("#EADBC0", 0.35))
    for s in (-1, 1):
        kula(f"szklo{s}", 0.5, (x + s * 0.065, -0.18, z - 0.06), (0.11, 0.03, 0.07), seg=24,
             mat=emalia("#0B0612", 0.05))
    for s in (-1, 1):
        bryla_z_obrysu(f"musz{s}", [(x, z - 0.27), (x + s * 0.09, z - 0.22), (x + s * 0.09, z - 0.32)], 0.03, 0.008,
                       emalia("#21E6FF", 0.3)).location.y = -0.18
    k = kamera(wzniesienie_st=0.0, skala=5.0)
    return k


RENDERY = {
    "maskotka_powitanie": (m_maskotka_powitanie, ""),
    "maskotka_wygrana": (m_maskotka_wygrana, ""),
    "maskotka_bankrut": (m_maskotka_bankrut, ""),
    "skrzynia": (m_skrzynia, ""),
    "awatary": (m_awatary, ""),
}
