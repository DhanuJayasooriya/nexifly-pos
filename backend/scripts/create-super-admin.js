// Creates the first Super Admin account so you can log in to a fresh database.
//
// Usage:
//   npm run create-admin -- --email admin@example.com --username admin --password "StrongPass123"
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db/pool');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

(async () => {
  const email = arg('email');
  const username = arg('username') || 'admin';
  const password = arg('password');

  if (!email || !password) {
    console.error('Usage: npm run create-admin -- --email <email> --username <name> --password <password>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO platform_user (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'super_admin')
       RETURNING id, username, email`,
      [username, email, hash]
    );
    console.log(`Super Admin created: ${rows[0].username} <${rows[0].email}>`);
  } catch (err) {
    console.error('Could not create Super Admin:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
