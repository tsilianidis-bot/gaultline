import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useSEO", () => ({
  useSEO: () => undefined,
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: ComponentProps<"a"> & { children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import Legal, { getLegalTabFromLocation, subscribeToLegalLocationChanges } from "./Legal";

type MutableLocation = {
  hash: string;
  search: string;
};

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("Legal tab URL behavior", () => {
  it("selects the requested tab from a hash before the query-string fallback", () => {
    expect(getLegalTabFromLocation({ hash: "#terms", search: "" })).toBe("terms");
    expect(getLegalTabFromLocation({ hash: "#privacy", search: "?tab=terms" })).toBe("privacy");
    expect(getLegalTabFromLocation({ hash: "#TERMS", search: "" })).toBe("terms");
  });

  it("uses ?tab= when there is no recognized hash and defaults safely to privacy", () => {
    expect(getLegalTabFromLocation({ hash: "", search: "?tab=terms" })).toBe("terms");
    expect(getLegalTabFromLocation({ hash: "#unknown", search: "?tab=privacy" })).toBe("privacy");
    expect(getLegalTabFromLocation({ hash: "#unknown", search: "?tab=unknown" })).toBe("privacy");
  });

  it("synchronizes hash and history navigation events and removes listeners on cleanup", () => {
    const target = new EventTarget();
    const location: MutableLocation = { hash: "#privacy", search: "" };
    const selections: string[] = [];
    const unsubscribe = subscribeToLegalLocationChanges(target, location, (tab) => selections.push(tab));

    location.hash = "#terms";
    target.dispatchEvent(new Event("hashchange"));
    location.hash = "";
    location.search = "?tab=privacy";
    target.dispatchEvent(new Event("popstate"));

    unsubscribe();
    location.hash = "#terms";
    target.dispatchEvent(new Event("hashchange"));

    expect(selections).toEqual(["terms", "privacy"]);
  });

  it("renders the terms tab from a direct hash with semantic tabs and a home link", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { hash: "#terms", search: "" } },
    });

    const html = renderToStaticMarkup(<Legal />);

    expect(html).toMatch(/id="terms-tab"[^>]*aria-selected="true"/);
    expect(html).toContain('id="terms-panel"');
    expect(html).toContain("By accessing or using FAULTLINE");
    expect(html).toContain('role="tablist"');
    expect(html).toContain('href="/"');
    expect(html).toContain("← BACK TO SITE");
  });
});
