import React from 'react';
import { motion } from 'motion/react';
import { Trophy, Medal, Award } from 'lucide-react';
import Avatar from './Avatar';

interface TopGiver {
  id: number;
  uid: string;
  username: string;
  avatar?: string;
  total_spent: number;
  level: number;
}

interface LeaderboardProps {
  givers: TopGiver[];
}

export default function Leaderboard({ givers }: LeaderboardProps) {
  return (
    <div className="glass p-8 rounded-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-3">
          <Trophy className="text-yellow-400" />
          قائمة كبار الداعمين
        </h2>
      </div>

      <div className="space-y-4">
        {givers.map((giver, index) => (
          <motion.div
            key={giver.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${
                  index === 0 ? 'bg-yellow-500 text-black' :
                  index === 1 ? 'bg-zinc-300 text-black' :
                  index === 2 ? 'bg-orange-500 text-black' :
                  'bg-white/10 text-zinc-400'
                }`}>
                  {index === 0 ? <Medal size={16} /> : index + 1}
                </div>
              </div>
              <Avatar username={giver.username} avatar={giver.avatar} size="sm" />
              <div>
                <h3 className="font-bold group-hover:text-emerald-400 transition-colors">{giver.username}</h3>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">ID: {giver.uid} • مستوى {giver.level}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-emerald-400 font-black text-lg">{giver.total_spent.toLocaleString()}</div>
              <div className="text-[10px] text-zinc-500 uppercase">إجمالي الدعم</div>
            </div>
          </motion.div>
        ))}

        {givers.length === 0 && (
          <div className="text-center py-10 text-zinc-500 italic">
            لا يوجد داعمون حالياً.. كن أول الداعمين!
          </div>
        )}
      </div>
    </div>
  );
}
