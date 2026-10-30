/**
 * NCAMart cPanel / CloudLinux Passenger Startup File (server.js)
 *
 * Used by ExonHost cPanel ("Setup Node.js App") as the Application Startup File.
 * Automatically binds to the PORT or socket provided by Phusion Passenger / cPanel.
 */
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error("Error occurred handling request:", req.url, err);
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    })
      .once("error", (err) => {
        console.error("Server error:", err);
        process.exit(1);
      })
      .listen(port, () => {
        console.log(`> NCAMart Ready on http://${hostname}:${port} (env: ${process.env.NODE_ENV || "production"})`);
      });
  })
  .catch((err) => {
    console.error("Failed to start Next.js server:", err);
    process.exit(1);
  });

