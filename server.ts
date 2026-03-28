import express from "express";
import path from "path";
import fs from "fs/promises";
import { format, parse } from "date-fns";
import { formatInTimeZone } from 'date-fns-tz';
import { Product, Customer, Order } from "./src/types";

// Set Taiwan Timezone
process.env.TZ = 'Asia/Taipei';

const DATA_FILE = path.join(process.cwd(), "data.json");

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize data file if it doesn't exist
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({
      products: [],
      customers: [],
      orders: [],
      settings: {
        notificationTemplate: "您好 {customerName}，您的訂單 {orderList} 已配貨完成，總金額為 {totalAmount} 元。感謝您的購買！"
      }
    }, null, 2));
  }

  // Robust body parsing: use express.json() if body is not already parsed
  app.use((req, res, next) => {
    if ('body' in req) {
      // Body already parsed by Vercel or another middleware
      next();
    } else {
      // Body not parsed, use express.json()
      express.json({ limit: '50mb' })(req, res, next);
    }
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- Server Data Persistence Routes ---
  app.get("/api/data", async (req, res) => {
    try {
      const data = await fs.readFile(DATA_FILE, "utf-8");
      res.json(JSON.parse(data));
    } catch (error) {
      res.status(500).json({ error: "讀取資料失敗" });
    }
  });

  app.post("/api/data", async (req, res) => {
    try {
      const data = req.body;
      console.log(`[Server] 正在儲存資料... 商品: ${data.products?.length}, 顧客: ${data.customers?.length}, 訂單: ${data.orders?.length}`);
      await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
      res.json({ success: true });
    } catch (error) {
      console.error("[Server] 儲存資料失敗:", error);
      res.status(500).json({ error: "儲存資料失敗" });
    }
  });

  // Vite middleware for development
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler to ensure JSON responses
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Express Global Error:", err);
    res.status(500).json({ error: "Internal Server Error", details: err.message || String(err) });
  });

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

export default startServer();
