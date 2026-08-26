import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db/db.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import billRoutes from './routes/billRoutes.js';
import paymentRequestRoutes from './routes/paymentRequestRoutes.js';
import hoRoutes from './routes/hoRoutes.js';
import caRoutes from './routes/caRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import masterRoutes from './routes/masterRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../uploads');

const app = express();
const port = process.env.PORT || 8000;

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Static file serving for invoice documents and payment proofs
app.use('/uploads', express.static(uploadDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/payment-requests', paymentRequestRoutes);
app.use('/api/ho', hoRoutes);
app.use('/api/ca', caRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/masters', masterRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy and added ci/cp pipeline',
    app: 'SKALLP Centralized Payment Module',
    architecture: 'MVC with ES6 ESM Modules',
    version: '1.0.0',
    database: `PostgreSQL (${process.env.PG_DATABASE || 'skallpDB'})`,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express Error Handler:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: (process.env.NODE_ENV || 'development') === 'development' ? err.stack : undefined
  });
});

// Start Server after PostgreSQL Pool Connection Init
async function startServer() {
  await db.initPool();
  app.listen(port, () => {
    console.log(`=============================================================`);
    console.log(`🚀 SKALLP Centralized Payment Backend running on port ${port}`);
    console.log(`🏗️ Architecture: Clean MVC Pattern (ES6 ESM Modules)`);
    console.log(`🗄️ Connected to PostgreSQL Database: ${process.env.PG_DATABASE || 'skallpDB'}`);
    console.log(`🌐 Health check: http://localhost:${port}/api/health`);
    console.log(`📁 Uploads served at: http://localhost:${port}/uploads`);
    console.log(`=============================================================`);
  });
}

startServer();
