import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedProductionDatabase } from "./services/seed-production";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Health check endpoint - must be registered early
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

(async () => {
  try {
    log("Starting server initialization...");
    
    // Seed database (non-blocking - server will start even if seeding fails)
    try {
      await seedProductionDatabase();
    } catch (seedError) {
      console.error("[Server] Warning: Database seeding failed, but continuing startup:", seedError);
    }

    log("Registering routes...");
    await registerRoutes(httpServer, app);

    // Error handler must be registered after routes but before static serving
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Log the error but don't throw - throwing after sending response can crash the server
      console.error("[Express Error]", status, message, err);
      
      // Only send response if headers haven't been sent
      if (!res.headersSent) {
        res.status(status).json({ message });
      }
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (process.env.NODE_ENV === "production") {
      log("Setting up static file serving...");
      serveStatic(app);
    } else {
      log("Setting up Vite dev server...");
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Railway automatically sets PORT - use that value
    // Default to 5000 if not specified (for local development)
    const port = parseInt(process.env.PORT || "5000", 10);
    
    if (isNaN(port) || port <= 0 || port > 65535) {
      throw new Error(`Invalid PORT value: ${process.env.PORT}. Must be a number between 1 and 65535.`);
    }

    log(`Starting HTTP server on port ${port}...`);
    
    // Remove reusePort as it's not a standard Node.js option and may not be supported on Railway
    httpServer.listen(port, "0.0.0.0", () => {
      log(`✓ Server is running on port ${port}`);
      log(`✓ Health check available at http://0.0.0.0:${port}/health`);
      log(`✓ Environment: ${process.env.NODE_ENV || "development"}`);
    }).on("error", (err: NodeJS.ErrnoException) => {
      console.error("[Server] Failed to start server:", err);
      if (err.code === "EADDRINUSE") {
        console.error(`[Server] Port ${port} is already in use`);
      } else if (err.code === "EACCES") {
        console.error(`[Server] Permission denied to bind to port ${port}`);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error("[Server] Failed to initialize server:", error);
    if (error instanceof Error) {
      console.error("[Server] Error details:", error.message);
      console.error("[Server] Stack trace:", error.stack);
    }
    process.exit(1);
  }
})();
