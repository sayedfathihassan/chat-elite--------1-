import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User } from 'lucide-react';
import Avatar from './Avatar';

interface ProfileModalProps {
  user: any;
  onClose: () => void;
}

export default function ProfileModal({ user, onClose }: ProfileModalProps) {
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [username, setUsername] = useState(user.username || '');
  const [textColor, setTextColor] = useState(user.text_color || '#ffffff');
  const [bubbleStyle, setBubbleStyle] = useState(user.bubble_style || 'default');
  const [joinEffect, setJoinEffect] = useState(user.join_effect || 'none');

  const bubbleOptions = [
    { id: 'default', name: 'افتراضي', price: 0 },
    { id: 'neon', name: 'نيون', price: 500 },
    { id: 'gold', name: 'ذهبي', price: 1000 },
    { id: 'purple', name: 'بنفسجي', price: 1000 },
    { id: 'fire', name: 'ناري', price: 2000 },
    { id: 'galaxy', name: 'مجرة', price: 3000 },
  ];

  const colorOptions = [
    { hex: '#ffffff', price: 0 },
    { hex: '#ff4d4d', price: 200 },
    { hex: '#00aaff', price: 200 },
    { hex: '#00ff88', price: 200 },
    { hex: '#bf00ff', price: 500 },
    { hex: '#ffcc00', price: 500 },
    { hex: '#ff66aa', price: 500 },
  ];

  const handleSave = async () => {
    const response = await fetch('/api/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar, username, textColor, bubbleStyle, joinEffect })
    });
    
    if (!response.ok) {
      const data = await response.json();
      alert(data.error || 'حدث خطأ أثناء الحفظ');
      return;
    }
    window.location.reload();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="glass p-8 rounded-3xl w-full max-w-sm space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">تعديل الملف الشخصي</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
        </div>
        
        <div className="flex flex-col items-center gap-4">
          <Avatar username={username} avatar={avatar} size="lg" />
          <div className="text-zinc-500 font-mono text-sm">ID: {user.uid}</div>
          <input 
            value={username || ''} 
            onChange={e => setUsername(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-center"
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 block mb-2">تأثير الانضمام</label>
            <select 
              value={joinEffect}
              onChange={(e) => setJoinEffect(e.target.value)}
              className="w-full p-2 rounded-xl bg-zinc-800 border border-white/10 text-white"
            >
              <option value="none">بدون تأثير</option>
              <option value="confetti">قصاصات ملونة</option>
              <option value="fireworks">ألعاب نارية</option>
              <option value="stars">نجوم</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-2">لون الخط</label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map(color => (
                <button 
                  key={color.hex} 
                  onClick={() => setTextColor(color.hex)}
                  className={`w-8 h-8 rounded-full border-2 ${textColor === color.hex ? 'border-white' : 'border-transparent'} relative`}
                  style={{ backgroundColor: color.hex }}
                  title={`${color.price} رصيد`}
                >
                  {color.price > 0 && <span className="absolute -top-2 -right-2 bg-yellow-600 text-[8px] rounded-full px-1">{color.price}</span>}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-2">نمط الفقاعة</label>
            <select 
              value={bubbleStyle}
              onChange={(e) => setBubbleStyle(e.target.value)}
              className="w-full p-2 rounded-xl bg-zinc-800 border border-white/10 text-white"
            >
              {bubbleOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.name} {option.price > 0 ? `(${option.price} رصيد)` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button onClick={handleSave} className="w-full py-3 bg-emerald-600 rounded-xl text-white font-bold">حفظ التغييرات</button>
      </motion.div>
    </motion.div>
  );
}
