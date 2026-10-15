#!/usr/bin/env python3
"""Rebuild index.html and sw.js at the repo root from source/app.html.
Usage: python3 source/build.py"""
import re, os, shutil, datetime, zipfile

SRC = None
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = ROOT

src = open(os.path.join(HERE, 'app.html')).read()
src = re.sub(r'<link rel="stylesheet" href="https://fonts.googleapis.com[^>]*>\n?', '', src, count=1)
title = re.search(r'<title>.*?</title>\n?', src).group(0)
src = src.replace(title, '', 1).replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '', 1)

faces = ''
for fam, f, w in [("Barlow Condensed", "barlow-condensed-latin-500-normal", 500), ("Barlow Condensed", "barlow-condensed-latin-600-normal", 600),
                  ("Barlow Condensed", "barlow-condensed-latin-700-normal", 700), ("Source Sans 3", "source-sans-3-latin-400-normal", 400),
                  ("Source Sans 3", "source-sans-3-latin-600-normal", 600), ("Source Sans 3", "source-sans-3-latin-700-normal", 700),
                  ("JetBrains Mono", "jetbrains-mono-latin-400-normal", 400), ("JetBrains Mono", "jetbrains-mono-latin-600-normal", 600)]:
    faces += f'@font-face{{font-family:"{fam}";font-style:normal;font-weight:{w};font-display:swap;src:url(fonts/{f}.woff2) format("woff2")}}\n'

connect = open(os.path.join(HERE, 'claude-connect.js')).read()
installed = open(os.path.join(HERE, 'installed.js')).read()

head = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
{title.strip()}
<meta name="theme-color" content="#0E1410">
<meta name="description" content="Kohl Ballistics: ballistic calculator for a .30-06 BLR. Works offline.">
<link rel="manifest" href="manifest.json">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>
{faces}:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);color-scheme:light}}
html,body{{margin:0}}
body{{font-size:14px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}}
img{{max-width:100%}}
[hidden]{{display:none!important}}
.offbar{{font-size:.8rem;text-align:center;padding:4px 8px;background:var(--sunk);color:var(--muted)}}
</style>
<script>
{connect}
</script>
</head>
<body>
<div class="offbar" id="netBar" hidden></div>
'''
page = head + src + '\n<script>\n' + installed + '</script>\n</body>\n</html>\n'

os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, 'index.html'), 'w').write(page)

version = 'kohl-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')
fonts = sorted(f for f in os.listdir(os.path.join(OUT, 'fonts')) if f.endswith('.woff2'))
files = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'] + [f'./fonts/{f}' for f in fonts]
sw = f'''// Kohl Ballistics offline cache. VERSION changes with every build so phones pick up updates.
const VERSION = "{version}";
const FILES = {files!r};
self.addEventListener("install", e => {{ e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES))); }});
self.addEventListener("activate", e => {{
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
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
open(os.path.join(OUT, 'sw.js'), 'w').write(sw.replace("'", '"'))
_unused = (
    "Kohl Ballistics app.\nUpload everything in this folder (index.html, sw.js, manifest.json, icons/, fonts/) to your GitHub Pages repository,\n"
    "replacing the old files. Open it in Chrome on your phone with signal and choose Install app. It switches between online and offline by itself.\n")

print('built', version, len(page), 'bytes')
