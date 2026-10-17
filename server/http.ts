export interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}
export interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  setHeader?(name: string, value: string): unknown;
}
export function send(res: ApiResponse, status: number, body: unknown) {
  res.setHeader?.("cache-control", "no-store");
  res.status(status).json(body);
}
