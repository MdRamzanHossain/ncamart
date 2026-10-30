#!/usr/bin/env node
/**
 * 1-Click cPanel Git Pull & Auto-Permission Script (Pure CommonJS)
 * Uses single-threaded git (pack.threads=1) for CloudLinux LVE compatibility,
 * with an automatic curl+tar fallback if CloudLinux restricts git threads.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const repoUrl = "https://github.com/MdRamzanHossain/ncamart.git";
const tarballUrl = "https://codeload.github.com/MdRamzanHossain/ncamart/tar.gz/refs/heads/main";

function run(cmd) {
  console.log(`> ${cmd}`);
  const out = execSync(cmd, { cwd: rootDir, encoding: "utf-8" });
  if (out && out.trim()) console.log(out.trim());
}

try {
  console.log("=== NCAMart 1-Click Git Update Starting ===");

  // Back up .env in memory as an extra safety guarantee
  const envPath = path.join(rootDir, ".env");
  const envBackup = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : null;

  try {
    // 1. Initialize git repository if .git/HEAD is missing
    const gitHeadPath = path.join(rootDir, ".git", "HEAD");
    if (!fs.existsSync(gitHeadPath)) {
      run("rm -rf .git");
      run("git init -b main");
      run(`git remote add origin ${repoUrl}`);
    } else {
      try {
        run(`git remote set-url origin ${repoUrl}`);
      } catch (_) {
        run(`git remote add origin ${repoUrl}`);
      }
    }

    // Force single-threaded git pack indexing for CloudLinux LVE limits
    run("git config pack.threads 1");
    run("git config http.postBuffer 524288000");

    // 2. Single-threaded shallow fetch & reset
    run("git -c pack.threads=1 fetch --depth 1 origin main");
    run("git reset --hard origin/main");
  } catch (gitErr) {
    console.log("CloudLinux thread limit hit during git fetch; switching to direct GitHub tarball sync...");
    run(`curl -sL "${tarballUrl}" | tar -xz --strip-components=1`);
  }

  // Restore .env if needed
  if (envBackup) {
    fs.writeFileSync(envPath, envBackup, "utf-8");
  }

  // Sync server.js with server.cjs and fix directory permissions for Passenger
  run("cp -f server.cjs server.js || true");
  run("chmod -R u+rwX,go+rX .next public src scripts || true");

  console.log("=========================================================");
  console.log("SUCCESS: Latest code & .next build pulled from GitHub!");
  console.log("Now click the 'Restart' button in cPanel Setup Node.js App.");
  console.log("=========================================================");
} catch (err) {
  console.error("Update Failed:", err.message);
  process.exit(1);
}
