import Database from "better-sqlite3";

/**
 * Idempotent schema setup. Runs on every boot. Uses CREATE ... IF NOT EXISTS
 * so it is safe to run repeatedly against an existing database.
 */
export function runMigrations(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'folder',
      position INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      topic TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT 'hash',
      is_private INTEGER NOT NULL DEFAULT 0,
      is_promoted INTEGER NOT NULL DEFAULT 0,
      category_id INTEGER,
      position INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS channel_members (
      channel_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      last_read_message_id INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'member',
      PRIMARY KEY (channel_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS dm_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dm_members (
      dm_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      last_read_message_id INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (dm_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER,
      dm_id INTEGER,
      parent_id INTEGER,
      user_id INTEGER NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      edited_at TEXT,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, id);
    CREATE INDEX IF NOT EXISTS idx_messages_dm ON messages(dm_id, id);
    CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id);

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER,
      uploader_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      storage_path TEXT NOT NULL,
      thumb_path TEXT
    );

    CREATE TABLE IF NOT EXISTS link_previews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      description TEXT,
      image TEXT,
      site_name TEXT
    );

    CREATE TABLE IF NOT EXISTS reactions (
      message_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      PRIMARY KEY (message_id, user_id, emoji)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      actor_id INTEGER,
      channel_id INTEGER,
      dm_id INTEGER,
      message_id INTEGER,
      preview TEXT NOT NULL DEFAULT '',
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      user_id INTEGER NOT NULL,
      message_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, message_id)
    );

    CREATE TABLE IF NOT EXISTS invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      invited_by INTEGER NOT NULL,
      accepted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- per-user personal sidebar layout (overrides admin default order/category)
    CREATE TABLE IF NOT EXISTS user_channel_layout (
      user_id INTEGER NOT NULL,
      channel_id INTEGER NOT NULL,
      category_id INTEGER,
      position INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, channel_id)
    );

    -- secure incoming webhooks for posting to a channel programmatically
    CREATE TABLE IF NOT EXISTS channel_webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT 'Webhook',
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Full text search over message bodies
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      body,
      content='messages',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(rowid, body) VALUES (new.id, new.body);
    END;
    CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, body) VALUES('delete', old.id, old.body);
    END;
    CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, body) VALUES('delete', old.id, old.body);
      INSERT INTO messages_fts(rowid, body) VALUES (new.id, new.body);
    END;
  `);

  // additive columns (SQLite has no ADD COLUMN IF NOT EXISTS)
  addColumn(db, "messages", "pinned_at", "TEXT");
  addColumn(db, "messages", "pinned_by", "INTEGER");
  addColumn(db, "users", "status_text", "TEXT");
  addColumn(db, "users", "is_bot", "INTEGER NOT NULL DEFAULT 0");
  addColumn(db, "channel_webhooks", "bot_user_id", "INTEGER");

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_channel_favorites (
      user_id INTEGER NOT NULL,
      channel_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, channel_id)
    );
  `);
}

function addColumn(db: Database.Database, table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

// Allow running standalone: `tsx src/db/migrate.ts`
if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  const path = await import("node:path");
  const fs = await import("node:fs");
  const dir = process.env.DATA_DIR || "./data";
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "slashslack.sqlite"));
  runMigrations(db);
  console.log("Migrations applied.");
  db.close();
}
