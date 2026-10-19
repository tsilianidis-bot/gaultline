#!/usr/bin/env python3
"""Verify the live FAULTLINE graphics candidate through the real application.

This is deliberately a browser-only, read-only QA harness.  It never installs a
route interceptor, substitutes provider data, creates a user, or calls a write
endpoint.  The managed-preview identity (when observed) is reported as the
host-bound, read-only QA boundary it is; it is not a real paid-user login.

The default target is the exact managed-preview candidate URL. The runner does
not write browser storage directly. Existing first-login and daily-welcome
screens are dismissed through their normal buttons; those native actions may
save the application's existing local intro preferences, never market data.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time
import traceback
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from playwright.sync_api import Browser, BrowserContext, Error as PlaywrightError
from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


DEFAULT_URL = (
    "https://3000-ismtjoaf359ij44vxguni-0bed1374.us1.manus.computer/app/now"
)
DEFAULT_OUT = "/home/ubuntu/gaultline/artifacts/graphics-candidate-verification"
CHROMIUM_PATH = "/usr/bin/chromium"
VIEWPORT_HEIGHT = 1000
DOMAIN_LABELS = [
    "Liquidity Stress",
    "Credit Contagion",
    "Volatility Regime",
    "Macro Sensitivity",
    "Market Breadth",
    "AI Bubble Risk",
]
DEMO_MARKERS = [
    "ISOLATED DESIGN PREVIEW",
    "DEMONSTRATION DATA",
    "DEMONSTRATION ONLY",
    "fictional design fixture",
    "Not live market intelligence",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def target_url(raw_url: str) -> str:
    """Use the supplied URL, adding /app/now only when a bare origin is supplied."""
    parsed = urlsplit(raw_url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("--url must be an absolute http(s) URL")
    path = parsed.path or "/"
    if path == "/":
        path = "/app/now"
    return urlunsplit((parsed.scheme, parsed.netloc, path, parsed.query, ""))


def new_results(url: str, out: pathlib.Path) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "startedAt": utc_now(),
        "target": {"url": url, "out": str(out)},
        "execution": {
            "browser": "Chromium via Python Playwright",
            "chromiumExecutable": CHROMIUM_PATH,
            "networkMode": "live application only; no route interception, mocks, or provider-response injection",
            "verifierMutations": {
                "localStorage": "no direct writes; normal intro-dismissal buttons may save existing client preferences",
                "sessionStorage": "no direct writes; normal welcome-dismissal button may save existing client preferences",
                "auth": "none",
                "applicationData": "none",
            },
        },
        "validationScope": {
            "kind": "managed-preview unavailable-state rendering QA",
            "expectedPrincipal": "exact-host FAULTLINE_MANAGED_PREVIEW read-only QA boundary",
            "principalIsGenuineLogin": False,
            "providerCredentials": "not supplied and not fabricated by this verifier",
            "genuineAuthenticatedPaidUserValidation": {
                "performed": False,
                "status": "not_tested",
                "reason": "This run must not represent the host-bound QA principal, absent provider credentials, or unavailable canonical state as a genuine paid-user/provider validation.",
            },
            "genuinePassEligible": False,
        },
        "checks": [],
        "domainDrawerInteractions": [],
        "responsive": [],
        "performance": {},
        "observedAuthContext": {
            "responseObserved": False,
            "qaBoundaryObserved": False,
            "principalClassification": "not observed",
        },
        "browser": {
            "pageErrors": [],
            "consoleErrors": [],
            "requestFailures": [],
            "apiResponses": [],
            "providerLikeRequests": [],
        },
        "screenshots": [],
        "fatalErrors": [],
        "unavailableStatePassed": False,
        "passed": False,
        "passMeaning": "A true passed value means only that the requested managed-preview unavailable-state UI checks passed. It never means a genuine authenticated paid-user or provider-backed current-data pass.",
    }


def check(results: dict[str, Any], name: str, passed: bool, details: Any = None) -> bool:
    item: dict[str, Any] = {"name": name, "passed": bool(passed)}
    if details is not None:
        item["details"] = details
    results["checks"].append(item)
    return bool(passed)


def add_screenshot(
    page: Page,
    results: dict[str, Any],
    path: pathlib.Path,
    *,
    locator: str | None = None,
    full_page: bool = False,
) -> None:
    """Capture rendered output only; no DOM or style mutation is performed."""
    if locator:
        page.locator(locator).screenshot(path=str(path))
    else:
        page.screenshot(path=str(path), full_page=full_page)
    results["screenshots"].append(str(path))


def response_user_candidate(payload: Any) -> dict[str, Any] | None:
    """Find a tRPC auth.me user-shaped object without retaining PII in the report."""
    if isinstance(payload, dict):
        keys = set(payload)
        if {"loginMethod", "isQaSession", "qaAccess"} & keys:
            return payload
        for value in payload.values():
            found = response_user_candidate(value)
            if found is not None:
                return found
    elif isinstance(payload, list):
        for value in payload:
            found = response_user_candidate(value)
            if found is not None:
                return found
    return None


def attach_live_observers(page: Page, results: dict[str, Any]) -> None:
    """Observe real browser behavior; do not alter, block, or fulfill a request."""

    def page_error(error: Exception) -> None:
        results["browser"]["pageErrors"].append(
            {"at": utc_now(), "message": str(error)}
        )

    def console(message: Any) -> None:
        if message.type == "error":
            results["browser"]["consoleErrors"].append(
                {"at": utc_now(), "text": message.text, "location": message.location}
            )

    def request_failed(request: Any) -> None:
        results["browser"]["requestFailures"].append(
            {
                "at": utc_now(),
                "method": request.method,
                "url": request.url,
                "failure": request.failure,
            }
        )

    def request(request: Any) -> None:
        host = (urlsplit(request.url).hostname or "").lower()
        if any(token in host for token in ("yahoo", "fred", "coingecko")):
            results["browser"]["providerLikeRequests"].append(
                {"method": request.method, "url": request.url}
            )

    def response(response: Any) -> None:
        url = response.url
        if "/api/" in url or "/trpc/" in url:
            results["browser"]["apiResponses"].append(
                {"url": url, "status": response.status}
            )
        if "auth.me" not in url:
            return
        try:
            candidate = response_user_candidate(response.json())
            if candidate is None:
                return
            qa_session = candidate.get("isQaSession") is True
            login_method = candidate.get("loginMethod")
            qa_access = candidate.get("qaAccess")
            results["observedAuthContext"] = {
                "responseObserved": True,
                "qaBoundaryObserved": qa_session or login_method == "qa_access" or qa_access == "read_only",
                "principalClassification": (
                    "host-bound read-only QA boundary (not a genuine login)"
                    if qa_session or login_method == "qa_access" or qa_access == "read_only"
                    else "non-QA identity observed; not treated as a genuine paid-user pass"
                ),
                "loginMethod": login_method,
                "isQaSession": qa_session,
                "qaAccess": qa_access,
                "accessTier": candidate.get("accessTier"),
            }
        except Exception as exc:  # Response parsing is diagnostic only.
            results["observedAuthContext"]["responseParseError"] = str(exc)

    page.on("pageerror", page_error)
    page.on("console", console)
    page.on("requestfailed", request_failed)
    page.on("request", request)
    page.on("response", response)


def wait_for_candidate(page: Page) -> list[str]:
    """Wait for the real core without waiting for a provider or forcing a state."""
    dismissed: list[str] = []
    core = page.locator(".fic-experience")
    core.wait_for(state="visible", timeout=45_000)
    page.locator(".fic-topology").wait_for(state="visible", timeout=20_000)
    # The existing daily PLATO welcome screen is dismissed exactly as a user
    # would dismiss it. No auth, provider result or canonical state is altered.
    entry = page.get_by_role("button", name="ENTER MARKET INTELLIGENCE →", exact=True)
    try:
        entry.wait_for(state="visible", timeout=15_000)
        entry.click(timeout=10_000)
        entry.wait_for(state="hidden", timeout=10_000)
        dismissed.append("ENTER MARKET INTELLIGENCE →")
    except PlaywrightTimeoutError:
        if entry.is_visible():
            raise
    intro_skip = page.get_by_role("button", name="Skip", exact=True)
    try:
        intro_skip.wait_for(state="visible", timeout=5_000)
        intro_skip.click(timeout=10_000)
        intro_skip.wait_for(state="hidden", timeout=10_000)
        dismissed.append("Skip (existing first-login PLATO intro)")
    except PlaywrightTimeoutError:
        if intro_skip.is_visible():
            raise
    decline = page.get_by_role("button", name="DECLINE", exact=True)
    if decline.is_visible():
        decline.click(timeout=10_000)
        dismissed.append("Decline (existing optional analytics cookie banner)")
    core.scroll_into_view_if_needed(timeout=10_000)
    # Let current actual application transitions settle before idle-animation sampling.
    page.wait_for_timeout(1_100)
    return dismissed


def fic_interactable(page: Page) -> dict[str, Any]:
    page.locator(".fic-experience .fic-domain").first.scroll_into_view_if_needed()
    return page.locator(".fic-experience").evaluate(
        """root => {
          const target = root.querySelector('.fic-domain');
          const rect = target.getBoundingClientRect();
          const x = Math.min(Math.max(rect.left + rect.width / 2, 1), innerWidth - 1);
          const y = Math.min(Math.max(rect.top + rect.height / 2, 1), innerHeight - 1);
          const atPoint = document.elementFromPoint(x, y);
          return {
            root: {left: rect.left, top: rect.top, width: rect.width, height: rect.height},
            hitTag: atPoint?.tagName ?? null,
            hitClass: atPoint?.className ?? null,
            hitWithinCandidate: Boolean(atPoint && root.contains(atPoint)),
          };
        }"""
    )


def unavailable_snapshot(page: Page) -> dict[str, Any]:
    return page.locator(".fic-experience").evaluate(
        """root => {
          const domains = [...root.querySelectorAll('.fic-domain')].map(node => ({
            label: node.querySelector('.fic-domain-label')?.textContent?.trim() ?? '',
            ariaLabel: node.getAttribute('aria-label'),
            status: node.querySelector('.fic-status')?.textContent?.trim() ?? '',
            unavailable: node.classList.contains('fic-domain--unavailable'),
          }));
          const pressure = root.querySelector('.fic-pressure-number')?.textContent?.trim() ?? null;
          const regime = root.querySelector('.fic-core-regime')?.textContent?.trim() ?? null;
          const topology = root.querySelector('.fic-topology');
          const text = root.innerText;
          return {
            observationId: root.querySelector('.fic-observation-id')?.textContent?.trim() ?? null,
            integrity: topology?.getAttribute('data-integrity') ?? null,
            pressure,
            regime,
            domainCount: domains.length,
            domains,
            demoNoticeCount: root.querySelectorAll('.fic-demo-notice').length,
            evidenceValueCount: root.querySelectorAll('.fic-evidence-value').length,
            visibleText: text,
          };
        }"""
    )


def fic_overflow(page: Page) -> dict[str, Any]:
    """Measure the candidate scope, not legacy browser/app chrome outside .fic-experience."""
    return page.locator(".fic-experience").evaluate(
        """root => {
          const rect = root.getBoundingClientRect();
          const horizontal = root.scrollWidth > root.clientWidth + 1;
          const candidateOutliers = [...root.querySelectorAll('*')]
            .map(node => {
              const r = node.getBoundingClientRect();
              const style = getComputedStyle(node);
              return {tag: node.tagName, className: String(node.className || ''), left: r.left, right: r.right,
                      width: r.width, display: style.display, visibility: style.visibility};
            })
            .filter(item => item.display !== 'none' && item.visibility !== 'hidden' && item.width > 1 &&
              (item.left < -1 || item.right > innerWidth + 1))
            .slice(0, 20);
          return {
            viewportWidth: innerWidth,
            rootClientWidth: root.clientWidth,
            rootScrollWidth: root.scrollWidth,
            rootLeft: rect.left,
            rootRight: rect.right,
            horizontalOverflow: horizontal || rect.left < -1 || rect.right > innerWidth + 1 || candidateOutliers.length > 0,
            candidateOutliers,
            documentHorizontalOverflow: document.documentElement.scrollWidth > innerWidth,
          };
        }"""
    )


def fic_idle_animations(page: Page) -> list[dict[str, Any]]:
    """Report only active animations rooted in .fic, intentionally excluding old app chrome."""
    return page.evaluate(
        """() => {
          const roots = [...document.querySelectorAll('.fic')];
          return document.getAnimations({subtree: true})
            .filter(animation => {
              const target = animation.effect && animation.effect.target;
              return target instanceof Element && roots.some(root => root.contains(target));
            })
            .map(animation => {
              const target = animation.effect && animation.effect.target;
              return {
                playState: animation.playState,
                currentTime: animation.currentTime,
                animationName: target instanceof Element ? getComputedStyle(target).animationName : null,
                target: target instanceof Element ? `${target.tagName}.${target.className}` : null,
              };
            });
        }"""
    )


def cdp_metrics(cdp: Any) -> dict[str, float]:
    return {metric["name"]: metric["value"] for metric in cdp.send("Performance.getMetrics")["metrics"]}


def delta(after: dict[str, float], before: dict[str, float], name: str) -> float | None:
    if name not in after or name not in before:
        return None
    return after[name] - before[name]


def add_performance_result(
    page: Page,
    cdp: Any,
    before_idle: dict[str, float],
    after_idle: dict[str, float],
    idle_seconds: float,
    candidate_ready_seconds: float,
    results: dict[str, Any],
) -> None:
    resource_summary = page.evaluate(
        """() => {
          const entries = performance.getEntriesByType('resource');
          const nav = performance.getEntriesByType('navigation')[0];
          return {
            resourceCount: entries.length,
            transferBytes: entries.reduce((total, entry) => total + (entry.transferSize || 0), 0),
            navigation: nav ? {
              responseEndMs: nav.responseEnd,
              domContentLoadedMs: nav.domContentLoadedEventEnd,
              loadEventEndMs: nav.loadEventEnd,
            } : null,
          };
        }"""
    )
    fic_node_count = page.locator(".fic-experience, .fic-experience *").count()
    results["performance"].update({
        "caveat": "CDP process metrics and navigation timing cover the full existing application, including legacy app chrome, auth/UI shell, and all mounted components. They are diagnostic browser measurements, not isolated FIC-only RUM or low-end-device guarantees.",
        "candidateReadyWallSeconds": candidate_ready_seconds,
        "idleWindowSeconds": idle_seconds,
        "idleTaskSeconds": delta(after_idle, before_idle, "TaskDuration"),
        "idleScriptSeconds": delta(after_idle, before_idle, "ScriptDuration"),
        "idleLayoutSeconds": delta(after_idle, before_idle, "LayoutDuration"),
        "idleRecalcStyleSeconds": delta(after_idle, before_idle, "RecalcStyleDuration"),
        "totalDomNodes": after_idle.get("Nodes"),
        "ficScopedDomNodes": fic_node_count,
        "jsHeapUsedBytes": after_idle.get("JSHeapUsedSize"),
        "layoutCount": after_idle.get("LayoutCount"),
        "recalcStyleCount": after_idle.get("RecalcStyleCount"),
        "resourceSummary": resource_summary,
    })


def test_unavailable_state(page: Page, results: dict[str, Any]) -> None:
    snapshot = unavailable_snapshot(page)
    visible_text = snapshot.pop("visibleText")
    demo_markers_found = [marker for marker in DEMO_MARKERS if marker.lower() in visible_text.lower()]
    domain_labels = [domain["label"] for domain in snapshot["domains"]]
    domains_unavailable = all(
        domain["unavailable"] and domain["status"].upper() == "UNAVAILABLE"
        for domain in snapshot["domains"]
    )
    no_numeric_pressure = bool(snapshot["pressure"] and snapshot["pressure"].startswith("—"))
    # A status legend is vocabulary, not a market claim. Inspect real domains
    # and the masked central readout rather than treating its LIVE key as data.
    no_current_readout = not page.locator(".fic-experience .fic-domain .fic-status--current").count()

    check(results, "Actual FIC candidate is interactable (not hidden by an application gate)", fic_interactable(page)["hitWithinCandidate"], fic_interactable(page))
    check(results, "Canonical source is explicitly unavailable", snapshot["observationId"] == "No canonical state connected" and snapshot["integrity"] == "unavailable", snapshot)
    check(results, "Pressure is masked rather than rendered as a current number", no_numeric_pressure, {"pressure": snapshot["pressure"]})
    check(results, "Regime is masked rather than rendered as a current claim", snapshot["regime"] == "Regime unavailable", {"regime": snapshot["regime"]})
    check(results, "Exactly six actual evidence domains are rendered", snapshot["domainCount"] == 6 and domain_labels == DOMAIN_LABELS, {"labels": domain_labels})
    check(results, "All six domains render unavailable source status", domains_unavailable, {"domains": snapshot["domains"]})
    check(results, "No synthetic demonstration payload or demo current numbers are shown", snapshot["demoNoticeCount"] == 0 and snapshot["evidenceValueCount"] == 0 and not demo_markers_found and no_current_readout, {"demoMarkersFound": demo_markers_found, "demoNoticeCount": snapshot["demoNoticeCount"], "evidenceValueCount": snapshot["evidenceValueCount"], "containsVerifiedCurrent": not no_current_readout})


def exercise_domain_drawers(page: Page, results: dict[str, Any], out: pathlib.Path) -> None:
    domains = page.locator(".fic-experience .fic-domain")
    count = domains.count()
    for index in range(count):
        domain = domains.nth(index)
        label = domain.locator(".fic-domain-label").inner_text().strip()
        domain.scroll_into_view_if_needed(timeout=10_000)
        domain.click(timeout=10_000)
        drawer = page.locator(".fic-drawer[role='dialog']")
        drawer.wait_for(state="visible", timeout=10_000)
        drawer_text = drawer.inner_text()
        empty_evidence = "No verified evidence connected" in drawer_text and "0 CONNECTED" in drawer_text
        dialog_title = drawer.locator(".fic-drawer-title").inner_text().strip()
        if index == 0:
            add_screenshot(
                page,
                results,
                out / "desktop-1440-liquidity-drawer-actual.png",
                locator=".fic-drawer[role='dialog']",
            )
        page.keyboard.press("Escape")
        drawer.wait_for(state="hidden", timeout=10_000)
        focus_restored = domain.evaluate("node => document.activeElement === node")
        interaction = {
            "index": index + 1,
            "label": label,
            "openMethod": "actual click",
            "drawerTitle": dialog_title,
            "emptyEvidenceMessage": empty_evidence,
            "focusRestoredAfterEscape": focus_restored,
        }
        results["domainDrawerInteractions"].append(interaction)
        check(results, f"{label}: click opens its actual unavailable evidence drawer", dialog_title == label and empty_evidence, interaction)
        check(results, f"{label}: Escape closes drawer and restores opener focus", focus_restored, interaction)

    # Keyboard behavior is a separate real interaction, not a state injection.
    first_domain = domains.nth(0)
    first_domain.focus()
    before_open_focus = first_domain.evaluate("node => document.activeElement === node")
    first_domain.press("Enter")
    drawer = page.locator(".fic-drawer[role='dialog']")
    drawer.wait_for(state="visible", timeout=10_000)
    auto_focus_inside = page.evaluate(
        "Boolean(document.activeElement && document.activeElement.closest('.fic-drawer[role=dialog]'))"
    )
    page.keyboard.press("Tab")
    tab_focus_inside = page.evaluate(
        "Boolean(document.activeElement && document.activeElement.closest('.fic-drawer[role=dialog]'))"
    )
    page.keyboard.press("Escape")
    drawer.wait_for(state="hidden", timeout=10_000)
    keyboard_focus_restored = first_domain.evaluate("node => document.activeElement === node")
    check(results, "Keyboard Enter opens the focused domain drawer", before_open_focus and auto_focus_inside, {"openerFocused": before_open_focus, "dialogFocus": auto_focus_inside})
    check(results, "Drawer retains keyboard focus and Escape restores the focused domain", tab_focus_inside and keyboard_focus_restored, {"tabFocusInsideDrawer": tab_focus_inside, "focusRestored": keyboard_focus_restored})


def test_responsive_and_capture(page: Page, results: dict[str, Any], out: pathlib.Path) -> None:
    for width in (1440, 390, 360):
        page.set_viewport_size({"width": width, "height": VIEWPORT_HEIGHT})
        page.locator(".fic-experience").scroll_into_view_if_needed(timeout=10_000)
        page.wait_for_timeout(350)
        overflow = fic_overflow(page)
        domain_boxes = page.locator(".fic-experience .fic-domain").evaluate_all(
            "nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return {width: r.width, height: r.height}; })"
        )
        touch_targets = all(box["width"] >= 44 and box["height"] >= 44 for box in domain_boxes)
        responsive = {
            "viewportWidth": width,
            "ficScopedOverflow": overflow,
            "domainTargets": domain_boxes,
            "allDomainTargetsAtLeast44px": touch_targets,
        }
        results["responsive"].append(responsive)
        check(results, f"No horizontal overflow in .fic subtree at {width}px", not overflow["horizontalOverflow"], overflow)
        check(results, f"All domain targets are at least 44px at {width}px", touch_targets, domain_boxes)

        if width == 1440:
            add_screenshot(page, results, out / "desktop-1440-actual-app.png", full_page=True)
            add_screenshot(page, results, out / "desktop-1440-fic-actual.png", locator=".fic-experience")
        elif width == 390:
            add_screenshot(page, results, out / "mobile-390-actual-app.png", full_page=True)
            add_screenshot(page, results, out / "mobile-390-fic-actual.png", locator=".fic-experience")
            # A genuine mobile click verifies the portal drawer's actual viewport fit.
            first = page.locator(".fic-experience .fic-domain").first
            first.click(timeout=10_000)
            drawer = page.locator(".fic-drawer[role='dialog']")
            drawer.wait_for(state="visible", timeout=10_000)
            # The approved entry motion lasts 180ms. Measure the settled layout,
            # not its intentional transient 18px translateX entrance position.
            page.wait_for_timeout(250)
            drawer_box = drawer.evaluate("node => { const r = node.getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width,viewport:innerWidth}; }")
            add_screenshot(page, results, out / "mobile-390-liquidity-drawer-actual.png", locator=".fic-drawer[role='dialog']")
            check(results, "390px drawer fits its actual mobile viewport", drawer_box["left"] >= -1 and drawer_box["right"] <= drawer_box["viewport"] + 1, drawer_box)
            drawer_above_chrome = drawer.evaluate("node => { const r = node.querySelector('.fic-drawer-header').getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!hit && node.contains(hit); }")
            check(results, "Mobile evidence drawer stays above fixed application chrome", drawer_above_chrome)
            page.keyboard.press("Escape")
            drawer.wait_for(state="hidden", timeout=10_000)
        else:
            add_screenshot(page, results, out / "mobile-360-actual-app.png", full_page=True)
            add_screenshot(page, results, out / "mobile-360-fic-actual.png", locator=".fic-experience")


def run(args: argparse.Namespace) -> int:
    url = target_url(args.url)
    out = pathlib.Path(args.out).expanduser().resolve()
    out.mkdir(parents=True, exist_ok=True)
    results = new_results(url, out)
    browser: Browser | None = None
    context: BrowserContext | None = None

    try:
        executable = pathlib.Path(CHROMIUM_PATH)
        if not executable.is_file():
            raise RuntimeError(f"Required Chromium executable not found: {CHROMIUM_PATH}")

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                executable_path=CHROMIUM_PATH,
                args=["--no-sandbox"],
            )
            context = browser.new_context(
                viewport={"width": 1440, "height": VIEWPORT_HEIGHT},
                device_scale_factor=1,
            )
            page = context.new_page()
            attach_live_observers(page, results)
            cdp = context.new_cdp_session(page)
            cdp.send("Performance.enable")

            navigation_started = time.monotonic()
            # Deliberately no networkidle wait: live background queries and absent providers
            # are part of the observed application and must not be manufactured into success.
            page.goto(url, wait_until="domcontentloaded", timeout=60_000)
            results["execution"]["uiPreferenceActions"] = wait_for_candidate(page)
            candidate_ready_seconds = time.monotonic() - navigation_started

            test_unavailable_state(page, results)
            # These screenshots are taken before any drawer click and are actual page pixels.
            add_screenshot(page, results, out / "desktop-1440-initial-actual-app.png", full_page=True)
            add_screenshot(page, results, out / "desktop-1440-initial-fic-actual.png", locator=".fic-experience")

            exercise_domain_drawers(page, results, out)
            test_responsive_and_capture(page, results, out)

            page.set_viewport_size({"width": 1440, "height": VIEWPORT_HEIGHT})
            page.locator(".fic-experience").scroll_into_view_if_needed(timeout=10_000)
            page.wait_for_timeout(1_100)
            idle_animations_before = fic_idle_animations(page)
            idle_metrics_before = cdp_metrics(cdp)
            idle_started = time.monotonic()
            page.wait_for_timeout(1_500)
            idle_seconds = time.monotonic() - idle_started
            idle_metrics_after = cdp_metrics(cdp)
            idle_animations_after = fic_idle_animations(page)
            results["performance"]["ficIdleAnimationsBeforeWindow"] = idle_animations_before
            results["performance"]["ficIdleAnimationsAfterWindow"] = idle_animations_after
            check(results, "No idle animations exist within the .fic subtree", not idle_animations_before and not idle_animations_after, {"before": idle_animations_before, "after": idle_animations_after, "scope": ".fic only; full legacy application chrome intentionally excluded"})
            add_performance_result(page, cdp, idle_metrics_before, idle_metrics_after, idle_seconds, candidate_ready_seconds, results)

            # A managed-preview QA response is required for this requested boundary, but is
            # separately labelled so a truthy QA result is never confused with customer auth.
            qa_observed = results["observedAuthContext"].get("qaBoundaryObserved") is True
            check(results, "Observed identity is the managed-preview QA boundary, not a paid-user claim", qa_observed, results["observedAuthContext"])
            check(results, "No uncaught browser JavaScript errors", not results["browser"]["pageErrors"], results["browser"]["pageErrors"])
            check(results, "No browser console errors during candidate exercise", not results["browser"]["consoleErrors"], results["browser"]["consoleErrors"])

    except (PlaywrightError, PlaywrightTimeoutError, RuntimeError, ValueError) as exc:
        results["fatalErrors"].append({"type": type(exc).__name__, "message": str(exc)})
    except Exception as exc:  # Always leave a JSON artifact for diagnosis.
        results["fatalErrors"].append(
            {"type": type(exc).__name__, "message": str(exc), "traceback": traceback.format_exc()}
        )
    finally:
        if context is not None:
            try:
                context.close()
            except Exception as exc:
                results.setdefault("cleanupWarnings", []).append({"type": type(exc).__name__, "message": f"context close: {exc}"})
        if browser is not None:
            try:
                browser.close()
            except Exception as exc:
                results.setdefault("cleanupWarnings", []).append({"type": type(exc).__name__, "message": f"browser close: {exc}"})

    results["finishedAt"] = utc_now()
    results["unavailableStatePassed"] = not results["fatalErrors"] and bool(results["checks"]) and all(item["passed"] for item in results["checks"])
    results["passed"] = results["unavailableStatePassed"]
    output_file = out / "graphics-candidate-validation.json"
    output_file.write_text(json.dumps(results, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    print(json.dumps(results, indent=2, sort_keys=False))
    return 0 if results["passed"] else 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=DEFAULT_URL, help="Live candidate URL (default: managed-preview /app/now)")
    parser.add_argument("--out", default=DEFAULT_OUT, help="Directory for screenshots and graphics-candidate-validation.json")
    return parser.parse_args()


if __name__ == "__main__":
    sys.exit(run(parse_args()))
