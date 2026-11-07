# FM-1 Switcher

One-click firmware swaps for the M-VAVE FM-1 from a Mac over USB-C. A small static web page (Chrome/Edge, Web MIDI) with a local firmware library; flashing is done by M-VAVE's own unmodified `webupdate.js` from [m-vave/fm1_open](https://github.com/m-vave/fm1_open) (GPL-3.0 with linking exception).

## Use
Live: https://larkindom.github.io/fm1-switcher/ (the five featured firmwares load automatically).

Locally:
```sh
python3 -m http.server 8000   # then open http://localhost:8000 in Chrome
```
Connect the FM-1, click **Connect FM-1**, add firmware to the library (stock V15 downloads from GitHub; other firmware as the `.json` web package the official workbench uses), click **Switch**.

## Status: untested on hardware
- `node test.mjs FM-1_015.fwsc` checks the official parser accepts the real stock package. Nothing has been flashed by this app yet.
- Two update paths: M-VAVE's official one (`webupdate.js`: FM1 Open, stock V15) and the community one used by SLOOP, Melodee, AMB-1 and others (`felucca.js`, extracted unmodified from [The Firmware Hub](https://thefirmwarehub.com/), GPL-3.0, Leo Kuroshita). Community packages are downloaded from the hub on demand and checked against its SHA-256 pin; nothing is stored in this repo. Featured: SLOOP, Melodee, AMB-1, CoralFlower, ZEN-1, fm1-chord, FMEL-1, Frodhes, Clipper, FM-106, sloopDX, Tonitor, JIANT FM, ChoralRoot, MONO2K, KARMA (add more: one id in `HUB_IDS` in `app.js` plus a button). Packages marked "old flash chip" only know the first FM-1s' Puya flash; the app warns before installing them.
- Returning from a community firmware to stock V15 is not wired up in this app yet; use the hub's "Back to official".
- Switching from stock V15 or unrecognised firmware needs the "allow" checkbox.
- Updater messages come from the vendor file and are partly in Chinese.
- Bundled: `firmware/fm1-open-v14.json`, the official FM1 Open V14 web package extracted unmodified from M-VAVE's [V14 release](https://github.com/m-vave/fm1_open/releases/tag/V14) (app GPL-3.0; engine under M-VAVE's SDK terms). Stock V15 is fetched from M-VAVE's repo, not stored here. Community firmwares (Clipper, SLOOP, ...) are not bundled: each has its own licence and most don't fit the official updater's package format. Back up projects and samples first; formats differ between firmwares. Power loss mid-write can brick the unit.

Card images are loaded from thefirmwarehub.com (each from its project's repository), not stored here.

See also [FM-SWITCH](https://github.com/ocean/FM-SWITCH): a native Mac/iPhone/iPad app with whole-flash backup and rescue (download mode), which a web page can't do.

Not affiliated with M-VAVE. GPL-3.0.
