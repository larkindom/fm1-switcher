#!/usr/bin/env python3
"""Draws the two pixel-art backgrounds (assets/scene-light.png, scene-dark.png): original art, 192x108, scaled up by the page.
   python3 tools/make_scenes.py"""
import zlib, struct, random, math
W, H = 192, 108

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

def cloud(im, x, y, w, c='#ffffff', sh='#d6ecf7'):
    im.ell(x + w // 2, y + 3, w // 2, 3, c); im.ell(x + w // 3, y + 1, w // 4, 3, c); im.ell(x + 2 * w // 3, y, w // 4, 3, c)
    im.rect(x + 2, y + 5, w - 4, 1, sh)

def light():
    im = Img(); r = random.Random(7)
    im.rect(0, 0, W, H, '#f6e7c8')
    # soft wall wash
    for y in range(0, 64, 2): im.rect(0, y, W, 1, '#f1dfba', .25)
    # windows with sky
    def window(x0, x1, curtain):
        for y in range(0, 62):
            t = y / 62; c = (int(130 + 90 * t), int(200 + 40 * t), 240)
            im.rect(x0, y, x1 - x0, 1, c)
        for cx, cy, cw in ((x0 + 4, 18 + r.randrange(0, 8), 18), (x0 + (x1 - x0) // 2, 30 + r.randrange(0, 8), 24)): cloud(im, cx, cy, cw)
        if curtain:
            im.rect(x0, 0, x1 - x0, 12, '#7fa6df')
            for k in range(x0 + 3, x1 - 3, 9):
                im.rect(k, 3, 2, 2, '#e6f0ff'); im.rect(k - 1, 4, 4, 1, '#e6f0ff'); im.rect(k + 4, 8, 2, 2, '#e6f0ff')
            im.rect(x0, 12, x1 - x0, 1, '#4d73b3')
    window(2, 50, True); window(62, 130, False); window(142, 190, True)
    for x in (0, 50, 60, 130, 140, 190):   # frames
        im.rect(x, 0, 3, 64, '#9a6a45'); im.rect(x + 1, 0, 1, 64, '#b98558')
    im.rect(0, 62, W, 3, '#9a6a45'); im.rect(0, 0, W, 2, '#9a6a45')
    # desk
    im.rect(0, 65, W, 28, '#ebc88e'); im.rect(0, 65, W, 2, '#f6dca8')
    for y in range(70, 92, 4): im.rect(0, y, W, 1, '#dcb678', .5)
    im.rect(0, 93, W, 4, '#9a6a45'); im.rect(0, 97, W, 11, '#7d5436')
    for x in range(0, W, 24): im.rect(x, 99, 1, 9, '#5d3d26')
    # lamp (left)
    im.rect(8, 84, 10, 3, '#c9806f'); im.line(12, 84, 16, 68, '#d9917e'); im.line(13, 84, 17, 68, '#d9917e'); im.line(16, 68, 30, 63, '#d9917e')
    im.poly([(26, 60), (44, 66), (40, 72), (23, 66)], '#f0b8a2'); im.poly([(26, 60), (44, 66), (41, 67), (24, 63)], '#f8d0bf'); im.rect(32, 72, 3, 2, '#ffe27a')
    # pencil cup + notebook
    im.rect(14, 76, 9, 10, '#d9404a'); im.rect(14, 76, 9, 1, '#f26b73')
    for k, c in enumerate(('#f2c14e', '#6bb36b', '#5a8fd9', '#c9806f')): im.line(15 + k * 2, 76, 14 + k * 3, 68 - k % 2, c)
    im.rect(34, 72, 18, 13, '#fbf7ee'); im.rect(34, 72, 18, 1, '#c9c2b2'); im.rect(34, 72, 1, 13, '#c9c2b2')
    for y in range(75, 84, 3): im.rect(37, y, 12, 1, '#9aa3b5')
    # plant in pink pot (center-left)
    im.rect(70, 76, 12, 12, '#e98fb0'); im.rect(70, 76, 12, 2, '#f7b5cd'); im.rect(72, 86, 8, 2, '#c96d90')
    for dx, dy, rx, ry in ((-6, -10, 9, 4), (7, -14, 9, 4), (0, -22, 6, 8), (-9, -22, 5, 3)):
        im.ell(76 + dx, 72 + dy, rx, ry, '#4f9a6b'); im.ell(76 + dx, 71 + dy, rx - 2, ry - 1, '#6cb785')
    # right side: shelf with books, plush, plant
    im.rect(150, 26, 2, 66, '#9a6a45'); im.rect(188, 26, 2, 66, '#9a6a45')
    for y in (44, 62, 80): im.rect(150, y, 40, 3, '#b98558'); im.rect(150, y + 3, 40, 1, '#8a5a3a')
    cols = ['#d9404a', '#f2c14e', '#6bb3a5', '#5a8fd9', '#c9806f', '#8a6fc9', '#e98fb0']
    x = 153
    while x < 186:
        w = r.choice((3, 4, 5)); h = r.choice((11, 13, 15)); c = r.choice(cols); im.rect(x, 62 - h, w, h, c); im.rect(x, 62 - h, w, 1, '#ffffff', .3); x += w + 1
    x = 153
    while x < 180:
        w = r.choice((3, 4)); h = r.choice((10, 12)); c = r.choice(cols); im.rect(x, 80 - h, w, h, c); x += w + 1
    im.ell(168, 38, 8, 6, '#f6a0c2'); im.rect(160, 42, 5, 2, '#d9404a'); im.rect(172, 42, 5, 2, '#d9404a'); im.px(165, 37, '#8a3d5c'); im.px(171, 37, '#8a3d5c')
    im.rect(180, 36, 8, 8, '#d28a6f'); im.ell(184, 32, 5, 5, '#4f9a6b'); im.ell(182, 30, 3, 4, '#6cb785')
    # white cat sleeping, orange cat, yellow plant
    im.ell(166, 88, 22, 7, '#fdfbf7'); im.ell(150, 86, 7, 6, '#fdfbf7'); im.ell(150, 82, 3, 2, '#f1c9a0'); im.rect(146, 79, 2, 3, '#fdfbf7'); im.rect(152, 79, 2, 3, '#fdfbf7')
    im.ell(170, 85, 6, 3, '#eebb86'); im.rect(140, 93, 3, 2, '#fdfbf7')
    im.rect(130, 78, 12, 12, '#e8b13a'); im.rect(130, 78, 12, 2, '#f6cd62')
    for dx, dy, rx, ry in ((-4, -9, 7, 3), (5, -11, 7, 3), (0, -17, 5, 6)): im.ell(136 + dx, 76 + dy, rx, ry, '#4f9a6b')
    im.ell(14, 104, 12, 7, '#f2b043'); im.ell(18, 98, 6, 6, '#f2b043'); im.poly([(13, 94), (16, 90), (18, 95)], '#f2b043'); im.poly([(19, 95), (22, 90), (24, 96)], '#f2b043')
    im.rect(15, 98, 2, 2, '#243a30'); im.rect(21, 98, 2, 2, '#243a30'); im.rect(18, 101, 2, 1, '#d9707f')
    return im

def dark():
    im = Img(); r = random.Random(11)
    for y in range(H): t = y / H; im.rect(0, y, W, 1, (int(24 + 20 * t), int(24 + 14 * t), int(44 + 22 * t)))
    # slanted ceiling (left) and right wall lighter panel
    im.poly([(0, 0), (60, 0), (46, 34), (0, 70)], '#171627')
    im.poly([(192, 0), (140, 0), (150, 36), (192, 56)], '#1a1930')
    im.rect(138, 40, 54, 52, '#2e2840'); im.rect(138, 40, 54, 1, '#3a3350')
    # skylight with rain sky
    sky = [(50, 0), (142, 0), (130, 36), (62, 36)]
    im.poly(sky, '#34465f')
    for y in range(0, 36):
        im.rect(0, 0, 0, 0, '#000')
    for k in range(70):
        x = r.randrange(54, 140); y = r.randrange(0, 34); L = r.randrange(3, 7)
        for t in range(L): im.px(x - t // 2, y + t, '#9fb6d3', .6)
    im.line(50, 0, 62, 36, '#6a4636'); im.line(51, 0, 63, 36, '#6a4636'); im.line(142, 0, 130, 36, '#6a4636'); im.line(141, 0, 129, 36, '#6a4636')
    im.rect(62, 36, 68, 2, '#6a4636'); im.rect(60, 38, 72, 1, '#4a3025')
    for k in range(5): im.px(r.randrange(66, 126), 37, '#c7dcf5', .8)   # drips on the sill
    # right wall: posters, shelf, sconce
    posters = [(146, 44, 10, 14, '#6b5b8c'), (158, 44, 12, 18, '#8c6b5b'), (172, 46, 14, 12, '#5b7c8c'), (148, 62, 12, 10, '#8c5b6f'), (164, 66, 18, 14, '#5b6b8c')]
    for x, y, w, h, c in posters: im.rect(x, y, w, h, c); im.rect(x, y, w, 1, '#ffffff', .25); im.rect(x + 2, y + 3, w - 4, h - 6, '#ffffff', .12)
    im.rect(150, 76, 40, 2, '#4a3025'); 
    for k in range(6): im.rect(152 + k * 6, 70, 4, 6, r.choice(['#7a5a8c', '#8c6a4a', '#4a7a7a']))
    im.rect(138, 46, 3, 3, '#b0a090'); im.line(140, 49, 144, 46, '#b0a090'); im.poly([(140, 44), (146, 44), (143, 50)], '#d9c9a8')
    # desk with warm lamp light
    im.rect(40, 74, 112, 4, '#6b5240'); im.rect(40, 78, 112, 30, '#2a2030'); im.rect(40, 74, 112, 1, '#8a6a50')
    im.rect(42, 80, 3, 28, '#3a2a35'); im.rect(146, 80, 3, 28, '#3a2a35')
    im.rect(0, 80, 28, 28, '#3b2d38'); im.rect(0, 80, 28, 2, '#5a4452')
    for y in (86, 94, 102): im.rect(2, y, 24, 5, '#46364a'); im.rect(11, y + 2, 6, 1, '#8a7a6a')
    # plant left
    im.rect(8, 70, 10, 10, '#5a4a5a')
    for k in range(10): im.line(13, 70, 4 + k * 2, 44 + r.randrange(0, 14), '#2b4a3f')
    # chair silhouette
    im.rect(86, 86, 24, 3, '#2a1f24'); im.rect(90, 89, 2, 19, '#221a1f'); im.rect(104, 89, 2, 19, '#221a1f'); im.rect(88, 60, 20, 26, '#251c22'); im.rect(88, 60, 20, 2, '#33262d')
    # desk lamp (teal shade) + items
    im.line(52, 74, 56, 58, '#7b8a85'); im.line(56, 58, 66, 52, '#7b8a85'); im.poly([(60, 46), (76, 52), (72, 58), (58, 52)], '#2f7f78'); im.rect(52, 74, 8, 2, '#7b8a85')
    im.rect(68, 56, 5, 2, '#ffe9a8')
    im.rect(80, 70, 34, 4, '#e6d7b0'); im.rect(80, 70, 34, 1, '#fff3cc'); im.rect(124, 68, 6, 6, '#d9a86f'); im.rect(132, 66, 4, 8, '#8c6a4a')
    im.rect(98, 66, 8, 4, '#c9b890'); 
    # warm light pool (radial blend from lamp bulb)
    for y in range(H):
        for x in range(W):
            d = math.hypot((x - 70) * 0.8, (y - 58)); 
            if d < 44: im.px(x, y, (255, 190, 100), max(0, (1 - d / 44)) ** 1.6 * 0.42)
    im.ell(110, 76, 34, 4, (255, 200, 120), .18)
    # vignette
    for y in range(H):
        for x in range(W):
            d = math.hypot((x - 96) / 96, (y - 54) / 62); 
            if d > .75: im.px(x, y, (8, 8, 20), min(.5, (d - .75) * 1.2))
    return im

if __name__ == '__main__':
    light().save('assets/scene-light.png'); dark().save('assets/scene-dark.png'); print('ok')
