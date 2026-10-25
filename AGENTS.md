# AGENTS.md — De/Het Nederlandse Context Trainer

## Project overview
Interactive web app that teaches Dutch noun gender (de/het) through contextual sentence exercises. Users select the correct modifier (possessive, adjective, demonstrative) that agrees with the hidden noun gender. Wrong answers trigger a 3-stage repair loop.

## Stack
- **Runtime:** Bun (package manager + scripts)
- **Framework:** React 19 + TypeScript 5.8
- **Bundler:** Vite 6
- **Validation:** Zod (data schemas)
- **Testing:** Playwright (E2E)
- **Audio:** Web Speech API (nl-NL) + Web Audio API (chimes)

## Conventions

### File structure
```
data/           JSON datasets + Zod schemas (single source of truth)
scripts/        One-shot CLI tools (validate, translate, etc.)
src/engine/     Pure logic, no React — session, queue, progress, ripple, mistakes
src/audio/      TTS + tone helpers, stateless
src/components/ React components — App shell, challenge screen, repair shop, settings
src/styles/     Single theme.css with CSS custom properties (light/dark/system)
tests/          Playwright E2E specs
```

### Data
- `data/nouns.json` — 15 nouns with article, translation, diminutive, grammatical rules
- `data/challenges.json` — 72 challenges across 5 levels, each with a `[modifier]` template
- `data/schema.ts` — Zod schemas for nouns, challenges, and ProgressStore
- Validate after any data change: `bun run validate`

### Components
- `ChallengeScreen` — state machine: `selecting → answered → (repairing) → selecting`
- `SentenceCanvas` — renders template with modifier highlighted; natural inline text flow (not flex per-word)
- `ModifierSlot` — two option buttons, randomised left/right order
- `RepairShop` — 3-stage repair: type-correct → structural-shift → contrast-duel
- `SettingsPanel` — theme, audio toggle, export/import progress JSON

### Engine
- `session.ts` — `createSession` uses `buildAdaptiveQueue` (mastery-weighted, see below)
- `ripple.ts` — deprecated; SentenceCanvas now handles its own rendering
- `progress.ts` — localStorage key `nl-context-v1`, versioned schema
- `mistakes.ts` — picks repair challenges from the master challenge list

### Adaptive queue algorithm
Per-noun mastery (0–1) determines how many challenges appear each session:
- `< 0.3` → all challenges for that noun
- `0.3–0.7` → ~75%
- `0.7–0.9` → 1–2
- `> 0.9` → 33% chance of 1 refresher

Challenges matching the noun's `mistakeType` are sorted first within each noun.

### Language
All user-facing text is in simple Dutch. Code comments and variable names are in English. Challenge explanations use Dutch grammatical terms (de-woord, het-woord, verkleinwoord, samenstelling).

### CSS
- Theme via `data-theme` attribute on `<html>`: `light`, `dark`, `system`
- System mode uses `@media (prefers-color-scheme: dark)` at top level (not nested)
- All colours are CSS custom properties (`--bg`, `--text`, `--accent`, etc.)
- Animations: `popLock`, `shakeX`, `fadeInUp` keyframes

## Commands
```bash
bun install          # install dependencies
bun run dev          # Vite dev server (localhost:5173)
bun run build        # tsc + vite build → dist/
bun run validate     # Zod-check nouns.json + challenges.json
bunx playwright test # 6 E2E tests (requires bun run dev running or uses webServer config)
```

## Do NOT
- Add English UI strings — everything user-facing is Dutch
- Nest `@media` inside CSS selector blocks
- Call `setPhase` or other state setters inside `useCallback` computations (side-effect free only)
- Mutate data in `data/` without running `bun run validate` after
- Use `process.exit` in scripts (throw instead)
- Import `fs` or Node builtins that need `@types/node` — use `Bun.write` if needed