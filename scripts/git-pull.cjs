/**
 * NCAMart cPanel 1-Click Git Pull & Permission Sync (scripts/git-pull.cjs)
 *
 * Run via cPanel "Setup Node.js App" -> "Run JS script" -> "git:pull"
 * Safely fetches the latest code and pre-built .next bundle from GitHub (origin/main),
 * preserves .env and public/uploads, and sets 0755 permissions on all folders.
 */
const { execSync } = require("child_process");

function run(cmd) {
  console.log(`> ${cmd}`);
  const out = execSync(cmd, { cwd: process.cwd(), encoding: "utf-8" });
  if (out) console.log(out.trim());
}

function main() {
  try {
    console.log("=======================================================");
    console.log("  Pulling latest update & .next build from GitHub...   ");
    console.log("=======================================================");

    run("git fetch origin main");
    run("git reset --hard origin/main");

    // Ensureserver.cjs exists alongside server.js
    run("cp -f server.cjs server.js || true");

    // Ensure Linux directory permissions are 0755
    run("chmod -R u+rwX,go+rX .next public src scripts || true");

    console.log("\n=======================================================");
    console.log("  UPDATE COMPLETE! Now click 'Restart' in cPanel.      ");
    console.log("=======================================================\n");
  } catch (err) {
    console.error("Git pull failed:", err.message);
    process.exit(1);
  }
}

main();

