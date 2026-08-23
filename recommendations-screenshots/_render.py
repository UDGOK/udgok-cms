#!/usr/bin/env python3
"""Render the recommendation wireframes + a few public site screenshots
to PNG using Playwright. Used once to produce the visuals for the user.

Renders each .html in /workspace/recommendations-screenshots/ to a
.png of the same name, plus a few public CMS pages.
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path("/workspace/recommendations-screenshots")
OUT = ROOT
PUBLIC = [
    # Public marketing pages we can hit without auth
    ("https://cms.udgok.com/", "live-home.png"),
    ("https://cms.udgok.com/features", "live-features.png"),
    ("https://cms.udgok.com/pricing", "live-pricing.png"),
    ("https://cms.udgok.com/c/test", "live-c-404.png"),  # expected 404 but shows chrome
]

def render_wireframes():
    for html in sorted(ROOT.glob("*.html")):
        png = OUT / (html.stem + ".png")
        print(f"  rendering {html.name} -> {png.name}")
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1280, "height": 1600}, device_scale_factor=2)
            page.goto(f"file://{html.resolve()}")
            page.wait_for_load_state("networkidle")
            page.screenshot(path=str(png), full_page=True)
            browser.close()

def render_public():
    for url, name in PUBLIC:
        png = OUT / name
        print(f"  rendering {url} -> {name}")
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch()
                page = browser.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=2)
                page.goto(url, wait_until="domcontentloaded", timeout=15000)
                page.wait_for_load_state("networkidle", timeout=10000)
                page.screenshot(path=str(png), full_page=True)
                browser.close()
        except Exception as e:
            print(f"    ! {url} failed: {e}")
            # Try a fallback shorter wait
            try:
                with sync_playwright() as p:
                    browser = p.chromium.launch()
                    page = browser.new_page(viewport={"width": 1280, "height": 800})
                    page.goto(url, timeout=15000)
                    page.wait_for_timeout(2000)
                    page.screenshot(path=str(png), full_page=False)
                    browser.close()
            except Exception as e2:
                print(f"    ! {url} fallback also failed: {e2}")

if __name__ == "__main__":
    if "--public" in sys.argv:
        render_public()
    elif "--all" in sys.argv:
        render_wireframes()
        render_public()
    else:
        render_wireframes()
