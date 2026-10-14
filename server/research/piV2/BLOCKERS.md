# Unresolved blockers

These items are open on purpose. This branch does not close them.

1. The SQL migration is in the repository and is not applied to any database. Production Railway is unchanged.
2. The Friday tick is not registered in `server/_core/index.ts` and the enablement gate defaults to off. A production or Railway environment cannot open that gate.
3. No live FRED pull was made for this change. Daily capture stays behind the disabled tick.
4. The 2000-01-07 through 2026-09-11 golden weekly panel described in the research spec is not in this repository. Tests lock the formula, the hash, and synthetic cases. They do not claim a zero-mismatch replay against that panel.
5. ALFRED unemployment vintages are not vendored. A single current FRED vintage is labeled `CURRENT_VINTAGE_FORWARD_ONLY` and does not satisfy the five-year real-time history rule, so the unemployment pillar stays unavailable until that history is loaded.
6. Full ICE BofA high-yield OAS history, CDS, and FRA-OIS need licenses. They are documented in `LICENSING.md` and are not purchased.
7. FRED high-yield OAS is only the window that starts 2023-10-16. It is stored, labeled, and excluded from the score.
8. Funding has no approved successor. CP minus T-bill is a separate candidate script, not part of the frozen spec.
9. The NBER peak list embedded for evaluation stops at February 2020. A later peak needs a new list id.
10. `T-BANK` has no preregistered event list, so that target stays unevaluable.
11. Forward evidence does not exist yet. The first official Friday is 2026-10-16. Promotion still requires two years of forward Fridays and three forward T-EQ10 events, which this branch cannot create.
12. OFR FSI was not downloaded.
13. PLATO is not wired to v2. No public route returns v2 scores.
