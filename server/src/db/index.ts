import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "./schema.js";
import { runMigrations } from "./migrate.js";
import { DEFAULT_SETTINGS, type StoredSettings } from "../settings.js";

export const DATA_DIR = process.env.DATA_DIR || "./data";
export const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, "thumbs"), { recursive: true });

const sqlite = new Database(path.join(DATA_DIR, "slashslack.sqlite"));
runMigrations(sqlite);

export const db = drizzle(sqlite, { schema });
export const raw: Database.Database = sqlite;

/** Seed default settings + a starter category and #general channel. */
export function seed() {
  const existing = db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.id, 1))
    .get();
  if (!existing) {
    db.insert(schema.appSettings)
      .values({ id: 1, data: JSON.stringify(DEFAULT_SETTINGS) })
      .run();
  }

  const anyChannel = db.select().from(schema.channels).limit(1).get();
  if (!anyChannel) {
    const cat = db
      .insert(schema.categories)
      .values({ name: "General", icon: "hash", position: 0 })
      .returning()
      .get();
    db.insert(schema.channels)
      .values({
        name: "general",
        topic: "Company-wide announcements and chit-chat",
        icon: "megaphone",
        isPromoted: true,
        categoryId: cat.id,
        position: 0,
        createdBy: 0,
      })
      .run();
    db.insert(schema.channels)
      .values({
        name: "random",
        topic: "Non-work banter and water-cooler chat",
        icon: "coffee",
        categoryId: cat.id,
        position: 1,
        createdBy: 0,
      })
      .run();
  }
}

export function getSettings(): StoredSettings {
  const row = db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.id, 1))
    .get();
  if (!row) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...JSON.parse(row.data) };
}

export function saveSettings(next: StoredSettings) {
  db.update(schema.appSettings)
    .set({ data: JSON.stringify(next) })
    .where(eq(schema.appSettings.id, 1))
    .run();
}
