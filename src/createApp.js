import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.static(path.join(rootDir, config.staticDir)));
  app.use('/shared', express.static(path.join(rootDir, config.sharedDir)));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
