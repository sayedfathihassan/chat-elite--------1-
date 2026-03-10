import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import * as path from "path";
import db from "./db.ts";

const JWT_SECRET = process.env.JWT_SECRET || "chat-elite-secret-key-123";

function generateUID() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  app.use(express.json());
  app.use(cookieParser());

  // --- Auth Middleware ---
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // --- Auth Routes ---
  app.post("/api/register", async (req, res) => {
    let { username, password } = req.body;
    username = username?.trim();
    try {
      const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
      const role = userCount.count === 0 ? 'admin' : 'user';

      const hashedPassword = await bcrypt.hash(password, 10);
      let uid = generateUID();
      // Ensure UID is unique
      while (db.prepare("SELECT id FROM users WHERE uid = ?").get(uid)) {
        uid = generateUID();
      }

      const stmt = db.prepare("INSERT INTO users (username, password, role, uid) VALUES (?, ?, ?, ?)");
      const result = stmt.run(username, hashedPassword, role, uid);
      res.json({ success: true, userId: result.lastInsertRowid, uid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/login", async (req, res) => {
    let { username, password } = req.body;
    username = username?.trim();
    console.log(`Login attempt for: ${username}`);
    const user = db.prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?)").get(username) as any;
    if (!user) {
      console.log(`User not found: ${username}`);
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`Password mismatch for: ${username}`);
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (user.is_banned) {
      console.log(`Banned user attempted login: ${username}`);
      return res.status(403).json({ error: "تم حظرك من التطبيق بالكامل." });
    }
    console.log(`Login successful for: ${username}`);
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
    res.cookie("token", token, { httpOnly: true, sameSite: 'none', secure: true });
    res.json({ success: true, user: { id: user.id, username: user.username, role: user.role, avatar: user.avatar, credits: user.credits, level: user.level, uid: user.uid, text_color: user.text_color, bubble_style: user.bubble_style } });
  });

  app.post("/api/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  app.get("/api/me", authenticate, (req: any, res) => {
    const user = db.prepare("SELECT id, uid, username, role, avatar, credits, level, exp, text_color, bubble_style FROM users WHERE id = ?").get(req.user.id) as any;

    // If user doesn't have a UID (legacy users), generate one
    if (!user.uid) {
      let uid = generateUID();
      while (db.prepare("SELECT id FROM users WHERE uid = ?").get(uid)) {
        uid = generateUID();
      }
      db.prepare("UPDATE users SET uid = ? WHERE id = ?").run(uid, user.id);
      user.uid = uid;
    }

    res.json(user);
  });

  app.post("/api/update-profile", authenticate, (req: any, res) => {
    let { avatar, username, textColor, bubbleStyle, joinEffect } = req.body;
    username = username?.trim();

    const user = db.prepare("SELECT credits, text_color, bubble_style FROM users WHERE id = ?").get(req.user.id) as any;
    let cost = 0;

    // Calculate cost
    const bubbleOptions = [
      { id: 'default', price: 0 }, { id: 'neon', price: 500 },
      { id: 'gold', price: 1000 }, { id: 'purple', price: 1000 },
      { id: 'fire', price: 2000 }, { id: 'galaxy', price: 3000 },
    ];
    const colorOptions = [
      { hex: '#ffffff', price: 0 }, { hex: '#ff4d4d', price: 200 },
      { hex: '#00aaff', price: 200 }, { hex: '#00ff88', price: 200 },
      { hex: '#bf00ff', price: 500 }, { hex: '#ffcc00', price: 500 },
      { hex: '#ff66aa', price: 500 },
    ];

    if (bubbleStyle && bubbleStyle !== user.bubble_style) {
      const option = bubbleOptions.find(o => o.id === bubbleStyle);
      if (option) cost += option.price;
    }
    if (textColor && textColor !== user.text_color) {
      const option = colorOptions.find(o => o.hex === textColor);
      if (option) cost += option.price;
    }

    if (user.credits < cost) return res.status(400).json({ error: "رصيدك غير كافٍ" });

    let updateFields = ["avatar = ?"];
    let updateValues = [avatar];

    if (username) {
      const existing = db.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?").get(username, req.user.id);
      if (existing) return res.status(400).json({ error: "اسم المستخدم مأخوذ بالفعل" });
      updateFields.push("username = ?");
      updateValues.push(username);
    }

    if (textColor) {
      updateFields.push("text_color = ?");
      updateValues.push(textColor);
    }
    if (bubbleStyle) {
      updateFields.push("bubble_style = ?");
      updateValues.push(bubbleStyle);
    }
    if (joinEffect) {
      updateFields.push("join_effect = ?");
      updateValues.push(joinEffect);
    }

    updateValues.push(req.user.id);

    db.transaction(() => {
      if (cost > 0) db.prepare("UPDATE users SET credits = credits - ? WHERE id = ?").run(cost, req.user.id);
      db.prepare(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateValues);
    })();

    res.json({ success: true });
  });

  app.post("/api/admin/create-user", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    let { username, password, role } = req.body;
    username = username?.trim();
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      let uid = generateUID();
      while (db.prepare("SELECT id FROM users WHERE uid = ?").get(uid)) {
        uid = generateUID();
      }
      db.prepare("INSERT INTO users (username, password, role, uid) VALUES (?, ?, ?, ?)").run(username, hashedPassword, role || 'user', uid);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/admin/change-password", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { userId, password } = req.body;
    try {
      let user = db.prepare("SELECT id FROM users WHERE uid = ?").get(userId);
      if (!user) user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const hashedPassword = await bcrypt.hash(password, 10);
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, user.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/admin/update-room-role", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { roomId, userId, role } = req.body;

    let user = db.prepare("SELECT id FROM users WHERE uid = ?").get(userId);
    if (!user) user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    db.prepare("INSERT OR REPLACE INTO room_roles (room_id, user_id, role) VALUES (?, ?, ?)").run(roomId, user.id, role);
    res.json({ success: true });
  });

  // --- Room Routes ---
  app.get("/api/rooms", authenticate, (req, res) => {
    const rooms = db.prepare("SELECT * FROM rooms").all();
    res.json(rooms);
  });

  app.get("/api/leaderboard", authenticate, (req, res) => {
    const topGivers = db.prepare("SELECT id, uid, username, avatar, total_spent, level FROM users WHERE total_spent > 0 ORDER BY total_spent DESC LIMIT 10").all();
    res.json(topGivers);
  });

  app.post("/api/rooms", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { name, description, icon } = req.body;
    const stmt = db.prepare("INSERT INTO rooms (name, description, icon) VALUES (?, ?, ?)");
    const result = stmt.run(name, description, icon);
    res.json({ success: true, roomId: result.lastInsertRowid });
  });

  // --- Trivia Bot Admin Routes ---
  app.get("/api/admin/questions", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const questions = db.prepare("SELECT * FROM bot_questions").all();
    res.json(questions);
  });

  app.post("/api/admin/questions", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { question, answer, category } = req.body;
    try {
      db.prepare("INSERT INTO bot_questions (question, answer, category) VALUES (?, ?, ?)").run(question, answer, category || 'general');
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/admin/questions/:id", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      db.prepare("DELETE FROM bot_questions WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // --- Admin Routes ---
  app.get("/api/admin/users", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const users = db.prepare("SELECT id, uid, username, role, credits, level, exp, avatar FROM users").all();
    res.json(users);
  });

  app.post("/api/admin/add-credits", authenticate, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { userId, amount } = req.body;
    // Try to find by UID first, then by ID
    let user = db.prepare("SELECT id FROM users WHERE uid = ?").get(userId);
    if (!user) user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);

    if (!user) return res.status(404).json({ error: "User not found" });

    db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(amount, user.id);
    res.json({ success: true });
  });

  // --- Room Management API ---
  app.get("/api/rooms/:id/settings", (req, res) => {
    const room = db.prepare("SELECT * FROM rooms WHERE id = ?").get(req.params.id);
    if (!room) return res.status(404).json({ error: "Room not found" });
    res.json(room);
  });

  app.post("/api/rooms/:id/settings", (req, res) => {
    const { name, description, icon, is_private, slow_mode, background_image } = req.body;
    db.prepare(`
      UPDATE rooms 
      SET name = ?, description = ?, icon = ?, is_private = ?, slow_mode = ?, background_image = ? 
      WHERE id = ?
    `).run(name, description, icon, is_private ? 1 : 0, slow_mode || 0, background_image || null, req.params.id);
    res.json({ success: true });
  });

  app.get("/api/rooms/:id/bans", (req, res) => {
    const bans = db.prepare(`
      SELECT b.*, u.username, u.avatar 
      FROM bans b 
      JOIN users u ON b.user_id = u.id 
      WHERE b.room_id = ? AND b.type = 'ban'
    `).all(req.params.id);
    res.json(bans);
  });

  app.delete("/api/rooms/:id/bans/:userId", (req, res) => {
    db.prepare("DELETE FROM bans WHERE room_id = ? AND user_id = ? AND type = 'ban'").run(req.params.id, req.params.userId);
    res.json({ success: true });
  });

  app.post("/api/rooms/:id/roles", (req, res) => {
    const { userId, role } = req.body;

    let targetUser;
    if (typeof userId === 'string' && userId.length > 5) {
      targetUser = db.prepare("SELECT id FROM users WHERE uid = ?").get(userId) as any;
    } else {
      targetUser = db.prepare("SELECT id FROM users WHERE id = ?").get(userId) as any;
    }

    if (!targetUser) return res.status(404).json({ error: "User not found" });

    const existing = db.prepare("SELECT * FROM room_roles WHERE room_id = ? AND user_id = ?").get(req.params.id, targetUser.id);
    if (existing) {
      db.prepare("UPDATE room_roles SET role = ? WHERE room_id = ? AND user_id = ?").run(role, req.params.id, targetUser.id);
    } else {
      db.prepare("INSERT INTO room_roles (room_id, user_id, role) VALUES (?, ?, ?)").run(req.params.id, targetUser.id, role);
    }
    res.json({ success: true });
  });

  app.post("/api/rooms/:id/clear-chat", (req, res) => {
    db.prepare("DELETE FROM messages WHERE room_id = ?").run(req.params.id);
    io.to(`room_${req.params.id}`).emit("chat_cleared");
    res.json({ success: true });
  });

  app.post("/api/admin/update-join-effect", (req, res) => {
    const { userId, effect } = req.body;

    let user;
    if (typeof userId === 'string' && userId.length > 5) {
      user = db.prepare("SELECT id FROM users WHERE uid = ?").get(userId) as any;
    } else {
      user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId) as any;
    }

    if (!user) return res.status(404).json({ error: "User not found" });

    db.prepare("UPDATE users SET join_effect = ? WHERE id = ?").run(effect || null, user.id);
    res.json({ success: true });
  });

  // --- Socket.io Logic ---
  const activeUsersPerRoom = new Map<string, Set<number>>();
  const typingUsers = new Map<string, Set<string>>();

  interface MicState {
    currentSpeaker: number | null;
    queue: number[];
    endTime: number | null;
    duration: number; // in seconds
  }
  const roomMics = new Map<string, MicState>();

  const activeTriviaPerRoom = new Map<string, { answer: string, reward: number, timer: NodeJS.Timeout }>();

  function askNextQuestion(roomIdStr: string) {
    const questions = db.prepare("SELECT * FROM bot_questions ORDER BY RANDOM() LIMIT 1").all() as any[];
    if (questions.length === 0) return; // No questions in DB

    const q = questions[0];
    const reward = Math.floor(Math.random() * 50) + 50; // 50 to 100

    io.to(`room_${roomIdStr}`).emit("receive_message", {
      id: Date.now(),
      roomId: roomIdStr,
      userId: 0,
      username: "🤖 بوت المسابقات",
      content: `📢 السؤال: ${q.question}\nالجائزة: ${reward} رصيد\nأمامكم 30 ثانية!`,
      type: "system",
      role: "system",
      timestamp: new Date().toISOString()
    });

    const timer = setTimeout(() => {
      io.to(`room_${roomIdStr}`).emit("receive_message", {
        id: Date.now(),
        roomId: roomIdStr,
        userId: 0,
        username: "🤖 بوت المسابقات",
        content: `⏰ انتهى الوقت! الإجابة الصحيحة هي: ${q.answer}`,
        type: "system",
        role: "system",
        timestamp: new Date().toISOString()
      });

      setTimeout(() => {
        if (activeTriviaPerRoom.has(roomIdStr)) {
          askNextQuestion(roomIdStr);
        }
      }, 3000);
    }, 30000);

    activeTriviaPerRoom.set(roomIdStr, { answer: q.answer, reward, timer });
  }

  function normalizeArabic(text: string) {
    if (!text) return "";
    return text.trim().toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\u064B-\u065F]/g, ''); // Remove tashkeel
  }

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join_room", ({ roomId, userId }) => {
      // Check for bans
      const ban = db.prepare("SELECT * FROM bans WHERE room_id = ? AND user_id = ? AND type = 'ban' AND (expires_at IS NULL OR expires_at > ?)").get(roomId, userId, new Date().toISOString());
      if (ban) {
        socket.emit("error", { message: "أنت محظور من دخول هذه الغرفة" });
        return;
      }

      // Prevent double join announcement if already in room
      const wasInRoom = socket.rooms.has(`room_${roomId}`);

      socket.data.userId = userId;
      const roomIdStr = roomId.toString();
      socket.join(`room_${roomIdStr}`);
      socket.join(`user_${userId}`);
      console.log(`User ${userId} joined room ${roomIdStr}`);

      if (!activeUsersPerRoom.has(roomIdStr)) {
        activeUsersPerRoom.set(roomIdStr, new Set());
      }
      activeUsersPerRoom.get(roomIdStr)!.add(userId);

      // Ensure user has a role in the room
      const existingRole = db.prepare("SELECT role FROM room_roles WHERE room_id = ? AND user_id = ?").get(roomId, userId);
      if (!existingRole) {
        db.prepare("INSERT INTO room_roles (room_id, user_id, role) VALUES (?, ?, ?)").run(roomId, userId, 'member');
      }

      // Get room members and roles
      const members = db.prepare(`
        SELECT u.id, u.uid, u.username, u.avatar, u.level, u.credits, u.text_color, u.bubble_style, rr.role 
        FROM users u 
        JOIN room_roles rr ON u.id = rr.user_id 
        WHERE rr.room_id = ?
      `).all(roomId);

      io.to(`room_${roomId}`).emit("room_users", members);

      // Join Announcement (only if not already in room)
      if (!wasInRoom) {
        const joiningUser = db.prepare("SELECT username, join_effect FROM users WHERE id = ?").get(userId) as any;
        if (joiningUser) {
          io.to(`room_${roomId}`).emit("receive_message", {
            id: Date.now() + Math.random(),
            roomId,
            userId: 0,
            username: "النظام",
            content: `🚪 انضم ${joiningUser.username} إلى الغرفة`,
            type: "system",
            role: "system",
            timestamp: new Date().toISOString(),
            joinEffect: joiningUser.join_effect
          });
        }
      }
    });

    socket.on("typing", ({ roomId, userId, username, isTyping }) => {
      if (!typingUsers.has(roomId)) {
        typingUsers.set(roomId, new Set());
      }

      const roomTyping = typingUsers.get(roomId)!;
      if (isTyping) {
        roomTyping.add(username);
      } else {
        roomTyping.delete(username);
      }

      socket.to(`room_${roomId}`).emit("user_typing", {
        roomId,
        typingUsers: Array.from(roomTyping)
      });
    });

    socket.on("delete_message", ({ roomId, messageId, adminId }) => {
      const admin = db.prepare("SELECT role FROM users WHERE id = ?").get(adminId) as any;
      const roomRole = db.prepare("SELECT role FROM room_roles WHERE room_id = ? AND user_id = ?").get(roomId, adminId) as any;

      if (admin.role === 'admin' || roomRole?.role === 'master' || roomRole?.role === 'moderator') {
        db.prepare("DELETE FROM messages WHERE id = ?").run(messageId);
        io.to(`room_${roomId}`).emit("message_deleted", { messageId });
      }
    });

    socket.on("toggle_trivia_bot", ({ roomId, userId, action }) => {
      const roomIdStr = roomId.toString();
      const user = db.prepare("SELECT username, role FROM users WHERE id = ?").get(userId) as any;
      const roleInRoom = db.prepare("SELECT role FROM room_roles WHERE room_id = ? AND user_id = ?").get(roomId, userId) as any;

      if (roleInRoom?.role !== 'master' && roleInRoom?.role !== 'moderator' && user.role !== 'admin') {
        socket.emit("error", { message: "فقط المشرف أو المالك يمكنه التحكم في المسابقة!" });
        return;
      }

      if (action === 'start') {
        if (activeTriviaPerRoom.has(roomIdStr)) {
          socket.emit("error", { message: "المسابقة قيد التشغيل بالفعل!" });
        } else {
          io.to(`room_${roomIdStr}`).emit("receive_message", {
            id: Date.now(),
            roomId: roomIdStr,
            userId: 0,
            username: "🤖 بوت المسابقات",
            content: `🎉 تم تشغيل بوت المسابقات! استعدوا...`,
            type: "system",
            role: "system",
            timestamp: new Date().toISOString()
          });

          activeTriviaPerRoom.set(roomIdStr, { answer: "", reward: 0, timer: setTimeout(() => { }, 0) });
          setTimeout(() => askNextQuestion(roomIdStr), 2000);
        }
      } else if (action === 'stop') {
        const trivia = activeTriviaPerRoom.get(roomIdStr);
        if (trivia) {
          clearTimeout(trivia.timer);
          activeTriviaPerRoom.delete(roomIdStr);
          io.to(`room_${roomIdStr}`).emit("receive_message", {
            id: Date.now(),
            roomId: roomIdStr,
            userId: 0,
            username: "🤖 بوت المسابقات",
            content: `🛑 تم إيقاف المسابقة.`,
            type: "system",
            role: "system",
            timestamp: new Date().toISOString()
          });
        }
      }
    });

    socket.on("send_message", ({ roomId, userId, content, type, recipientId }) => {
      // Add to active users
      if (!activeUsersPerRoom.has(roomId)) {
        activeUsersPerRoom.set(roomId, new Set());
      }
      activeUsersPerRoom.get(roomId)!.add(userId);

      const roomIdStr = roomId.toString();
      const user = db.prepare("SELECT username, avatar, role, text_color, bubble_style FROM users WHERE id = ?").get(userId) as any;

      const stmt = db.prepare("INSERT INTO messages (room_id, user_id, content, type, recipient_id) VALUES (?, ?, ?, ?, ?)");
      const result = stmt.run(roomId, userId, content, type || 'text', recipientId || null);

      const roleInRoom = db.prepare("SELECT role FROM room_roles WHERE room_id = ? AND user_id = ?").get(roomId, userId) as any;

      const messageData = {
        id: result.lastInsertRowid,
        roomId,
        userId,
        username: user.username,
        avatar: user.avatar,
        role: roleInRoom?.role || 'member',
        content,
        type: type || 'text',
        recipientId: recipientId || null,
        textColor: user.text_color,
        bubbleStyle: user.bubble_style,
        timestamp: new Date().toISOString()
      };

      if (recipientId) {
        // Private message: send only to sender and recipient
        io.to(`user_${userId}`).emit("receive_message", messageData);
        io.to(`user_${recipientId}`).emit("receive_message", messageData);
      } else {
        // Public message: send to everyone in the room
        io.to(`room_${roomId}`).emit("receive_message", messageData);
      }

      // If they answered correctly, announce winner AFTER their message is shown
      if (!recipientId && (!type || type === 'text')) {
        const trivia = activeTriviaPerRoom.get(roomIdStr);
        if (trivia && trivia.answer && normalizeArabic(content) === normalizeArabic(trivia.answer)) {
          clearTimeout(trivia.timer);
          const reward = trivia.reward;
          const originalAnswer = trivia.answer;
          trivia.answer = ""; // Prevent multiple winners for the same question
          db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(reward, userId);

          io.to(`room_${roomIdStr}`).emit("receive_message", {
            id: Date.now() + 1,
            roomId: roomIdStr,
            userId: 0,
            username: "🤖 بوت المسابقات",
            content: `🎉 مبروك لـ ${user.username}! الإجابة صحيحة (${originalAnswer}). ربحت ${reward} رصيد!`,
            type: "system",
            role: "system",
            timestamp: new Date().toISOString()
          });

          io.to(`user_${userId}`).emit("credits_granted", { userId, amount: reward });

          // Ask next question immediately
          setTimeout(() => {
            if (activeTriviaPerRoom.has(roomIdStr)) {
              askNextQuestion(roomIdStr);
            }
          }, 3000);
        }
      }

      // Update EXP for activity
      db.prepare("UPDATE users SET exp = exp + 1 WHERE id = ?").run(userId);
      // Level up logic (simple: 100 exp per level)
      const userData = db.prepare("SELECT exp, level FROM users WHERE id = ?").get(userId) as any;
      if (userData.exp >= userData.level * 100) {
        db.prepare("UPDATE users SET level = level + 1, exp = 0 WHERE id = ?").run(userId);
        socket.emit("level_up", { level: userData.level + 1 });
      }
    });

    socket.on("admin_action", ({ roomId, targetUserId, action, adminId, duration }) => {
      // Check if adminId has permission
      const admin = db.prepare("SELECT role FROM users WHERE id = ?").get(adminId) as any;
      const roomRole = db.prepare("SELECT role FROM room_roles WHERE room_id = ? AND user_id = ?").get(roomId, adminId) as any;

      if (admin.role === 'admin' || roomRole?.role === 'master' || roomRole?.role === 'moderator') {
        if (action === 'kick') {
          io.to(`room_${roomId}`).emit("user_kicked", { userId: targetUserId });
        } else if (action === 'ban') {
          const expiresAt = duration && duration > 0 ? new Date(Date.now() + duration * 60 * 60 * 1000).toISOString() : null;
          db.prepare("INSERT INTO bans (room_id, user_id, type, expires_at) VALUES (?, ?, 'ban', ?)").run(roomId, targetUserId, expiresAt);
          io.to(`room_${roomId}`).emit("user_kicked", { userId: targetUserId });
        } else if (action === 'global_ban' && admin.role === 'admin') {
          db.prepare("UPDATE users SET is_banned = 1 WHERE id = ?").run(targetUserId);
          io.emit("user_kicked", { userId: targetUserId }); // Kick from everywhere
        } else if (action === 'mute_text') {
          db.prepare("INSERT INTO bans (room_id, user_id, type) VALUES (?, ?, 'mute_text')").run(roomId, targetUserId);
          io.to(`room_${roomId}`).emit("user_muted", { userId: targetUserId, type: 'text' });
        }
        // Add more actions as needed
      }
    });

    socket.on("claim_gift", ({ roomId, userId }) => {
      const amount = Math.floor(Math.random() * 50) + 10;
      db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(amount, userId);

      io.to(`user_${userId}`).emit("credits_granted", { userId, amount });

      const user = db.prepare("SELECT username FROM users WHERE id = ?").get(userId) as any;

      io.to(`room_${roomId}`).emit("receive_message", {
        id: Date.now(),
        roomId,
        userId: 0,
        username: "النظام",
        content: `🎉 المستخدم ${user.username} حصل على ${amount} من صندوق الهدايا!`,
        type: "system",
        role: "system",
        timestamp: new Date().toISOString()
      });
    });

    socket.on("send_gift", ({ roomId, userId, recipientId, recipientName, giftId, price: clientPrice, name: clientName, icon: clientIcon, type: clientType }) => {
      console.log("send_gift received:", { roomId, userId, type: clientType, price: clientPrice });

      const gifts = [
        { id: 1, name: 'وردة', price: 10, icon: '🌹' },
        { id: 2, name: 'قلب', price: 20, icon: '❤️' },
        { id: 3, name: 'تاج', price: 50, icon: '👑' },
        { id: 4, name: 'خاتم', price: 100, icon: '💍' },
        { id: 5, name: 'سيارة', price: 200, icon: '🚗' },
        { id: 6, name: 'طائرة', price: 500, icon: '✈️' },
        { id: 7, name: 'يخت', price: 1000, icon: '🛥️' },
        { id: 8, name: 'قصر', price: 2000, icon: '🏰' },
        { id: 9, name: 'صاروخ', price: 3000, icon: '🚀' },
        { id: 10, name: 'نجمة', price: 5000, icon: '⭐' },
        { id: 11, name: 'ماس', price: 7000, icon: '💎' },
        { id: 12, name: 'ذهب', price: 10000, icon: '💰' },
        { id: 13, name: 'ساعة', price: 15000, icon: '⌚' },
        { id: 14, name: 'عطر', price: 20000, icon: '🧴' },
        { id: 15, name: 'موبايل', price: 25000, icon: '📱' },
        { id: 16, name: 'صندوق عشوائي', price: 1000, icon: '📦', type: 'random_box' },
      ];

      const gift = gifts.find(g => g.id === giftId);
      if (!gift) {
        socket.emit("error", { message: "هدية غير صالحة" });
        return;
      }

      const price = gift.price;
      const name = gift.name;
      const icon = gift.icon;
      const type = gift.type || 'gift';

      const user = db.prepare("SELECT username, credits FROM users WHERE id = ?").get(userId) as any;

      if (type === 'random_box') {
        console.log("Processing random_box");
        if (price < 1000) {
          socket.emit("error", { message: "أقل سعر للصندوق العشوائي هو 1000 رصيد" });
          return;
        }
        if (user.credits < price) {
          socket.emit("error", { message: "رصيدك غير كافٍ" });
          return;
        }

        const activeUsers = activeUsersPerRoom.get(roomId.toString());
        console.log("Active users in room:", activeUsers);
        if (!activeUsers || activeUsers.size <= 1) {
          socket.emit("error", { message: "لا يوجد مستخدمين كافيين في الغرفة لتوزيع الصندوق" });
          return;
        }

        // Deduct credits
        db.prepare("UPDATE users SET credits = credits - ? WHERE id = ?").run(price, userId);
        io.to(`user_${userId}`).emit("credits_deducted", { userId, amount: price });

        // Distribute randomly
        const users = Array.from(activeUsers).filter(id => id !== userId);
        const results: { userId: number, amount: number }[] = [];
        let remaining = price;

        // Shuffle users
        for (let i = users.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [users[i], users[j]] = [users[j], users[i]];
        }

        // Distribute
        users.forEach((uid, index) => {
          if (index === users.length - 1) {
            // Last user gets remainder
            results.push({ userId: uid, amount: remaining });
          } else {
            const max = Math.floor(remaining / (users.length - index));
            const amount = Math.floor(Math.random() * (max * 2)); // Random up to 2x average
            const finalAmount = Math.min(amount, remaining);
            results.push({ userId: uid, amount: finalAmount });
            remaining -= finalAmount;
          }
        });

        // Apply results
        results.forEach(res => {
          if (res.amount > 0) {
            db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(res.amount, res.userId);
            io.to(`user_${res.userId}`).emit("credits_granted", { userId: res.userId, amount: res.amount });
          }
        });

        // Emit message
        io.to(`room_${roomId}`).emit("receive_message", {
          id: Date.now(),
          roomId,
          userId: 0,
          username: "النظام",
          content: `📦 أرسل ${user.username} صندوقاً عشوائياً بقيمة ${price} رصيد! تم التوزيع على ${users.length} مستخدم.`,
          type: "system",
          role: "system",
          timestamp: new Date().toISOString()
        });
        return;
      }

      let totalPrice = price;
      let recipientCount = 1;

      if (!recipientId) {
        // Gift to everyone
        const activeUsers = activeUsersPerRoom.get(roomId.toString());
        if (!activeUsers) {
          socket.emit("error", { message: "لا يوجد مستخدمين في الغرفة" });
          return;
        }

        // Count others (excluding sender)
        recipientCount = activeUsers.size - (activeUsers.has(userId) ? 1 : 0);

        if (recipientCount <= 0) {
          socket.emit("error", { message: "لا يوجد مستخدمين آخرين في الغرفة لإرسال الهدية لهم" });
          return;
        }

        totalPrice = price * recipientCount;
      }

      if (user.credits < totalPrice) {
        socket.emit("error", { message: `رصيدك غير كافٍ. التكلفة الإجمالية: ${totalPrice} رصيد` });
        return;
      }

      // Deduct credits
      db.prepare("UPDATE users SET credits = credits - ? WHERE id = ?").run(totalPrice, userId);
      io.to(`user_${userId}`).emit("credits_deducted", { userId, amount: totalPrice });

      // Emit gift message
      const content = recipientId
        ? `🎁 أرسل ${user.username} هدية ${name} ${icon} إلى ${recipientName} بقيمة ${price} رصيد!`
        : `🎁 أرسل ${user.username} هدية ${name} ${icon} للجميع (${recipientCount} مستخدم) بقيمة إجمالية ${totalPrice} رصيد!`;

      const giftMessage = {
        id: Date.now(),
        roomId,
        userId,
        username: user.username,
        content,
        type: "gift",
        role: "member",
        timestamp: new Date().toISOString()
      };

      io.to(`room_${roomId}`).emit("receive_message", giftMessage);

      // Global announcement for expensive gifts (price >= 1000)
      if (price >= 1000) {
        const room = db.prepare("SELECT name FROM rooms WHERE id = ?").get(roomId) as any;
        const globalContent = recipientId
          ? `🌟 إعلان ملكي: أرسل السخي ${user.username} هدية ${name} ${icon} إلى ${recipientName} في غرفة [${room?.name || roomId}]! 🌟`
          : `🌟 إعلان ملكي: أرسل السخي ${user.username} هدية ${name} ${icon} للجميع في غرفة [${room?.name || roomId}]! 🌟`;

        io.emit("receive_message", {
          id: Date.now() + 1,
          roomId: 0,
          userId: 0,
          username: "إعلان عالمي",
          content: globalContent,
          type: "system",
          role: "admin",
          timestamp: new Date().toISOString()
        });
      }
    });

    // --- Mic System ---
    const broadcastMicState = (roomId: string) => {
      const state = roomMics.get(roomId);
      if (state) {
        io.to(`room_${roomId}`).emit("mic_state_update", state);
      }
    };

    socket.on("get_mic_state", ({ roomId }) => {
      if (!roomMics.has(roomId)) {
        roomMics.set(roomId, { currentSpeaker: null, queue: [], endTime: null, duration: 60 });
      }
      socket.emit("mic_state_update", roomMics.get(roomId));
    });

    socket.on("request_mic", ({ roomId, userId }) => {
      if (!roomMics.has(roomId)) {
        roomMics.set(roomId, { currentSpeaker: null, queue: [], endTime: null, duration: 60 });
      }
      const state = roomMics.get(roomId)!;

      if (state.currentSpeaker === null) {
        state.currentSpeaker = userId;
        state.endTime = Date.now() + state.duration * 1000;
        // Simple auto-kick timer (for demonstration, a real app might use a more robust interval)
        setTimeout(() => {
          const currentState = roomMics.get(roomId);
          if (currentState && currentState.currentSpeaker === userId) {
            currentState.currentSpeaker = null;
            currentState.endTime = null;
            if (currentState.queue.length > 0) {
              currentState.currentSpeaker = currentState.queue.shift()!;
              currentState.endTime = Date.now() + currentState.duration * 1000;
            }
            broadcastMicState(roomId);
          }
        }, state.duration * 1000);
      } else if (state.currentSpeaker !== userId && !state.queue.includes(userId)) {
        state.queue.push(userId);
      }
      broadcastMicState(roomId);
    });

    socket.on("release_mic", ({ roomId, userId }) => {
      const state = roomMics.get(roomId);
      if (state) {
        if (state.currentSpeaker === userId) {
          state.currentSpeaker = null;
          state.endTime = null;
          if (state.queue.length > 0) {
            state.currentSpeaker = state.queue.shift()!;
            state.endTime = Date.now() + state.duration * 1000;
          }
        } else {
          state.queue = state.queue.filter(id => id !== userId);
        }
        broadcastMicState(roomId);
      }
    });

    socket.on("admin_mic_action", ({ roomId, adminId, action, targetUserId, duration }) => {
      const admin = db.prepare("SELECT role FROM users WHERE id = ?").get(adminId) as any;
      const roomRole = db.prepare("SELECT role FROM room_roles WHERE room_id = ? AND user_id = ?").get(roomId, adminId) as any;
      if (admin.role === 'admin' || roomRole?.role === 'master' || roomRole?.role === 'moderator') {
        const state = roomMics.get(roomId);
        if (state) {
          if (action === 'kick' && state.currentSpeaker === targetUserId) {
            state.currentSpeaker = null;
            state.endTime = null;
            if (state.queue.length > 0) {
              state.currentSpeaker = state.queue.shift()!;
              state.endTime = Date.now() + state.duration * 1000;
            }
          } else if (action === 'set_duration' && duration) {
            state.duration = duration;
          } else if (action === 'remove_from_queue') {
            state.queue = state.queue.filter(id => id !== targetUserId);
          }
          broadcastMicState(roomId);
        }
      }
    });

    socket.on("mic_audio", ({ roomId, userId, audioData }) => {
      const state = roomMics.get(roomId);
      if (state && state.currentSpeaker === userId) {
        socket.to(`room_${roomId}`).emit("receive_mic_audio", { userId, audioData });
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
      const userId = socket.data.userId;

      activeUsersPerRoom.forEach((users, roomId) => {
        if (users.has(userId)) {
          users.delete(userId);

          // Cleanup mic system
          const state = roomMics.get(roomId);
          if (state) {
            let micChanged = false;
            if (state.currentSpeaker === userId) {
              state.currentSpeaker = null;
              state.endTime = null;
              if (state.queue.length > 0) {
                state.currentSpeaker = state.queue.shift()!;
                state.endTime = Date.now() + state.duration * 1000;
              }
              micChanged = true;
            } else if (state.queue.includes(userId)) {
              state.queue = state.queue.filter(id => id !== userId);
              micChanged = true;
            }
            if (micChanged) {
              io.to(`room_${roomId}`).emit("mic_state_update", state);
            }
          }

          // Update room users list for everyone
          const members = db.prepare(`
            SELECT u.id, u.username, u.avatar, u.level, u.credits, rr.role 
            FROM users u 
            JOIN room_roles rr ON u.id = rr.user_id 
            WHERE rr.room_id = ?
          `).all(roomId);

          io.to(`room_${roomId}`).emit("room_users", members);

          // Leave Announcement
          const leavingUser = db.prepare("SELECT username FROM users WHERE id = ?").get(userId) as any;
          if (leavingUser) {
            io.to(`room_${roomId}`).emit("receive_message", {
              id: Date.now(),
              roomId,
              userId: 0,
              username: "النظام",
              content: `👋 غادر ${leavingUser.username} الغرفة`,
              type: "system",
              role: "system",
              timestamp: new Date().toISOString()
            });
          }
        }
      });

      typingUsers.forEach((users, roomId) => {
        // We don't have username here easily, but we can clear or let it timeout
        // Better to just clear typing for that room if we knew the username
      });
    });
  });

  // --- Hourly Gift Box ---
  setInterval(() => {
    const rooms = db.prepare("SELECT id FROM rooms").all() as any[];
    rooms.forEach(room => {
      const randomCredits = Math.floor(Math.random() * 50) + 10;
      io.to(`room_${room.id}`).emit("gift_box", { amount: randomCredits });
      // Logic to distribute credits to active users in room could be added here
    });
  }, 3600000); // Every hour

  // --- Credit Granting (Every 5 minutes) ---
  setInterval(() => {
    activeUsersPerRoom.forEach((userIds, roomId) => {
      userIds.forEach(userId => {
        // Grant credits
        const amount = 5; // Small amount
        db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(amount, userId);

        // Notify user
        io.to(`user_${userId}`).emit("credits_granted", { userId, amount });
      });
      // Clear active users for next interval
      userIds.clear();
    });
  }, 300000); // 5 minutes

  // --- Vite Integration ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => res.sendFile(path.resolve("dist/index.html")));
  }

  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
