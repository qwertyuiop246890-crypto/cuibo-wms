import express from "express";
import path from "path";

process.env.TZ = "Asia/Taipei";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // The live app uses Firebase under the signed-in Google account. Keep the
  // legacy file-persistence API disabled so deployments do not expose an
  // unauthenticated data read/write path.
  app.get("/api/data", (_req, res) => {
    res.status(410).json({ error: "The app uses Firebase as the live data source." });
  });

  app.post("/api/data", (_req, res) => {
    res.status(410).json({ error: "The app uses Firebase as the live data source." });
  });

  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Express Global Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

export default startServer();
