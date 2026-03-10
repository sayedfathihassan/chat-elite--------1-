import React from 'react';

interface AvatarProps {
  username: string;
  avatar?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Avatar({ username, avatar, className = '', size = 'md' }: AvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-20 h-20 text-2xl',
  };

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-zinc-800 flex items-center justify-center font-bold border border-white/10 overflow-hidden ${className}`}>
      {avatar ? (
        <img src={avatar} alt={username} className="w-full h-full object-cover" />
      ) : (
        username[0].toUpperCase()
      )}
    </div>
  );
}
