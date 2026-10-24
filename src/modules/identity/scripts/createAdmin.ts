import crypto from "node:crypto";
import { staffAuthService } from "../staffAuth";

function parseArgs(): { email?: string; phone?: string; name?: string } {
  const args = process.argv.slice(2);
  const result: { email?: string; phone?: string; name?: string } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--email" && i + 1 < args.length) {
      result.email = args[++i];
    } else if (arg.startsWith("--email=")) {
      result.email = arg.split("=")[1];
    } else if (arg === "--phone" && i + 1 < args.length) {
      result.phone = args[++i];
    } else if (arg.startsWith("--phone=")) {
      result.phone = arg.split("=")[1];
    } else if (arg === "--name" && i + 1 < args.length) {
      result.name = args[++i];
    } else if (arg.startsWith("--name=")) {
      result.name = arg.split("=")[1];
    }
  }

  return result;
}

function generateSecurePassword(length = 16): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i]! % chars.length];
  }
  return result;
}

async function main() {
  const { email, phone, name } = parseArgs();

  if (!email || !phone || !name) {
    console.error(`
Usage:
  pnpm staff:create-admin --email <email> --phone <phone> --name <name>

Example:
  pnpm staff:create-admin --email admin@ncamart.com --phone 01812345678 --name "Super Administrator"
`);
    process.exit(1);
  }

  const oneTimePassword = generateSecurePassword(16);

  try {
    const { staff } = await staffAuthService.createStaff({
      fullName: name,
      email,
      phone,
      password: oneTimePassword,
      roles: ["SUPER_ADMIN"],
      mustChangePassword: true,
    });

    console.log(`
==================================================================
           NCAMart Super Admin Account Provisioned
==================================================================
  Staff ID:           ${staff.id}
  Full Name:          ${staff.fullName}
  Email:              ${staff.email}
  Phone:              ${staff.phone}
  Role:               SUPER_ADMIN
  One-Time Password:  ${oneTimePassword}
------------------------------------------------------------------
  IMPORTANT SECURITY NOTICE:
  - This one-time password is displayed ONCE and cannot be recovered.
  - The administrator must log in immediately via:
    POST /api/v1/auth/staff/login
  - TOTP enrollment is required on first login.
  - The administrator must change this temporary password upon setup.
==================================================================
`);
    process.exit(0);
  } catch (err) {
    console.error("Failed to create Super Admin staff account:", err);
    process.exit(1);
  }
}

main();
