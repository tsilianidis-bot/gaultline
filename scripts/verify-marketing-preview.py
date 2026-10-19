#!/usr/bin/env python3
"""Read-only marketing verification through the existing Sandbox browser's CDP.

No browser is launched. The target is localhost only. No product evidence fixtures,
login, checkout, production API or database are used. Run with Vite (or its static
production preview) listening on port 3000 and the browser on port 9222.
"""
import json
import os
import subprocess
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUTPUT = Path(os.environ.get('MARKETING_CAPTURE_OUTPUT', '/home/ubuntu/marketing-deliverables'))
OUTPUT.mkdir(exist_ok=True)
ORIGIN = os.environ.get('MARKETING_PREVIEW_ORIGIN', 'http://127.0.0.1:3000')
if not ORIGIN.startswith('http://127.0.0.1:'):
    raise ValueError('Verification origin must be an isolated loopback preview.')
AXE = Path('/home/ubuntu/marketing-audit-tools/node_modules/axe-core/axe.min.js')
checks = []

def check(name, condition, detail=None):
    checks.append({'name': name, 'passed': bool(condition), 'detail': detail})
    print(('PASS ' if condition else 'FAIL ') + name, flush=True)

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp('http://127.0.0.1:9222')
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, device_scale_factor=1)
    page = context.new_page()
    errors = []
    requests = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: requests.append({'url': request.url, 'method': request.method}))
    page.goto(ORIGIN, wait_until='domcontentloaded')
    page.locator('.mp-hero').wait_for(state='visible', timeout=60000)
    page.evaluate('document.fonts.ready')
    check('Public headline visible without cinematic', page.locator('h1').is_visible() and page.locator('[aria-label="Skip introduction"]').count() == 0)
    check('Exactly one h1', page.locator('h1').count() == 1)
    check('Exactly six reused domain buttons', page.locator('.mp-illustration .fic-domain').count() == 6)
    check('No simulated Pressure Index score in the architecture', page.locator('.mp-illustration .fic-pressure-value').count() == 0)
    check('Public guest CTA remains /pressure-index', page.locator('.mp-hero-actions a').first.get_attribute('href') == '/pressure-index')
    # Decline optional analytics only in this disposable local context.
    decline = page.get_by_role('button', name='DECLINE', exact=True)
    try:
        decline.wait_for(state='visible', timeout=5000)
        decline.click()
    except Exception:
        pass
    page.mouse.move(10, 10)
    page.screenshot(path=str(OUTPUT / 'desktop-homepage.png'), full_page=True)
    page.locator('.mp-hero').screenshot(path=str(OUTPUT / 'desktop-hero.png'))
    page.locator('#product-showcase').screenshot(path=str(OUTPUT / 'desktop-showcase.png'))
    check('No horizontal overflow on desktop', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    domain = page.locator('.mp-illustration .fic-domain').first
    domain.scroll_into_view_if_needed()
    domain.focus()
    expect(page.locator('.mp-domain-context')).to_contain_text('Liquidity Stress')
    check('Keyboard domain explanation', page.locator('.mp-domain-context').text_content().find('Liquidity Stress') >= 0)
    domain.press('Enter')
    check('Tap/Enter opens educational domain dialog', page.get_by_role('dialog').is_visible())
    page.screenshot(path=str(OUTPUT / 'desktop-domain-explanation.png'))
    page.keyboard.press('Escape')
    page.get_by_role('dialog').wait_for(state='hidden')
    page.wait_for_function('document.activeElement.classList.contains("fic-domain")')
    check('Escape closes dialog and restores keyboard focus', page.get_by_role('dialog').count() == 0 and domain.evaluate('(element) => document.activeElement === element'))
    page.get_by_role('button', name='Pause illustrative animation').click()
    check('Pause control suspends CSS motion', page.locator('.mp-illustration').get_attribute('data-motion') == 'paused')
    page.get_by_role('button', name='Resume illustrative animation').click()
    page.emulate_media(reduced_motion='reduce')
    page.wait_for_function('document.querySelector(".mp-illustration").dataset.motion === "paused"')
    check('Reduced-motion setting suspends illustration', page.locator('.mp-illustration').get_attribute('data-motion') == 'paused')
    check('Reduced motion removes animated organization path', page.locator('.fic-connection--organization').first.evaluate('(element) => getComputedStyle(element).animationName') == 'none')
    page.emulate_media(reduced_motion='no-preference')
    page.locator('#access').scroll_into_view_if_needed()
    page.wait_for_function('document.querySelector(".mp-illustration").dataset.motion === "paused"')
    check('Offscreen hero motion is suspended', page.locator('.mp-illustration').get_attribute('data-motion') == 'paused')
    check('Both existing checkout controls remain disabled', page.locator('[data-checkout-coming-soon]:disabled').count() == 2)
    check('Standard and Lifetime prices unchanged', '$99/month' in page.locator('#access').inner_text() and '$1,500 one-time' in page.locator('#access').inner_text())
    check('No registration/checkout links added by marketing', page.locator('.mp-hero a[href*="checkout"], .mp-hero a[href*="register"], #product-showcase a[href*="checkout"]').count() == 0)
    page.locator('#access').screenshot(path=str(OUTPUT / 'desktop-membership.png'))
    gallery_buttons = page.locator('.mp-showcase-selectors button, .mp-showcase-tabs button, [data-showcase-selector]')
    if gallery_buttons.count() == 0:
        gallery_buttons = page.locator('#product-showcase button[aria-pressed]')
    check('Five product gallery selectors', gallery_buttons.count() == 5)
    for index in range(gallery_buttons.count()):
        gallery_buttons.nth(index).click()
        page.locator('#product-showcase-stage').screenshot(path=str(OUTPUT / f'gallery-entry-{index + 1}-desktop.png'))
        check(f'Gallery selection {index + 1} remains capture-pending', 'VERIFIED CAPTURE PENDING' in page.locator('#product-showcase').inner_text())
    if gallery_buttons.count(): gallery_buttons.first.click()
    page.set_viewport_size({'width': 768, 'height': 1024})
    check('No horizontal overflow on tablet', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    page.set_viewport_size({'width': 390, 'height': 844})
    page.evaluate('window.scrollTo(0, 0)')
    check('No horizontal overflow on mobile', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    check('Six domain controls remain visible on mobile', all(page.locator('.mp-illustration .fic-domain').nth(i).is_visible() for i in range(6)))
    page.get_by_role('button', name='Open navigation').click()
    page.get_by_role('navigation', name='Mobile landing navigation').wait_for(state='visible')
    check('Mobile navigation opens', page.get_by_role('navigation', name='Mobile landing navigation').is_visible())
    page.get_by_role('navigation', name='Mobile landing navigation').get_by_role('link', name='MEMBERSHIP', exact=True).click()
    page.get_by_role('navigation', name='Mobile landing navigation').wait_for(state='hidden')
    check('Mobile navigation closes after selection', page.get_by_role('navigation', name='Mobile landing navigation').count() == 0)
    page.evaluate('window.scrollTo(0,0)')
    page.screenshot(path=str(OUTPUT / 'mobile-homepage.png'), full_page=True)
    page.locator('.mp-hero').screenshot(path=str(OUTPUT / 'mobile-hero.png'))
    page.locator('#product-showcase').screenshot(path=str(OUTPUT / 'mobile-showcase.png'))
    for index in range(gallery_buttons.count()):
        gallery_buttons.nth(index).click()
        page.locator('#product-showcase-stage').screenshot(path=str(OUTPUT / f'gallery-entry-{index + 1}-mobile.png'))
    if gallery_buttons.count(): gallery_buttons.first.click()
    check('Pending captures expose no expansion, viewport or zoom controls', page.locator('.product-showcase__expand, .product-showcase__viewport-controls, .product-showcase__zoom-controls').count() == 0)
    if AXE.exists():
        page.add_script_tag(path=str(AXE))
        accessibility = page.evaluate('async () => await axe.run(document, {runOnly: {type:"tag", values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}})')
        (OUTPUT / 'accessibility-results.json').write_text(json.dumps(accessibility, indent=2))
        check('WCAG 2.1 A/AA automated axe scan', len(accessibility['violations']) == 0, [{'id': v['id'], 'impact': v['impact'], 'count': len(v['nodes'])} for v in accessibility['violations']])
    check('No browser runtime exceptions', len(errors) == 0, errors)
    check('No production FAULTLINE/Railway/Stripe requests', not any('getfaultline.live/api' in r['url'] or 'railway' in r['url'] or 'stripe.com' in r['url'] for r in requests))
    check('No state-changing application requests', not any(r['method'] not in ('GET', 'HEAD', 'OPTIONS') and '/api/' in r['url'] for r in requests))
    context.close()

provenance = {
    'sourceBranch': subprocess.check_output(['git', 'branch', '--show-current'], text=True).strip(),
    'sourceSha': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
    'capturedAt': datetime.now(timezone.utc).isoformat(),
    'workingTreeModified': bool(subprocess.check_output(['git', 'status', '--porcelain'], text=True).strip()),
    'classification': 'isolated marketing layout; gallery placeholders; not operational product evidence',
    'origin': ORIGIN,
    'images': [{ 'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest() } for path in sorted(OUTPUT.glob('*.png'))],
}
(OUTPUT / 'layout-capture-provenance.json').write_text(json.dumps(provenance, indent=2))

result = {'origin': ORIGIN, 'browser': 'Existing Sandbox Chrome via CDP; no browser launch', 'checks': checks, 'passed': sum(c['passed'] for c in checks), 'failed': sum(not c['passed'] for c in checks), 'limitations': ['Backend not connected: public canonical reading unavailable/loading, never replaced by fixtures.', 'All showcase images remain verification-pending placeholders.', 'Layout captures are not operational product screenshots.']}
(OUTPUT / 'browser-verification.json').write_text(json.dumps(result, indent=2))
raise SystemExit(1 if result['failed'] else 0)
