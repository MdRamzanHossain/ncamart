const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const argon2 = require("argon2");

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--email" && i + 1 < args.length) result.email = args[++i];
    else if (arg.startsWith("--email=")) result.email = arg.split("=")[1];
    else if (arg === "--phone" && i + 1 < args.length) result.phone = args[++i];
    else if (arg.startsWith("--phone=")) result.phone = arg.split("=")[1];
    else if (arg === "--name" && i + 1 < args.length) result.name = args[++i];
    else if (arg.startsWith("--name=")) result.name = arg.split("=")[1];
    else if (arg === "--password" && i + 1 < args.length) result.password = args[++i];
    else if (arg.startsWith("--password=")) result.password = arg.split("=")[1];
  }
  return result;
}

function generateSecurePassword(length = 16) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function normalizeBdPhone(phone) {
  const clean = phone.replace(/[\s\-\(\)]/g, "");
  if (clean.startsWith("+880")) return clean;
  if (clean.startsWith("880")) return "+" + clean;
  if (clean.startsWith("0")) return "+88" + clean;
  return clean;
}

async function main() {
  const args = parseArgs();
  const email = (args.email || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const phone = (args.phone || process.env.ADMIN_PHONE || "").trim();
  const name = (args.name || process.env.ADMIN_NAME || "Super Administrator").trim();
  const password = args.password || process.env.ADMIN_PASSWORD || generateSecurePassword(16);

  if (!email || !phone) {
    console.error("Usage: node scripts/create-admin.cjs --email <email> --phone <phone> [--name <name>] [--password <password>]");
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL environment variable is missing.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const passwordHash = await argon2.hash(password);
    const normalizedPhone = normalizeBdPhone(phone);

    // Upsert or insert staff
    const staffRes = await pool.query(
      `INSERT INTO staff (full_name, email, phone, password_hash, totp_enabled, status, must_change_password)
       VALUES ($1, $2, $3, $4, false, 'ACTIVE', false)
       ON CONFLICT (email) DO UPDATE 
       SET full_name = EXCLUDED.full_name,
           phone = EXCLUDED.phone,
           password_hash = EXCLUDED.password_hash,
           status = 'ACTIVE'
       RETURNING id, full_name, email, phone;`,
      [name, email, normalizedPhone, passwordHash]
    );

    const staffId = staffRes.rows[0].id;

    // Assign SUPER_ADMIN role
    await pool.query(
      `INSERT INTO staff_roles (staff_id, role)
       VALUES ($1, 'SUPER_ADMIN')
       ON CONFLICT DO NOTHING;`,
      [staffId]
    );

    console.log(`
==================================================================
           NCAMart Super Admin Account Provisioned
==================================================================
  Staff ID:           ${staffId}
  Full Name:          ${staffRes.rows[0].full_name}
  Email:              ${staffRes.rows[0].email}
  Phone:              ${staffRes.rows[0].phone}
  Role:               SUPER_ADMIN
  Admin Password:     ${password}
------------------------------------------------------------------
  IMPORTANT SECURITY NOTICE:
  - Keep this password safe.
  - Log in to your Admin Panel at: https://ncamart.com/auth/login?mode=staff
==================================================================
`);
  } catch (err) {
    console.error("Failed to create Super Admin staff account:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

