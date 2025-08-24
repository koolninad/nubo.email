import React, { useState } from 'react';
import { X, Tag, Plus, Check } from 'lucide-react';

interface TagPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTags: (tags: string[]) => void;
  currentTags?: string[];
  availableTags?: string[];
}

const defaultTags = [
  'Important',
  'Work',
  'Personal',
  'Finance',
  'Travel',
  'Project',
  'Meeting',
  'Follow-up',
  'Urgent',
  'Reference'
];

export default function TagPopup({ 
  isOpen, 
  onClose, 
  onApplyTags, 
  currentTags = [],
  availableTags = defaultTags 
}: TagPopupProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>(currentTags);
  const [newTag, setNewTag] = useState('');
  const [customTags, setCustomTags] = useState<string[]>([]);

  if (!isOpen) return null;

  const allTags = [...availableTags, ...customTags];

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    if (newTag.trim() && !allTags.includes(newTag.trim())) {
      setCustomTags(prev => [...prev, newTag.trim()]);
      setSelectedTags(prev => [...prev, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleApply = () => {
    onApplyTags(selectedTags);
    onClose();
  };

  const getTagColor = (index: number) => {
    const colors = [
      'bg-purple-500/20 border-purple-400/50 text-purple-200',
      'bg-blue-500/20 border-blue-400/50 text-blue-200',
      'bg-green-500/20 border-green-400/50 text-green-200',
      'bg-yellow-500/20 border-yellow-400/50 text-yellow-200',
      'bg-red-500/20 border-red-400/50 text-red-200',
      'bg-pink-500/20 border-pink-400/50 text-pink-200',
      'bg-indigo-500/20 border-indigo-400/50 text-indigo-200',
      'bg-cyan-500/20 border-cyan-400/50 text-cyan-200',
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-md mx-4 glass rounded-xl p-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Manage Tags</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-white/70" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-white/80 mb-2">Add Custom Tag</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addCustomTag()}
                placeholder="Enter tag name..."
                className="flex-1 px-3 py-2 glass-input text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              <button
                onClick={addCustomTag}
                className="px-3 py-2 glass-button hover:bg-purple-600/20 transition-colors"
              >
                <Plus className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-white/80 mb-2">Available Tags</p>
            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
              {allTags.map((tag, index) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`
                    px-3 py-1.5 rounded-full border transition-all
                    ${selectedTags.includes(tag) 
                      ? getTagColor(index) + ' border-2' 
                      : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10'
                    }
                  `}
                >
                  <span className="flex items-center gap-1.5">
                    {selectedTags.includes(tag) && <Check className="h-3 w-3" />}
                    {tag}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {selectedTags.length > 0 && (
            <div>
              <p className="text-sm font-medium text-white/80 mb-2">
                Selected Tags ({selectedTags.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag, index) => (
                  <span
                    key={tag}
                    className={`px-3 py-1 rounded-full border ${getTagColor(allTags.indexOf(tag))}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-white/10">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 glass-button text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="flex-1 px-4 py-2 glass-button hover:bg-purple-600/20 text-white transition-colors"
            >
              Apply Tags
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}