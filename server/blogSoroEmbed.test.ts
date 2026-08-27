import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const blogPageSource = readFileSync(resolve(process.cwd(), "client/src/pages/Blog.tsx"), "utf8");

describe("public Blog Soro embed", () => {
  it("mounts the user-supplied Soro blog endpoint in a dedicated public-page container", () => {
    expect(blogPageSource).toContain('const SORO_BLOG_EMBED_SRC = "https://app.trysoro.com/api/embed/46626052-54a8-4bcf-9ec4-84473cffbb53"');
    expect(blogPageSource).toContain('<div id="soro-blog" />');
    expect(blogPageSource).toContain('{!isAdmin && <SoroBlogEmbed />}');
  });

  it("adds one deferred loader at a time and removes its page-instance loader on unmount", () => {
    expect(blogPageSource).toContain('document.getElementById(SORO_BLOG_EMBED_ID)?.remove();');
    expect(blogPageSource).toContain('script.defer = true;');
    expect(blogPageSource).toContain('return () => {\n      script.remove();\n    };');
  });
});

