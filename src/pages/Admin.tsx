import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { motion } from 'motion/react';
import { Shield, Plus, Users, MessageSquare, Coins, Trash2, Sparkles } from 'lucide-react';

interface Room {
  id: number;
  name: string;
  description: string;
}

export default function Admin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('rooms');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [newRoom, setNewRoom] = useState({ name: '', description: '' });
  const [creditForm, setCreditForm] = useState({ userId: '', amount: '' });
  const [newQuestion, setNewQuestion] = useState({ question: '', answer: '', category: 'general' });
  const navigate = useNavigate();

  const fetchUsers = async () => {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    setUsers(data);
  };

  const fetchQuestions = async () => {
    const res = await fetch('/api/admin/questions');
    if (res.ok) {
      const data = await res.json();
      setQuestions(data);
    }
  };

  useEffect(() => {
    fetch('/api/rooms').then(res => res.json()).then(setRooms);
    fetchUsers();
    fetchQuestions();
  }, []);

  const handleCreateRoom = async (e: any) => {
    e.preventDefault();
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRoom),
    });
    if (res.ok) {
      const data = await res.json();
      setRooms([...rooms, { id: data.roomId, ...newRoom }]);
      setNewRoom({ name: '', description: '' });
    }
  };

  const handleAddCredits = async (e: any) => {
    e.preventDefault();
    const res = await fetch('/api/admin/add-credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: Number(creditForm.userId), amount: Number(creditForm.amount) }),
    });
    if (res.ok) {
      alert('تمت إضافة الرصيد بنجاح');
      setCreditForm({ userId: '', amount: '' });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <Shield size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">لوحة التحكم العامة</h1>
              <p className="text-zinc-500 text-sm">إدارة الغرف، الأعضاء، والرصيد</p>
            </div>
          </div>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-sm">
            العودة للوبي
          </button>
        </header>

        <div className="flex gap-2 p-1 bg-white/5 rounded-2xl mb-8">
          {[
            { id: 'rooms', label: 'الغرف', icon: Plus },
            { id: 'users', label: 'المستخدمين', icon: Users },
            { id: 'credits', label: 'الرصيد', icon: Coins },
            { id: 'trivia', label: 'المسابقات', icon: MessageSquare },
            { id: 'settings', label: 'الإعدادات', icon: Shield }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${activeTab === tab.id ? 'bg-white/10 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-10">
          {activeTab === 'rooms' && (
            <section className="glass p-8 rounded-3xl space-y-6">
              <h2 className="text-2xl font-bold flex items-center gap-3 text-emerald-400">
                <Plus />
                إدارة الغرف
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <form onSubmit={handleCreateRoom} className="space-y-4">
                  <input
                    type="text"
                    placeholder="اسم الغرفة"
                    value={newRoom.name || ''}
                    onChange={e => setNewRoom({ ...newRoom, name: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <textarea
                    placeholder="وصف الغرفة"
                    value={newRoom.description || ''}
                    onChange={e => setNewRoom({ ...newRoom, description: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 h-24"
                  />
                  <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all hover:scale-[1.02]">
                    إنشاء الغرفة
                  </button>
                </form>
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="text-zinc-500 text-sm border-b border-white/10">
                        <th className="pb-4 font-medium">ID</th>
                        <th className="pb-4 font-medium">الاسم</th>
                        <th className="pb-4 font-medium">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {rooms.map(room => (
                        <tr key={room.id} className="text-sm">
                          <td className="py-4 text-zinc-500">#{room.id}</td>
                          <td className="py-4 font-bold">{room.name}</td>
                          <td className="py-4">
                            <button className="p-2 text-zinc-500 hover:text-red-400 transition-colors">
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'users' && (
            <section className="glass p-8 rounded-3xl space-y-6">
              <h2 className="text-2xl font-bold flex items-center gap-3 text-blue-400">
                <Users />
                إدارة المستخدمين
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="text-zinc-500 text-sm border-b border-white/10">
                      <th className="pb-4 font-medium">UID</th>
                      <th className="pb-4 font-medium">اسم المستخدم</th>
                      <th className="pb-4 font-medium">الرصيد</th>
                      <th className="pb-4 font-medium">الرتبة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map(user => (
                      <tr key={user.id} className="text-sm">
                        <td className="py-4 text-zinc-300 font-mono">{user.uid || user.id}</td>
                        <td className="py-4 font-bold">{user.username}</td>
                        <td className="py-4 text-yellow-500">{user.credits}</td>
                        <td className="py-4 text-purple-400">{user.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'credits' && (
            <section className="glass p-8 rounded-3xl space-y-6">
              <h2 className="text-2xl font-bold flex items-center gap-3 text-yellow-500">
                <Coins />
                توزيع الرصيد
              </h2>
              <form onSubmit={handleAddCredits} className="flex gap-4">
                <input
                  type="text"
                  placeholder="رقم العضو (UID/ID)"
                  value={creditForm.userId || ''}
                  onChange={e => setCreditForm({ ...creditForm, userId: e.target.value })}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                />
                <input
                  type="number"
                  placeholder="المبلغ"
                  value={creditForm.amount || ''}
                  onChange={e => setCreditForm({ ...creditForm, amount: e.target.value })}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required
                />
                <button type="submit" className="px-8 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-xl transition-all hover:scale-[1.02]">
                  إرسال الرصيد
                </button>
              </form>
            </section>
          )}

          {activeTab === 'trivia' && (
            <section className="glass p-8 rounded-3xl space-y-6">
              <h2 className="text-2xl font-bold flex items-center gap-3 text-emerald-400">
                <MessageSquare />
                إدارة أسئلة المسابقات
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await fetch('/api/admin/questions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newQuestion),
                  });
                  if (res.ok) {
                    setNewQuestion({ question: '', answer: '', category: 'general' });
                    fetchQuestions();
                  }
                }} className="space-y-4">
                  <input
                    type="text"
                    placeholder="السؤال"
                    value={newQuestion.question}
                    onChange={e => setNewQuestion({ ...newQuestion, question: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <input
                    type="text"
                    placeholder="الإجابة الصحيحة"
                    value={newQuestion.answer}
                    onChange={e => setNewQuestion({ ...newQuestion, answer: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all hover:scale-[1.02]">
                    إضافة السؤال
                  </button>
                </form>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="text-zinc-500 text-sm border-b border-white/10">
                        <th className="pb-4 font-medium">السؤال</th>
                        <th className="pb-4 font-medium">الإجابة</th>
                        <th className="pb-4 font-medium">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {questions.map(q => (
                        <tr key={q.id} className="text-sm">
                          <td className="py-2.5 font-bold">{q.question}</td>
                          <td className="py-2.5 text-emerald-400">{q.answer}</td>
                          <td className="py-2.5">
                            <button
                              onClick={async () => {
                                const res = await fetch(`/api/admin/questions/${q.id}`, { method: 'DELETE' });
                                if (res.ok) fetchQuestions();
                              }}
                              className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Create User */}
              <section className="glass p-8 rounded-3xl space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-3 text-blue-400">
                  <Users />
                  إنشاء مستخدم جديد
                </h2>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const res = await fetch('/api/admin/create-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      username: formData.get('username'),
                      password: formData.get('password'),
                      role: formData.get('role')
                    }),
                  });
                  if (res.ok) {
                    alert('تم إنشاء المستخدم');
                    e.currentTarget.reset();
                    fetchUsers();
                  }
                }} className="space-y-4">
                  <input name="username" type="text" placeholder="اسم المستخدم" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl" required />
                  <input name="password" type="password" placeholder="كلمة المرور" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl" required />
                  <select name="role" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
                    <option value="user">عضو</option>
                    <option value="admin">أدمن</option>
                  </select>
                  <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl">إنشاء</button>
                </form>
              </section>

              {/* Change Password */}
              <section className="glass p-8 rounded-3xl space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-3 text-red-400">
                  <Shield />
                  تغيير كلمة المرور
                </h2>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const res = await fetch('/api/admin/change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      userId: formData.get('userId'),
                      password: formData.get('password')
                    }),
                  });
                  if (res.ok) {
                    alert('تم تغيير كلمة المرور');
                    e.currentTarget.reset();
                  } else {
                    const data = await res.json();
                    alert(data.error || 'حدث خطأ');
                  }
                }} className="space-y-4">
                  <input name="userId" type="text" placeholder="رقم العضو (UID/ID)" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl" required />
                  <input name="password" type="password" placeholder="كلمة المرور الجديدة" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl" required />
                  <button type="submit" className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl">تغيير</button>
                </form>
              </section>

              {/* Manage User Roles */}
              <section className="glass p-8 rounded-3xl space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-3 text-purple-400">
                  <Users />
                  إدارة رتب الأعضاء في الغرف
                </h2>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const res = await fetch('/api/admin/update-room-role', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      roomId: Number(formData.get('roomId')),
                      userId: formData.get('userId'),
                      role: formData.get('role')
                    }),
                  });
                  if (res.ok) {
                    alert('تم تحديث الرتبة');
                    e.currentTarget.reset();
                  } else {
                    const data = await res.json();
                    alert(data.error || 'حدث خطأ');
                  }
                }} className="space-y-4">
                  <input name="roomId" type="number" placeholder="رقم الغرفة (ID)" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl" required />
                  <input name="userId" type="text" placeholder="رقم العضو (UID/ID)" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl" required />
                  <select name="role" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
                    <option value="member">عضو</option>
                    <option value="assistant">مساعد</option>
                    <option value="moderator">مشرف</option>
                    <option value="master">ماستر</option>
                  </select>
                  <button type="submit" className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl">تحديث الرتبة</button>
                </form>
              </section>

              {/* Manage Join Effects */}
              <section className="glass p-8 rounded-3xl space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-3 text-emerald-400">
                  <Sparkles size={20} />
                  إدارة تأثيرات الدخول
                </h2>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const res = await fetch('/api/admin/update-join-effect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      userId: formData.get('userId'),
                      effect: formData.get('effect')
                    }),
                  });
                  if (res.ok) {
                    alert('تم تحديث تأثير الدخول');
                    e.currentTarget.reset();
                  } else {
                    const data = await res.json();
                    alert(data.error || 'حدث خطأ');
                  }
                }} className="space-y-4">
                  <input name="userId" type="text" placeholder="رقم العضو (UID/ID)" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl" required />
                  <select name="effect" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
                    <option value="">بدون تأثير</option>
                    <option value="confetti">قصاصات ملونة (Confetti)</option>
                    <option value="fireworks">ألعاب نارية (Fireworks)</option>
                    <option value="stars">نجوم ذهبية (Stars)</option>
                  </select>
                  <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl">تحديث التأثير</button>
                </form>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
