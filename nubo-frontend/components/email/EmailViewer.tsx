'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Reply, ReplyAll, Forward, Archive, Trash2, 
  Star, MoreVertical, Download, Paperclip, Clock 
} from 'lucide-react';
import { format } from 'date-fns';
import DOMPurify from 'isomorphic-dompurify';

interface Email {
  id: number;
  subject: string;
  from_address: string;
  to_address: string;
  cc_address?: string;
  date: string;
  is_starred: boolean;
  folder: string;
}

interface EmailBody {
  text: string;
  html: string;
}

interface Attachment {
  id: number;
  filename: string;
  content_type: string;
  size: number;
  is_inline: boolean;
}

interface EmailViewerProps {
  email: Email | null;
  onClose: () => void;
  onReply: () => void;
  onForward: () => void;
}

export default function EmailViewer({ email, onClose, onReply, onForward }: EmailViewerProps) {
  const [body, setBody] = useState<EmailBody | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  // Fetch email body when email changes
  useEffect(() => {
    if (!email) return;

    const fetchEmailBody = async () => {
      setLoading(true);
      try {
        // Fetch body
        const bodyResponse = await fetch(`/api/mail-v2/emails/${email.id}/body`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (!bodyResponse.ok) throw new Error('Failed to fetch email body');
        const bodyData = await bodyResponse.json();
        setBody(bodyData);

        // Fetch attachments
        const attachResponse = await fetch(`/api/mail-v2/emails/${email.id}/attachments`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (!attachResponse.ok) throw new Error('Failed to fetch attachments');
        const attachData = await attachResponse.json();
        setAttachments(attachData);
      } catch (error) {
        console.error('Failed to fetch email details:', error);
        setBody({ text: 'Failed to load email body', html: '' });
      } finally {
        setLoading(false);
      }
    };

    fetchEmailBody();
  }, [email]);

  const downloadAttachment = async (attachmentId: number, filename: string) => {
    try {
      const response = await fetch(`/api/mail-v2/attachments/${attachmentId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to download attachment');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download attachment:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const parseEmailAddresses = (addresses: string) => {
    try {
      const parsed = JSON.parse(addresses);
      return parsed.map((addr: any) => addr.address || addr).join(', ');
    } catch {
      return addresses;
    }
  };

  if (!email) return null;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold truncate max-w-md">
            {email.subject || '(No subject)'}
          </h2>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={onReply}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Reply"
          >
            <Reply className="h-4 w-4" />
          </button>
          <button
            onClick={() => {}}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Reply All"
          >
            <ReplyAll className="h-4 w-4" />
          </button>
          <button
            onClick={onForward}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Forward"
          >
            <Forward className="h-4 w-4" />
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <button
            onClick={() => {}}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Archive"
          >
            <Archive className="h-4 w-4" />
          </button>
          <button
            onClick={() => {}}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => {}}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Star"
          >
            <Star className={`h-4 w-4 ${email.is_starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
          </button>
          <button
            onClick={() => {}}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="More"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Email metadata */}
      <div className="p-4 border-b bg-gray-50">
        <div className="space-y-2 text-sm">
          <div className="flex">
            <span className="font-medium w-20">From:</span>
            <span className="text-gray-700">{email.from_address}</span>
          </div>
          <div className="flex">
            <span className="font-medium w-20">To:</span>
            <span className="text-gray-700">{parseEmailAddresses(email.to_address)}</span>
          </div>
          {email.cc_address && (
            <div className="flex">
              <span className="font-medium w-20">Cc:</span>
              <span className="text-gray-700">{parseEmailAddresses(email.cc_address)}</span>
            </div>
          )}
          <div className="flex">
            <span className="font-medium w-20">Date:</span>
            <span className="text-gray-700">
              {format(new Date(email.date), 'PPpp')}
            </span>
          </div>
        </div>
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center gap-2 mb-2">
            <Paperclip className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">{attachments.length} Attachment{attachments.length > 1 ? 's' : ''}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <button
                key={attachment.id}
                onClick={() => downloadAttachment(attachment.id, attachment.filename)}
                className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg hover:bg-gray-50"
              >
                <Download className="h-4 w-4 text-gray-500" />
                <span className="text-sm">{attachment.filename}</span>
                <span className="text-xs text-gray-500">({formatFileSize(attachment.size)})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Email body */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Clock className="h-8 w-8 text-gray-400 mx-auto mb-3 animate-pulse" />
              <p className="text-gray-500">Loading email content...</p>
            </div>
          </div>
        ) : body ? (
          <div className="prose max-w-none">
            {showOriginal || !body.html ? (
              <pre className="whitespace-pre-wrap font-sans text-sm">{body.text}</pre>
            ) : (
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: DOMPurify.sanitize(body.html, {
                    ADD_ATTR: ['target'],
                    ADD_TAGS: ['style'],
                  })
                }}
                className="email-content"
              />
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500">
            Unable to load email content
          </div>
        )}
      </div>

      {/* Toggle view button */}
      {body && body.html && (
        <div className="p-4 border-t">
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="text-sm text-blue-600 hover:underline"
          >
            {showOriginal ? 'Show formatted' : 'Show original'}
          </button>
        </div>
      )}

      <style jsx global>{`
        .email-content img {
          max-width: 100%;
          height: auto;
        }
        .email-content a {
          color: #2563eb;
          text-decoration: underline;
        }
        .email-content table {
          border-collapse: collapse;
        }
        .email-content td, .email-content th {
          padding: 0.5rem;
        }
      `}</style>
    </div>
  );
}