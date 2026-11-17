# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/danzturuu51/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/danzturuu51/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks 226 pre-token protocols by implied value, from a sealed
DeFiLlama snapshot (2026-11-14): the 40 watchlist protocols, plus 186 early
finds below the $50M TVL floor. Every protocol gets an implied value from
its own figures — TVL times a sector multiple, seven-day momentum, age and
chain breadth — and a 7-step farm plan with a concrete cost and time for
each step. The dashboard is a dark radar screen: search, category and chain
filters, a watchlist toggle, five sort keys, a live-token comparison tab,
and a detail drawer that recomputes the model in the page and shows the
farm plan. No names are hard-coded anywhere; the model is printed in full
on the page so anyone can audit it.

## Run it

```sh
node main.ts --input input/snapshot.json --output out
```

The snapshot is the sealed `input/snapshot.json` from the competition kit.
`main.ts` (Node 22, standard library only, no network) writes
`out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and
`out/dossier.json`. Two runs write byte-identical outputs.

---

Entered on [make.fun](https://make.fun/?ref=kjcabbnq&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
