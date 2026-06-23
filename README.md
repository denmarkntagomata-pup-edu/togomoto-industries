# Togomoto Industries — demo website

A small but complete demo of a **used-vehicle dealership website** (used cars,
trucks, and heavy equipment) with a public storefront and an admin area. It runs
**entirely on your own computer** — nothing is published to the internet, and it
cannot be deployed. It exists so you can download it, run it locally, and click
around.

Built with **Astro 5** + **Cloudflare Workers** tooling, a local **SQLite (D1)**
database, and local file storage (**R2**). All names, contact details, photos,
and IDs are fictional placeholders.

> **You do not need to know how to code to run this.** Follow the steps below
> exactly, copying and pasting each command. If you can open VS Code, you can do
> this.

---

## 1. What you need to install first (prerequisites)

Install these **before** you start. Do them in order.

| # | What | Why you need it | Where to get it | How to check it worked |
|---|------|-----------------|-----------------|------------------------|
| 1 | **Node.js 20 LTS or newer** (22 LTS recommended) | Runs the website and all the commands. `npm` is included with it. | https://nodejs.org/ → click the big **LTS** button → run the installer, click *Next* through all defaults. | Open a terminal and type `node -v` → it should print `v20.x.x` or higher. |
| 2 | **VS Code** | The editor + a built-in terminal you'll type commands into. | https://code.visualstudio.com/ | It opens. |
| 3 | **Git** *(optional, only for `git clone`)* | Lets you download the project with one command. If you skip it, download the ZIP instead (see below). | https://git-scm.com/downloads → run installer, accept defaults. | `git -v` prints a version. |

After installing Node.js, **close and reopen VS Code** so it picks up the new
installation. On Windows you may need to restart the computer once for `node` to
be recognized everywhere.

> ⚠️ If `node -v` shows something **lower than v20** (or "not recognized"),
> Node.js isn't installed correctly. Reinstall it from the link above and
> reopen VS Code. Everything else depends on this working first.

---

## 2. Get the project onto your computer

You have two options. **Option A** is easiest if you installed Git.

