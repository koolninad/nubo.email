import React from 'react';
import { Archive, Trash2, Mail, Clock, Tag, RotateCcw, AlertCircle, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmailHoverActionsProps {
  emailId: number;
  isRead: boolean;
  onArchive?: () => void;
  onDelete: () => void;
  onToggleRead: () => void;
  onSnooze: () => void;
  onSelect: () => void;
  onLabel: () => void;
  onMore?: () => void;
  onRestore?: () => void;
  onSpam?: () => void;
  onUnspam?: () => void;
  isSpam?: boolean;
}

export function EmailHoverActions({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  emailId: _emailId,
  isRead,
  onArchive,
  onDelete,
  onToggleRead,
  onSnooze,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSelect: _onSelect,
  onLabel,
  onRestore,
  onSpam,
  onUnspam,
  isSpam
}: EmailHoverActionsProps) {
  return (
    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 p-1">
      {onRestore ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onRestore();
          }}
          title="Restore"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      ) : onArchive ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onArchive();
          }}
          title="Archive"
        >
          <Archive className="w-4 h-4" />
        </Button>
      ) : null}
      
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={(e) => {
          e.stopPropagation();
          onToggleRead();
        }}
        title={isRead ? "Mark as unread" : "Mark as read"}
      >
        <Mail className="w-4 h-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={(e) => {
          e.stopPropagation();
          onSnooze();
        }}
        title="Snooze"
      >
        <Clock className="w-4 h-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={(e) => {
          e.stopPropagation();
          onLabel();
        }}
        title="Add label"
      >
        <Tag className="w-4 h-4" />
      </Button>
      
      {isSpam && onUnspam ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onUnspam();
          }}
          title="Not spam"
        >
          <ShieldOff className="w-4 h-4" />
        </Button>
      ) : onSpam ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onSpam();
          }}
          title="Mark as spam"
        >
          <AlertCircle className="w-4 h-4" />
        </Button>
      ) : null}
    </div>
  );
}