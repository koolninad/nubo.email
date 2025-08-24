import React from 'react';

interface EmailAvatarProps {
  email: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function EmailAvatar({ email, name, size = 'md' }: EmailAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base'
  };

  // Generate color based on email
  const getColor = (str: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-indigo-500',
      'bg-cyan-500',
      'bg-teal-500'
    ];
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Get domain logo if it's a known provider
  const getProviderLogo = (emailAddress: string) => {
    const domain = emailAddress.split('@')[1]?.toLowerCase();
    
    const providerLogos: Record<string, string> = {
      'gmail.com': '🔴',
      'outlook.com': '🔵',
      'yahoo.com': '💜',
      'hotmail.com': '🔵',
      'icloud.com': '☁️',
      'protonmail.com': '🔒',
    };

    if (domain && providerLogos[domain]) {
      return providerLogos[domain];
    }

    return null;
  };

  const initial = (name || email).charAt(0).toUpperCase();
  const colorClass = getColor(email);
  const logo = getProviderLogo(email);

  return (
    <div className={`${sizeClasses[size]} ${colorClass} rounded-full flex items-center justify-center text-white font-medium`}>
      {logo || initial}
    </div>
  );
}