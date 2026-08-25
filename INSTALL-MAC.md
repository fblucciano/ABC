# VenusP Planning Report — Mac Installation Guide (Apple Silicon)

**No extra software is required.** This ZIP is fully self-contained (no Node.js, Python, browser, or Java install).

---

## Which file to open

After unzipping, you will see these files:

| File | What it is |
|------|------------|
| **`Open-VenusP.command`** | **← OPEN THIS FILE** (launcher) |
| `VenusP-Planning-mac_arm64` | Application binary (do not open directly first) |
| `resources.neu` | Packed resources (must stay in the same folder) |
| `INSTALL-MAC.md` | This guide |
| `README.txt` | Quick start |

### Important

- **Always start with `Open-VenusP.command`**
- Do **not** double-click `VenusP-Planning-mac_arm64` on first use — macOS will block it
- Keep `resources.neu` in the **same folder** as the app

---

## Step 1 — Unzip

1. Download `VenusP-Desktop-Mac-AppleSilicon.zip`
2. Double-click the ZIP to extract the folder `VenusP-Desktop-Mac-AppleSilicon`
3. Move the folder to a permanent location (e.g. **Documents/VenusP** or **Applications**)

---

## Step 2 — First launch (macOS security)

macOS blocks apps that are not from the App Store. You only need to approve **once**.

### Method A — Right-click Open (try this first)

1. Open the folder `VenusP-Desktop-Mac-AppleSilicon`
2. Find **`Open-VenusP.command`**
3. **Right-click** (or Control-click) on **`Open-VenusP.command`**
4. Choose **Open** from the menu
5. In the dialog, click **Open** again

### Method B — Privacy & Security (if Method A does not work)

1. Try Method A once (macOS will block or warn you)
2. Open **System Settings** (Apple menu  → **System Settings**)
3. In the left sidebar, click **Privacy & Security**
4. **Scroll all the way down** to the **Security** section at the bottom of the page
5. Look for a message such as:
   - *"`Open-VenusP.command` was blocked because it is from an unidentified developer"*, or
   - *"`VenusP-Planning-mac_arm64` was blocked..."*
6. Click **Open Anyway** next to that message
7. Confirm by clicking **Open Anyway** in the popup
8. Double-click **`Open-VenusP.command`** again

### Method C — Terminal (if A and B fail)

1. Open **Terminal** (Applications → Utilities → Terminal)
2. Run (replace the path with your folder location):

```bash
cd ~/Documents/VenusP-Desktop-Mac-AppleSilicon
xattr -cr .
chmod +x Open-VenusP.command VenusP-Planning-mac_arm64
./Open-VenusP.command
```

`xattr -cr .` removes the macOS quarantine flag from downloaded files. You only need this once.

---

## Step 3 — Log in

- Password: `venus2026`
- Works **offline** after installation

---

## Daily use

1. Open the folder
2. Double-click **`Open-VenusP.command`**
3. Enter case data → click **Export PDF**

---

## PDF export

- Minimum **6 pages** (standard proforma)
- **Additional pages** are added automatically when you include many images
- Each image has **PDF layout controls** (height, full/half width) in the app

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Nothing happens when I double-click | Use **right-click → Open** on `Open-VenusP.command` |
| “App is damaged” or “cannot be opened” | Run Method C (`xattr -cr .`) in Terminal |
| Blank screen after login | Re-download the latest ZIP; keep `resources.neu` next to the app |
| Wrong Mac type | This ZIP is for **Apple Silicon only** (M1/M2/M3). Intel Macs need a different build. |

---

## Requirements

- Mac with **Apple Silicon** (M1, M2, M3, or newer)
- **macOS 11 (Big Sur)** or later
- ~15 MB disk space

---

Verify all clinical outputs against the current VenusP-Valve IFU and institutional protocols.
