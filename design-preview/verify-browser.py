#!/usr/bin/env python3
"""Read-only verification of the isolated frontend. Requires Playwright and axe-core JS."""
import argparse
import json
import pathlib
import shutil
import time
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:4173')
parser.add_argument('--out', default='/home/ubuntu/faultline-deliverables')
parser.add_argument('--axe', default='/home/ubuntu/faultline-test-tools/package/axe.min.js')
args = parser.parse_args()
out = pathlib.Path(args.out)
out.mkdir(parents=True, exist_ok=True)
results = {'checks': [], 'accessibility': [], 'responsive': [], 'performance': {}, 'consoleErrors': [], 'productionApiRequests': []}


def check(name, condition, details=None):
    results['checks'].append({'name': name, 'passed': bool(condition), 'details': details})


def accessibility(page, name):
    page.add_script_tag(path=args.axe)
    report = page.evaluate("""async () => { const r = await axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}); return {violations:r.violations.map(x=>({id:x.id,impact:x.impact,description:x.description,nodes:x.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),passes:r.passes.length,incomplete:r.incomplete.map(x=>x.id)}; }""")
    results['accessibility'].append({'state': name, **report})
    check(f'axe WCAG A/AA: {name}', not report['violations'], report['violations'])


def open_state(page, state):
    page.goto(args.url + '/?state=' + state, wait_until='networkidle')
    page.locator('.fic-core-readout').wait_for()


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1, record_video_dir=str(out / 'interaction-video'), record_video_size={'width': 1440, 'height': 1000})
    page = context.new_page()
    page.on('pageerror', lambda error: results['consoleErrors'].append(str(error)))
    page.on('request', lambda request: results['productionApiRequests'].append(request.url) if '/api/' in request.url else None)
    open_state(page, 'unavailable')
    check('Production-safe default masks pressure', page.locator('.fic-pressure-number').inner_text().strip().startswith('—'))
    check('Unavailable regime is explicit', page.locator('.fic-core-regime').inner_text() == 'Regime unavailable')
    check('All six unavailable nodes available', page.locator('.fic-domain').count() == 6)
    page.screenshot(path=str(out / 'desktop-unavailable.png'), full_page=True)
    accessibility(page, 'unavailable')

    open_state(page, 'demo')
    check('Demo banner explicit', 'Not live market intelligence' in page.locator('.fic-demo-notice').first.inner_text())
    check('Fictional pressure is isolated', '62.4' in page.locator('.fic-pressure-number').inner_text())
    check('Six statuses visible in legend', page.locator('.fic-status-legend .fic-status').count() == 6)
    page.screenshot(path=str(out / 'desktop-core.png'), full_page=True)
    accessibility(page, 'mixed demonstration')
    domain = page.locator('.fic-domain').first
    domain.focus()
    domain.press('Enter')
    page.get_by_role('dialog').wait_for()
    check('Keyboard opens domain evidence', 'Liquidity Stress' in page.get_by_role('dialog').inner_text())
    check('Evidence retains original observation', 'Observation' in page.get_by_role('dialog').inner_text())
    check('Developing-since and history shown', 'Developing since' in page.get_by_role('dialog').inner_text() and 'Historical comparison' in page.get_by_role('dialog').inner_text())
    for _ in range(7):
        page.keyboard.press('Tab')
    check('Drawer traps keyboard focus', page.evaluate("Boolean(document.activeElement.closest('[role=dialog]'))"))
    page.screenshot(path=str(out / 'desktop-evidence.png'), full_page=True)
    accessibility(page, 'evidence drawer')
    page.keyboard.press('Escape')
    page.get_by_role('dialog').wait_for(state='hidden')
    check('Escape restores domain focus', domain.evaluate('(node) => node === document.activeElement'))

    tabs = page.get_by_role('tablist', name='Scenario paths')
    tabs.get_by_role('tab').first.focus()
    page.keyboard.press('End')
    selected = tabs.get_by_role('tab', selected=True)
    check('Keyboard selects Scenario C', 'C' in selected.inner_text())
    check('Scenario C never favored', 'Favored' not in selected.inner_text())
    check('Scenario selects connected domains', page.locator('.fic-domain--selected').count() == 3)
    page.locator('.fic-scenario-panel').screenshot(path=str(out / 'scenario-c.png'))
    page.locator('.fic-scenario-panel').get_by_role('button', name='Review evidence').click()
    page.get_by_role('dialog').wait_for()
    check('Scenario evidence drawer works', 'scenario evidence' in page.get_by_role('dialog').inner_text())
    page.keyboard.press('Escape')
    page.get_by_role('dialog').wait_for(state='hidden')

    open_state(page, 'degraded')
    check('Degraded current pressure withheld', page.locator('.fic-pressure-number').inner_text().strip().startswith('—'))
    check('Degraded regime withheld', page.locator('.fic-core-regime').inner_text() == 'Regime unavailable')
    page.screenshot(path=str(out / 'desktop-degraded.png'), full_page=True)
    accessibility(page, 'degraded demonstration')

    open_state(page, 'records')
    check('Example record provenance explicit', page.locator('.fic-demo-badge').count() == 3)
    page.locator('.fic-disclosure-button').first.click()
    check('Record lineage expands', page.locator('.fic-disclosure-button').first.get_attribute('aria-expanded') == 'true')
    page.locator('.fic-track-record-panel').screenshot(path=str(out / 'track-record.png'))
    page.get_by_role('tab', name='Reconstructed', exact=False).click()
    check('Reconstructed cohort separated', page.locator('.fic-record-row').count() == 1)
    check('No fabricated metrics', page.locator('.fic-metric').count() == 0)
    accessibility(page, 'track record demonstration')

    for width in [360, 390, 768, 1024, 1440, 1920]:
        page.set_viewport_size({'width': width, 'height': 900})
        open_state(page, 'demo')
        overflow = page.evaluate('document.documentElement.scrollWidth > window.innerWidth')
        targets = page.locator('.fic-domain').evaluate_all('(nodes) => nodes.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height}))')
        results['responsive'].append({'width': width, 'horizontalOverflow': overflow, 'domainTargets': targets})
        check(f'No horizontal overflow at {width}px', not overflow)
        check(f'Domain touch targets >=44px at {width}px', all(t['width'] >= 44 and t['height'] >= 44 for t in targets))
        if width == 390:
            page.screenshot(path=str(out / 'mobile-full.png'), full_page=True)
            page.locator('.fic-topology-section').screenshot(path=str(out / 'mobile-core.png'))
            accessibility(page, 'mobile mixed demonstration')
            page.locator('.fic-domain').first.click()
            page.get_by_role('dialog').wait_for()
            page.screenshot(path=str(out / 'mobile-evidence.png'))
            check('Mobile drawer fits viewport', page.get_by_role('dialog').evaluate('(node) => node.getBoundingClientRect().width <= window.innerWidth'))
            page.keyboard.press('Escape')
            page.get_by_role('dialog').wait_for(state='hidden')

    page.set_viewport_size({'width': 1440, 'height': 1000})
    open_state(page, 'demo')
    page.emulate_media(reduced_motion='reduce')
    reduced = page.locator('.fic-domain').first.evaluate('(node) => getComputedStyle(node).transitionDuration')
    check('Reduced motion disables transitions', all(float(v.strip().removesuffix('s')) == 0 for v in reduced.split(',')))
    check('No idle market motion', page.evaluate('document.getAnimations().length') == 0)
    cdp = context.new_cdp_session(page)
    cdp.send('Performance.enable')
    before = {m['name']: m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
    started = time.monotonic()
    page.wait_for_timeout(1500)
    elapsed = time.monotonic() - started
    after = {m['name']: m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
    results['performance'] = {
        'environment': 'Headless Chromium, development Vite server, unthrottled sandbox; not production RUM or a low-end-device guarantee',
        'idleWindowSeconds': elapsed,
        'idleTaskSeconds': after.get('TaskDuration', 0) - before.get('TaskDuration', 0),
        'idleScriptSeconds': after.get('ScriptDuration', 0) - before.get('ScriptDuration', 0),
        'domNodes': after.get('Nodes'),
        'jsHeapUsedBytes': after.get('JSHeapUsedSize'),
        'activeIdleAnimations': page.evaluate('document.getAnimations().length'),
        'svgElements': page.locator('svg').count(),
        'canvasElements': page.locator('canvas').count(),
        'resources': page.evaluate('performance.getEntriesByType("resource").map(r=>({name:r.name,transferSize:r.transferSize,duration:r.duration}))'),
    }
    check('No browser runtime errors', not results['consoleErrors'], results['consoleErrors'])
    check('No production/provider API requests', not results['productionApiRequests'], results['productionApiRequests'])
    page.wait_for_timeout(300)
    video = page.video
    context.close()
    if video:
        video.save_as(str(out / 'intelligence-core-interactions.webm'))
    browser.close()

results['passed'] = all(item['passed'] for item in results['checks'])
(out / 'browser-validation.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps({k: results[k] for k in ['passed', 'checks', 'accessibility', 'responsive', 'performance']}, indent=2))
raise SystemExit(0 if results['passed'] else 1)
