import React, { useState } from 'react';
import { X, Clock, Calendar } from 'lucide-react';

interface SnoozePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSnooze: (date: Date) => void;
  emailSubject?: string;
}

export default function SnoozePopup({ isOpen, onClose, onSnooze, emailSubject }: SnoozePopupProps) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00');

  if (!isOpen) return null;

  const handleSnooze = () => {
    if (!selectedDate) return;
    
    const dateTime = new Date(`${selectedDate}T${selectedTime}`);
    onSnooze(dateTime);
    onClose();
  };

  const setQuickSnooze = (hours: number) => {
    const date = new Date();
    date.setHours(date.getHours() + hours);
    onSnooze(date);
    onClose();
  };

  const tomorrow9am = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    onSnooze(date);
    onClose();
  };

  const nextWeek = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    date.setHours(9, 0, 0, 0);
    onSnooze(date);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-md mx-4 glass rounded-xl p-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Snooze Email</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-white/70" />
          </button>
        </div>

        {emailSubject && (
          <p className="text-sm text-white/60 mb-4 truncate">
            {emailSubject}
          </p>
        )}

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-white/80 mb-2">Quick Options</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setQuickSnooze(1)}
                className="glass-button px-3 py-2 text-sm text-white"
              >
                1 hour
              </button>
              <button
                onClick={() => setQuickSnooze(4)}
                className="glass-button px-3 py-2 text-sm text-white"
              >
                4 hours
              </button>
              <button
                onClick={tomorrow9am}
                className="glass-button px-3 py-2 text-sm text-white"
              >
                Tomorrow 9am
              </button>
              <button
                onClick={nextWeek}
                className="glass-button px-3 py-2 text-sm text-white"
              >
                Next week
              </button>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <p className="text-sm font-medium text-white/80 mb-2">Custom Date & Time</p>
            <div className="flex gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="flex-1 px-3 py-2 glass-input text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="px-3 py-2 glass-input text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 glass-button text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSnooze}
              disabled={!selectedDate}
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              Snooze
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}