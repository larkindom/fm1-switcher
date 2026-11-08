#!/usr/bin/env python3
"""Draws the two pixel-art backgrounds (assets/scene-light.png, scene-dark.png): original art, 192x108, scaled up by the page.
   python3 tools/make_scenes.py"""
import zlib, struct, random, math
W, H = 256, 144

def hexc(s): s = s.lstrip('#'); return tuple(int(s[i:i+2], 16) for i in (0, 2, 4))

class Img:
    def __init__(s): s.p = [[(0, 0, 0)] * W for _ in range(H)]
    def px(s, x, y, c, a=1.0):
        if 0 <= x < W and 0 <= y < H:
            c = hexc(c) if isinstance(c, str) else c
            if a >= 1: s.p[y][x] = c
            else:
                o = s.p[y][x]; s.p[y][x] = tuple(int(o[i] * (1 - a) + c[i] * a) for i in range(3))
    def rect(s, x, y, w, h, c, a=1.0):
        for j in range(h):
            for i in range(w): s.px(x + i, y + j, c, a)
    def ell(s, cx, cy, rx, ry, c, a=1.0):
        for j in range(-ry, ry + 1):
            for i in range(-rx, rx + 1):
                if (i * i) / (rx * rx + .01) + (j * j) / (ry * ry + .01) <= 1: s.px(cx + i, cy + j, c, a)
    def line(s, x0, y0, x1, y1, c, a=1.0):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for t in range(n + 1): s.px(round(x0 + (x1 - x0) * t / n), round(y0 + (y1 - y0) * t / n), c, a)
    def poly(s, pts, c, a=1.0):
        ys = [p[1] for p in pts]
        for y in range(min(ys), max(ys) + 1):
            xs = []
            for k in range(len(pts)):
                (x0, y0), (x1, y1) = pts[k], pts[(k + 1) % len(pts)]
                if (y0 <= y < y1) or (y1 <= y < y0): xs.append(x0 + (y - y0) * (x1 - x0) / (y1 - y0))
            xs.sort()
            for k in range(0, len(xs) - 1, 2):
                for x in range(math.ceil(xs[k]), math.floor(xs[k + 1]) + 1): s.px(x, y, c, a)
    def save(s, path):
        raw = b''.join(b'\x00' + bytes([v for px in row for v in px]) for row in s.p)
        def ch(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
        open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw, 9)) + ch(b'IEND', b''))


PAL = {
 'day': dict(ceil=('#b57a45', '#a66d3b'), beam='#7d4a28', wall='#d9a77a', wall2='#cf9a6c', frame='#8c5a3a', sky=((126, 190, 238), (222, 240, 250)), cloud='#ffffff',
             hill='#7d9bc4', roofA='#6f87b3', roofB='#8aa0c8', wallH='#e8d4b8', lit='#fff1b0', tree='#4f8f62', desk='#b86f3f', deskTop='#d28b57', chair='#9a5a30',
             floor=('#c98f55', '#bb8249'), blanket='#8fa86e', pillow='#b9cf95', bed='#9a5a30', glow='#ffe9a0', tint=None, stars=False),
 'dusk': dict(ceil=('#8a4c36', '#7b4230'), beam='#5a2f22', wall='#74463f', wall2='#6a3f39', frame='#6b4a4a', sky=((88, 110, 184), (232, 170, 140)), cloud='#c9a6c0',
              hill='#4f5f8e', roofA='#4a5a86', roofB='#5b6b9a', wallH='#6f7fa8', lit='#f7a24e', tree='#34476a', desk='#8f4f2e', deskTop='#b5683b', chair='#7a4126',
              floor=('#a95f33', '#9a542d'), blanket='#7b8a58', pillow='#9ab07a', bed='#7a4126', glow='#ffd27a', tint=(40, 14, 60, .16), stars=True),
}

