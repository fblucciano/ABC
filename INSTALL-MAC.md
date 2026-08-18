# VenusP Planning Report — Mac Installation Guide (Apple Silicon)

This package is **fully self-contained**. The doctor's Mac does **not** need Node.js, Python, a web browser install, Java, or any other software. Everything required to run the app is included in this ZIP.

## What is in the ZIP

| File | Purpose |
|------|---------|
| `VenusP-Planning-mac_arm64` | Native application (M1 / M2 / M3) |
| `resources.neu` | Packed app resources (UI, logic, fonts, images) |
| `Open-VenusP.command` | Double-click launcher |
| `INSTALL-MAC.md` | This guide |

**Important:** Keep `resources.neu` in the **same folder** as the application. Do not move or delete it.

---

## Step 1 — Download and unzip

1. Download `VenusP-Desktop-Mac-AppleSilicon.zip`
2. Double-click the ZIP to unzip it
3. Move the folder `VenusP-Desktop-Mac-AppleSilicon` to a permanent location (e.g. **Applications** or **Documents/VenusP**)

---

## Step 2 — First launch (macOS security)

Because this app is distributed outside the Mac App Store, macOS may block it the first time.

### Recommended method

1. Open the unzipped folder
2. **Right-click** (or Control-click) **`Open-VenusP.command`**
3. Click **Open** in the dialog
4. If prompted again, click **Open** once more

### If macOS still blocks the app

1. Open **System Settings** → **Privacy & Security**
2. Scroll down to the message about `VenusP-Planning` or `Open-VenusP.command`
3. Click **Open Anyway**

### Alternative — Terminal (one-time)

```bash
cd /path/to/VenusP-Desktop-Mac-AppleSilicon
chmod +x VenusP-Planning-mac_arm64 Open-VenusP.command
xattr -cr .
./Open-VenusP.command
```

The `xattr -cr .` command clears the macOS quarantine flag from downloaded files. You only need this once per folder.

---

## Step 3 — Log in

- Password: `venus2026`
- The app works **offline** after installation (no internet required for sizing or PDF export)

---

## Daily use

1. Open the folder
2. Double-click **`Open-VenusP.command`**
3. Enter the case data in the app
4. Click **Export PDF** to generate the 6-page clinical proforma

---

## PDF export

- Fills the VenusP pre-implantation planning proforma from the data entered in the app
- Includes measurements, morphology, chart, deployment simulation, and valve recommendation
- Save the PDF from the system print/save dialog

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| “App is damaged” or won’t open | Run `xattr -cr .` in the app folder (see Terminal method above) |
| Blank window after login | Re-download the latest ZIP; keep `resources.neu` next to the app |
| PDF export fails | Ensure case measurements are entered; try Export PDF again |
| Permission denied on `.command` | Right-click → Open, or run `chmod +x Open-VenusP.command` |

---

## Technical requirements

- Mac with **Apple Silicon** (M1, M2, M3, or newer)
- **macOS 11 (Big Sur)** or later
- ~15 MB free disk space
- **No additional software installation required**

---

## Support

For clinical use, verify all outputs against the current VenusP-Valve IFU and institutional protocols.
