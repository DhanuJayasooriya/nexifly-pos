require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date() }));

// ── API v1 Routes ─────────────────────────────────────────────────────────────
const v1 = express.Router();

v1.use('/', require('./modules/platform/platform.routes'));
v1.use('/', require('./modules/branch/branch.routes'));
v1.use('/', require('./modules/product/product.routes'));
v1.use('/', require('./modules/product/sku.routes'));         // ← SKU suggest+check+next
v1.use('/', require('./modules/grn/grn.routes'));
v1.use('/', require('./modules/billing/billing.routes'));
v1.use('/', require('./modules/misc.routes'));
v1.use('/', require('./modules/rental/rental.routes')); // ← Rentals

app.use('/api/v1', v1);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

const PORT = parseInt(process.env.PORT || '4000');
app.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log(`  ║  Nexifly API  →  http://localhost:${PORT}   ║`);
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');
});

// ── DB connection check on startup ────────────────────────────────────────────
const { pool } = require('./db/pool');
pool.query('SELECT NOW()')
    .then(() => console.log('  ✅  PostgreSQL connected successfully\n'))
    .catch(err => {
        console.error('  ❌  PostgreSQL connection FAILED:', err.message);
        console.error('      Check your .env DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD\n');
    });

module.exports = app;
