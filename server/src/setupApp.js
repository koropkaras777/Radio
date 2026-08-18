import express, { Router } from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { CLIENT_ORIGIN, IS_PROD, JWT_SECRET } from './config/env.js';
import { CLIENT_DIST, PUBLIC_ROOT } from './config/paths.js';
import { createDocsSite } from './http/docsSite.js';

export function createLoginLimiter() {
  return rateLimit({
    windowMs       : 15 * 60 * 1000,
    max            : 10,
    standardHeaders: true,
    legacyHeaders  : false,
    handler        : (req, res) => {
      console.warn(`[Security] Rate limit hit from IP: ${req.ip}`);
      res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
    },
  });
}

export function setupApp() {
  const app = express();
  app.set('trust proxy', 1);
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'], credentials: true },
  });

  if (IS_PROD) {
    io.use((socket, next) => {
      const rawCookie = socket.request.headers.cookie || '';
      const cookies = Object.fromEntries(
        rawCookie.split(';').map((c) => {
          const [k, ...v] = c.trim().split('=');
          return [k.trim(), decodeURIComponent(v.join('='))];
        }).filter(([k]) => k)
      );
      const token = cookies['adminToken'];
      if (!token) { socket.data.isAdmin = false; return next(); }
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        socket.data.isAdmin = !err && decoded?.role === 'admin';
        next();
      });
    });
  }

  app.use(cors({
    origin     : CLIENT_ORIGIN,
    credentials: true,
  }));

  // ── Donation webhooks: mounted before express.json() (raw body needed) ─────
  const donationsWebhookRouter = Router();
  app.use(donationsWebhookRouter);

  app.use(express.json());
  app.use(cookieParser());

  app.use(createDocsSite());

  app.use(express.static(CLIENT_DIST));

  const loginLimiter = createLoginLimiter();

  return { app, httpServer, io, loginLimiter, donationsWebhookRouter };
}