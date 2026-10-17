import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { loadEnv } from "vite";
import config from "../api/config.js";
import auth from "../api/auth.js";
import progress from "../api/progress.js";
import feedback from "../api/speaking-feedback.js";
import azure from "../api/azure-token.js";
import type { ApiRequest, ApiResponse } from "./http.js";

const production = process.argv.includes("--production");
if (production) process.env.NODE_ENV = "production";
const env = loadEnv(
  production ? "production" : "development",
  process.cwd(),
  "",
);
for (const [name, value] of Object.entries(env))
  if (process.env[name] === undefined) process.env[name] = value;
const handlers: Record<string, (req: ApiRequest, res: ApiResponse) => unknown> =
  {
    "/api/config": config,
    "/api/auth": auth,
    "/api/progress": progress,
    "/api/speaking-feedback": feedback,
    "/api/azure-token": azure,
  };
const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
const root = resolve("dist");
const vite = production
  ? null
  : await (
      await import("vite")
    ).createServer({ server: { middlewareMode: true }, appType: "spa" });

function adapter(response: ServerResponse): ApiResponse {
  return {
    status(code) {
      response.statusCode = code;
      return this;
    },
    json(body) {
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.setHeader("cache-control", "no-store");
      response.end(JSON.stringify(body));
    },
  };
}
async function handle(request: IncomingMessage, response: ServerResponse) {
  const pathname = new URL(request.url || "/", "http://localhost").pathname;
  const handler = handlers[pathname];
  if (handler) {
    const parts: Buffer[] = [];
    let size = 0;
    for await (const part of request) {
      size += part.length;
      if (size > 1_100_000)
        return adapter(response)
          .status(413)
          .json({ error: "Request is too large." });
      parts.push(part);
    }
    let body: unknown;
    try {
      body = parts.length
        ? JSON.parse(Buffer.concat(parts).toString("utf8"))
        : {};
    } catch {
      return adapter(response)
        .status(400)
        .json({ error: "Invalid JSON request." });
    }
    await handler(
      { method: request.method, headers: request.headers, body },
      adapter(response),
    );
    return;
  }
  if (pathname.startsWith("/api/")) {
    response.statusCode = 404;
    response.end("Unknown API route");
    return;
  }
  if (vite) {
    vite.middlewares(request, response);
    return;
  }
  if (!["GET", "HEAD"].includes(request.method || "")) {
    response.statusCode = 405;
    response.end();
    return;
  }
  const file = resolve(
    root,
    `.${decodeURIComponent(pathname === "/" ? "/index.html" : pathname)}`,
  );
  if (!file.startsWith(root + sep)) {
    response.statusCode = 403;
    response.end();
    return;
  }
  try {
    if (!(await stat(file)).isFile()) throw new Error();
    response.setHeader(
      "content-type",
      types[extname(file)] || "application/octet-stream",
    );
    if (request.method === "HEAD") response.end();
    else createReadStream(file).pipe(response);
  } catch {
    response.statusCode = 404;
    response.end("Page not found");
  }
}
const server = createServer((request, response) => {
  void handle(request, response).catch(() => {
    if (!response.writableEnded)
      adapter(response)
        .status(500)
        .json({ error: "The request could not be completed." });
  });
});
const port = Number(process.env.PORT || 3000);
server.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(`Citoyen is available at http://127.0.0.1:${port}`),
);
async function close() {
  await vite?.close();
  server.close();
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
