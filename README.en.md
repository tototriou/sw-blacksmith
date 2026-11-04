# SW Blacksmith

*[Français](README.md) · English*

A toolbox for Summoners War.

**Online: https://sw-forge.vercel.app** — and as a desktop app (Windows, Linux), from the site's
Download page. The app is available in French and English.

SW Blacksmith helps you prepare your competitive content: build your siege teams and check their
speed tuning, rank your monsters for RTA, analyze your runes and your account, find the best build
for a monster, share deck recommendations with your guild.

**Everything stays in your browser.** No server, no account, no sign-in: the account export you
import is read in the page and never sent anywhere. Nothing is kept without your consent, and
“Delete all” erases everything.

## Documentation

The documentation is written in French.

- **What the app does, how it is built**:
  [docs/01-presentation/](docs/01-presentation/README.md).
- **All the documentation**, page by page: [docs/README.md](docs/README.md). It is the functional
  source of truth: it says what each screen does and **why**, including the pitfalls already met and
  the decisions not to undo.
- **Contributing code** (stack, commands, working rules): [AGENTS.md](AGENTS.md).

## Getting started

```bash
nvm use              # Node 24, read from .nvmrc
npm install          # also installs the Git hooks (pre-commit, commit-msg)
npm run fetch-data   # monster and skill data (demo mode if the API is down)
npm run dev          # http://localhost:5173
```

## Contributing

No need to code to help. A bug, wrong data, a formula that doesn't match what the game shows, an
idea for a screen: open an **issue**. For a calculation disagreement, the most useful thing is a
**concrete case** — the monster, its values, and what the game shows. That is how the speed formula
was corrected.

Pull requests are welcome; for a substantial change, open an issue first so we can discuss it.
Before coding, read the documentation of what you touch: [AGENTS.md](AGENTS.md) says which.

The Optimizer's shared search, ranking and resolution path is described in
[the engine pipeline](docs/03-developpeur/optimizer/moteur/pipeline.md).

## Contact

A question, feedback or a specific request:
[**join the Discord**](https://discord.gg/R2Fe4GJZET).

## Built with

- [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vitejs.dev) — build and dev server
- [Tailwind CSS](https://tailwindcss.com) — styles
- [lucide-react](https://lucide.dev) — interface icons
- [framer-motion](https://www.framer.com/motion/) — animations
- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) — split-screen divider
- [Electron](https://www.electronjs.org) — desktop app
- Deployed on [Vercel](https://vercel.com): automatic deployment on `main`, preview per branch.

## Author

**Thomas** — [github.com/tototriou](https://github.com/tototriou) ·
[Discord](https://discord.gg/R2Fe4GJZET)

## Acknowledgements

- [SWARFARM](https://github.com/swarfarm/swarfarm) — monster data and game icons, made publicly
  available.
- [SW Exporter](https://github.com/Xzandro/sw-exporter) — the account export format that makes the
  import possible.

Game data and images © Com2uS. Unofficial project, not affiliated with Com2uS.
