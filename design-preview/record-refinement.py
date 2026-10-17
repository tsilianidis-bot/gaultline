#!/usr/bin/env python3
"""Record actual interactions with the compiled isolated preview, not a rendered mockup."""
import pathlib
import shutil
from playwright.sync_api import sync_playwright

out=pathlib.Path('/home/ubuntu/faultline-refinement/after')
out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1000},record_video_dir=str(out/'recording'),record_video_size={'width':1440,'height':1000})
    page=context.new_page()
    page.goto('http://127.0.0.1:4173/?state=transitions',wait_until='networkidle')
    page.wait_for_timeout(1300)
    def show_core():
        page.locator('.fic-core-layout').scroll_into_view_if_needed()
        page.evaluate('window.scrollBy(0,-35)')
        page.wait_for_timeout(1900)
    show_core()
    page.get_by_role('button',name='Admit credit evidence',exact=True).click();show_core()
    page.get_by_role('button',name='Change verified fixture regime',exact=True).click();show_core()
    page.get_by_role('button',name='Support an association',exact=True).click();show_core()
    page.locator('.fic-domain').first.click();page.get_by_role('dialog').wait_for();page.wait_for_timeout(900)
    page.get_by_role('dialog').locator('.fic-relationship-list').scroll_into_view_if_needed();page.wait_for_timeout(1900)
    page.keyboard.press('Escape');page.get_by_role('dialog').wait_for(state='hidden')
    page.get_by_role('button',name='Expire liquidity observation',exact=True).click();show_core();page.wait_for_timeout(1400)
    video=page.video
    context.close();video.save_as(str(out/'Intelligence_Core_Refinement_Interaction.webm'));browser.close()
print(out/'Intelligence_Core_Refinement_Interaction.webm')
