import 'dotenv/config';
import express from 'express';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { createProxyMiddleware } from 'http-proxy-middleware';
import multer from 'multer';

const rootDir = process.cwd();

// Ensure storage directory exists
let storageDir = path.join(rootDir, 'storage');
try {
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
} catch (err) {
  console.warn(`[Runner] Could not create storage in ${storageDir}, falling back to /tmp/storage`);
  storageDir = path.join('/tmp', 'storage');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, storageDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

async function startServer() {
  
  const app = express();
  const PORT = 3000;
  const PYTHON_PORT = 5051; // Use 5050
  const mainPyPath = path.join(rootDir, 'main.py');

  
  if (!fs.existsSync(mainPyPath)) {
    console.error(`[Runner] ERROR: main.py not found at ${mainPyPath}`);
  }

  const getPythonCmd = () => {
    if (process.platform === 'win32') return 'python';
    return 'python3';
  };

  let pythonCmd = getPythonCmd();
  
  const spawnPython = (cmd) => {
    return spawn(cmd, ['-u', mainPyPath], {
      stdio: 'inherit',
      cwd: rootDir,
      env: { 
        ...process.env, 
        PYTHONUNBUFFERED: '1',
        PORT: PYTHON_PORT.toString()
      }
    });
  };

  let pythonProcess = spawnPython(pythonCmd);

  const setupPythonHandlers = (proc) => {
    proc.on('error', (err) => {
      console.error(`[Runner] Failed to start Python process with ${pythonCmd}:`, err);
      if (pythonCmd === 'python3') {
        pythonCmd = 'python';
        pythonProcess = spawnPython(pythonCmd);
        setupPythonHandlers(pythonProcess);
      } else {
        console.error('[Runner] CRITICAL: Python not found or failed to start. Continuing without backend...');
      }
    });

    proc.on('close', (code) => {
      // Don't necessarily exit the whole app unless it's a fatal crash at startup
    });
  };

  setupPythonHandlers(pythonProcess);

  // Root health check
  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'node-proxy' }));

  // File Upload API
  app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `/storage/${req.file.filename}`;
    res.json({ url: fileUrl });
  });

  // Serve static storage
  app.use('/storage', express.static(storageDir));

  // API Health check for proxy
  app.get('/api/proxy-health', (req, res) => {
    res.json({ 
      status: 'ok', 
      python_alive: !!pythonProcess && !pythonProcess.killed, 
      python_port: PYTHON_PORT,
      env: process.env.NODE_ENV
    });
  });

  // Proxy API requests to Python backend
  app.use(createProxyMiddleware({
    pathFilter: '/api',
    target: `http://localhost:${PYTHON_PORT}`,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req, res) => {
      },
      error: (err, req, res) => {
        console.error('[Proxy] Error connecting to Python backend:', err.message);
        const response = res as any;
        if (response.headersSent === false && typeof response.status === 'function') {
          response.status(502).json({ 
            error: 'Backend unreachable', 
            details: err.message,
            python_alive: !!pythonProcess && !pythonProcess.killed,
            url: req.url
          });
        }
      }
    }
  }));

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    try {
      // @ts-ignore
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error('[Runner] Failed to load Vite:', e.message);
    }
  } else {
    const distPath = path.join(rootDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {

  });

  // Relay signals to child
  const signals = ['SIGTERM', 'SIGINT'] as const;
  signals.forEach(sig => {
    process.on(sig, () => {
      if (pythonProcess) {
        try {
          pythonProcess.kill(sig);
        } catch (e) {}
      }
      process.exit(0);
    });
  });
}

startServer().catch(err => {
  console.error('[Runner] CRITICAL: Failed to start server:', err);
  process.exit(1);
});
