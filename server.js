const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = __dirname;
const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 3000;

const ROUTE_FILES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/search", "search.html"],
  ["/search.html", "search.html"],
  ["/problem.html", "problem.html"]
]);

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

function getContentType(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function isInsideRoot(candidatePath) {
  let relativePath = path.relative(ROOT_DIR, candidatePath);
  return relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function sendFile(response, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Internal Server Error");
      return;
    }

    response.writeHead(200, { "Content-Type": getContentType(filePath) });
    response.end(data);
  });
}

function sendNotFound(response) {
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not Found");
}

function resolveRequestPath(pathname) {
  let normalizedPathname =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.replace(/\/+$/, "")
      : pathname;

  if (normalizedPathname === "/problems" || normalizedPathname.startsWith("/problems/")) {
    return path.join(ROOT_DIR, "problem.html");
  }

  let routedFile = ROUTE_FILES.get(normalizedPathname);
  if (routedFile) {
    return path.join(ROOT_DIR, routedFile);
  }

  let relativePath = pathname.replace(/^\/+/, "");
  let candidatePath = path.join(ROOT_DIR, relativePath);

  if (!isInsideRoot(candidatePath)) {
    return null;
  }

  return candidatePath;
}

const server = http.createServer((request, response) => {
  if (!request.url) {
    sendNotFound(response);
    return;
  }

  let requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  let pathname = decodeURIComponent(requestUrl.pathname);
  let filePath = resolveRequestPath(pathname);

  if (!filePath) {
    sendNotFound(response);
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      sendNotFound(response);
      return;
    }

    sendFile(response, filePath);
  });
});

server.listen(PORT, () => {
  console.log(`Contest Nexus running at http://localhost:${PORT}`);
});
