#!/usr/bin/env python3
"""Rebuild both editions of Kohl Ballistics from source/app.html.
  Lance's edition   -> index.html, sw.js, manifest.json at the repo root
  Friends' edition  -> friends/index.html, friends/sw.js, friends/manifest.json
Each edition keeps its own data on the phone, so they never mix.
Before writing anything, and again after, the ballistics engine is checked against independent
reference numbers (source/check/). If it's off, the build stops. Needs Node.js.
Usage: python3 source/build.py"""
import re, os, json, datetime, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CHECK = os.path.join(HERE, 'check', 'check_solver.js')


def check_solver(*pages):
    node = shutil.which('node')
    if not node:
        sys.exit('build stopped: Node.js is needed to check the ballistics engine (https://nodejs.org)')
    if subprocess.run([node, CHECK, *pages]).returncode:
        sys.exit('build stopped: the ballistics engine no longer matches the reference numbers (see above)')


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def write(path, text):
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


check_solver(os.path.join(HERE, 'app.html'))

base = read(os.path.join(HERE, 'app.html'))
base = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^>]*>\n?', '', base, count=1)
title = re.search(r'<title>.*?</title>\n?', base).group(0)
base = base.replace(title, '', 1).replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '', 1)

connect = read(os.path.join(HERE, 'claude-connect.js'))
installed = read(os.path.join(HERE, 'installed.js'))
fonts = sorted(f for f in os.listdir(os.path.join(ROOT, 'fonts')) if f.endswith('.woff2'))
version = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')

FACES = [("Barlow Condensed", "barlow-condensed-latin-500-normal", 500), ("Barlow Condensed", "barlow-condensed-latin-600-normal", 600),
         ("Barlow Condensed", "barlow-condensed-latin-700-normal", 700), ("Source Sans 3", "source-sans-3-latin-400-normal", 400),
         ("Source Sans 3", "source-sans-3-latin-600-normal", 600), ("Source Sans 3", "source-sans-3-latin-700-normal", 700),
         ("JetBrains Mono", "jetbrains-mono-latin-400-normal", 400), ("JetBrains Mono", "jetbrains-mono-latin-600-normal", 600)]

EDITIONS = [
    dict(key="lance", out=ROOT, up="", desc="Kohl Ballistics: ballistic calculator for a .30-06 BLR. Works offline."),
    dict(key="friends", out=os.path.join(ROOT, "friends"), up="../", desc="Kohl Ballistics: ballistic calculator for your rifle and scope. Works offline."),
]

for ed in EDITIONS:
    up, out = ed["up"], ed["out"]
    os.makedirs(out, exist_ok=True)
    faces = ''.join(f'@font-face{{font-family:"{fam}";font-style:normal;font-weight:{w};font-display:swap;src:url({up}fonts/{f}.woff2) format("woff2")}}\n' for fam, f, w in FACES)
    head = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
{title.strip()}
<meta name="theme-color" content="#0E1410">
<meta name="description" content="{ed['desc']}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Kohl Ballistics">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<link rel="manifest" href="manifest.json">
<link rel="icon" type="image/png" sizes="192x192" href="{up}icons/icon-192.png">
<link rel="apple-touch-icon" href="{up}icons/apple-touch-icon.png">
<style>
{faces}:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);color-scheme:light}}
html,body{{margin:0}}
body{{font-size:14px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}}
img{{max-width:100%}}
[hidden]{{display:none!important}}
.offbar{{font-size:.8rem;text-align:center;padding:4px 8px;background:var(--sunk);color:var(--muted)}}
</style>
<script>window.KB_EDITION = "{ed['key']}";
try {{ var t = localStorage.getItem("kb-theme"); if (t && t !== "auto") document.documentElement.setAttribute("data-theme", t); }} catch (e) {{}}</script>
<script>
{connect}
</script>
</head>
<body>
<div class="offbar" id="netBar" hidden></div>
'''
    page = head + base + '\n<script>\n' + installed + '</script>\n</body>\n</html>\n'
    write(os.path.join(out, 'index.html'), page)

    manifest = {
        "name": "Kohl Ballistics", "short_name": "Kohl Ballistics", "description": ed["desc"],
        "start_url": "./", "scope": "./", "id": "./", "display": "standalone", "orientation": "portrait",
        "background_color": "#0E1410", "theme_color": "#0E1410",
        "icons": [
            {"src": f"{up}icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": f"{up}icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": f"{up}icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}
    write(os.path.join(out, 'manifest.json'), json.dumps(manifest, indent=2) + "\n")

    files = ['./', './index.html', './manifest.json'] + [f'{up}icons/{i}' for i in ('icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png')] + [f'{up}fonts/{f}' for f in fonts]
    sw = f'''// Kohl Ballistics offline cache ({ed['key']} edition). VERSION changes with every build so phones pick up updates.
const VERSION = "kohl-{ed['key']}-{version}";
const FILES = {json.dumps(files)};
self.addEventListener("install", e => {{ e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES))); }});
self.addEventListener("activate", e => {{
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && (k.startsWith("kohl-{ed['key']}-") || /^kohl-\\d/.test(k))).map(k => caches.delete(k)))).then(() => self.clients.claim()));
}});
// Serve from the phone first so it works with no signal; refresh the stored copy in the background when online.
// Only this app's own files are cached; calls to Claude go straight to the network.
self.addEventListener("fetch", e => {{
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async c => {{
    const hit = await c.match(e.request, {{ ignoreSearch: true }});
    const net = fetch(e.request).then(r => {{ if (r && r.ok) c.put(e.request, r.clone()); return r; }}).catch(() => null);
    return hit || (await net) || c.match("./index.html");
  }}));
}});
'''
    write(os.path.join(out, 'sw.js'), sw)
    print('built', ed['key'], len(page), 'bytes')
check_solver(*(os.path.join(ed['out'], 'index.html') for ed in EDITIONS))
print('version', version)
