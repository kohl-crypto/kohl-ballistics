# Kohl Ballistics

Ballistic calculator for a Browning BLR .30-06 with a Leupold VX-5HD 3-15x44 CDS-ZL2.
Installable on Android; works with no signal. When the phone has signal and a Claude API key is saved
in the app (Rifle & load → Online features), the Spotter and box-photo reading turn on.

Live app: https://kohl-crypto.github.io/kohl-ballistics/

## What's here
- `index.html`, `sw.js`, `manifest.json`, `icons/`, `fonts/`: the published app (GitHub Pages serves these).
- `source/app.html`: the main app page.
- `source/claude-connect.js`: talks to the Claude API with the key stored on the phone.
- `source/installed.js`: online/offline switching, Online features panel, offline caching.
- `source/build.py`: rebuilds `index.html` and `sw.js` from `source/`. Run `python3 source/build.py`.

No personal data or API keys are stored in this repository. Loads, zero and the API key live only on the phone.
