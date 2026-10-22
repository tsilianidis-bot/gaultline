import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { renderSpaPage } from "../publicContentSsr";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      // Inject per-page metadata so crawlers get unique titles/descriptions
      // without requiring JavaScript execution. Published articles and Daily
      // Briefs get their own metadata/content; missing slugs return 404.
      const rendered = await renderSpaPage(page, url);
      res.status(rendered.status).set({ "Content-Type": "text/html", ...rendered.headers }).end(rendered.html);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

/** Paths that look like static files; never served the SPA shell. */
export const STATIC_ASSET_PATH =
  /\.(?:png|jpe?g|gif|webp|avif|svg|ico|bmp|woff2?|ttf|otf|eot|css|js|mjs|map)$/i;

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // A request for a static asset (image, icon, font, script, stylesheet)
  // that express.static did not find must not fall through to the SPA
  // shell: returning index.html as text/html under an image URL breaks
  // link-preview cards and favicons. Answer with a plain 404 instead.
  app.use((req, res, next) => {
    if (!STATIC_ASSET_PATH.test(req.path)) return next();
    res.status(404).type("text/plain").send("Not Found");
  });

  // fall through to index.html if the file doesn't exist
  // Inject per-page metadata server-side so every public SEO page returns
  // unique title/description/OG/Twitter/canonical without JavaScript execution
  app.use("*", async (req, res) => {
    try {
      const indexPath = path.resolve(distPath, "index.html");
      const html = await fs.promises.readFile(indexPath, "utf-8");
      const rendered = await renderSpaPage(html, req.originalUrl);
      res.status(rendered.status);
      res.set(rendered.headers);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(rendered.html);
    } catch (err) {
      res.status(500).send("Internal Server Error");
    }
  });
}
