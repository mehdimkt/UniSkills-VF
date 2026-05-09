import 'dotenv/config';
import express from 'express';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { createProxyMiddleware } from 'http-proxy-middleware';
import multer from 'multer';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;

// Configuration pour Railway
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);
const PYTHON_PORT = 5051;

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

// Fonction pour vérifier si Python est prêt
async function checkPythonHealth(timeout = 30000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`http://localhost:${PYTHON_PORT}/api/health`);
      if (response.ok) {
        console.log('[Python] Backend is ready!');
        return true;
      }
    } catch (error) {
      // Python pas encore prêt, on attend
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.error('[Python] Timeout waiting for backend to start');
  return false;
}

async function startServer() {
  const app = express();

  const mainPyPath = path.join(rootDir, 'main.py');

  if (!fs.existsSync(mainPyPath)) {
    console.error(`[Runner] ERROR: main.py not found at ${mainPyPath}`);
    process.exit(1);
  }

  // Démarrer le backend Python
  const startPythonBackend = () => {
    return new Promise((resolve: (value: any) => void, reject: (reason?: any) => void) => {
      let pythonProcess: any;

      if (IS_PRODUCTION) {
        // En production: utiliser gunicorn
        console.log('[Python] Starting with Gunicorn in production mode...');
        pythonProcess = spawn('gunicorn', [
          'main:app',
          '--bind', `0.0.0.0:${PYTHON_PORT}`,
          '--workers', '2',
          '--timeout', '120',
          '--log-level', 'info'
        ], {
          stdio: 'inherit',
          cwd: rootDir,
          env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
            PORT: PYTHON_PORT.toString(),
            FLASK_ENV: 'production'
          }
        });
      } else {
        // En développement
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        console.log(`[Python] Starting with ${pythonCmd} in development mode...`);
        pythonProcess = spawn(pythonCmd, ['-u', mainPyPath], {
          stdio: 'inherit',
          cwd: rootDir,
          env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
            PORT: PYTHON_PORT.toString()
          }
        });
      }

      pythonProcess.on('error', (err: Error) => {
        console.error('[Python] Failed to start:', err);
        reject(err);
      });

      // Donner un peu de temps à Python pour démarrer
      setTimeout(() => resolve(pythonProcess), 2000);
    });
  };

  // Démarrer Python
  let pythonProcess: any;
  try {
    pythonProcess = await startPythonBackend();
    console.log('[Python] Process started');
  } catch (err: any) {
    console.error('[Runner] Failed to start backend:', err.message);
    // Continue sans Python ? Non, on arrête
    process.exit(1);
  }

  // Attendre que Python soit vraiment prêt
  const isPythonReady = await checkPythonHealth(30000);
  if (!isPythonReady) {
    console.error('[Python] Backend failed to become ready');
    process.exit(1);
  }

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check for Node
  app.get('/health', (req: any, res: any) => {
    res.json({
      status: 'ok',
      service: 'node-proxy',
      python_alive: !!pythonProcess && !pythonProcess.killed,
      timestamp: new Date().toISOString()
    });
  });

  // File Upload API
  app.post('/api/upload', upload.single('file'), (req: any, res: any) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `/storage/${req.file.filename}`;
    res.json({ url: fileUrl });
  });

  // Serve static storage
  app.use('/storage', express.static(storageDir));

  // API Health check for proxy
  app.get('/api/proxy-health', async (req: any, res: any) => {
    try {
      const pythonHealth = await fetch(`http://localhost:${PYTHON_PORT}/api/health`);
      const pythonStatus = pythonHealth.ok ? 'healthy' : 'unhealthy';
      res.json({
        status: 'ok',
        python_alive: !!pythonProcess && !pythonProcess.killed,
        python_status: pythonStatus,
        python_port: PYTHON_PORT,
        node_env: process.env.NODE_ENV,
        railway: !!process.env.RAILWAY_SERVICE_NAME
      });
    } catch (err: any) {
      res.json({
        status: 'degraded',
        python_alive: false,
        python_error: err.message,
        python_port: PYTHON_PORT
      });
    }
  });

  // Proxy API requests to Python backend
  app.use('/api', createProxyMiddleware({
    target: `http://localhost:${PYTHON_PORT}`,
    changeOrigin: true,
    timeout: 30000,
    proxyTimeout: 30000,
    on: {
      proxyReq: (proxyReq: any, req: any, res: any) => {
        // Forward the original request headers
        if (req.headers.authorization) {
          proxyReq.setHeader('Authorization', req.headers.authorization);
        }
      },
      error: (err: Error, req: any, res: any) => {
        console.error('[Proxy] Error connecting to Python backend:', err.message);
        if (!res.headersSent) {
          res.status(502).json({
            error: 'Backend unreachable',
            details: err.message,
            python_alive: !!pythonProcess && !pythonProcess.killed,
            url: req.url
          });
        }
      }
    }
  }));

  // Serve static files and SPA
  const distPath = path.join(rootDir, 'dist');
  const publicPath = path.join(rootDir, 'public');

  // Serve static assets from dist
  if (fs.existsSync(distPath)) {
    console.log(`[Static] Serving built assets from ${distPath}`);
    app.use(express.static(distPath));
  }

  // Serve public folder assets
  if (fs.existsSync(publicPath)) {
    console.log(`[Static] Serving public assets from ${publicPath}`);
    app.use(express.static(publicPath));
  }

  // SPA fallback - all non-API routes go to index.html
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
      return next();
    }

    // Try to serve from dist first
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }

    // Fallback to development mode message
    if (!IS_PRODUCTION) {
      res.sendFile(path.join(rootDir, 'index.html'));
    } else {
      res.status(404).send('Application not built. Run `npm run build` first.');
    }
  });

  // Start the server
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Node] Server running on port ${PORT}`);
    console.log(`[Node] Environment: ${IS_PRODUCTION ? 'production' : 'development'}`);
    console.log(`[Node] Python backend: http://localhost:${PYTHON_PORT}`);
    console.log(`[Node] Health check: http://localhost:${PORT}/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[Node] Received ${signal}, shutting down gracefully...`);

    server.close(async () => {
      console.log('[Node] HTTP server closed');

      if (pythonProcess && !pythonProcess.killed) {
        console.log('[Python] Terminating Python process...');
        pythonProcess.kill('SIGTERM');
        // Give Python time to clean up
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (!pythonProcess.killed) {
          pythonProcess.kill('SIGKILL');
        }
      }

      console.log('[Node] Shutdown complete');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('[Node] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  // Handle termination signals
  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'] as const;
  signals.forEach(sig => {
    process.on(sig, () => shutdown(sig));
  });

  // Handle uncaught errors
  process.on('uncaughtException', (err: Error) => {
    console.error('[Node] Uncaught exception:', err);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason: any) => {
    console.error('[Node] Unhandled rejection:', reason);
    shutdown('unhandledRejection');
  });
}

// Start the application
startServer().catch(err => {
  console.error('[Runner] CRITICAL: Failed to start server:', err);
  process.exit(1);
});