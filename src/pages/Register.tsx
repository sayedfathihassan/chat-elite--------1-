import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { UserPlus } from 'lucide-react';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      navigate('/login');
    } else {
      setError(data.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 glass rounded-3xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">إنشاء حساب</h1>
          <p className="text-zinc-400">انضم إلى مجتمع شات إليت</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">اسم المستخدم</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <UserPlus size={20} />
            تسجيل
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-zinc-400">
            لديك حساب بالفعل؟{' '}
            <Link to="/login" className="text-emerald-400 hover:underline">سجل دخولك</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
