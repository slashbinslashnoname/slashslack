import Database from "better-sqlite3";
import { MIGRATIONS } from "./migrations.js";

/**
 * Apply any pending migrations in order. Each migration runs once inside a
 * transaction and is recorded in `_migrations`. Safe to call on every boot.
 */
export function runMigrations(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    (db.prepare("SELECT id FROM _migrations").all() as { id: string }[]).map((r) => r.id),
  );

  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    const tx = db.transaction(() => {
      m.up(db);
      db.prepare("INSERT INTO _migrations (id) VALUES (?)").run(m.id);
    });
    tx();
    console.log(`[migrate] applied ${m.id}`);
  }
}

// Allow running standalone: `npm run migrate`
if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  const path = await import("node:path");
  const fs = await import("node:fs");
  const dir = process.env.DATA_DIR || "./data";
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "slashslack.sqlite"));
  runMigrations(db);
  console.log("Migrations up to date.");
  db.close();
}
