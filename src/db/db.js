import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables directly from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

let pool = null;

export async function initPool() {
  try {
    const dbName = process.env.PG_DATABASE || 'skallpDB';
    const dbHost = process.env.PG_HOST || 'localhost';
    const dbPort = process.env.PG_PORT || 5432;
    const dbUser = process.env.PG_USER || 'postgres';
    const dbPassword = process.env.PG_PASSWORD || 'admin123';
    const dbUrl = process.env.DATABASE_URL || `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;

    pool = new Pool({
      connectionString: dbUrl,
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      connectionTimeoutMillis: 5000
    });

    const client = await pool.connect();
    await client.query('SELECT 1;');
    client.release();
    console.log(`✅ Connected to PostgreSQL database '${dbName}' successfully!`);

    // Initialize Schema on Postgres
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schemaSql);

    // Sync primary key SERIAL sequences for all tables to prevent duplicate key constraint errors
    const tables = [
      'users', 'vendors', 'bills', 'branches', 'projects',
      'bill_documents', 'payment_requests', 'ho_queries',
      'payment_transactions', 'audit_logs', 'notifications'
    ];

    for (const table of tables) {
      try {
        await pool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1)) FROM ${table};`);
      } catch (seqErr) {
        // Ignore silent sequence sync warning
      }
    }

    console.log('✅ PostgreSQL schema verified & SERIAL sequences synchronized.');
  } catch (err) {
    console.error(`❌ PostgreSQL Connection Error:`, err.message);
    throw err;
  }
}

export async function query(sqlText, params = []) {
  if (!pool) {
    throw new Error('PostgreSQL pool not initialized.');
  }
  return await pool.query(sqlText, params);
}

export function getPool() {
  return pool;
}

export default {
  initPool,
  query,
  getPool
};
