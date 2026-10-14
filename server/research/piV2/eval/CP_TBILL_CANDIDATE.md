# CP minus T-bill — candidate notes

Spec id for this note: `FL-PI-v2-funding-candidate-cp-tbill-NOT-FROZEN`.

This file is research only. `FL-PI-v2-research-0` does not accept the spread as a funding pillar. The calculator throws if `DCPF3M`, `DTB3`, or `CP_TBILL` is placed in an official panel, and the official raw store rejects those series ids.

## Definition

- Commercial paper: FRED `DCPF3M` (3-month AA financial commercial paper yield).
- Treasury bill: FRED `DTB3` (3-month Treasury bill secondary-market rate, discount basis).
- Spread: `DCPF3M - DTB3` on dates where both prints exist.
- Missing dates are left missing. The script does not carry the previous spread forward.

`DTB3` is a discount rate and `DCPF3M` is a yield. That basis difference is one reason this candidate needs its own approval. It is not a silent continuation of TED.

## Event rule from the validation protocol

Target `T-LIQ` asks whether the spread stays at or above a preregistered threshold for at least five consecutive sessions, inside a 30-day horizon.

No threshold is stored in this candidate. Passing `--threshold` prints a descriptive streak count and still sets `claim` to `NONE`, `pass` to null, and `evaluable` to false. A threshold has to be written down before the series is studied for a pass or fail, under a new spec id.

## How to run

```bash
pnpm exec tsx server/research/piV2/eval/cpTbillCandidate.ts
pnpm exec tsx server/research/piV2/eval/cpTbillCandidate.ts --cp cp.json --tbill tbill.json
```

Without input files the script prints the unevaluable candidate record. It does not download data and it does not write the forward ledger.
