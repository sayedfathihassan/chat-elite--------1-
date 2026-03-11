import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/chat_elite';
const sql = postgres(connectionString, {
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Initialize tables
async function initDb() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        avatar TEXT,
        credits INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        exp INTEGER DEFAULT 0,
        total_spent INTEGER DEFAULT 0,
        uid TEXT UNIQUE,
        role TEXT DEFAULT 'user',
        join_effect TEXT DEFAULT NULL,
        text_color TEXT DEFAULT '#ffffff',
        bubble_style TEXT DEFAULT 'default',
        is_banned INTEGER DEFAULT 0
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        is_private INTEGER DEFAULT 0,
        slow_mode INTEGER DEFAULT 0,
        background_image TEXT DEFAULT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS room_roles (
        room_id INTEGER,
        user_id INTEGER,
        role TEXT NOT NULL,
        PRIMARY KEY (room_id, user_id),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        room_id INTEGER,
        user_id INTEGER,
        recipient_id INTEGER,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS bans (
        id SERIAL PRIMARY KEY,
        room_id INTEGER,
        user_id INTEGER,
        type TEXT NOT NULL,
        expires_at TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS bot_questions (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        category TEXT DEFAULT 'general'
      );
    `;

    // Insert default questions if empty
    const questions = await sql`SELECT id FROM bot_questions LIMIT 1`;
    if (questions.length === 0) {
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

      for (const q of defaultQuestions) {
        await sql`INSERT INTO bot_questions (question, answer) VALUES (${q.q}, ${q.a})`;
      }
    }

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

initDb();

export default sql;

