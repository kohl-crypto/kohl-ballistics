# Kohl Ballistics

Ballistic calculator for a Browning BLR .30-06 with a Leupold VX-5HD 3-15x44 CDS-ZL2.
Installable on Android; works with no signal. When the phone has signal and a Claude API key is saved
in the app (Rifle & load → Online features), the Spotter and box-photo reading turn on.

Live app (Lance's BLR): https://kohl-crypto.github.io/kohl-ballistics/
Friends' edition (any rifle and scope, iPhone or Android): https://kohl-crypto.github.io/kohl-ballistics/friends/

The friends' edition starts empty and asks for the rifle's caliber (.30-06 Springfield, .308 Winchester,
6.5 Creedmoor or other), the scope (MOA or MIL, click value, focal plane, power range) and the zero.
It keeps its data separately from Lance's edition, so the two never mix.

Installing on iPhone: open the friends link in Safari, tap Share, then Add to Home Screen.
Installing on Android: open it in Chrome, tap the ⋮ menu, then Install app.

## What's here
- `index.html`, `sw.js`, `manifest.json`, `icons/`, `fonts/`: Lance's edition (GitHub Pages serves these).
- `friends/`: the friends' edition (shares `icons/` and `fonts/`).
- `source/app.html`: the main app page.
- `source/claude-connect.js`: talks to the Claude API with the key stored on the phone.
- `source/installed.js`: online/offline switching, Online features panel, offline caching.
- `source/build.py`: rebuilds both editions from `source/`. Run `python3 source/build.py`.

No personal data or API keys are stored in this repository. Loads, zero and the API key live only on the phone.
