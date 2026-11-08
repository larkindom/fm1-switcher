# FM-1 Switcher

One-click firmware swaps for the M-VAVE FM-1 from a Mac over USB-C. A small static web page (Chrome/Edge, Web MIDI) with a local firmware library; flashing is done by M-VAVE's own unmodified `webupdate.js` from [m-vave/fm1_open](https://github.com/m-vave/fm1_open) (GPL-3.0 with linking exception).

## Use
Live: https://larkindom.github.io/fm1-switcher/ (the five featured firmwares load automatically).

Locally:
```sh
python3 -m http.server 8000   # then open http://localhost:8000 in Chrome
```
Connect the FM-1, click **Connect FM-1**, add firmware to the library (stock V15 downloads from GitHub; other firmware as the `.json` web package the official workbench uses), click **Switch**.

## Emulator
Cards from the hub have a ▶ that opens that firmware in an embedded panel (or a new tab) of [fm1-emu](https://github.com/joakimeriksson/fm1-emu) (MIT, by joakimeriksson), a browser emulator that also ships AU/VST3 plugins. It runs the firmware but not your real flash chip, so it can't test the old-chip problem.

## Saves (backup and restore, FM1 Open only)
**Back up** reads the FM-1's current project, samples and voice banks through M-VAVE's project protocol and keeps them under **My saves** (this browser) and as a `fm1-backup-DATE.json` download. **Restore** writes a save back and reads each part back to check it; it only works when the FM-1 runs the same firmware the save came from, because formats differ between firmwares. It works only under the official **FM1 Open** firmware, covers the current project (not the 16 project slots), and is not a whole-flash image, so it does not cover a firmware that can't save or update on your flash chip. Library resets never touch saves. Use a download-mode tool such as FM-SWITCH on a Mac for whole-flash backups, and the hub's rescue page for a firmware that won't update.

## More features
- **Backup & rescue tools** and **More FM-1 tools** panels link whole-flash backup and rescue tools (a web page can't read the whole flash).
- Cards: ★ favourite, ✎ the firmware's own editor, ⓘ details (author, licence, release notes, source, the hub's "built from source" check), ▶ emulator, and an "updated from" badge for two weeks after a newer release replaces an older one.
- Search, filters (kind, favourites, hide older-chip firmware) and sorting (A-Z, most installed, newest, most starred).
- A banner explains update mode and the hold-OCT- rescue start when no FM-1 is found or it is stuck in its update loader.
- **Back to official V15** from a community firmware goes through the community updater, as the hub does. Not tested on hardware.

## Firmware not on the hub
`EXTRAS` in `app.js` lists firmwares kept in this repo and pinned by SHA-256 (currently Garden FM, GPL-3.0, from its GitHub release; see `firmware/GARDEN.md`). They are marked "chip support unknown" because nobody has checked them.

## The look
The page is drawn as the FM-1 itself on a wooden desk (`tools/make_desk.py` draws the oak desk, `assets/desk.svg`). The LCD shows connection status, messages and progress. The COLOUR knob picks one of six device colourways (Cream, Lilac, Graphite, Orange, Blue, Mint), SORT and SHOW cycle the sort order and category, and SETUP opens settings. The buttons are CONNECT, BACK UP, and shortcuts for favourites, hiding older-chip firmware, My saves and the rescue tools. Firmware cards sit in the key tray.

## Status: untested on hardware
- `node test.mjs FM-1_015.fwsc` checks the official parser accepts the real stock package. Nothing has been flashed by this app yet.
- Two update paths: M-VAVE's official one (`webupdate.js`: FM1 Open, stock V15) and the community one used by SLOOP, Melodee, AMB-1 and others (`felucca.js`, extracted unmodified from [The Firmware Hub](https://thefirmwarehub.com/), GPL-3.0, Leo Kuroshita). Community packages are downloaded from the hub on demand and checked against its SHA-256 pin; nothing is stored in this repo. Featured: SLOOP, Melodee, AMB-1, CoralFlower, ZEN-1, fm1-chord, FMEL-1, Frodhes, Clipper, FM-106, sloopDX, Tonitor, JIANT FM, ChoralRoot, MONO2K, KARMA, fm1-dock, X0X, FoMni, PERF-1, MAKU (add more: one id in `HUB_IDS` in `app.js` plus a button). Packages marked "old flash chip" only know the first FM-1s' Puya flash; the app warns before installing them.
- Returning from a community firmware to stock V15 is not wired up in this app yet; use the hub's "Back to official".
- Switching from stock V15 or unrecognised firmware needs the "allow" checkbox.
- Updater messages come from the vendor file and are partly in Chinese.
- Bundled: `firmware/fm1-open-v14.json`, the official FM1 Open V14 web package extracted unmodified from M-VAVE's [V14 release](https://github.com/m-vave/fm1_open/releases/tag/V14) (app GPL-3.0; engine under M-VAVE's SDK terms). Stock V15 is fetched from M-VAVE's repo, not stored here. Community firmwares (Clipper, SLOOP, ...) are not bundled: each has its own licence and most don't fit the official updater's package format. Back up projects and samples first; formats differ between firmwares. Power loss mid-write can brick the unit.

Card images are loaded from thefirmwarehub.com (each from its project's repository), not stored here.

Not affiliated with M-VAVE. GPL-3.0.
