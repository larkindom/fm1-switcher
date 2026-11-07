# FM-1 Switcher

One-click firmware swaps for the M-VAVE FM-1 from a Mac over USB-C. A small static web page (Chrome/Edge, Web MIDI) with a local firmware library; flashing is done by M-VAVE's own unmodified `webupdate.js` from [m-vave/fm1_open](https://github.com/m-vave/fm1_open) (GPL-3.0 with linking exception).

## Use
```sh
python3 -m http.server 8000   # then open http://localhost:8000 in Chrome
```
Connect the FM-1, click **Connect FM-1**, add firmware to the library (stock V15 downloads from GitHub; other firmware as the `.json` web package the official workbench uses), click **Switch**.

## Status: untested on hardware
- `node test.mjs FM-1_015.fwsc` checks the official parser accepts the real stock package. Nothing has been flashed by this app yet.
- Only firmware the official updater accepts is supported (identities `FM1_OFFICIAL_OPEN`, `FM1_COMMUNITY_n`, `FM-1_8xxxxxx`, and stock V15). Other community firmware needs the Firmware Hub for now.
- Switching from stock V15 or unrecognised firmware needs the "allow" checkbox.
- Updater messages come from the vendor file and are partly in Chinese.
- Bundled: `firmware/fm1-open-v14.json`, the official FM1 Open V14 web package extracted unmodified from M-VAVE's [V14 release](https://github.com/m-vave/fm1_open/releases/tag/V14) (app GPL-3.0; engine under M-VAVE's SDK terms). Stock V15 is fetched from M-VAVE's repo, not stored here. Community firmwares (Clipper, SLOOP, ...) are not bundled: each has its own licence and most don't fit the official updater's package format. Back up projects and samples first; formats differ between firmwares. Power loss mid-write can brick the unit.

Not affiliated with M-VAVE. GPL-3.0.
