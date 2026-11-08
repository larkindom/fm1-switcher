#!/usr/bin/env python3
"""Writes assets/desk.svg: four oak boards with warped grain, pores, knots and seams (1600x1200, tileable enough at this size)."""
W, H, B = 1600, 1200, 300
tones = [('#a8743f', '#7d4f26', 11), ('#9b6a39', '#6f4522', 23), ('#b07c46', '#80522a', 37), ('#a06f3b', '#734a24', 51)]
defs, body = [], []
for i, (base, dark, seed) in enumerate(tones):
    y = i * B
    defs.append(f'''<clipPath id="c{i}"><rect x="0" y="{y}" width="{W}" height="{B}"/></clipPath>
<filter id="g{i}" x="0" y="{y}" width="{W}" height="{B}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
 <feTurbulence type="fractalNoise" baseFrequency="0.0016 0.05" numOctaves="3" seed="{seed}" result="warp"/>
 <feTurbulence type="fractalNoise" baseFrequency="0.0035 0.16" numOctaves="4" seed="{seed+1}" result="fine"/>
 <feDisplacementMap in="fine" in2="warp" scale="46" xChannelSelector="R" yChannelSelector="G" result="grain"/>
 <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.075  0 0 0 0 0.02  1.9 0 0 0 -0.78"/>
</filter>
<filter id="p{i}" x="0" y="{y}" width="{W}" height="{B}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
 <feTurbulence type="fractalNoise" baseFrequency="0.012 0.9" numOctaves="2" seed="{seed+2}"/>
 <feColorMatrix type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.06  0 0 0 0 0.02  3.2 0 0 0 -1.9"/>
</filter>
<linearGradient id="s{i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>''')
    kx, ky = [(1180, 150), (320, 140), (900, 170), (1400, 120)][i]
    knot = f'''<g clip-path="url(#c{i})"><ellipse cx="{kx}" cy="{y+ky}" rx="46" ry="20" fill="#3a2008" opacity=".55"/>
<ellipse cx="{kx}" cy="{y+ky}" rx="76" ry="30" fill="none" stroke="#4a2a0e" stroke-width="3" opacity=".35"/><ellipse cx="{kx}" cy="{y+ky}" rx="112" ry="42" fill="none" stroke="#4a2a0e" stroke-width="2" opacity=".22"/></g>'''
    body.append(f'''<g clip-path="url(#c{i})"><rect x="0" y="{y}" width="{W}" height="{B}" fill="{base}"/>
<rect x="0" y="{y}" width="{W}" height="{B}" filter="url(#g{i})"/><rect x="0" y="{y}" width="{W}" height="{B}" filter="url(#p{i})" opacity=".8"/>
<rect x="0" y="{y}" width="{W}" height="{B}" fill="url(#s{i})"/></g>{knot}
<rect x="0" y="{y}" width="{W}" height="3" fill="#1d0e04" opacity=".7"/><rect x="0" y="{y+3}" width="{W}" height="2" fill="#fff" opacity=".12"/>
<rect x="{[520, 1250, 160, 980][i]}" y="{y}" width="3" height="{B}" fill="#1d0e04" opacity=".55"/>''')
svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><defs>{"".join(defs)}</defs>{"".join(body)}</svg>'
open('assets/desk.svg', 'w').write(svg); print(len(svg), 'bytes')
