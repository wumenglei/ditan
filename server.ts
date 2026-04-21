import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

// SaaS Proxy Logic (from API_SPEC (1)-1.md)
const proxyRequest = async (req: express.Request, res: express.Response, targetPath: string) => {
  const saasBaseUrl = process.env.SAAS_BASE_URL || "http://aibigtree.com";
  const targetUrl = `${saasBaseUrl}${targetPath}`;
  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`[Proxy Success] ${targetPath} -> Status: ${response.status}`);
    res.status(response.status).json(response.data);
  } catch (error: any) {
    console.error(`[Proxy Error] ${targetPath} ->`, error.response?.data || error.message);
    res.status(error.response?.status || 500).json(error.response?.data || { error: "代理转发失败" });
  }
};

app.post("/api/tool/launch", (req, res) => proxyRequest(req, res, "/api/tool/launch"));
app.post("/api/tool/verify", (req, res) => proxyRequest(req, res, "/api/tool/verify"));
app.post("/api/tool/consume", (req, res) => proxyRequest(req, res, "/api/tool/consume"));

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
