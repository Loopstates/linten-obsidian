# Release Guide — Linten Obsidian Plugin

> **Internal Developer Manual for Loopstates Team**  
> This guide outlines how dual-repository releases work for the closed-source Linten Obsidian plugin.

---

## 🏛️ Repository Architecture

To protect our proprietary TypeScript source code while remaining 100% compliant with the official Obsidian Community Plugin directory, we operate on a **dual-repository architecture**:

| Repository | Visibility | Purpose |
| :--- | :--- | :--- |
| **`Loopstates/linten-obsidian-source`** | 🔒 **Private** | Contains all TypeScript source code (`src/`), build tools, internal configurations, and development history. |
| **`Loopstates/linten-obsidian`** | 🌐 **Public** | Clean distribution repository containing **only** compiled release assets (`main.js`, `manifest.json`, `styles.css`, `README.md`, `LICENSE`). Zero source code. |

---

## 🚀 How to Publish a New Release (1 Single Command)

Whenever you add new features, fix bugs, or polish styles in this private repository, **never manually copy files or manage two repositories**.

Simply run the automated release command from the root of this repository:

```bash
npm run release <version> "[optional release description]"
```

### Example:
```bash
npm run release 1.0.4 "feat: real-time link health caching and mobile improvements"
```

---

## ⚙️ What the Automated Script Does (In ~3 Seconds):

1. **Version Bumping**: Automatically updates `"version": "x.y.z"` in both `package.json` and `manifest.json`.
2. **Byte-for-Byte Production Build**: Runs `npm run build` using `esbuild` to compile a clean, non-obfuscated `main.js`.
3. **Private Source Repository**:
   - Commits changes (`chore: release vx.y.z`).
   - Creates git tag `x.y.z`.
   - Pushes branch `main` and tags to `Loopstates/linten-obsidian-source`.
4. **Public Distribution Repository**:
   - Copies `main.js`, `manifest.json`, `styles.css`, `README.md`, and `LICENSE` to `../obsidian-public`.
   - Commits distribution files.
   - Creates git tag `x.y.z`.
   - Pushes branch `main` and tags to `Loopstates/linten-obsidian`.
5. **Local Obsidian Test Vault**:
   - Automatically synchronizes the fresh `main.js`, `manifest.json`, and `styles.css` directly into your local Obsidian test vault (`.obsidian/plugins/linten/`) so you can test live immediately.
6. **One-Click Release URL**:
   - Outputs the direct GitHub link to finalize the release on `Loopstates/linten-obsidian`.

---

## 📋 Final Step: Publish Release on GitHub

After the script finishes, visit the generated link (or navigate to `https://github.com/Loopstates/linten-obsidian/releases/new`):
1. **Tag**: `x.y.z` (already created by the script).
2. **Title**: `vx.y.z - [Feature Title]`
3. **Assets**: Verify that `main.js`, `manifest.json`, and `styles.css` are attached.
4. Click **Publish release**.

Obsidian's automated review bot will build from the private source repo, verify byte-for-byte parity with the public release, and award the **"Private source reviewed"** compliance badge.
