import json, sys
def flat(x, p=''):
    if isinstance(x, dict):
        for k, v in x.items(): yield from flat(v, f"{p}.{k}" if p else k)
    elif isinstance(x, list):
        if all(not isinstance(i,(dict,list)) for i in x): yield p, x
        else:
            for i, v in enumerate(x): yield from flat(v, f"{p}[{i}]")
    else: yield p, x
a = dict(flat(json.load(open(f"out/{sys.argv[1]}.json"))))
b = dict(flat(json.load(open(f"out/{sys.argv[2]}.json"))))
a.pop('tree'); b.pop('tree')
keys = sorted(set(a) | set(b)); diffs = [k for k in keys if a.get(k) != b.get(k)]
print(f"{sys.argv[1]} vs {sys.argv[2]}: {len(keys)} fields compared, {len(diffs)} differ")
for k in diffs: print(f"  {k}\n    {sys.argv[1]}: {json.dumps(a.get(k), ensure_ascii=False)[:300]}\n    {sys.argv[2]}: {json.dumps(b.get(k), ensure_ascii=False)[:300]}")
