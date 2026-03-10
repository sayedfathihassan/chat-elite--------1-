import Database from 'better-sqlite3';
import path from 'path';

const db = new Database('database.sqlite');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT,
    credits INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    uid TEXT UNIQUE,
    role TEXT DEFAULT 'user' -- 'admin' or 'user'
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT
  );

  CREATE TABLE IF NOT EXISTS room_roles (
    room_id INTEGER,
    user_id INTEGER,
    role TEXT NOT NULL, -- 'master', 'moderator', 'assistant', 'member'
    PRIMARY KEY (room_id, user_id),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER,
    user_id INTEGER,
    recipient_id INTEGER,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text', -- 'text', 'gift', 'system'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS bans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER,
    user_id INTEGER,
    type TEXT NOT NULL, -- 'kick', 'ban', 'mute_text', 'mute_mic'
    expires_at DATETIME,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS bot_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT DEFAULT 'general'
  );
`);

// Insert default questions if empty
const questionCount = db.prepare("SELECT COUNT(*) as count FROM bot_questions").get() as { count: number };
if (questionCount.count === 0) {
  const defaultQuestions = [
    { q: "ما هي عاصمة السعودية؟", a: "الرياض" },
    { q: "كم عدد قارات العالم؟", a: "7" },
    { q: "ما هو أطول نهر في العالم؟", a: "النيل" },
    { q: "ما هو الكوكب الأحمر؟", a: "المريخ" },
    { q: "كم عدد ركعات صلاة الفجر؟", a: "2" },
    { q: "ما هي لغة القرآن الكريم؟", a: "العربية" },
    { q: "من هو خاتم الأنبياء؟", a: "محمد" },
    { q: "ما هو الحيوان الذي يسمى سفينة الصحراء؟", a: "الجمل" },
    { q: "ما هي أكبر دولة في العالم مساحة؟", a: "روسيا" },
    { q: "ما هو أسرع حيوان بري؟", a: "الفهد" },
    { q: "ما هي عاصمة مصر؟", a: "القاهرة" },
    { q: "كم عدد سور القرآن الكريم؟", a: "114" },
    { q: "ما هو لون الزمرد؟", a: "أخضر" },
    { q: "ما هي عاصمة الإمارات؟", a: "أبوظبي" },
    { q: "كم عدد أيام السنة الكبيسة؟", a: "366" }
  ];

  const insert = db.prepare("INSERT INTO bot_questions (question, answer) VALUES (?, ?)");
  const insertMany = db.transaction((qs) => {
    for (const q of qs) insert.run(q.q, q.a);
  });
  insertMany(defaultQuestions);
}

// Migration: Add recipient_id to messages if not exists
try {
  db.exec("ALTER TABLE messages ADD COLUMN recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
} catch (e) { }

// Migration: Add total_spent to users if not exists
try {
  db.exec("ALTER TABLE users ADD COLUMN total_spent INTEGER DEFAULT 0");
} catch (e) { }

// Migration: Add uid to users if not exists
try {
  db.exec("ALTER TABLE users ADD COLUMN uid TEXT");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uid ON users(uid)");
  console.log("Added uid column and unique index to users table");
} catch (e: any) {
  if (!e.message.includes("duplicate column name")) {
    console.error("Error adding uid column:", e.message);
  }
}

// Migration: Add join_effect to users if not exists
try {
  db.exec("ALTER TABLE users ADD COLUMN join_effect TEXT DEFAULT NULL");
  console.log("Added join_effect column to users table");
} catch (e: any) {
  if (!e.message.includes("duplicate column name")) {
    console.error("Error adding join_effect column:", e.message);
  }
}

// Migration: Add settings to rooms if not exists
try {
  db.exec("ALTER TABLE rooms ADD COLUMN is_private INTEGER DEFAULT 0");
  db.exec("ALTER TABLE rooms ADD COLUMN slow_mode INTEGER DEFAULT 0");
  db.exec("ALTER TABLE rooms ADD COLUMN background_image TEXT DEFAULT NULL");
  console.log("Added settings columns to rooms table");
} catch (e: any) {
  if (!e.message.includes("duplicate column name")) {
    console.error("Error adding room settings columns:", e.message);
  }
}

// Migration: Add customization columns to users
try {
  db.exec("ALTER TABLE users ADD COLUMN text_color TEXT DEFAULT '#ffffff'");
  db.exec("ALTER TABLE users ADD COLUMN bubble_style TEXT DEFAULT 'default'");
  console.log("Added customization columns to users table");
} catch (e: any) {
  if (!e.message.includes("duplicate column name")) {
    console.error("Error adding user customization columns:", e.message);
  }
}

// Migration: Add is_banned to users if not exists
try {
  db.exec("ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0");
  console.log("Added is_banned column to users table");
} catch (e: any) {
  if (!e.message.includes("duplicate column name")) {
    console.error("Error adding is_banned column:", e.message);
  }
}

export default db;
