'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Paperclip, Bold, Italic, Underline, Link, 
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Maximize2, Lock, Signature, X, FileText, Image, FileArchive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ComposeEmailProps {
  open: boolean;
  onClose: () => void;
  onSend: (data: any) => void;
  accounts: any[];
  replyTo?: any;
  isReply?: boolean;
  isForward?: boolean;
}

export function ComposeEmail({ 
  open, 
  onClose, 
  onSend, 
  accounts,
  replyTo,
  isReply,
  isForward
}: ComposeEmailProps) {
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout>();
  
  const getInitialFormData = () => {
    // Check if we're on the client side
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('appSettings');
      const settings = savedSettings ? JSON.parse(savedSettings) : {};
      const signatureHtml = settings.enableSignature && settings.signature 
        ? `<br><br>--<br>${settings.signature.replace(/\n/g, '<br>')}`
        : '';
      
      return {
        from: accounts[0]?.id || '',
        to: '',
        cc: '',
        bcc: '',
        subject: '',
        body: signatureHtml,
        confidential: false,
        signature: settings.enableSignature === true,
        attachments: []
      };
    }
    
    // Default for SSR
    return {
      from: accounts[0]?.id || '',
      to: '',
      cc: '',
      bcc: '',
      subject: '',
      body: '',
      confidential: false,
      signature: false,
      attachments: []
    };
  };

  const [formData, setFormData] = useState(getInitialFormData());

  // Reset form when opening with reply/forward data
  useEffect(() => {
    if (open) {
      // Always refresh initial data when opening to get latest signature settings
      const initialData = getInitialFormData();
      
      if (isReply && replyTo) {
        setFormData({
          ...initialData,
          from: accounts[0]?.id || '',
          to: replyTo.from_address || '',
          subject: `Re: ${replyTo.subject?.replace(/^Re: /, '')}`,
          body: initialData.body // Keep signature from initial data
        });
      } else if (isForward && replyTo) {
        const forwardBody = `<br><br>---------- Forwarded message ----------<br>From: ${replyTo.from_address}<br>Date: ${replyTo.date}<br>Subject: ${replyTo.subject}<br><br>${replyTo.text_body || ''}`;
        setFormData({
          ...initialData,
          from: accounts[0]?.id || '',
          subject: `Fwd: ${replyTo.subject?.replace(/^Fwd: /, '')}`,
          body: forwardBody + initialData.body // Append signature
        });
      } else {
        setFormData(initialData);
      }
    }
  }, [open, isReply, isForward, replyTo, accounts]);

  // Auto-save draft - but not for replies/forwards
  useEffect(() => {
    if (!open || isReply || isForward) return;
    
    // Clear existing timer
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }
    
    // Set new timer for auto-save (3 seconds after last change)
    autoSaveTimer.current = setTimeout(() => {
      if (formData.to || formData.subject || formData.body) {
        saveDraft();
      }
    }, 3000);
    
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [formData, open, isReply, isForward]);
  
  const saveDraft = async () => {
    if (!formData.from || typeof window === 'undefined') return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/mail/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          account_id: formData.from,
          to: formData.to,
          cc: formData.cc,
          bcc: formData.bcc,
          subject: formData.subject || '(No subject)',
          text_body: formData.body.replace(/<[^>]*>/g, ''),
          html_body: formData.body,
          draft_id: draftId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setDraftId(data.draft_id);
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSend = () => {
    if (!formData.to || !formData.subject) {
      alert('Please fill in To and Subject fields');
      return;
    }
    if (!formData.from || formData.from === '') {
      alert('Please select a From account');
      return;
    }
    
    // Add Nubo footer to the email
    const nuboFooter = `<br><br><div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666;">
      <p>Sent using <a href="https://nubo.email" style="color: #0066cc;">Nubo.email</a> - All your inboxes, one place.</p>
      <p><a href="https://nubo.email/signup" style="color: #0066cc;">Join today</a></p>
    </div>`;
    
    // Include attachments in the data
    const dataToSend = {
      ...formData,
      body: formData.body + nuboFooter,
      attachments: attachments
    };
    
    onSend(dataToSend);
    setFormData(getInitialFormData());
    setAttachments([]);
    onClose();
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };
  
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };
  
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (file.type.includes('zip') || file.type.includes('rar')) return <FileArchive className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`${fullscreen ? 'max-w-full h-screen m-0' : 'max-w-3xl max-h-[90vh]'} p-0 flex flex-col glass border border-white/10`}>
        <DialogHeader className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between w-full pr-10">
            <div className="flex items-center space-x-3 flex-1">
              <DialogTitle>{isReply ? 'Reply' : isForward ? 'Forward' : 'New Message'}</DialogTitle>
              {saving && (
                <span className="text-xs text-neutral-500">Saving...</span>
              )}
              {!saving && lastSaved && (
                <span className="text-xs text-neutral-500">
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-2 mr-2"
              onClick={() => setFullscreen(!fullscreen)}
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* From selector */}
          {accounts.length > 1 && (
            <div className="flex items-center space-x-2">
              <Label className="w-16">From:</Label>
              <select
                className="flex-1 px-3 py-2 glass-input text-white"
                value={formData.from}
                onChange={(e) => setFormData({...formData, from: e.target.value})}
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.display_name} ({acc.email_address})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* To field */}
          <div className="flex items-center space-x-2">
            <Label className="w-16">To:</Label>
            <div className="flex-1 flex items-center space-x-2">
              <Input
                type="email"
                placeholder="Recipients"
                value={formData.to}
                onChange={(e) => setFormData({...formData, to: e.target.value})}
                className="flex-1 glass-input text-white placeholder:text-white/50"
              />
              <button
                onClick={() => setShowCc(!showCc)}
                className="text-sm text-blue-600 hover:underline"
              >
                Cc
              </button>
              <button
                onClick={() => setShowBcc(!showBcc)}
                className="text-sm text-blue-600 hover:underline"
              >
                Bcc
              </button>
            </div>
          </div>

          {/* CC field */}
          {showCc && (
            <div className="flex items-center space-x-2">
              <Label className="w-16">Cc:</Label>
              <Input
                type="email"
                placeholder="Cc recipients"
                value={formData.cc}
                onChange={(e) => setFormData({...formData, cc: e.target.value})}
                className="glass-input text-white placeholder:text-white/50"
              />
            </div>
          )}

          {/* BCC field */}
          {showBcc && (
            <div className="flex items-center space-x-2">
              <Label className="w-16">Bcc:</Label>
              <Input
                type="email"
                placeholder="Bcc recipients"
                value={formData.bcc}
                onChange={(e) => setFormData({...formData, bcc: e.target.value})}
                className="glass-input text-white placeholder:text-white/50"
              />
            </div>
          )}

          {/* Subject */}
          <div className="flex items-center space-x-2">
            <Label className="w-16">Subject:</Label>
            <Input
              placeholder="Subject"
              value={formData.subject}
              onChange={(e) => setFormData({...formData, subject: e.target.value})}
              className="glass-input text-white placeholder:text-white/50"
            />
          </div>

          {/* Formatting toolbar */}
          <div className="glass-input rounded-t-lg rounded-b-none p-2 flex items-center space-x-1 flex-wrap">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => formatText('bold')}
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => formatText('italic')}
            >
              <Italic className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => formatText('underline')}
            >
              <Underline className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-neutral-300 mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => formatText('insertUnorderedList')}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => formatText('insertOrderedList')}
            >
              <ListOrdered className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-neutral-300 mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => formatText('justifyLeft')}
            >
              <AlignLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => formatText('justifyCenter')}
            >
              <AlignCenter className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => formatText('justifyRight')}
            >
              <AlignRight className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-neutral-300 mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                const url = prompt('Enter URL:');
                if (url) formatText('createLink', url);
              }}
            >
              <Link className="w-4 h-4" />
            </Button>
          </div>

          {/* Email body */}
          <div className="relative">
            {formData.confidential && (
              <div className="absolute top-2 right-2 z-10 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-2 py-1 rounded text-xs flex items-center">
                <Lock className="w-3 h-3 mr-1" />
                Confidential Mode
              </div>
            )}
            <div
              contentEditable
              className={`min-h-[200px] p-4 glass-input rounded-t-none focus:outline-none text-white ${
                formData.confidential ? 'border-red-300 dark:border-red-700 bg-red-50/20 dark:bg-red-950/20' : ''
              }`}
              onInput={(e) => setFormData({...formData, body: e.currentTarget.innerHTML})}
              data-placeholder="Compose your message..."
            />
          </div>

          {/* Attachments display */}
          {attachments.length > 0 && (
            <div className="border rounded-lg p-3 space-y-2">
              <div className="text-sm font-medium">Attachments ({attachments.length})</div>
              <div className="space-y-1">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-neutral-50 dark:bg-neutral-800 rounded">
                    <div className="flex items-center space-x-2">
                      {getFileIcon(file)}
                      <span className="text-sm">{file.name}</span>
                      <span className="text-xs text-neutral-500">({formatFileSize(file.size)})</span>
                    </div>
                    <button
                      onClick={() => removeAttachment(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Original message (for replies/forwards) */}
          {(isReply || isForward) && replyTo && (
            <div className="border-l-4 border-neutral-300 pl-4 mt-4 text-sm text-neutral-600">
              <div className="mb-2">
                On {new Date(replyTo.date).toLocaleString()}, {replyTo.from_name || replyTo.from_address} wrote:
              </div>
              <div dangerouslySetInnerHTML={{ __html: replyTo.html_body || replyTo.text_body }} />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center space-x-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept="*/*"
            />
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="w-4 h-4 mr-2" />
              Attach ({attachments.length})
            </Button>
            <Button 
              variant={formData.signature ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                const newSignatureState = !formData.signature;
                if (typeof window !== 'undefined') {
                  const savedSettings = localStorage.getItem('appSettings');
                  const settings = savedSettings ? JSON.parse(savedSettings) : {};
                  const signatureHtml = settings.enableSignature && settings.signature 
                    ? `<br><br>--<br>${settings.signature.replace(/\n/g, '<br>')}`
                    : '';
                  
                  if (newSignatureState && signatureHtml) {
                    // Add signature if turning on
                    const currentBody = formData.body;
                    // Remove existing signature if any
                    const bodyWithoutSig = currentBody.replace(/<br><br>--<br>[\s\S]*$/, '');
                    setFormData({
                      ...formData, 
                      body: bodyWithoutSig + signatureHtml,
                      signature: true
                    });
                  } else {
                    // Remove signature if turning off
                    const bodyWithoutSig = formData.body.replace(/<br><br>--<br>[\s\S]*$/, '');
                    setFormData({
                      ...formData, 
                      body: bodyWithoutSig,
                      signature: false
                    });
                  }
                }
              }}
            >
              <Signature className="w-4 h-4 mr-2" />
              {formData.signature ? 'Signature On' : 'Signature Off'}
            </Button>
            <Button 
              variant={formData.confidential ? "default" : "ghost"}
              size="sm"
              onClick={() => setFormData({...formData, confidential: !formData.confidential})}
            >
              <Lock className={`w-4 h-4 mr-2 ${formData.confidential ? 'text-red-500' : ''}`} />
              {formData.confidential ? 'Confidential Mode' : 'Standard Mode'}
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSend}>
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}