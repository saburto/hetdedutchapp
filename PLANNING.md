# The Dutch Context Builder — Implementation Plan

## Decisions
- **Stack:** React + Vite + TypeScript
- **Scope:** 15 nouns, ~50 challenges across 5 levels, validator, playable prototype
- **Persistence:** localStorage versioned key + JSON export/import
- **Audio:** Web Speech API `nl-NL` TTS + Web Audio API chimes
- **Theme:** Light/dark/system via `data-theme` attribute

## File tree
```
hetdedutchapp/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── PLANNING.md
├── data/
│   ├── schema.ts            # Zod types for nouns & challenges
│   ├── nouns.json           # 15 high-frequency Dutch nouns
│   └── challenges.json      # ~50 context challenges (levels 01–05)
├── scripts/
│   └── validate-data.ts     # CI-ready data validator
└── src/
    ├── main.tsx
    ├── engine/
    │   ├── ripple.ts        # Sentence template interpolation
    │   ├── session.ts       # Challenge queue + level progression
    │   ├── mistakes.ts      # 3-stage repair loop
    │   └── progress.ts      # localStorage persistence layer
    ├── audio/
    │   └── audio.ts         # TTS speak(nl-NL) + chime/thud tones
    ├── components/
    │   ├── App.tsx
    │   ├── ChallengeScreen.tsx
    │   ├── SentenceCanvas.tsx
    │   ├── ModifierSlot.tsx
    │   ├── RepairShop.tsx
    │   ├── SettingsPanel.tsx
    │   └── ProgressDots.tsx
    └── styles/
        └── theme.css
```

## Data model (Zod schema)
- **Noun:** id, noun, article (de/het), translation, category, grammaticalRules[]
- **Challenge:** id, nounId, levelType, levelNumber, sentenceTemplate, options {correct, distractor}, explanation

## 5 Level types
1. **Possessive Pivot** — Ons (het) vs Onze (de)
2. **Adjective Snag** — Indefinite het drops trailing -e
3. **Demonstrative Shift** — Dit/Dat (het) vs Deze/Die (de)
4. **Diminutive Trap** — de→het via -je suffix, then demonstrative flips
5. **Compound Clash** — End-word gender dominance in compounds

## Engine design
- **Ripple engine:** takes template + answer → computes word-level segments with status
- **Session manager:** picks next challenge, scores answers, tracks level progress
- **Mistake loop:** 3-stage repair per failed noun (explicit correction → structural shift → contrast duel)
- **Progress store:** versioned localStorage, per-noun mastery float, export/import JSON

## UI flow
Landing → Challenge (sentence with [modifier] slot) → Selection → Ripple animation (lock/shatter) → Explanation subtitle → Progress update → Next challenge
Settings gear → theme toggle, audio toggle, export/import buttons