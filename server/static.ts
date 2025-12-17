import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `WARNING: Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
    // In production, serve a basic message instead of crashing
    app.use("*", (_req, res) => {
      res.status(500).json({ 
        error: "Application not built properly",
        message: "Static files not found. Please ensure the build process completed successfully."
      });
    });
    return;
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
