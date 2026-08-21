const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const siteRoot = path.join(root, "_site");
const port = Number(process.env.PORT || 4001);
const ignoredRoots = [".git", ".sass-cache", "_site", "node_modules", "tmp"];
const watchedExtensions = new Set([
  ".css", ".html", ".jpeg", ".jpg", ".js", ".json", ".md", ".pdf",
  ".png", ".scss", ".svg", ".yml", ".yaml",
]);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

let building = false;
let ignoreEventsUntil = 0;
let debounceTimer;

function build() {
  if (building) return;

  building = true;
  console.log("\nRegenerating site...");
  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "build-local.ps1")],
    { cwd: root, stdio: "inherit", windowsHide: true },
  );

  child.on("exit", (code) => {
    building = false;
    ignoreEventsUntil = Date.now() + 1000;
    console.log(code === 0 ? "Site regenerated." : `Build failed with exit code ${code}.`);
  });
}

function scheduleBuild(filename) {
  if (building || Date.now() < ignoreEventsUntil) return;
  if (!filename) return;
  const normalized = filename.toString().replaceAll("\\", "/");
  const topLevel = normalized.split("/", 1)[0];
  if (ignoredRoots.includes(topLevel)) return;
  if (normalized === "assets/css/main.scss") return;
  if (!watchedExtensions.has(path.extname(normalized).toLowerCase())) return;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(build, 400);
}

fs.watch(root, { recursive: true }, (_event, filename) => scheduleBuild(filename));

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(request.url.split("?", 1)[0]);
  let filePath = path.resolve(siteRoot, `.${requestPath}`);

  if (!filePath.startsWith(siteRoot)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    filePath = path.join(siteRoot, "404.html");
    response.statusCode = 404;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(500).end(error.message);
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    if (extension === ".html") {
      contents = Buffer.from(
        contents.toString().replaceAll("http://localhost:4000", `http://localhost:${port}`),
      );
    }
    response.setHeader("Content-Type", mimeTypes[extension] || "application/octet-stream");
    response.end(contents);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Watching source files and serving http://localhost:${port}/`);
});
