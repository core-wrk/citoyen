import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { isIP } from "node:net";
import { loadEnv } from "vite";
import config from "../api/config.js";
import { toNodeHandler } from "better-auth/node";
import { auth, authReady } from "./auth.js";
import { requireStudyAccess } from "./access.js";
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
  if (pathname === "/health" && request.method === "GET") {
    response.statusCode = 200;
    response.setHeader("content-type", "text/plain; charset=utf-8");
    response.end("ok");
    return;
  }
  if (pathname.startsWith("/api/auth/")) {
    if (!authReady()) return adapter(response).status(503).json({ error: "Private sign-in is not configured." });
    if (pathname.startsWith("/api/auth/admin/")) return adapter(response).status(404).json({ error: "Not found." });
    const forwarded = request.headers["x-forwarded-for"];
    const address = process.env.RENDER === "true" && typeof forwarded === "string"
      ? forwarded.split(",").at(-1)?.trim()
      : request.socket.remoteAddress;
    delete request.headers["x-citoyen-client-ip"];
    if (address && isIP(address)) request.headers["x-citoyen-client-ip"] = address;
    return toNodeHandler(auth())(request, response);
  }
  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method || "")) {
    const origin = request.headers.origin;
    const expected = production ? process.env.BETTER_AUTH_URL : `http://${request.headers.host}`;
    if (!origin || !expected || origin !== new URL(expected).origin) {
      return adapter(response).status(403).json({ error: "Invalid request origin." });
    }
  }
  const handler = handlers[pathname];
  if (handler) {
    if (pathname === "/api/progress" && request.method === "PUT") {
      const user = await requireStudyAccess({ method: request.method, headers: request.headers }, adapter(response));
      if (!user) return;
      if (user.id !== "local" && request.headers["x-citoyen-user"] !== user.id)
        return adapter(response).status(409).json({ error: "Your account changed. Please reload the page." });
    }
    const parts: Buffer[] = [];
    let size = 0;
    for await (const part of request) {
      size += part.length;
      if (!(pathname === "/api/progress" && request.method === "PUT") && size > 1_100_000)
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
server.listen(port, process.env.HOST || (production ? "0.0.0.0" : "127.0.0.1"), () =>
  console.log(`Citoyen is available at http://127.0.0.1:${port}`),
);
async function close() {
  await vite?.close();
  server.close();
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
