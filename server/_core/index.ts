import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import rateLimit from "express-rate-limit";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerFredProxy } from "../fredProxy";
import { registerSignalsProxy } from "../signalsProxy";
import { registerCoinGeckoProxy } from "../coingeckoProxy";
import { registerSEORoutes } from "../seoRoutes";
import analyticsRoutes from "../analyticsRoutes";
import { handleStripeWebhook } from "../stripe/webhook";
import { handleScheduledPublishBlog } from "../scheduledBlog";
import { handleScheduledXPost, handleXNewsMonitor } from "../scheduledXPost";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// Rate limiters
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // 120 requests/min per IP — generous for a dashboard app
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
  skip: (req) => process.env.NODE_ENV === "development",
});

const signalsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,             // 60 req/min for market data endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Market data rate limit exceeded." },
  skip: (req) => process.env.NODE_ENV === "development",
});

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Security: minimal response headers
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        // 'unsafe-inline' required for manus-runtime platform script injected at deploy time
        // googletagmanager.com + google-analytics.com required for GA4
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://manus-analytics.com https://us.umami.is https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        // Allow manus storage CDN for OG image and uploaded assets
        "img-src 'self' data: blob: https://d2xsxph8kpxj0f.cloudfront.net https://assets.coingecko.com https://*.manus.space https://*.cloudfront.net https://www.google-analytics.com https://www.googletagmanager.com",
        // Allow connections to manus analytics, storage, and GA4 collect endpoints
        "connect-src 'self' https://manus-analytics.com https://us.umami.is https://*.manus.space https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://region1.google-analytics.com https://www.googletagmanager.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ")
    );
    next();
  });

  // Stripe webhook MUST use raw body BEFORE express.json() for signature verification
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

  // Body parser — 1mb default, storage proxy registers its own 50mb limit before this
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  // Apply rate limiting to API routes
  app.use("/api/trpc", apiLimiter);
  app.use("/api/signals", signalsLimiter);
  app.use("/api/fred", apiLimiter);
  app.use("/api/crypto", signalsLimiter);

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerFredProxy(app);
  registerSignalsProxy(app);
  registerCoinGeckoProxy(app);
  registerSEORoutes(app);
  app.use("/api/analytics", analyticsRoutes);

  // Scheduled cron endpoints — must be before tRPC / Vite fallthrough
  app.post("/api/scheduled/ping", (_req, res) => res.json({ ok: true }));
  app.post("/api/scheduled/publish-blog", handleScheduledPublishBlog);
  app.post("/api/scheduled/x-post-scheduled", handleScheduledXPost);
  app.post("/api/scheduled/x-news-monitor", handleXNewsMonitor);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    process.stderr.write(`Port ${preferredPort} is busy, using port ${port} instead\n`);
  }

  server.listen(port, () => {
    process.stdout.write(`Server running on http://localhost:${port}/\n`);
  });
}

startServer().catch(console.error);
