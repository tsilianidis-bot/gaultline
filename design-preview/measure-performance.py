#!/usr/bin/env python3
"""Compare fresh compiled preview pages; lab observations are not field or real-device guarantees."""
import argparse
import gzip
import json
import pathlib
import shutil
import time
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:4173/?state=demo')
parser.add_argument('--output', default='/home/ubuntu/faultline-deliverables/compiled-performance.json')
parser.add_argument('--assets', default='.design-preview-dist/assets')
parser.add_argument('--cpu-rate', type=float, default=1)
parser.add_argument('--width', type=int, default=1440)
parser.add_argument('--height', type=int, default=1000)
args = parser.parse_args()
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':args.width,'height':args.height})
    page = context.new_page()
    cdp = context.new_cdp_session(page)
    cdp.send('Emulation.setCPUThrottlingRate', {'rate':args.cpu_rate})
    page.add_init_script("""window.__layoutShifts=[];window.__lcp=[];new PerformanceObserver(l=>{for(const x of l.getEntries()) if(!x.hadRecentInput)window.__layoutShifts.push(x.value)}).observe({type:'layout-shift',buffered:true});new PerformanceObserver(l=>window.__lcp.push(...l.getEntries().map(x=>x.startTime))).observe({type:'largest-contentful-paint',buffered:true});""")
    start = time.monotonic()
    page.goto(args.url,wait_until='networkidle')
    page.locator('.fic-core-readout').wait_for()
    ready_ms = (time.monotonic()-start)*1000
    cdp.send('Performance.enable')
    metrics = lambda:{m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
    before = metrics()
    page.wait_for_timeout(1500)
    after = metrics()
    result = {
        'environment':f'Fresh headless Chromium, compiled standalone preview, {args.cpu_rate:g}x CPU throttle; local network, lab observation only, not production RUM or a real-device guarantee',
        'viewport':{'width':args.width,'height':args.height},
        'readyIncludingNetworkIdleMs':ready_ms,
        'paint':page.evaluate('performance.getEntriesByType("paint").map(x=>({name:x.name,ms:x.startTime}))'),
        'largestContentfulPaintMs':page.evaluate('Math.max(0,...window.__lcp)'),
        'layoutShiftSum':page.evaluate('window.__layoutShifts.reduce((a,b)=>a+b,0)'),
        'renderedDomElements':page.locator('*').count(),
        'svgElements':page.locator('svg').count(),
        'canvasElements':page.locator('canvas').count(),
        'activeIdleAnimations':page.evaluate('document.getAnimations().length'),
        'freshJsHeapUsedBytes':after.get('JSHeapUsedSize'),
        'idleTaskSecondsOver1500ms':after.get('TaskDuration',0)-before.get('TaskDuration',0),
        'idleScriptSecondsOver1500ms':after.get('ScriptDuration',0)-before.get('ScriptDuration',0),
        'assets':[{'file':f.name,'bytes':f.stat().st_size,'gzipBytes':len(gzip.compress(f.read_bytes(),mtime=0))} for f in pathlib.Path(args.assets).iterdir() if f.is_file()],
    }
    opener=page.locator('.fic-domain').first
    opener.click()
    page.get_by_role('dialog').wait_for()
    result['evidenceDrawerWorksOnCompiledPreview']=page.get_by_role('dialog').is_visible()
    page.keyboard.press('Escape')
    page.get_by_role('dialog').wait_for(state='hidden')
    result['focusRestoredOnCompiledPreview']=opener.evaluate('(node)=>node===document.activeElement')
    result['allRequestsLocal']=page.evaluate('performance.getEntriesByType("resource").every(r=>new URL(r.name).origin===location.origin)')
    context.close()
    browser.close()
pathlib.Path(args.output).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
