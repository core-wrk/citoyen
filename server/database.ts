import pg from "pg";

let pool: pg.Pool | undefined;

export function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error("Database is not configured.");
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}
