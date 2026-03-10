import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings, Users, Ban, Trash2, Shield, Save, UserPlus } from 'lucide-react';

interface RoomAdminModalProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
  onClearChat: () => void;
}

export default function RoomAdminModal({ roomId, isOpen, onClose, onClearChat }: RoomAdminModalProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState({ name: '', description: '', icon: '', is_private: false, slow_mode: 0, background_image: '' });
  const [bans, setBans] = useState<any[]>([]);
  const [roleForm, setRoleForm] = useState({ userId: '', role: 'member' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch(`/api/rooms/${roomId}/settings`).then(res => res.json()).then(setSettings);
      fetch(`/api/rooms/${roomId}/bans`).then(res => res.json()).then(setBans);
    }
  }, [isOpen, roomId]);

  const handleSaveSettings = async () => {
    setLoading(true);
    await fetch(`/api/rooms/${roomId}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    setLoading(false);
    alert('تم حفظ الإعدادات');
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/rooms/${roomId}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roleForm)
    });
    if (res.ok) {
      alert('تم تحديث الرتبة');
      setRoleForm({ userId: '', role: 'member' });
    } else {
      const data = await res.json();
      alert(data.error || 'حدث خطأ');
    }
  };

  const handleUnban = async (userId: number) => {
    await fetch(`/api/rooms/${roomId}/bans/${userId}`, { method: 'DELETE' });
    setBans(bans.filter(b => b.user_id !== userId));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-900 border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-xl text-purple-400">
              <Shield size={20} />
            </div>
            <h2 className="text-xl font-bold">إدارة الغرفة</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-white/5">
          {[
            { id: 'general', label: 'العام', icon: Settings },
            { id: 'roles', label: 'الرتب', icon: Users },
            { id: 'bans', label: 'المحظورين', icon: Ban },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-all ${
                activeTab === tab.id ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-400/5' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 mr-2">اسم الغرفة</label>
                  <input 
                    type="text" 
                    value={settings.name || ''} 
                    onChange={e => setSettings({...settings, name: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 mr-2">أيقونة الغرفة</label>
                  <input 
                    type="text" 
                    value={settings.icon || ''} 
                    onChange={e => setSettings({...settings, icon: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 mr-2">صورة خلفية الغرفة (رابط)</label>
                  <input 
                    type="text" 
                    value={settings.background_image || ''} 
                    onChange={e => setSettings({...settings, background_image: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-zinc-500 mr-2">وصف الغرفة</label>
                <textarea 
                  value={settings.description || ''} 
                  onChange={e => setSettings({...settings, description: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none h-20"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                <div>
                  <p className="font-bold">غرفة خاصة</p>
                  <p className="text-xs text-zinc-500">لا تظهر في القائمة العامة</p>
                </div>
                <button 
                  onClick={() => setSettings({...settings, is_private: !settings.is_private})}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings.is_private ? 'bg-purple-600' : 'bg-zinc-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.is_private ? 'right-7' : 'right-1'}`} />
                </button>
              </div>
              
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-red-400">تطهير الدردشة</p>
                  <p className="text-xs text-red-500/70">حذف جميع الرسائل في هذه الغرفة</p>
                </div>
                <button 
                  onClick={() => {
                    if(confirm('هل أنت متأكد من حذف جميع الرسائل؟')) onClearChat();
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-colors"
                >
                  حذف الكل
                </button>
              </div>

              <button 
                onClick={handleSaveSettings}
                disabled={loading}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <Save size={18} />
                {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-6">
              <form onSubmit={handleUpdateRole} className="p-4 bg-white/5 rounded-2xl space-y-4">
                <h3 className="font-bold flex items-center gap-2">
                  <UserPlus size={18} className="text-purple-400" />
                  إضافة/تعديل رتبة
                </h3>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="UID العضو" 
                    value={roleForm.userId || ''}
                    onChange={e => setRoleForm({...roleForm, userId: e.target.value})}
                    className="flex-1 bg-zinc-800 border border-white/10 rounded-xl px-4 py-2 outline-none"
                    required
                  />
                  <select 
                    value={roleForm.role || 'member'}
                    onChange={e => setRoleForm({...roleForm, role: e.target.value})}
                    className="bg-zinc-800 border border-white/10 rounded-xl px-4 py-2 outline-none"
                  >
                    <option value="member">عضو</option>
                    <option value="assistant">مساعد</option>
                    <option value="moderator">مشرف</option>
                    <option value="master">ماستر</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors">
                  تحديث الرتبة
                </button>
              </form>
              
              <div className="space-y-2">
                <p className="text-xs text-zinc-500 mr-2">صلاحيات الرتب:</p>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-purple-400 font-bold">ماستر:</span> تحكم كامل في الإعدادات، الرتب، الحظر، وتطهير الدردشة.
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-blue-400 font-bold">مشرف:</span> حظر/فك حظر، طرد، حذف رسائل، وتطهير الدردشة.
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-emerald-400 font-bold">مساعد:</span> طرد وحذف رسائل فردية.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bans' && (
            <div className="space-y-4">
              {bans.length === 0 ? (
                <div className="text-center py-10 text-zinc-500">لا يوجد مستخدمين محظورين حالياً</div>
              ) : (
                bans.map(ban => (
                  <div key={ban.user_id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden">
                        {ban.avatar ? <img src={ban.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-500">👤</div>}
                      </div>
                      <div>
                        <p className="font-bold">{ban.username}</p>
                        <p className="text-[10px] text-zinc-500">
                          {ban.expires_at ? `ينتهي في: ${new Date(ban.expires_at).toLocaleString()}` : 'حظر دائم'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleUnban(ban.user_id)}
                      className="p-2 text-zinc-500 hover:text-emerald-400 transition-colors"
                      title="فك الحظر"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
