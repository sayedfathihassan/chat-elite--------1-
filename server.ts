import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import * as path from "path";
import db from "./db.ts";

// --- Configuration ---
const JWT_SECRET = process.env.JWT_SECRET || "chat-elite-secret-key-123";
// Verification comment: Deployment version 1.0.1

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
      const users = await db`SELECT COUNT(*) as count FROM users`;
      const role = parseInt(users[0].count) === 0 ? 'admin' : 'user';

      const hashedPassword = await bcrypt.hash(password, 10);
      let uid = generateUID();
      
      // Ensure UID is unique
      let existingUid = await db`SELECT id FROM users WHERE uid = ${uid}`;
      while (existingUid.length > 0) {
        uid = generateUID();
        existingUid = await db`SELECT id FROM users WHERE uid = ${uid}`;
      }

      const result = await db`
        INSERT INTO users (username, password, role, uid) 
        VALUES (${username}, ${hashedPassword}, ${role}, ${uid})
        RETURNING id
      `;
      res.json({ success: true, userId: result[0].id, uid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/login", async (req, res) => {
    let { username, password } = req.body;
    username = username?.trim();
    console.log(`Login attempt for: ${username}`);
    const users = await db`SELECT * FROM users WHERE LOWER(username) = LOWER(${username})`;
    const user = users[0];

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

  app.get("/api/me", authenticate, async (req: any, res) => {
    const users = await db`SELECT id, uid, username, role, avatar, credits, level, exp, text_color, bubble_style FROM users WHERE id = ${req.user.id}`;
    let user = users[0];

    // If user doesn't have a UID (legacy users), generate one
    if (!user.uid) {
      let uid = generateUID();
      let existingUid = await db`SELECT id FROM users WHERE uid = ${uid}`;
      while (existingUid.length > 0) {
        uid = generateUID();
        existingUid = await db`SELECT id FROM users WHERE uid = ${uid}`;
      }
      await db`UPDATE users SET uid = ${uid} WHERE id = ${user.id}`;
      user.uid = uid;
    }

    res.json(user);
  });

  app.post("/api/update-profile", authenticate, async (req: any, res) => {
    let { avatar, username, textColor, bubbleStyle, joinEffect } = req.body;
    username = username?.trim();

    const users = await db`SELECT credits, text_color, bubble_style FROM users WHERE id = ${req.user.id}`;
    const user = users[0];
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

    try {
      await db.begin(async (sql: any) => {
        if (cost > 0) await sql`UPDATE users SET credits = credits - ${cost} WHERE id = ${req.user.id}`;
        
        const updateData: any = { avatar };
        if (username) {
            const existing = await sql`SELECT id FROM users WHERE LOWER(username) = LOWER(${username}) AND id != ${req.user.id}`;
            if (existing.length > 0) throw new Error("اسم المستخدم مأخوذ بالفعل");
            updateData.username = username;
        }
        if (textColor) updateData.text_color = textColor;
        if (bubbleStyle) updateData.bubble_style = bubbleStyle;
        if (joinEffect) updateData.join_effect = joinEffect;

        await sql`UPDATE users SET ${sql(updateData)} WHERE id = ${req.user.id}`;
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/admin/create-user", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    let { username, password, role } = req.body;
    username = username?.trim();
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      let uid = generateUID();
      let existingUid = await db`SELECT id FROM users WHERE uid = ${uid}`;
      while (existingUid.length > 0) {
        uid = generateUID();
        existingUid = await db`SELECT id FROM users WHERE uid = ${uid}`;
      }
      await db`INSERT INTO users (username, password, role, uid) VALUES (${username}, ${hashedPassword}, ${role || 'user'}, ${uid})`;
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/admin/change-password", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { userId, password } = req.body;
    try {
      let users = await db`SELECT id FROM users WHERE uid = ${userId.toString()}`;
      if (users.length === 0) users = await db`SELECT id FROM users WHERE id = ${parseInt(userId) || 0}`;
      if (users.length === 0) return res.status(404).json({ error: "User not found" });

      const hashedPassword = await bcrypt.hash(password, 10);
      await db`UPDATE users SET password = ${hashedPassword} WHERE id = ${users[0].id}`;
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/admin/update-room-role", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { roomId, userId, role } = req.body;

    let users = await db`SELECT id FROM users WHERE uid = ${userId.toString()}`;
    if (users.length === 0) users = await db`SELECT id FROM users WHERE id = ${parseInt(userId) || 0}`;
    if (users.length === 0) return res.status(404).json({ error: "User not found" });

    await db`
      INSERT INTO room_roles (room_id, user_id, role) 
      VALUES (${roomId}, ${users[0].id}, ${role})
      ON CONFLICT (room_id, user_id) DO UPDATE SET role = EXCLUDED.role
    `;
    res.json({ success: true });
  });

  // --- Room Routes ---
  app.get("/api/rooms", authenticate, async (req, res) => {
    const rooms = await db`SELECT * FROM rooms`;
    res.json(rooms);
  });

  app.get("/api/leaderboard", authenticate, async (req, res) => {
    const topGivers = await db`SELECT id, uid, username, avatar, total_spent, level FROM users WHERE total_spent > 0 ORDER BY total_spent DESC LIMIT 10`;
    res.json(topGivers);
  });

  app.post("/api/rooms", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { name, description, icon } = req.body;
    const result = await db`INSERT INTO rooms (name, description, icon) VALUES (${name}, ${description}, ${icon}) RETURNING id`;
    res.json({ success: true, roomId: result[0].id });
  });

  // --- Trivia Bot Admin Routes ---
  app.get("/api/admin/questions", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const questions = await db`SELECT * FROM bot_questions`;
    res.json(questions);
  });

  app.post("/api/admin/questions", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { question, answer, category } = req.body;
    try {
      await db`INSERT INTO bot_questions (question, answer, category) VALUES (${question}, ${answer}, ${category || 'general'})`;
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/admin/questions/:id", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      await db`DELETE FROM bot_questions WHERE id = ${req.params.id}`;
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // --- Admin Routes ---
  app.get("/api/admin/users", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const users = await db`SELECT id, uid, username, role, credits, level, exp, avatar FROM users`;
    res.json(users);
  });

  app.post("/api/admin/add-credits", authenticate, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { userId, amount } = req.body;
    // Try to find by UID first, then by ID
    let users = await db`SELECT id FROM users WHERE uid = ${userId.toString()}`;
    if (users.length === 0) users = await db`SELECT id FROM users WHERE id = ${parseInt(userId) || 0}`;

    if (users.length === 0) return res.status(404).json({ error: "User not found" });

    await db`UPDATE users SET credits = credits + ${parseInt(amount)} WHERE id = ${users[0].id}`;
    res.json({ success: true });
  });

  // --- Room Management API ---
  app.get("/api/rooms/:id/settings", async (req, res) => {
    const rooms = await db`SELECT * FROM rooms WHERE id = ${req.params.id}`;
    if (rooms.length === 0) return res.status(404).json({ error: "Room not found" });
    res.json(rooms[0]);
  });

  app.post("/api/rooms/:id/settings", async (req, res) => {
    const { name, description, icon, is_private, slow_mode, background_image } = req.body;
    await db`
      UPDATE rooms 
      SET name = ${name}, description = ${description}, icon = ${icon}, is_private = ${is_private ? 1 : 0}, slow_mode = ${slow_mode || 0}, background_image = ${background_image || null} 
      WHERE id = ${req.params.id}
    `;
    res.json({ success: true });
  });

  app.get("/api/rooms/:id/bans", async (req, res) => {
    const bans = await db`
      SELECT b.*, u.username, u.avatar 
      FROM bans b 
      JOIN users u ON b.user_id = u.id 
      WHERE b.room_id = ${req.params.id} AND b.type = 'ban'
    `;
    res.json(bans);
  });

  app.delete("/api/rooms/:id/bans/:userId", async (req, res) => {
    await db`DELETE FROM bans WHERE room_id = ${req.params.id} AND user_id = ${req.params.userId} AND type = 'ban'`;
    res.json({ success: true });
  });

  app.post("/api/rooms/:id/roles", async (req, res) => {
    const { userId, role } = req.body;

    let targetUser;
    if (typeof userId === 'string' && userId.length > 5) {
      const users = await db`SELECT id FROM users WHERE uid = ${userId}`;
      targetUser = users[0];
    } else {
      const users = await db`SELECT id FROM users WHERE id = ${userId}`;
      targetUser = users[0];
    }

    if (!targetUser) return res.status(404).json({ error: "User not found" });

    await db`
      INSERT INTO room_roles (room_id, user_id, role) 
      VALUES (${req.params.id}, ${targetUser.id}, ${role})
      ON CONFLICT (room_id, user_id) DO UPDATE SET role = EXCLUDED.role
    `;
    res.json({ success: true });
  });

  app.post("/api/rooms/:id/clear-chat", async (req, res) => {
    await db`DELETE FROM messages WHERE room_id = ${req.params.id}`;
    io.to(`room_${req.params.id}`).emit("chat_cleared");
    res.json({ success: true });
  });

  app.post("/api/admin/update-join-effect", async (req, res) => {
    const { userId, effect } = req.body;

    let user;
    if (typeof userId === 'string' && userId.length > 5) {
      const users = await db`SELECT id FROM users WHERE uid = ${userId}`;
      user = users[0];
    } else {
      const users = await db`SELECT id FROM users WHERE id = ${userId}`;
      user = users[0];
    }

    if (!user) return res.status(404).json({ error: "User not found" });

    await db`UPDATE users SET join_effect = ${effect || null} WHERE id = ${user.id}`;
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

  async function askNextQuestion(roomIdStr: string) {
    const questions = await db`SELECT * FROM bot_questions ORDER BY RANDOM() LIMIT 1`;
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

    const timer = setTimeout(async () => {
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

      setTimeout(async () => {
        if (activeTriviaPerRoom.has(roomIdStr)) {
          await askNextQuestion(roomIdStr);
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

    socket.on("join_room", async ({ roomId, userId }) => {
      // Check for bans
      const bans = await db`SELECT * FROM bans WHERE room_id = ${roomId} AND user_id = ${userId} AND type = 'ban' AND (expires_at IS NULL OR expires_at > ${new Date().toISOString()})`;
      if (bans.length > 0) {
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
      const roles = await db`SELECT role FROM room_roles WHERE room_id = ${roomId} AND user_id = ${userId}`;
      if (roles.length === 0) {
        await db`INSERT INTO room_roles (room_id, user_id, role) VALUES (${roomId}, ${userId}, 'member')`;
      }

      // Get room members and roles
      const members = await db`
        SELECT u.id, u.uid, u.username, u.avatar, u.level, u.credits, u.text_color, u.bubble_style, rr.role 
        FROM users u 
        JOIN room_roles rr ON u.id = rr.user_id 
        WHERE rr.room_id = ${roomId}
      `;

      io.to(`room_${roomId}`).emit("room_users", members);

      // Join Announcement (only if not already in room)
      if (!wasInRoom) {
        const users = await db`SELECT username, join_effect FROM users WHERE id = ${userId}`;
        const joiningUser = users[0];
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

    socket.on("delete_message", async ({ roomId, messageId, adminId }) => {
      const admins = await db`SELECT role FROM users WHERE id = ${adminId}`;
      const admin = admins[0];
      const roomRoles = await db`SELECT role FROM room_roles WHERE room_id = ${roomId} AND user_id = ${adminId}`;
      const roomRole = roomRoles[0];

      if (admin?.role === 'admin' || roomRole?.role === 'master' || roomRole?.role === 'moderator') {
        await db`DELETE FROM messages WHERE id = ${messageId}`;
        io.to(`room_${roomId}`).emit("message_deleted", { messageId });
      }
    });

    socket.on("toggle_trivia_bot", async ({ roomId, userId, action }) => {
      const roomIdStr = roomId.toString();
      const users = await db`SELECT username, role FROM users WHERE id = ${userId}`;
      const user = users[0];
      const roomRoles = await db`SELECT role FROM room_roles WHERE room_id = ${roomId} AND user_id = ${userId}`;
      const roleInRoom = roomRoles[0];

      if (roleInRoom?.role !== 'master' && roleInRoom?.role !== 'moderator' && user?.role !== 'admin') {
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
          setTimeout(async () => await askNextQuestion(roomIdStr), 2000);
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

    socket.on("send_message", async ({ roomId, userId, content, type, recipientId }) => {
      // Add to active users
      if (!activeUsersPerRoom.has(roomId)) {
        activeUsersPerRoom.set(roomId, new Set());
      }
      activeUsersPerRoom.get(roomId)!.add(userId);

      const roomIdStr = roomId.toString();
      const users = await db`SELECT username, avatar, role, text_color, bubble_style FROM users WHERE id = ${userId}`;
      const user = users[0];

      const result = await db`
        INSERT INTO messages (room_id, user_id, content, type, recipient_id) 
        VALUES (${roomId}, ${userId}, ${content}, ${type || 'text'}, ${recipientId || null})
        RETURNING id
      `;

      const roomRoles = await db`SELECT role FROM room_roles WHERE room_id = ${roomId} AND user_id = ${userId}`;
      const roleInRoom = roomRoles[0];

      const messageData = {
        id: result[0].id,
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
          await db`UPDATE users SET credits = credits + ${reward} WHERE id = ${userId}`;

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
          setTimeout(async () => {
            if (activeTriviaPerRoom.has(roomIdStr)) {
              await askNextQuestion(roomIdStr);
            }
          }, 3000);
        }
      }

      // Update EXP for activity
      await db`UPDATE users SET exp = exp + 1 WHERE id = ${userId}`;
      // Level up logic (simple: 100 exp per level)
      const userDataList = await db`SELECT exp, level FROM users WHERE id = ${userId}`;
      const userData = userDataList[0];
      if (userData.exp >= userData.level * 100) {
        await db`UPDATE users SET level = level + 1, exp = 0 WHERE id = ${userId}`;
        socket.emit("level_up", { level: userData.level + 1 });
      }
    });

    socket.on("admin_action", async ({ roomId, targetUserId, action, adminId, duration }) => {
      // Check if adminId has permission
      const admins = await db`SELECT role FROM users WHERE id = ${adminId}`;
      const admin = admins[0];
      const roomRoles = await db`SELECT role FROM room_roles WHERE room_id = ${roomId} AND user_id = ${adminId}`;
      const roomRole = roomRoles[0];

      if (admin?.role === 'admin' || roomRole?.role === 'master' || roomRole?.role === 'moderator') {
        if (action === 'kick') {
          io.to(`room_${roomId}`).emit("user_kicked", { userId: targetUserId });
        } else if (action === 'ban') {
          const expiresAt = duration && duration > 0 ? new Date(Date.now() + duration * 60 * 60 * 1000).toISOString() : null;
          await db`INSERT INTO bans (room_id, user_id, type, expires_at) VALUES (${roomId}, ${targetUserId}, 'ban', ${expiresAt})`;
          io.to(`room_${roomId}`).emit("user_kicked", { userId: targetUserId });
        } else if (action === 'global_ban' && admin.role === 'admin') {
          await db`UPDATE users SET is_banned = 1 WHERE id = ${targetUserId}`;
          io.emit("user_kicked", { userId: targetUserId }); // Kick from everywhere
        } else if (action === 'mute_text') {
          await db`INSERT INTO bans (room_id, user_id, type) VALUES (${roomId}, ${targetUserId}, 'mute_text')`;
          io.to(`room_${roomId}`).emit("user_muted", { userId: targetUserId, type: 'text' });
        }
        // Add more actions as needed
      }
    });

    socket.on("claim_gift", async ({ roomId, userId }) => {
      const amount = Math.floor(Math.random() * 50) + 10;
      await db`UPDATE users SET credits = credits + ${amount} WHERE id = ${userId}`;

      io.to(`user_${userId}`).emit("credits_granted", { userId, amount });

      const users = await db`SELECT username FROM users WHERE id = ${userId}`;
      const user = users[0];

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

    socket.on("send_gift", async ({ roomId, userId, recipientId, recipientName, giftId, price: clientPrice, name: clientName, icon: clientIcon, type: clientType }) => {
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

      const users = await db`SELECT username, credits FROM users WHERE id = ${userId}`;
      const user = users[0];

      if (type === 'random_box') {
        if (price < 1000) {
          socket.emit("error", { message: "أقل سعر للصندوق العشوائي هو 1000 رصيد" });
          return;
        }
        if (user.credits < price) {
          socket.emit("error", { message: "رصيدك غير كافٍ" });
          return;
        }

        const activeUsers = activeUsersPerRoom.get(roomId.toString());
        if (!activeUsers || activeUsers.size <= 1) {
          socket.emit("error", { message: "لا يوجد مستخدمين كافيين في الغرفة لتوزيع الصندوق" });
          return;
        }

        await db`UPDATE users SET credits = credits - ${price} WHERE id = ${userId}`;
        io.to(`user_${userId}`).emit("credits_deducted", { userId, amount: price });

        const recipients = Array.from(activeUsers).filter(id => id !== userId);
        const results: { userId: number, amount: number }[] = [];
        let remaining = price;

        for (let i = recipients.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [recipients[i], recipients[j]] = [recipients[j], recipients[i]];
        }

        recipients.forEach((uid: any, index: number) => {
          if (index === recipients.length - 1) {
            results.push({ userId: uid, amount: remaining });
          } else {
            const max = Math.floor(remaining / (recipients.length - index));
            const amount = Math.floor(Math.random() * (max * 2));
            const finalAmount = Math.min(amount, remaining);
            results.push({ userId: uid, amount: finalAmount });
            remaining -= finalAmount;
          }
        });

        for (const res of results) {
          if (res.amount > 0) {
            await db`UPDATE users SET credits = credits + ${res.amount} WHERE id = ${res.userId}`;
            io.to(`user_${res.userId}`).emit("credits_granted", { userId: res.userId, amount: res.amount });
          }
        }

        io.to(`room_${roomId}`).emit("receive_message", {
          id: Date.now(),
          roomId,
          userId: 0,
          username: "النظام",
          content: `📦 أرسل ${user.username} صندوقاً عشوائياً بقيمة ${price} رصيد! تم التوزيع على ${recipients.length} مستخدم.`,
          type: "system",
          role: "system",
          timestamp: new Date().toISOString()
        });
        return;
      }

      let totalPrice = price;
      let recipientCount = 1;

      if (!recipientId) {
        const activeUsers = activeUsersPerRoom.get(roomId.toString());
        if (!activeUsers) {
          socket.emit("error", { message: "لا يوجد مستخدمين في الغرفة" });
          return;
        }
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

      try {
        await db.begin(async (sql: any) => {
          await sql`UPDATE users SET credits = credits - ${totalPrice}, total_spent = total_spent + ${totalPrice} WHERE id = ${userId}`;
          
          const content = recipientId
            ? `🎁 أرسل ${user.username} هدية ${name} ${icon} إلى ${recipientName} بقيمة ${price} رصيد!`
            : `🎁 أرسل ${user.username} هدية ${name} ${icon} للجميع (${recipientCount} مستخدم) بقيمة إجمالية ${totalPrice} رصيد!`;

          const msgResult = await sql`
            INSERT INTO messages (room_id, user_id, recipient_id, content, type) 
            VALUES (${roomId}, ${userId}, ${recipientId || null}, ${content}, 'gift')
            RETURNING id
          `;

          const giftMessage = {
            id: msgResult[0].id,
            roomId,
            userId,
            username: user.username,
            content,
            type: "gift",
            role: "member",
            timestamp: new Date().toISOString()
          };

          io.to(`room_${roomId}`).emit("receive_message", giftMessage);
        });

        io.to(`user_${userId}`).emit("credits_deducted", { userId, amount: totalPrice });

        if (price >= 1000) {
          const roomData = await db`SELECT name FROM rooms WHERE id = ${roomId}`;
          const room = roomData[0];
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
      } catch (e: any) {
        socket.emit("error", { message: "حدث خطأ أثناء إرسال الهدية" });
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

    socket.on("admin_mic_action", async ({ roomId, adminId, action, targetUserId, duration }) => {
      const admins = await db`SELECT role FROM users WHERE id = ${adminId}`;
      const admin = admins[0];
      const roomRoles = await db`SELECT role FROM room_roles WHERE room_id = ${roomId} AND user_id = ${adminId}`;
      const roomRole = roomRoles[0];
      if (admin?.role === 'admin' || roomRole?.role === 'master' || roomRole?.role === 'moderator') {
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

    socket.on("disconnect", async () => {
      console.log("User disconnected");
      const userId = socket.data.userId;

      const roomsToUpdate: string[] = [];
      activeUsersPerRoom.forEach((users, roomId) => {
        if (users.has(userId)) {
          users.delete(userId);
          roomsToUpdate.push(roomId);
        }
      });

      for (const roomId of roomsToUpdate) {
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
          const members = await db`
            SELECT u.id, u.username, u.avatar, u.level, u.credits, rr.role 
            FROM users u 
            JOIN room_roles rr ON u.id = rr.user_id 
            WHERE rr.room_id = ${parseInt(roomId)}
          `;

          io.to(`room_${roomId}`).emit("room_users", members);

          // Leave Announcement
          const users = await db`SELECT username FROM users WHERE id = ${userId}`;
          const leavingUser = users[0];
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
  });

  // --- Hourly Gift Box ---
  setInterval(async () => {
    const rooms = await db`SELECT id FROM rooms`;
    rooms.forEach(room => {
      const randomCredits = Math.floor(Math.random() * 50) + 10;
      io.to(`room_${room.id}`).emit("gift_box", { amount: randomCredits });
    });
  }, 3600000); // Every hour

  // --- Credit Granting (Every 5 minutes) ---
  setInterval(async () => {
    for (const [roomId, userIds] of activeUsersPerRoom.entries()) {
      for (const userId of userIds) {
        const amount = 5;
        await db`UPDATE users SET credits = credits + ${amount} WHERE id = ${userId}`;
        io.to(`user_${userId}`).emit("credits_granted", { userId, amount });
      }
      userIds.clear();
    }
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

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
