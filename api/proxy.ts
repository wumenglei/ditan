import express, { type Request, type Response } from 'express';

const app = express();
app.use(express.json({ limit: '10mb' }));

const targetBaseUrl = process.env.SAAS_API_BASE_URL || 'http://aibigtree.com';
const allowedToolPaths = new Set([
  '/api/tool/launch',
  '/api/tool/verify',
  '/api/tool/consume',
]);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
});

const resolveTargetPath = (req: Request) => {
  const queryPath = typeof req.query.path === 'string' ? req.query.path : '';
  const path = queryPath || req.path;
  return allowedToolPaths.has(path) ? path : '';
};

const proxyRequest = async (req: Request, res: Response) => {
  const targetPath = resolveTargetPath(req);
  if (!targetPath) {
    res.status(404).json({ success: false, message: '未知的代理路径' });
    return;
  }

  try {
    const response = await fetch(`${targetBaseUrl}${targetPath}`, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method === 'GET' ? undefined : JSON.stringify(req.body || {}),
    });

    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      res.status(response.status).json(JSON.parse(text));
      return;
    }

    res.status(response.status).send(text);
  } catch (error) {
    console.error('代理转发失败:', error);
    res.status(500).json({ success: false, message: '代理转发失败' });
  }
};

app.post('/api/tool/launch', proxyRequest);
app.post('/api/tool/verify', proxyRequest);
app.post('/api/tool/consume', proxyRequest);
app.post('/api/proxy', proxyRequest);
app.options('/api/proxy', (_req, res) => res.status(200).end());

export default app;