### Option A — Clone with Git (recommended)
1. Open VS Code.
2. Open the terminal: top menu **Terminal → New Terminal** (or press `` Ctrl + ` ``).
3. Paste this and press **Enter** (this downloads it into a folder named
   `togomoto-industries`):
   ```bash
   git clone https://github.com/Solaris-CXVII/togomoto-industries.git
   ```
4. Move into the folder:
   ```bash
   cd togomoto-industries
   ```

### Option B — Download the ZIP (no Git needed)
1. Go to **https://github.com/Solaris-CXVII/togomoto-industries**.
2. Click the green **`< > Code`** button → **Download ZIP**.
3. Unzip it somewhere easy to find (e.g. your Desktop).
4. In VS Code: **File → Open Folder…** and select the unzipped
   `togomoto-industries` folder.
5. Open the terminal (**Terminal → New Terminal**). It should already be inside
   the project folder.

> 📍 **How do I know I'm in the right folder?** In the terminal, type `ls`
> (macOS/Linux) or `dir` (Windows). You should see files like `package.json`,
> `astro.config.mjs`, and folders like `src` and `public`.

---

## 3. Set it up (two ways — pick ONE)

### ✅ The easy way — run the setup script (does everything for you)

This installs dependencies, creates the config file, builds the local database,
and loads the demo data — all in one go.

**In the VS Code terminal**, run:
```bash
npm run setup
```

That's it. Wait for it to finish (a few minutes the first time — it's
downloading things). When it's done you'll see **"All done!"**. Skip to
[section 4](#4-run-the-website).

> Prefer not to use the terminal? On **Windows** you can instead double-click the
> **`setup.cmd`** file in the project folder. On **macOS/Linux** run `bash setup.sh`.

### 🔧 The manual way — run each command yourself

If you'd rather understand each step (or the script failed), run these **one at a
time**, waiting for each to finish before the next:

```bash
# 1) Download all the libraries the project needs (slowest step)
npm install

# 2) Create your local config file from the example
#    macOS / Linux:
cp .dev.vars.example .dev.vars
#    Windows (PowerShell):
copy .dev.vars.example .dev.vars

# 3) Build the local database (creates the tables)
npm run db:migrate:local

# 4) Fill the database with demo cars, trucks, parts, and announcements
npm run db:seed:local
```

---

## 4. Run the website

Start the local server:
```bash
npm run dev
```

You'll see a line like:
```
┃ Local    http://localhost:4321/
```

Open **http://localhost:4321** in your web browser (Ctrl/Cmd-click the link in
the terminal, or copy-paste it). 🎉

- The **public site** is at `http://localhost:4321`.
- The **admin area** is at `http://localhost:4321/admin` (no login in this local
  demo — that's expected).

**To stop the server:** click in the terminal and press **`Ctrl + C`**.
**To start it again later:** just run `npm run dev` again (you don't need to
repeat the setup).

---

## 5. Everyday commands (cheat sheet)

| I want to… | Command |
|------------|---------|
| Start the website | `npm run dev` |
| Stop the website | `Ctrl + C` in the terminal |
| Reset/reload the demo data | `npm run db:seed:local` |
| Re-run the whole setup from scratch | `npm run setup` |
| Check the code for type errors | `npm run check` |

---

## 6. Resetting the database

The demo data lives in a local file the tools manage for you. To wipe it and
reload the original demo inventory, just run the seed again:
```bash
npm run db:seed:local
```
If something gets badly stuck, you can delete the local state folder and re-run
setup:
```bash
# macOS / Linux
rm -rf .wrangler && npm run setup
# Windows (PowerShell)
Remove-Item -Recurse -Force .wrangler ; npm run setup
```

---

## 7. What's inside (quick tour)

```
togomoto-industries/
├─ src/
│  ├─ pages/          the website pages (home, about, products, admin, etc.)
│  ├─ components/     reusable pieces (nav, footer, cards, forms)
│  ├─ layouts/        page shells
│  ├─ lib/            data + helper logic
│  └─ db/             database schema + types
├─ public/            images, icons, robots.txt (placeholder logo/og images)
├─ drizzle/           database migrations
├─ scripts/           seed.sql (demo data) + setup.mjs (the setup script)
├─ .dev.vars.example  template for local config (you copy it to .dev.vars)
└─ package.json       the list of commands + dependencies
```

---

## 8. Troubleshooting

**`node` / `npm` is not recognized**
Node.js isn't installed or VS Code was open before you installed it. Install
Node 20+ from https://nodejs.org/, then fully close and reopen VS Code (or
restart your PC).

**`npm install` fails or hangs**
Usually a network issue. Check your internet, then run `npm install` again.

**"Port 4321 is already in use"**
The site is already running in another terminal. Stop it with `Ctrl + C`, or run
`npm run dev -- --port 4322` to use a different port.

**The pages show boxes instead of photos**
That's expected — the real photos were removed and replaced with neutral
placeholders. The site still works fully.

**Windows: "running scripts is disabled on this system"** (only if you tried
`setup.ps1`/double-click)
Use `npm run setup` in the VS Code terminal instead — it avoids that policy.

---

## 9. Good to know

- **This is a demo. It is not deployable** — there's no deploy command, no live
  domain, and no real secrets. It runs only on your machine.
- The **admin area is unlocked** on purpose for the local demo. Don't expose this
  on a network.
- The Turnstile (anti-bot) keys in `.dev.vars.example` are Cloudflare's public
  **TEST** keys — they always pass, so the contact form works offline.
- The placeholder images (`public/logo.svg`, `favicon.svg`, `og.svg`,
  `placeholder.svg`) and the gradient hero can be swapped for your own neutral
  imagery if you like.
