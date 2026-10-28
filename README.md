# De/Het — Nederlandse Context Trainer

Leer het geslacht van Nederlandse zelfstandige naamwoorden niet met stomme flashcards, maar door te **voelen** hoe de of het door de hele zin rimpelt.

---

## Hoe het werkt

Je ziet een Nederlandse zin met een gat waar een bijvoeglijk naamwoord, bezittelijk voornaamwoord of aanwijzend voornaamwoord hoort. Jij kiest de juiste vorm. Kies je fout, dan zie je meteen **waarom** — en de app helpt je met een 3-staps hersteltraject.

```
"___ stoel is helaas kapot."
      └──┬──┘
  ┌──────┴──────┐
  ▼             ▼
┌──────┐    ┌──────┐
│ Ons  │    │ Onze │  ← welke past bij 'stoel'?
└──────┘    └──────┘
```

## Zeven niveaus

| Niveau | Mechaniek | Voorbeeld |
|--------|-----------|-----------|
| 1 | Lidwoord (de/het) | [De / Het] auto is rood. |
| 2 | Bezittelijk (ons/onze) | [Ons / Onze] kind speelt buiten. |
| 3 | Bijvoeglijk naamwoord (wel/geen -e) | een [groot / grote] huis |
| 4 | Aanwijzend (dit/deze, dat/die) | Is [dit / deze] stoel bezet? |
| 5 | Verkleinwoord (de→het) | De auto → **het** autootje |
| 6 | Samenstelling (laatste woord bepaalt) | De tafel + Het laken = Het tafellaken |
| 7 | Absurde zinnen (spreek & luister) | Het schaap vloog over het dak. |

## Wat het anders maakt

- **Geen losse woordjes** — elke oefening staat in een volledige zin
- **Adaptieve wachtrij** — woorden die je lastig vindt komen vaker terug, woorden die je kent verschijnen minder
- **Zinsherstel** — na een fout typ je de juiste zin na, dan krijg je hetzelfde woord in een andere structuur, daarna een contrastduel
- **Nederlandse spraak** — de app leest elke zin hardop voor (Web Speech API, nl-NL)
- **Absurde zinnen** — niveau 7 toont een gekke zin woord voor woord, leest hem voor en laat je hem hardop naspreken via Chrome-spraakherkenning, met directe feedback op de/het
- **Donker thema** — licht/donker/systeem, geen gedoe
- **Rondleiding** — klik op de `?` knop rechtsboven voor een interactieve tour door de app

## Snel starten

```bash
bun install
bun run dev        # opent http://localhost:5173
```

## Scripts

```bash
bun run dev         # ontwikkelserver
bun run build       # productiebuild → dist/
bun run validate    # controleert alle datasets op fouten
bunx playwright test # E2E tests
```

## Structuur

```
data/               # 100 zelfstandige naamwoorden + 346 oefeningen + 15 zinnen + Zod-schema's
src/engine/         # pure logica: wachtrij, voortgang, zinsherstel
src/components/     # React-componenten
src/audio/          # spraak en geluidjes
src/styles/         # thema (licht/donker/systeem)
tests/              # Playwright E2E
```

## Voortgang bewaren

Je voortgang wordt automatisch opgeslagen in je browser (localStorage). Via het instellingenmenu (⚙️) kun je je voortgang exporteren als JSON en later weer importeren — handig als je van apparaat wisselt.

## Technisch

- **Stack:** React 19, TypeScript, Vite, Bun
- **Validatie:** Zod (alle datasets worden bij elke wijziging gecheckt)
- **Audio:** Web Speech API (Nederlandse stem) + Web Audio API (toontjes)
- **Progressie:** adaptieve wachtrij op basis van beheersingsscore per woord
- **Tests:** Playwright E2E (Chromium headless)