def house(im, x, y, w, h, wall, roof, lit):
    im.rect(x, y, w, h, wall); im.poly([(x - 2, y), (x + w // 2, y - h // 2), (x + w + 2, y)], roof)
    for k in range(0, w - 4, 8):
        im.rect(x + 3 + k, y + 4, 3, 4, lit); im.rect(x + 3 + k, y + 4, 3, 1, '#ffffff', .25)

def scene(name):
    P = PAL[name]; im = Img(); r = random.Random(5)
    # wall
    for y in range(H): im.rect(0, y, W, 1, P['wall'] if y % 6 < 3 else P['wall2'], 1)
    # wood ceiling + beam
    for y in range(0, 26): im.rect(0, y, W, 1, P['ceil'][(y // 3) % 2])
    for x in range(0, W, 31): im.rect(x + (y := 0), 0, 1, 26, P['beam'], .35)
    im.rect(0, 26, W, 4, P['beam']); im.rect(0, 30, W, 1, '#000000', .18)
    # window: three panes
    wx0, wx1, wy0, wy1 = 40, 216, 34, 92
    im.rect(wx0 - 4, wy0 - 4, wx1 - wx0 + 8, wy1 - wy0 + 8, P['frame'])
    top, bot = P['sky']
    for y in range(wy0, wy1):
        t = (y - wy0) / (wy1 - wy0); im.rect(wx0, y, wx1 - wx0, 1, tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    if P['stars']:
        for _ in range(14): im.px(r.randrange(wx0 + 2, wx1 - 2), r.randrange(wy0 + 1, wy0 + 20), '#fff4d6', .9)
    for cx, cy, cw in ((52, 46, 22), (120, 42, 26), (186, 50, 20)):
        im.ell(cx + cw // 2, cy + 3, cw // 2, 3, P['cloud'], .9); im.ell(cx + cw // 3, cy + 1, cw // 4, 3, P['cloud'], .9)
    # village silhouette
    for x in range(wx0, wx1, 6): im.rect(x, 70 + int(3 * math.sin(x / 9)), 7, 22, P['hill'])
    houses = [(46, 66, 18, 22, P['wallH'], P['roofA']), (84, 70, 14, 18, P['wallH'], P['roofB']), (108, 60, 20, 28, P['wallH'], P['roofA']),
              (134, 66, 16, 22, P['wallH'], P['roofB']), (172, 58, 22, 30, P['wallH'], P['roofA']), (198, 70, 14, 18, P['wallH'], P['roofB'])]
    for hx, hy, hw, hh, w_, ro in houses: house(im, hx, hy, hw, hh, w_, ro, P['lit'])
    for tx in (60, 150, 206): im.ell(tx, 76, 7, 9, P['tree']); im.ell(tx + 4, 70, 6, 8, P['tree'])
    im.rect(wx0, wy1 - 4, wx1 - wx0, 4, P['tree'], .55)
    for x in (92, 164): im.rect(x, wy0, 4, wy1 - wy0, P['frame']); im.rect(x, wy0, 1, wy1 - wy0, '#ffffff', .15)
    im.rect(wx0 - 5, wy1 + 4, wx1 - wx0 + 10, 3, P['deskTop'])   # sill
    # desk (left to center)
    im.rect(6, 94, 150, 5, P['deskTop']); im.rect(6, 99, 150, 2, P['desk']); im.rect(6, 94, 150, 1, '#ffffff', .25)
    im.rect(8, 101, 30, 28, P['desk']); im.rect(8, 101, 30, 1, '#ffffff', .2)
    for y in (104, 113, 122): im.rect(10, y, 26, 7, '#000000', .15); im.rect(20, y + 3, 6, 1, '#e8c9a0')
    im.rect(142, 101, 4, 28, P['desk']); im.rect(44, 101, 3, 28, P['desk'])
    # items on desk: books, mug, plant, frame, lamp
    for k, c in enumerate(('#6b8fc9', '#d9704a', '#8bbf7a', '#e8c14e')): im.rect(8, 88 - k * 5, 22 - k * 2, 5, c); im.rect(8, 88 - k * 5, 22 - k * 2, 1, '#ffffff', .3)
    im.rect(104, 84, 8, 10, '#e8d4c0'); im.rect(112, 86, 3, 5, '#e8d4c0'); im.rect(105, 84, 6, 1, '#7a5a4a')
    im.rect(122, 82, 14, 12, '#c9805f'); im.rect(122, 82, 14, 2, '#e0a07f')
    for dx, dy, rx, ry in ((-6, -8, 8, 3), (8, -10, 8, 3), (0, -16, 5, 7), (-10, -16, 5, 3)): im.ell(129 + dx, 80 + dy, rx, ry, P['tree'] if name == 'dusk' else '#5fa872'); 
    im.rect(142, 74, 12, 16, '#e8c9a0'); im.rect(144, 76, 8, 12, '#a98b78'); im.rect(142, 74, 12, 1, '#ffffff', .3)
    # chair
    im.rect(52, 82, 3, 34, P['chair']); im.rect(76, 82, 3, 34, P['chair']); im.rect(52, 82, 27, 3, P['chair'])
    for x in (58, 64, 70): im.rect(x, 85, 2, 18, P['chair'])
    im.rect(50, 104, 31, 4, P['desk']); im.rect(52, 108, 3, 18, P['chair']); im.rect(76, 108, 3, 18, P['chair'])
    # floor with planks
    for y in range(128, H):
        im.rect(0, y, W, 1, P['floor'][((y - 128) // 4) % 2])
    im.rect(0, 126, W, 2, '#000000', .25)
    for y0 in range(128, H, 4):
        for x in range((y0 * 7) % 40, W, 40): im.rect(x, y0, 1, 4, '#000000', .2)
    im.ell(30, 136, 8, 2, '#d9b8a0'); im.ell(60, 140, 7, 2, '#d9b8a0'); im.rect(6, 132, 18, 4, '#5a7aa8'); im.rect(6, 128, 16, 4, '#d9704a')  # slippers/books
    # bed (right)
    im.rect(166, 104, 90, 6, P['bed']); im.rect(166, 110, 90, 18, P['bed'], .8)
    im.poly([(170, 100), (232, 100), (250, 108), (250, 124), (170, 124)], P['blanket']); im.rect(170, 100, 62, 2, '#ffffff', .25)
    for k in range(8): im.rect(176 + k * 8, 106 + (k % 2) * 3, 6, 2, '#000000', .1)
    im.poly([(226, 94), (252, 90), (256, 102), (236, 106)], P['pillow']); im.rect(248, 76, 8, 36, P['bed'])
    # nightstand + glowing lamp
    im.rect(236, 112, 20, 26, P['desk']); im.rect(236, 112, 20, 2, P['deskTop']); im.rect(240, 120, 12, 2, '#000000', .2); im.rect(240, 128, 12, 2, '#000000', .2)
    for rr in range(18, 0, -2): im.ell(246, 104, rr, rr, P['glow'], .05 + (18 - rr) * 0.012)
    im.ell(246, 104, 6, 6, P['glow'])
    # black cat
    im.ell(204, 120, 11, 6, '#1b1b24'); im.ell(194, 114, 6, 5, '#1b1b24'); im.poly([(189, 111), (191, 105), (194, 110)], '#1b1b24'); im.poly([(195, 110), (198, 105), (199, 111)], '#1b1b24')
    im.rect(191, 113, 2, 2, '#ffffff'); im.rect(196, 113, 2, 2, '#ffffff'); im.line(214, 118, 222, 108, '#1b1b24'); im.line(215, 118, 223, 108, '#1b1b24'); im.rect(190, 125, 3, 3, '#1b1b24'); im.rect(206, 126, 3, 2, '#1b1b24')
    if P['tint']:
        t = P['tint']
        for y in range(H):
            for x in range(W): im.px(x, y, t[:3], t[3])
        for y in range(H):
            for x in range(W):
                d = math.hypot((x - 246) * .9, y - 104)
                if d < 60: im.px(x, y, (255, 190, 110), (1 - d / 60) ** 2 * .35)
    # soft edge darkening toward the outer margins gives the column a place to sit
    for y in range(H):
        for x in range(W):
            d = abs(x - W / 2) / (W / 2)
            if d < .5: im.px(x, y, (0, 0, 0), (0.5 - d) * .35)
    return im

if __name__ == '__main__':
    scene('day').save('assets/scene-light.png'); scene('dusk').save('assets/scene-dark.png'); print('ok')
