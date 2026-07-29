import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth-routes.js';
import errorHandler from './middlewares/error-handler.js';
import { AppError } from './utils/errors.js';

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());

// Diagnostic logging middleware
app.use((req, res, next) => {
  console.log(`[Auth] Received request: ${req.method} ${req.originalUrl} (req.url: ${req.url})`);
  next();
});

// Auth API Routes
app.use('/api/v1/auth', authRoutes);

// Fallback Route for Undefined Paths
app.use('*', (req, res, next) => {
  next(new AppError('NOT_FOUND', `Route ${req.originalUrl} tidak ditemukan`, 404));
});

// Global Error Handler
app.use(errorHandler);

export default app;
