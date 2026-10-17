"""Build the frozen v2 reference dataset (FL-PI-v2-research-0) used by the shadow engine.
Inputs: the Oct 12 2026 reconstruction workspace (pi-reconstruction-2026-10-12/data):
  fred/BAA10Y.csv, fred/TEDRATE.csv, fred/VIXCLS.csv (FRED, not revised), gspc.json (Yahoo ^GSPC),
  weekly_panel.csv (point-in-time weekly Sahm gap from ALFRED vintages + weekly raw pillars).
Cutoff: 2026-09-11 (last weekly grid date of the research study). Output is deterministic.
No parameter is fitted here; this only freezes the data the locked spec normalises against."""
import csv, json, sys, datetime as dt, hashlib
B = sys.argv[1] if len(sys.argv) > 1 else '/workspace/pi-reconstruction-2026-10-12/data/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'server/pressure/v2/reference/v2-reference-2026-09-11.json'
CUT = '2026-09-11'
# spxClose extends to 2026-09-14 so the research study's forward windows (ending <= 2026-09-14) are reproducible.
SPX_CUT = '2026-09-14'
def fred(s):
    d, v = [], []
    for r in list(csv.reader(open(B + 'fred/' + s + '.csv')))[1:]:
        if r[1] not in ('', '.') and r[0] <= CUT: d.append(r[0]); v.append(float(r[1]))
    return {'dates': d, 'values': v}
r = json.load(open(B + 'gspc.json'))['chart']['result'][0]
gs = [(dt.datetime.fromtimestamp(t, dt.timezone(dt.timedelta(hours=-5))).date().isoformat(), c)
      for t, c in zip(r['timestamp'], r['indicators']['quote'][0]['close']) if c is not None]
gc = [c for _, c in gs]
dd_d, dd_v = [], []
for i, (d, c) in enumerate(gs):
    if d > CUT: break
    hi = max(gc[max(0, i - 251):i + 1]); dd_d.append(d); dd_v.append(100 * (1 - c / hi))
weekly = {k: [] for k in ['date', 'credit_raw', 'funding_raw', 'vol_raw', 'mkt_raw', 'macro_raw', 'v2']}
for row in csv.DictReader(open(B + 'weekly_panel.csv')):
    if row['date'] > CUT: continue
    for k in weekly:
        x = row[k]
        weekly[k].append(x if k == 'date' else (None if x == '' else float(x)))
ref = {
    'specId': 'FL-PI-v2-research-0',
    'specSha256': '3ce5661ed0929fb391aca67329a8d339ecea54ee2edbb225f2e99c8569910b82',
    'cutoff': CUT,
    'sources': {'credit': 'FRED BAA10Y', 'funding': 'FRED TEDRATE (discontinued 2022-01-21)', 'vol': 'FRED VIXCLS',
                'mkt': 'Yahoo ^GSPC closes -> drawdown from trailing 252-session high (%)',
                'macro': 'weekly_panel.csv macro_raw: real-time Sahm-type gap from ALFRED UNRATE vintages'},
    'daily': {'credit': fred('BAA10Y'), 'funding': fred('TEDRATE'), 'vol': fred('VIXCLS'), 'mkt': {'dates': dd_d, 'values': dd_v}},
    'spxClose': {'dates': [d for d, _ in gs if d <= SPX_CUT], 'values': [c for d, c in gs if d <= SPX_CUT]},
    'weekly': weekly,
}
s = json.dumps(ref, separators=(',', ':'))
open(OUT, 'w').write(s)
print(OUT, len(s), 'bytes sha256', hashlib.sha256(s.encode()).hexdigest())
