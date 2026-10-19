#!/usr/bin/env python3
"""Refinement-specific browser/AX-tree checks. No provider calls or production writes."""
import argparse
import json
import pathlib
import shutil
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:4173')
parser.add_argument('--out', default='/home/ubuntu/faultline-refinement/after')
args = parser.parse_args()
out = pathlib.Path(args.out)
out.mkdir(parents=True, exist_ok=True)
results = {'checks': [], 'runtimeErrors': [], 'apiRequests': [], 'screenReaderCoverage': 'Chromium accessibility-tree names, roles, live regions and keyboard behavior; manual NVDA/VoiceOver unavailable in this sandbox'}
def check(name, passed, details=None):
    results['checks'].append({'name':name, 'passed':bool(passed), 'details':details})

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':1440,'height':1000})
    page = context.new_page()
    page.on('pageerror',lambda e:results['runtimeErrors'].append(str(e)))
    page.on('request',lambda r:results['apiRequests'].append(r.url) if '/api/' in r.url else None)
    page.goto(args.url+'/?state=transitions',wait_until='networkidle')
    page.wait_for_timeout(300)
    check('First snapshot has no market change animation',page.locator('.fic-core-change-ring,.fic-domain--admitted,.fic-domain--expired').count()==0)
    check('Normal-motion idle has no continuous animations',page.evaluate('document.getAnimations().length')==0)
    methods=page.locator('.fic-thesis-steps a').all_text_contents()
    check('Exact Pentagonal labels in original route order',all(label in text for label,text in zip(['REALITY','CAUSATION','CONSEQUENCE','VERIFICATION','ACTION'],methods)) and len(methods)==5,methods)
    check('Existing routes unchanged',page.locator('.fic-thesis-steps a').evaluate_all('(nodes)=>nodes.map(n=>n.getAttribute("href"))')==['/app/now','/app/why','/app/outlook','/app/watch','/app/act'])
    page.get_by_role('button',name='Admit credit evidence',exact=True).click()
    page.locator('.fic-domain--admitted').wait_for()
    check('New admission highlights only its associated domain',page.locator('.fic-domain--admitted').count()==1 and 'Credit Contagion' in page.locator('.fic-domain--admitted').inner_text())
    check('Admission announces factual prior and current status','Credit Contagion: delayed → current' in page.locator('.fic-change-record').inner_text())
    check('Fictional transition always labeled','Not live market intelligence' in page.locator('.fic-demo-notice').first.inner_text())
    page.wait_for_timeout(1400)
    check('Admission animation ends without a loop',page.evaluate('document.getAnimations().length')==0 and page.locator('.fic-domain--admitted').count()==0)
    page.get_by_role('button',name='Change verified fixture regime',exact=True).click()
    page.locator('.fic-core-change-ring').wait_for()
    check('Verified fixture regime changes supplied readout','Broader pressure' in page.locator('.fic-core-regime').inner_text() and '65.1' in page.locator('.fic-pressure-number').inner_text())
    check('Regime and pressure changes announce exact supplied values','62.4 → 65.1' in page.locator('.fic-change-record').inner_text() and 'Verified regime changed:' in page.locator('.fic-change-record').inner_text())
    page.wait_for_timeout(1400)
    check('Regime animation ends without idle activity',page.evaluate('document.getAnimations().length')==0)
    page.get_by_role('button',name='Support an association',exact=True).click()
    page.locator('.fic-supported-relationship--admitted').wait_for()
    check('Supported association receives distinct graphics',page.locator('.fic-supported-relationship--association').count()==1 and page.locator('.fic-supported-relationship--causal').count()==0)
    check('Relationship announcement never changes association into causation','1 newly supported association' in page.locator('.fic-change-record').inner_text())
    page.wait_for_timeout(1400)
    page.locator('.fic-core-layout').screenshot(path=str(out/'desktop-supported-association.png'))
    domain=page.locator('.fic-domain').first
    domain.focus();domain.press('Enter');page.get_by_role('dialog').wait_for()
    check('Evidence drawer states association not causation','ASSOCIATION · NOT CAUSATION' in page.get_by_role('dialog').inner_text())
    check('Drawer exposes semantic original source time',page.get_by_role('dialog').locator('time[datetime]').count()>0)
    cdp=context.new_cdp_session(page)
    ax=cdp.send('Accessibility.getFullAXTree')['nodes']
    accessible=[{'role':n.get('role',{}).get('value'),'name':n.get('name',{}).get('value'),'properties':n.get('properties',[])} for n in ax if not n.get('ignored')]
    (out/'evidence-accessibility-tree.json').write_text(json.dumps(accessible,indent=2)+'\n')
    check('Accessibility tree names the evidence dialog',any(n['role']=='dialog' and n['name']=='Liquidity Stress' for n in accessible))
    page.get_by_role('dialog').screenshot(path=str(out/'evidence-supported-association.png'))
    page.keyboard.press('Escape');page.get_by_role('dialog').wait_for(state='hidden')
    check('Refined drawer restores exact opener focus',domain.evaluate('(n)=>n===document.activeElement'))
    page.get_by_role('button',name='Expire liquidity observation',exact=True).click()
    page.locator('.fic-domain--expired').wait_for(timeout=5000)
    check('Actual fixture deadline changes source to stale','Stale observation' in page.locator('.fic-domain').first.inner_text())
    check('Expiry masks current pressure rather than retaining a live claim',page.locator('.fic-pressure-number').inner_text().strip().startswith('—'))
    check('Expiry announces source observation, not market urgency','Liquidity Stress observation expired' in page.locator('.fic-change-record').inner_text())
    check('Retained relationship becomes historical context',page.locator('.fic-supported-relationship--historical').count()==1)
    page.wait_for_timeout(1400)
    page.locator('.fic-core-layout').screenshot(path=str(out/'desktop-source-expired.png'))
    check('Expiry animation ends and idle remains still',page.evaluate('document.getAnimations().length')==0)
    page.emulate_media(reduced_motion='reduce')
    page.goto(args.url+'/?state=transitions',wait_until='networkidle')
    page.get_by_role('button',name='Admit credit evidence',exact=True).click();page.locator('.fic-domain--admitted').wait_for()
    check('Reduced motion suppresses source transition animation',page.locator('.fic-domain--admitted').evaluate('(n)=>getComputedStyle(n).animationName')=='none')
    check('Reduced-motion evidence change still communicated','Credit Contagion' in page.locator('.fic-change-record').inner_text())
    check('Reduced motion causes zero active animations',page.evaluate('document.getAnimations().length')==0)
    for width in [360,390,768,1024,1440,1920]:
        page.set_viewport_size({'width':width,'height':900})
        page.goto(args.url+'/?state=demo',wait_until='networkidle')
        rects=page.locator('.fic-core-readout,.fic-domain').evaluate_all('(nodes)=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}})')
        core=rects[0]
        overlap=any(core['left']<r['right'] and core['right']>r['left'] and core['top']<r['bottom'] and core['bottom']>r['top'] for r in rects[1:])
        # The readout container spans the full topology on desktop by design.
        # Check text bounds rather than that container's hit rectangle.
        text=page.locator('.fic-pressure-number').bounding_box()
        overlap=any(text['x']<r['right'] and text['x']+text['width']>r['left'] and text['y']<r['bottom'] and text['y']+text['height']>r['top'] for r in rects[1:])
        check(f'Core number and domain controls do not overlap at {width}px',not overlap)
        check(f'No refined page overflow at {width}px',page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    ax=cdp.send('Accessibility.getFullAXTree')['nodes']
    check('Core SVG exposes meaningful screen-reader name',any(n.get('role',{}).get('value')=='image' and 'Intelligence Core' in n.get('name',{}).get('value','') for n in ax))
    check('Change communication is a polite atomic live region',page.locator('.fic-change-record').get_attribute('aria-live')=='polite' and page.locator('.fic-change-record').get_attribute('aria-atomic')=='true')
    check('No new runtime errors',not results['runtimeErrors'],results['runtimeErrors'])
    check('No production/provider requests',not results['apiRequests'],results['apiRequests'])
    context.close();browser.close()
results['passed']=all(c['passed'] for c in results['checks'])
(out/'refinement-browser-validation.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
raise SystemExit(0 if results['passed'] else 1)
