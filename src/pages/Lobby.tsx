import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../App';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, Settings, MessageSquare, Coins, TrendingUp, Trophy } from 'lucide-react';
import Avatar from '../components/Avatar';
import ProfileModal from '../components/ProfileModal';
import Leaderboard from '../components/Leaderboard';

interface Room {
  id: number;
  name: string;
  description: string;
  icon: string;
  image_url?: string;
}

export default function Lobby() {
  const { user, setUser } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/rooms')
      .then(res => res.json())
      .then(setRooms);

    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(setLeaderboard);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setUser(null);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Navbar */}
      <nav className="glass sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          شات إليت
        </h1>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 bg-white/5 px-4 py-2 rounded-full border border-white/10 text-sm">
            <div className="flex items-center gap-2 text-yellow-400">
              <Coins size={16} />
              <span className="font-bold">{user?.credits}</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2 text-emerald-400">
              <TrendingUp size={16} />
              <span className="font-bold">مستوى {user?.level}</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="font-bold">ID: {user?.uid}</span>
            </div>
          </div>

          {user?.role === 'admin' && (
            <Link to="/admin" className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white">
              <Settings size={20} />
            </Link>
          )}
          <button onClick={handleLogout} className="p-2 hover:bg-red-500/10 rounded-full transition-colors text-zinc-400 hover:text-red-400">
            <LogOut size={20} />
          </button>
          <button onClick={() => setShowProfile(true)} className="flex items-center gap-2 hover:bg-white/5 p-1 rounded-full transition-colors">
            <Avatar username={user?.username || ''} avatar={user?.avatar} size="sm" />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
        <section className="lg:col-span-2">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <MessageSquare className="text-emerald-400" />
            الغرف المتاحة
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rooms.map((room) => (
              <motion.div
                key={room.id}
                whileHover={{ scale: 1.02, y: -5 }}
                className="glass p-6 rounded-3xl cursor-pointer hover:border-emerald-500/50 transition-all group relative overflow-hidden"
                onClick={() => navigate(`/room/${room.id}`)}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-start gap-4 relative z-10">
                  {room.image_url ? (
                    <img src={room.image_url} alt={room.name} className="w-16 h-16 rounded-2xl object-cover shadow-lg" />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors shadow-lg">
                      <MessageSquare size={28} />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1 group-hover:text-emerald-400 transition-colors">{room.name}</h3>
                    <p className="text-zinc-400 text-sm line-clamp-2 leading-relaxed">{room.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <aside className="space-y-8">
          <Leaderboard givers={leaderboard} />
        </aside>
      </main>

      <AnimatePresence>
        {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} />}
      </AnimatePresence>
    </div>
  );
}
