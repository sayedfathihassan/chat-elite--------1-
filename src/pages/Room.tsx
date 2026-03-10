import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Users, Shield, LogOut, Gift, Smile, Mic, MicOff, Ban, VolumeX, Trash2, Crown, Star, Sparkles, Settings, Bot } from 'lucide-react';
import Avatar from '../components/Avatar';
import ProfileModal from '../components/ProfileModal';
import RoomAdminModal from '../components/RoomAdminModal';
import confetti from 'canvas-confetti';

import EmojiPicker from 'emoji-picker-react';

interface Message {
  id: number;
  username: string;
  avatar?: string;
  content: string;
  type: string;
  role: string;
  timestamp: string;
  userId: number;
  recipientId?: number;
  joinEffect?: string;
  textColor?: string;
  bubbleStyle?: string;
}

interface RoomUser {
  id: number;
  uid?: string;
  username: string;
  avatar?: string;
  role: string;
  level: number;
  credits: number;
  isOnline?: boolean;
  text_color?: string;
  bubble_style?: string;
}

export default function Room() {
  const { id } = useParams();
  const { user, setUser, socket } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([]);
  const [roomSettings, setRoomSettings] = useState<any>({});
  const [input, setInput] = useState('');
  const [showUsers, setShowUsers] = useState(false);
  const [showGifts, setShowGifts] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [selectedUser, setSelectedUser] = useState<RoomUser | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ userId: number, action: string, username: string, duration?: number } | null>(null);
  const [banDuration, setBanDuration] = useState(1); // Default 1 hour
  const [toast, setToast] = useState<string | null>(null);
  const [pendingGift, setPendingGift] = useState<any | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<RoomUser | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showBotMenu, setShowBotMenu] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const [micState, setMicState] = useState<{currentSpeaker: number | null, queue: number[], endTime: number | null, duration: number}>({ currentSpeaker: null, queue: [], endTime: null, duration: 60 });
  const [isRecording, setIsRecording] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextAudioTimeRef = useRef<number>(0);
  const [customization, setCustomization] = useState({ 
    textColor: user?.text_color || '#ffffff', 
    bubbleStyle: user?.bubble_style || 'default',
    avatar: user?.avatar || '',
    joinEffect: user?.join_effect || 'none'
  });
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const userId = user?.id;
  const username = user?.username;

  useEffect(() => {
    if (!socket || !id) return;

    socket.emit('join_room', { roomId: id, userId });
    fetch(`/api/rooms/${id}/settings`).then(res => res.json()).then(setRoomSettings);

    socket.on('receive_message', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
      
      // Trigger confetti for gifts or global announcements of gifts
      if (msg.type === 'gift' || (msg.type === 'system' && msg.username === 'إعلان عالمي')) {
        const scalar = 2;
        const triangle = confetti.shapeFromPath({ path: 'M0 10 L5 0 L10 10z' });

        confetti({
          shapes: [triangle],
          particleCount: 40,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#fbbf24', '#f59e0b', '#d97706', '#fcd34d']
        });

        // More sparkles!
        setTimeout(() => {
          confetti({
            particleCount: 20,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#fbbf24', '#f59e0b']
          });
          confetti({
            particleCount: 20,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#fbbf24', '#f59e0b']
          });
        }, 200);
      }

      // Handle Join Effects
      if (msg.joinEffect) {
        if (msg.joinEffect === 'fireworks') {
          const duration = 3 * 1000;
          const animationEnd = Date.now() + duration;
          const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

          const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

          const interval: any = setInterval(function() {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
              return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
          }, 250);
        } else if (msg.joinEffect === 'stars') {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#ffffff', '#fcd34d', '#fbbf24']
          });
        } else if (msg.joinEffect === 'confetti') {
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 }
          });
        }
      }
    });

    socket.on('room_users', (users: RoomUser[]) => {
      setRoomUsers(users);
    });

    socket.on('user_kicked', ({ userId: kickedUserId }) => {
      if (kickedUserId === userId) {
        alert('لقد تم طردك من الغرفة');
        navigate('/');
      }
    });

    socket.on('gift_box', ({ amount }) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        username: 'النظام',
        content: `🎁 صندوق هدايا عشوائي ظهر في الغرفة! يحتوي على ${amount} رصيد.`,
        type: 'system',
        role: 'system',
        timestamp: new Date().toISOString(),
        userId: 0
      }]);
    });

    socket.on('credits_granted', ({ amount }) => {
      setUser(prev => prev ? { ...prev, credits: prev.credits + amount } : null);
      setMessages(prev => [...prev, {
        id: Date.now(),
        username: 'النظام',
        content: `💰 تهانينا! لقد حصلت على ${amount} رصيد لنشاطك في الغرفة.`,
        type: 'system',
        role: 'system',
        timestamp: new Date().toISOString(),
        userId: 0
      }]);
    });

    socket.on('credits_deducted', ({ amount }) => {
      setUser(prev => prev ? { ...prev, credits: prev.credits - amount } : null);
    });

    socket.on('level_up', ({ level }) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        username: 'النظام',
        role: 'admin',
        content: `🎉 تهانينا! لقد ارتفع مستواك إلى المستوى ${level}`,
        type: 'system',
        timestamp: new Date().toISOString(),
        userId: 0
      }]);
    });

    socket.on('user_typing', ({ typingUsers: users }) => {
      setTypingUsers(users.filter((u: string) => u !== username));
    });

    socket.on('message_deleted', ({ messageId }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    });

    socket.on('error', ({ message }) => {
      setToast(message);
      setTimeout(() => setToast(null), 3000);
    });

    socket.on('chat_cleared', () => {
      setMessages([]);
      setToast("تم تطهير الدردشة من قبل الإدارة");
      setTimeout(() => setToast(null), 3000);
    });

    socket.emit('get_mic_state', { roomId: id });

    socket.on('mic_state_update', (state) => {
      setMicState(state);
    });

    socket.on('receive_mic_audio', async ({ userId: speakerId, audioData }) => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      try {
        const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        
        const currentTime = audioContextRef.current.currentTime;
        if (currentTime < nextAudioTimeRef.current) {
          source.start(nextAudioTimeRef.current);
          nextAudioTimeRef.current += audioBuffer.duration;
        } else {
          source.start(currentTime);
          nextAudioTimeRef.current = currentTime + audioBuffer.duration;
        }
      } catch (e) {
        console.error("Error decoding audio:", e);
      }
    });

    return () => {
      socket.off('receive_message');
      socket.off('room_users');
      socket.off('user_kicked');
      socket.off('gift_box');
      socket.off('credits_granted');
      socket.off('credits_deducted');
      socket.off('level_up');
      socket.off('user_typing');
      socket.off('message_deleted');
      socket.off('error');
      socket.off('chat_cleared');
    };
  }, [socket, id, userId, username, navigate, setUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (micState.currentSpeaker === user?.id && !isRecording) {
      // Start recording
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = async (e) => {
          if (e.data.size > 0 && socket) {
            const arrayBuffer = await e.data.arrayBuffer();
            socket.emit('mic_audio', { roomId: id, userId: user?.id, audioData: arrayBuffer });
          }
        };
        
        // Send chunks every 500ms for low latency
        mediaRecorder.start(500);
        setIsRecording(true);
      }).catch(err => {
        console.error("Error accessing microphone:", err);
        setToast("لا يمكن الوصول إلى الميكروفون");
        socket?.emit('release_mic', { roomId: id, userId: user?.id });
      });
    } else if (micState.currentSpeaker !== user?.id && isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        mediaRecorderRef.current = null;
      }
      setIsRecording(false);
    }
    
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [micState.currentSpeaker, user?.id, socket, id]);

  const [micTimeLeft, setMicTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (micState.endTime) {
      const interval = setInterval(() => {
        const left = Math.max(0, Math.floor((micState.endTime! - Date.now()) / 1000));
        setMicTimeLeft(left);
        if (left === 0) clearInterval(interval);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setMicTimeLeft(0);
    }
  }, [micState.endTime]);

  const toggleBot = (action: 'start' | 'stop') => {
    socket?.emit('toggle_trivia_bot', { roomId: id, userId: user?.id, action });
    setShowBotMenu(false);
  };

  const sendMessage = (e?: any) => {
    e?.preventDefault();
    if (!input.trim() || !socket) return;
    socket.emit('send_message', { 
      roomId: id, 
      userId: user?.id, 
      content: input,
      recipientId: selectedRecipient?.id 
    });
    setInput('');
    setSelectedRecipient(null);
    
    // Stop typing immediately on send
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      socket.emit('typing', { roomId: id, userId: user?.id, username: user?.username, isTyping: false });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    
    if (!socket || !user) return;

    // Emit typing event
    socket.emit('typing', { roomId: id, userId: user.id, username: user.username, isTyping: true });

    // Clear previous timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { roomId: id, userId: user.id, username: user.username, isTyping: false });
    }, 3000);
  };

  const deleteMessage = (messageId: number) => {
    socket?.emit('delete_message', { roomId: id, messageId, adminId: user?.id });
  };

  const handleAdminAction = (targetUserId: number, action: string, duration?: number) => {
    socket?.emit('admin_action', { roomId: id, targetUserId, action, adminId: user?.id, duration });
  };

  const handleGiftClick = () => {
    socket?.emit('claim_gift', { roomId: id, userId: user?.id });
  };

  const handleUpdateCustomization = async () => {
    const response = await fetch('/api/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        avatar: customization.avatar,
        textColor: customization.textColor,
        bubbleStyle: customization.bubbleStyle,
        joinEffect: customization.joinEffect
      })
    });
    
    if (!response.ok) {
      const data = await response.json();
      setToast(data.error || 'حدث خطأ أثناء الحفظ');
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setToast('تم تحديث التخصيص بنجاح!');
    setShowCustomization(false);
    setTimeout(() => setToast(null), 3000);
    // Reload users to reflect changes
    socket?.emit('join_room', { roomId: id, userId: user?.id });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'master': return <span className="flex items-center gap-1 text-[10px] bg-red-500/20 px-1.5 py-0.5 rounded text-[#ff4d4d] font-bold border border-red-500/30 shadow-[0_0_10px_rgba(255,77,77,0.2)]"><Crown size={10} /> ماستر</span>;
      case 'moderator': return <span className="flex items-center gap-1 text-[10px] bg-blue-500/20 px-1.5 py-0.5 rounded text-[#00aaff] font-bold border border-blue-500/30 shadow-[0_0_10px_rgba(0,170,255,0.2)]"><Shield size={10} /> مشرف</span>;
      case 'assistant': return <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 px-1.5 py-0.5 rounded text-[#00ff88] font-bold border border-emerald-500/30 shadow-[0_0_10px_rgba(0,255,136,0.2)]"><Star size={10} /> مساعد</span>;
      case 'admin': return <span className="flex items-center gap-1 text-[10px] bg-purple-500/20 px-1.5 py-0.5 rounded text-[#bf00ff] font-bold border border-purple-500/30 shadow-[0_0_10px_rgba(191,0,255,0.2)]"><Shield size={10} /> إدارة</span>;
      default: return null;
    }
  };

  const getUserColor = (role: string) => {
    switch (role) {
      case 'master': return 'text-[#ff4d4d] drop-shadow-[0_0_5px_rgba(255,77,77,0.3)]';
      case 'moderator': return 'text-[#00aaff] drop-shadow-[0_0_5px_rgba(0,170,255,0.3)]';
      case 'assistant': return 'text-[#00ff88] drop-shadow-[0_0_5px_rgba(0,255,136,0.3)]';
      case 'admin': return 'text-[#bf00ff] drop-shadow-[0_0_5px_rgba(191,0,255,0.3)]';
      default: return 'text-zinc-100';
    }
  };

  const currentUserRole = roomUsers.find(u => u.id === user?.id)?.role || 'member';
  const canManageRoom = currentUserRole === 'master' || currentUserRole === 'moderator' || user?.role === 'admin';

  const getBubbleStyle = (style: string, isMe: boolean, isPrivate: boolean, isMention: boolean) => {
    const base = "relative px-4 py-2.5 max-w-xs break-words shadow-lg transition-all duration-300 ";
    
    if (isMe) {
      switch (style) {
        case 'neon': return base + "bg-emerald-600/20 border border-emerald-500/50 text-white rounded-2xl rounded-br-sm shadow-[0_0_15px_rgba(16,185,129,0.2)]";
        case 'gold': return base + "bg-gradient-to-br from-yellow-600 to-yellow-800 border border-yellow-400/50 text-white rounded-2xl rounded-br-sm shadow-[0_0_15px_rgba(234,179,8,0.2)]";
        case 'purple': return base + "bg-gradient-to-br from-indigo-600 to-purple-800 border border-indigo-400/50 text-white rounded-2xl rounded-br-sm shadow-[0_0_15px_rgba(99,102,241,0.2)]";
        case 'fire': return base + "bg-gradient-to-br from-red-600 to-orange-600 border border-red-400/50 text-white rounded-2xl rounded-br-sm shadow-[0_0_15px_rgba(220,38,38,0.2)]";
        case 'galaxy': return base + "bg-gradient-to-br from-violet-900 to-blue-900 border border-violet-400/50 text-white rounded-2xl rounded-br-sm shadow-[0_0_15px_rgba(139,92,246,0.2)]";
        default: return base + "bg-emerald-600 text-white rounded-2xl rounded-br-sm shadow-emerald-900/20";
      }
    }

    if (isPrivate) return base + "bg-purple-600/20 border border-purple-500/30 text-purple-100 rounded-2xl rounded-bl-sm";
    if (isMention) return base + "bg-yellow-500/20 border border-yellow-500/30 text-yellow-100 rounded-2xl rounded-bl-sm";

    switch (style) {
      case 'neon': return base + "bg-zinc-900/80 border border-emerald-500/30 text-zinc-100 rounded-2xl rounded-bl-sm shadow-[0_0_10px_rgba(16,185,129,0.1)]";
      case 'gold': return base + "bg-zinc-900/80 border border-yellow-500/30 text-zinc-100 rounded-2xl rounded-bl-sm shadow-[0_0_10px_rgba(234,179,8,0.1)]";
      case 'purple': return base + "bg-zinc-900/80 border border-indigo-500/30 text-zinc-100 rounded-2xl rounded-bl-sm shadow-[0_0_10px_rgba(99,102,241,0.1)]";
      case 'fire': return base + "bg-zinc-900/80 border border-red-500/30 text-zinc-100 rounded-2xl rounded-bl-sm shadow-[0_0_10px_rgba(220,38,38,0.1)]";
      case 'galaxy': return base + "bg-zinc-900/80 border border-violet-500/30 text-zinc-100 rounded-2xl rounded-bl-sm shadow-[0_0_10px_rgba(139,92,246,0.1)]";
      default: return base + "bg-zinc-800/80 border border-white/5 text-zinc-100 rounded-2xl rounded-bl-sm";
    }
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-950 overflow-hidden" onClick={() => { setShowBotMenu(false); setShowEmojis(false); setShowGifts(false); }}>
      <RoomAdminModal 
        roomId={id || ''} 
        isOpen={showAdminModal} 
        onClose={() => setShowAdminModal(false)}
        onClearChat={() => {
          fetch(`/api/rooms/${id}/clear-chat`, { method: 'POST' });
          setShowAdminModal(false);
        }}
      />
      {/* Header */}
      <header className="bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-white/10 rounded-full text-zinc-400">
            <LogOut size={20} className="rotate-180" />
          </button>
          <div>
            <h1 className="font-bold text-lg">غرفة الدردشة #{id}</h1>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              {roomUsers.length} متصل الآن
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowCustomization(true)}
            className="p-2 bg-white/5 text-zinc-400 hover:bg-white/10 rounded-xl transition-colors"
            title="تخصيص المظهر"
          >
            <Sparkles size={20} />
          </button>
          {canManageRoom && (
            <button 
              onClick={() => setShowAdminModal(true)}
              className="p-2 bg-white/5 text-zinc-400 hover:bg-white/10 rounded-xl transition-colors"
              title="إدارة الغرفة"
            >
              <Settings size={20} />
            </button>
          )}
          <button 
            onClick={() => setShowUsers(!showUsers)}
            className={`p-2 rounded-xl transition-colors ${showUsers ? 'bg-emerald-500 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
          >
            <Users size={20} />
          </button>
          {(user?.role === 'admin') && (
            <button className="p-2 bg-white/5 text-zinc-400 hover:bg-white/10 rounded-xl transition-colors">
              <Shield size={20} />
            </button>
          )}
        </div>
      </header>

      {/* Mic Area */}
      <div className="bg-zinc-900/50 border-b border-white/5 p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${micState.currentSpeaker ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-zinc-800 text-zinc-500 border border-white/10'}`}>
              <Mic size={24} />
            </div>
            {micState.currentSpeaker && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-zinc-950 animate-pulse" />
            )}
          </div>
          <div>
            {micState.currentSpeaker ? (
              <>
                <div className="font-bold text-emerald-400 flex items-center gap-2">
                  {roomUsers.find(u => u.id === micState.currentSpeaker)?.username || 'مستخدم'}
                  {micTimeLeft > 0 && micState.duration < 3600 && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                      {Math.floor(micTimeLeft / 60)}:{(micTimeLeft % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-400">يتحدث الآن...</div>
              </>
            ) : (
              <>
                <div className="font-bold text-zinc-400">المايك فارغ</div>
                <div className="text-xs text-zinc-500">اضغط لطلب المايك</div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Queue Info */}
          {micState.queue.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-800/50 px-3 py-1.5 rounded-full">
              <span>الطابور:</span>
              <span className="font-bold text-white">{micState.queue.length}</span>
            </div>
          )}

          {/* Action Buttons */}
          {micState.currentSpeaker === user?.id ? (
            <button 
              onClick={() => socket?.emit('release_mic', { roomId: id, userId: user?.id })}
              className="bg-red-500/20 text-red-400 hover:bg-red-500/30 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
            >
              <MicOff size={16} />
              ترك المايك
            </button>
          ) : micState.queue.includes(user?.id || 0) ? (
            <button 
              onClick={() => socket?.emit('release_mic', { roomId: id, userId: user?.id })}
              className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
            >
              <MicOff size={16} />
              إلغاء الطلب
            </button>
          ) : (
            <button 
              onClick={() => socket?.emit('request_mic', { roomId: id, userId: user?.id })}
              className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
            >
              <Mic size={16} />
              {micState.currentSpeaker ? 'طلب المايك ✋' : 'أخذ المايك'}
            </button>
          )}

          {/* Admin Controls */}
          {canManageRoom && (
            <div className="flex items-center gap-2 border-r border-white/10 pr-3">
              <select 
                value={micState.duration}
                onChange={(e) => socket?.emit('admin_mic_action', { roomId: id, adminId: user?.id, action: 'set_duration', duration: Number(e.target.value) })}
                className="bg-zinc-800 border border-white/10 rounded-lg text-xs text-zinc-300 p-1.5 focus:outline-none"
                title="توقيت المايك"
              >
                <option value={30}>30 ثانية</option>
                <option value={60}>دقيقة</option>
                <option value={120}>دقيقتين</option>
                <option value={300}>5 دقائق</option>
                <option value={3600}>مفتوح</option>
              </select>
              {micState.currentSpeaker && micState.currentSpeaker !== user?.id && (
                <button 
                  onClick={() => socket?.emit('admin_mic_action', { roomId: id, adminId: user?.id, action: 'kick', targetUserId: micState.currentSpeaker })}
                  className="bg-red-500/20 text-red-400 hover:bg-red-500/30 p-1.5 rounded-lg transition-colors"
                  title="سحب المايك"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {roomSettings.background_image && (
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-20"
              style={{ backgroundImage: `url(${roomSettings.background_image})` }}
            />
          )}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide relative z-10">
            {messages.map((msg) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id} 
                className={`flex flex-col w-full ${msg.type === 'system' ? 'items-center' : (msg.userId === user?.id ? 'items-start' : 'items-end')}`}
              >
                {msg.type === 'system' ? (
                  <div 
                    className={`${msg.username === 'إعلان عالمي' 
                      ? 'bg-gradient-to-r from-yellow-600/20 via-yellow-500/30 to-yellow-600/20 border-yellow-500/50 text-yellow-100 font-bold py-3 px-8 animate-pulse shadow-lg shadow-yellow-500/10' 
                      : 'bg-zinc-900/80 text-zinc-400 border-white/5 py-1.5 px-4 shadow-lg'} 
                      rounded-full text-xs border cursor-pointer hover:bg-zinc-800 transition-colors text-center max-w-[90%] backdrop-blur-sm`} 
                    onClick={handleGiftClick}
                  >
                    {msg.username === 'إعلان عالمي' && <Sparkles className="inline-block mr-2 text-yellow-500" size={14} />}
                    {msg.content}
                    {msg.username === 'إعلان عالمي' && <Sparkles className="inline-block ml-2 text-yellow-500" size={14} />}
                  </div>
                ) : msg.type === 'gift' ? (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full flex justify-center my-2"
                  >
                    <div className="bg-zinc-900/90 backdrop-blur-md px-6 py-3 rounded-3xl border border-yellow-500/30 flex items-center gap-3 shadow-xl shadow-yellow-500/10 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-transparent to-yellow-500/10 animate-pulse" />
                      <div className="relative z-10 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-2xl animate-gift-float">
                          {msg.content.match(/[\u{1F300}-\u{1F9FF}]/u)?.[0] || '🎁'}
                        </div>
                        <div className="text-sm">
                          <span className="font-bold text-yellow-400">{msg.username}</span>
                          <span className="text-zinc-300 mx-1">أرسل هدية مميزة!</span>
                          <p className="text-xs text-zinc-400 mt-0.5">{msg.content}</p>
                        </div>
                        <Sparkles className="text-yellow-500 animate-pulse" size={16} />
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className={`max-w-[85%] md:max-w-[70%] flex items-end gap-3 ${msg.userId === user?.id ? 'flex-row' : 'flex-row-reverse'}`}>
                    <Avatar username={msg.username} avatar={msg.avatar} size="sm" />
                    <div className={`flex flex-col ${msg.userId === user?.id ? 'items-start' : 'items-end'}`}>
                      <div className={`flex items-center gap-2 mb-1.5 px-1 ${msg.userId === user?.id ? 'flex-row' : 'flex-row-reverse'}`}>
                        {getRoleBadge(msg.role)}
                        <span className={`text-xs font-bold ${getUserColor(msg.role)}`}>{msg.username}</span>
                        {msg.recipientId && (
                          <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                            <Send size={8} /> إلى {msg.recipientId === user?.id ? 'أنت' : roomUsers.find(u => u.id === msg.recipientId)?.username}
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-500">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div 
                        style={{ color: msg.textColor || 'inherit' }}
                        className={getBubbleStyle(msg.bubbleStyle || 'default', msg.userId === user?.id, !!msg.recipientId, msg.content.includes(`@${user?.username}`))}
                      >
                        {msg.content}
                        
                        {/* Delete Button for Admins */}
                        {(user?.role === 'admin' || roomUsers.find(u => u.id === user?.id)?.role === 'master') && (
                          <button 
                            onClick={() => deleteMessage(msg.id)}
                            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover/msg:opacity-100 transition-opacity shadow-lg"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Typing Indicator */}
          <AnimatePresence>
            {typingUsers.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="px-6 py-1 text-[10px] text-zinc-500 italic flex items-center gap-2"
              >
                <div className="flex gap-1">
                  <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'يكتب...' : 'يكتبون...'}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Area */}
          <div className="p-4 bg-zinc-950/80 backdrop-blur-xl border-t border-white/5 relative z-[60]">
            <AnimatePresence>
              {selectedRecipient && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute -top-10 left-4 right-4 bg-purple-600/90 backdrop-blur-md text-white text-[10px] px-4 py-1.5 rounded-t-xl flex items-center justify-between shadow-lg"
                >
                  <span>رسالة خاصة إلى: <b>{selectedRecipient.username}</b></span>
                  <button onClick={() => setSelectedRecipient(null)} className="hover:text-zinc-300">
                    <Trash2 size={12} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            
            {showEmojis && (
              <div className="absolute bottom-full mb-4 left-4 z-[9999]" onClick={(e) => e.stopPropagation()}>
                <EmojiPicker onEmojiClick={(emojiData) => {
                  setInput(prev => prev + emojiData.emoji);
                  setShowEmojis(false);
                }} />
              </div>
            )}

            {showGifts && (
              <div className="absolute bottom-full mb-4 right-4 z-[9999] bg-zinc-900 border border-zinc-800 shadow-2xl p-4 rounded-3xl w-80 max-h-[400px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4">
                  <p className="text-xs text-zinc-400 mb-2">إرسال إلى:</p>
                  <select 
                    id="recipient-select"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    onChange={(e) => {
                      const val = e.target.value;
                      (window as any).selectedRecipientId = val === 'all' ? null : Number(val);
                      (window as any).selectedRecipientName = val === 'all' ? 'الجميع' : roomUsers.find(u => u.id === Number(val))?.username;
                    }}
                  >
                    <option value="all">الجميع</option>
                    {roomUsers.filter(u => u.id !== user?.id).map(u => (
                      <option key={u.id} value={u.id}>{u.username}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
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
                  ].map(gift => (
                    <button 
                      key={gift.id}
                      type="button"
                      onClick={() => {
                        const recipientId = (window as any).selectedRecipientId || null;
                        const recipientName = (window as any).selectedRecipientName || 'الجميع';
                        setPendingGift({
                          giftId: gift.id,
                          price: gift.price,
                          name: gift.name,
                          icon: gift.icon,
                          recipientId,
                          recipientName,
                          type: gift.type
                        });
                        setShowGifts(false);
                      }}
                      className="flex flex-col items-center gap-1 p-2 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors border border-transparent hover:border-zinc-700"
                    >
                      <span className="text-2xl">{gift.icon}</span>
                      <span className="text-[10px] text-zinc-400">{gift.price}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showBotMenu && canManageRoom && (
              <div className="absolute bottom-full mb-4 right-16 z-[9999] bg-zinc-900 border border-zinc-800 shadow-2xl p-4 rounded-3xl w-48" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-sm font-bold text-center mb-3 text-emerald-400">بوت المسابقات</h3>
                <div className="flex flex-col gap-2">
                  <button onClick={() => toggleBot('start')} className="w-full py-2 bg-emerald-600/20 text-emerald-400 rounded-xl font-bold hover:bg-emerald-600/30 text-xs transition-colors">
                    تشغيل البوت
                  </button>
                  <button onClick={() => toggleBot('stop')} className="w-full py-2 bg-red-600/20 text-red-400 rounded-xl font-bold hover:bg-red-600/30 text-xs transition-colors">
                    إيقاف البوت
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={sendMessage} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-2 rounded-full shadow-lg">
              <button type="button" onClick={(e) => { e.stopPropagation(); setShowEmojis(!showEmojis); }} className="p-2.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded-full transition-colors">
                <Smile size={22} />
              </button>
              <button 
                type="button" 
                onClick={(e) => { e.stopPropagation(); setShowGifts(!showGifts); }}
                className="p-2.5 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-full transition-colors"
              >
                <Gift size={22} />
              </button>
              {canManageRoom && (
                <button 
                  type="button" 
                  onClick={(e) => { e.stopPropagation(); setShowBotMenu(!showBotMenu); }}
                  className="p-2.5 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-full transition-colors"
                >
                  <Bot size={22} />
                </button>
              )}
              <input
                type="text"
                value={input || ''}
                onChange={handleInputChange}
                placeholder="اكتب رسالتك هنا..."
                className="flex-1 bg-transparent border-none px-2 py-2 focus:outline-none focus:ring-0 text-white placeholder-zinc-500 text-sm"
              />
              <button 
                type="submit"
                disabled={!input.trim()}
                className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-full transition-all shadow-lg shadow-emerald-900/20 disabled:shadow-none"
              >
                <Send size={18} className="rtl:-scale-x-100" />
              </button>
            </form>
          </div>
        </div>

        {/* Users Sidebar (Mobile Overlay / Desktop Side) */}
        <AnimatePresence>
          {showUsers && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute inset-y-0 right-0 w-72 bg-zinc-950/90 backdrop-blur-xl border-l border-white/5 z-20 flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h2 className="font-bold flex items-center gap-2">
                  <Users size={18} className="text-emerald-400" />
                  المتواجدون
                </h2>
                <button onClick={() => setShowUsers(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <LogOut size={18} className="rotate-180" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {roomUsers.map((u) => (
                  <div key={u.id} onClick={() => setSelectedUser(u)} className="group flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar username={u.username} avatar={u.avatar} size="sm" />
                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 ${u.isOnline ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-bold ${getUserColor(u.role)}`}>{u.username}</span>
                          {getRoleBadge(u.role)}
                        </div>
                        <div className="text-[10px] text-zinc-500">مستوى {u.level}</div>
                      </div>
                    </div>

                    {/* Admin Controls */}
                    {canManageRoom && user?.id !== u.id && (
                      <div className="hidden group-hover:flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setConfirmAction({ userId: u.id, action: 'kick', username: u.username }); }} className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-400/10 transition-colors" title="طرد">
                          <Trash2 size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmAction({ userId: u.id, action: 'ban', username: u.username }); }} className="p-1.5 text-zinc-500 hover:text-red-600 rounded-lg hover:bg-red-600/10 transition-colors" title="حظر">
                          <Ban size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmAction({ userId: u.id, action: 'mute_text', username: u.username }); }} className="p-1.5 text-zinc-500 hover:text-yellow-400 rounded-lg hover:bg-yellow-400/10 transition-colors" title="كتم">
                          <VolumeX size={14} />
                        </button>
                        {user?.role === 'admin' && (
                          <button onClick={(e) => { e.stopPropagation(); setConfirmAction({ userId: u.id, action: 'global_ban', username: u.username }); }} className="p-1.5 text-zinc-500 hover:text-purple-500 rounded-lg hover:bg-purple-500/10 transition-colors" title="حظر نهائي من التطبيق">
                            <Shield size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Customization Modal */}
      <AnimatePresence>
        {showCustomization && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6"
            onClick={() => setShowCustomization(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-zinc-900 border border-white/10 p-8 rounded-3xl w-full max-w-md space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-center flex items-center justify-center gap-2">
                <Sparkles className="text-yellow-500" />
                تخصيص مظهرك
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-500 block mb-2">تأثير الانضمام</label>
                  <select 
                    value={customization.joinEffect}
                    onChange={(e) => setCustomization({...customization, joinEffect: e.target.value})}
                    className="w-full p-2 rounded-xl bg-zinc-800 border border-white/10 text-white"
                  >
                    <option value="none">بدون تأثير</option>
                    <option value="confetti">قصاصات ملونة</option>
                    <option value="fireworks">ألعاب نارية</option>
                    <option value="stars">نجوم</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-2">الصورة الشخصية</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setCustomization({...customization, avatar: reader.result as string});
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500"
                  />
                  {customization.avatar && (
                    <img src={customization.avatar} alt="Avatar" className="w-16 h-16 rounded-full mt-2 mx-auto" />
                  )}
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-2">لون الخط</label>
                  <div className="flex flex-wrap gap-2">
                    {['#ffffff', '#ff4d4d', '#00aaff', '#00ff88', '#bf00ff', '#ffcc00', '#ff66aa'].map(color => (
                      <button 
                        key={color}
                        onClick={() => setCustomization({...customization, textColor: color})}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${customization.textColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-500 block mb-2">نمط الفقاعة</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'default', name: 'افتراضي', price: 0 },
                      { id: 'neon', name: 'نيون مشع', price: 500 },
                      { id: 'gold', name: 'ذهبي ملكي', price: 1000 },
                      { id: 'royal', name: 'بنفسجي فاخر', price: 1500 },
                    ].map(style => (
                      <button 
                        key={style.id}
                        onClick={() => setCustomization({...customization, bubbleStyle: style.id})}
                        className={`p-3 rounded-xl border-2 transition-all text-sm font-bold ${customization.bubbleStyle === style.id ? 'border-purple-500 bg-purple-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                      >
                        {style.name}
                        <div className="text-[10px] text-zinc-500 font-normal">{style.price > 0 ? `${style.price} رصيد` : 'مجاني'}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                onClick={handleUpdateCustomization}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all"
              >
                حفظ التعديلات
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Profile Modal */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6"
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="glass p-8 rounded-3xl w-full max-w-sm space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center gap-4">
                <Avatar username={selectedUser.username} avatar={selectedUser.avatar} size="lg" />
                <h2 className="text-xl font-bold">{selectedUser.username}</h2>
                {getRoleBadge(selectedUser.role)}
              </div>
              <div className="space-y-2 text-sm text-zinc-400 text-center">
                <p className="text-zinc-300 font-bold">ID: {selectedUser.uid || selectedUser.id}</p>
                <p>المستوى: {selectedUser.level}</p>
                <p>الرصيد: {selectedUser.credits}</p>
                <div className="flex gap-2 mt-4">
                  {user?.id === selectedUser.id ? (
                    <button onClick={() => { setSelectedUser(null); setShowProfile(true); }} className="flex-1 py-2 bg-emerald-600 rounded-xl text-white font-bold">تعديل الملف الشخصي</button>
                  ) : (
                    <>
                      <button 
                        onClick={() => {
                          setSelectedRecipient(selectedUser);
                          setSelectedUser(null);
                          setInput(`@${selectedUser.username} `);
                        }} 
                        className="flex-1 py-2 bg-emerald-600 rounded-xl text-white font-bold"
                      >
                        إشارة / خاص
                      </button>
                    </>
                  )}
                </div>
                {canManageRoom && user?.id !== selectedUser.id && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button onClick={() => setConfirmAction({ userId: selectedUser.id, action: 'kick', username: selectedUser.username })} className="flex-1 py-2 bg-red-500/20 text-red-400 rounded-xl font-bold hover:bg-red-500/30 text-xs">طرد</button>
                    <button onClick={() => setConfirmAction({ userId: selectedUser.id, action: 'ban', username: selectedUser.username })} className="flex-1 py-2 bg-red-600/20 text-red-600 rounded-xl font-bold hover:bg-red-600/30 text-xs">حظر</button>
                    <button onClick={() => setConfirmAction({ userId: selectedUser.id, action: 'mute_text', username: selectedUser.username })} className="flex-1 py-2 bg-yellow-500/20 text-yellow-400 rounded-xl font-bold hover:bg-yellow-500/30 text-xs">كتم</button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
        {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} />}
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-6"
            onClick={() => setConfirmAction(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="glass p-8 rounded-3xl w-full max-w-sm space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-center">تأكيد الإجراء</h2>
              <p className="text-center text-zinc-400">
                هل أنت متأكد من رغبتك في {confirmAction.action === 'kick' ? 'طرد' : confirmAction.action === 'ban' ? 'حظر' : confirmAction.action === 'global_ban' ? 'حظر نهائي من التطبيق لـ' : 'كتم'} {confirmAction.username}؟
              </p>
              {confirmAction.action === 'ban' && (
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500">مدة الحظر</label>
                  <select 
                    value={banDuration}
                    onChange={(e) => setBanDuration(Number(e.target.value))}
                    className="w-full p-2 rounded-xl bg-zinc-800 border border-white/10 text-white"
                  >
                    <option value={1}>ساعة واحدة</option>
                    <option value={24}>24 ساعة</option>
                    <option value={168}>أسبوع</option>
                    <option value={0}>دائم</option>
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setConfirmAction(null)} className="flex-1 py-2 bg-zinc-800 rounded-xl text-white font-bold">إلغاء</button>
                <button 
                  onClick={() => { 
                    handleAdminAction(confirmAction.userId, confirmAction.action, confirmAction.action === 'ban' ? banDuration : undefined); 
                    setConfirmAction(null); 
                    setSelectedUser(null); 
                  }} 
                  className={`flex-1 py-2 rounded-xl text-white font-bold ${confirmAction.action === 'kick' || confirmAction.action === 'ban' || confirmAction.action === 'global_ban' ? 'bg-red-600' : 'bg-yellow-600'}`}
                >
                  تأكيد
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gift Confirmation Dialog */}
      <AnimatePresence>
        {pendingGift && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-6"
            onClick={() => setPendingGift(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="glass p-8 rounded-3xl w-full max-w-sm space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-center">تأكيد إرسال الهدية</h2>
              <div className="text-center space-y-2">
                <span className="text-4xl">{pendingGift.icon}</span>
                <p className="text-lg font-bold">{pendingGift.name}</p>
                <p className="text-zinc-400">إلى: {pendingGift.recipientName}</p>
                <p className="text-yellow-500 font-bold">
                  التكلفة: {pendingGift.recipientId ? pendingGift.price : (pendingGift.price * (roomUsers.length - 1))} رصيد
                  {!pendingGift.recipientId && <span className="text-[10px] block text-zinc-500">(سعر الهدية × عدد المتواجدين)</span>}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPendingGift(null)} className="flex-1 py-2 bg-zinc-800 rounded-xl text-white font-bold">إلغاء</button>
                <button onClick={() => {
                  const recipientCount = pendingGift.recipientId ? 1 : (roomUsers.length - 1);
                  if (recipientCount <= 0) {
                    setToast("لا يوجد مستخدمين آخرين في الغرفة لإرسال الهدية لهم");
                    setPendingGift(null);
                    setTimeout(() => setToast(null), 3000);
                    return;
                  }
                  
                  socket?.emit('send_gift', { 
                    roomId: id, 
                    userId: user?.id, 
                    recipientId: pendingGift.recipientId,
                    recipientName: pendingGift.recipientName,
                    giftId: pendingGift.giftId, 
                    price: pendingGift.price, 
                    name: pendingGift.name, 
                    icon: pendingGift.icon,
                    type: pendingGift.type
                  });
                  setToast(`تم إرسال ${pendingGift.name} إلى ${pendingGift.recipientName} بنجاح!`);
                  setPendingGift(null);
                  setTimeout(() => setToast(null), 3000);
                }} className="flex-1 py-2 bg-emerald-600 rounded-xl text-white font-bold">تأكيد الإرسال</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-20 left-6 right-6 bg-emerald-600 text-white p-4 rounded-2xl shadow-lg z-[70] text-center font-bold"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
