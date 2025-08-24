'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  Search, 
  Mail, 
  Settings, 
  Key, 
  Shield, 
  Smartphone,
  Globe,
  HelpCircle,
  ChevronRight,
  Zap,
  Lock,
  Users,
  Server
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function HelpCenterPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const helpSections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: <Zap className="w-5 h-5" />,
      articles: [
        {
          title: 'Creating Your Nubo Account',
          content: `
1. Visit nubo.email and click "Sign Up"
2. Choose a unique username
3. Enter your email address
4. Create a strong password
5. Verify your email address
6. Complete your profile setup

Your Nubo account is your gateway to managing all your email accounts in one place.`
        },
        {
          title: 'Adding Your First Email Account',
          content: `
1. Go to Settings → Email Accounts
2. Click "Add Email Account"
3. Enter your email address
4. Provide your IMAP settings:
   - Server: Your email provider's IMAP server
   - Port: Usually 993 for SSL/TLS
   - Username: Your full email address
   - Password: Your email password
5. Configure SMTP settings for sending emails
6. Test the connection
7. Save your account

Popular providers:
- Gmail: imap.gmail.com (port 993)
- Outlook: outlook.office365.com (port 993)
- Yahoo: imap.mail.yahoo.com (port 993)`
        },
        {
          title: 'Understanding the Interface',
          content: `
The Nubo interface is designed for simplicity:

- Sidebar: Navigate between inbox, sent, drafts, trash, and spam
- Email List: View all your emails with preview
- Email View: Read full emails with attachments
- Compose Button: Start writing a new email
- Search Bar: Find emails across all accounts
- Settings: Manage accounts and preferences

Use keyboard shortcuts for faster navigation:
- C: Compose new email
- /: Focus search
- J/K: Navigate emails
- E: Archive
- #: Delete`
        }
      ]
    },
    {
      id: 'email-management',
      title: 'Email Management',
      icon: <Mail className="w-5 h-5" />,
      articles: [
        {
          title: 'Unified Inbox',
          content: `
The Unified Inbox combines emails from all your connected accounts:

- All emails appear in chronological order
- Account indicators show which account received each email
- Filter by account using the sidebar
- Search across all accounts simultaneously
- Separate folders for each account remain accessible

Benefits:
- Never miss an important email
- Respond faster without switching accounts
- Maintain a cleaner workflow`
        },
        {
          title: 'Composing and Sending Emails',
          content: `
To compose an email:
1. Click the Compose button or press 'C'
2. Select which account to send from
3. Enter recipients (To, CC, BCC)
4. Add your subject line
5. Write your message with rich text formatting
6. Attach files (up to 25MB per email)
7. Click Send or press Ctrl/Cmd + Enter

Features:
- Rich text editor with formatting options
- Drag and drop attachments
- Save drafts automatically
- Email signatures per account
- Schedule send (coming soon)`
        },
        {
          title: 'Managing Folders',
          content: `
Organize your emails effectively:

- Inbox: New and unread emails
- Sent: Emails you've sent
- Drafts: Unsent email drafts
- Trash: Deleted emails (auto-deleted after 30 days)
- Spam: Filtered spam emails (auto-deleted after 30 days)

Actions:
- Move emails between folders
- Create custom labels (coming soon)
- Bulk select and manage
- Empty trash/spam with one click`
        }
      ]
    },
    {
      id: 'security',
      title: 'Security & Privacy',
      icon: <Shield className="w-5 h-5" />,
      articles: [
        {
          title: 'Two-Factor Authentication (2FA)',
          content: `
Enable 2FA for enhanced security:

1. Go to Settings → Security
2. Click "Enable Two-Factor Authentication"
3. Scan the QR code with your authenticator app:
   - Google Authenticator
   - Authy
   - Microsoft Authenticator
4. Enter the verification code
5. Save your backup codes securely

Important:
- Store backup codes in a safe place
- Each backup code can only be used once
- Regenerate codes if compromised`
        },
        {
          title: 'Data Security',
          content: `
How we protect your data:

- All passwords are encrypted using bcrypt
- IMAP/SMTP credentials stored with AES-256 encryption
- TLS/SSL for all data transmission
- No email content stored permanently
- Temporary cache cleared after 4 hours
- Two-factor authentication available
- Regular security audits

Your privacy matters:
- We never read your emails
- No data sold to third parties
- Open source for transparency
- Self-hosting option available`
        },
        {
          title: 'Account Security Best Practices',
          content: `
Keep your account secure:

1. Use a strong, unique password
2. Enable two-factor authentication
3. Regularly review connected accounts
4. Use app-specific passwords when available
5. Monitor account activity
6. Keep your recovery email updated
7. Don't share your credentials

Warning signs:
- Unexpected login notifications
- Emails you didn't send
- Changed settings
- Missing emails

If compromised:
1. Change your password immediately
2. Review and remove unknown devices
3. Check email forwarding rules
4. Contact support@nubo.email`
        }
      ]
    },
    {
      id: 'accounts',
      title: 'Account Settings',
      icon: <Settings className="w-5 h-5" />,
      articles: [
        {
          title: 'Managing Email Accounts',
          content: `
Add multiple email accounts:

1. Navigate to Settings → Email Accounts
2. Click "Add Email Account"
3. Configure IMAP settings:
   - Server address
   - Port (993 for SSL/TLS)
   - Security type
   - Username and password
4. Configure SMTP settings:
   - Server address
   - Port (587 for STARTTLS, 465 for SSL)
   - Authentication method
5. Test connection
6. Set account nickname (optional)

Edit existing accounts:
- Update credentials
- Change server settings
- Modify display name
- Set as default for sending
- Remove account`
        },
        {
          title: 'Email Signatures',
          content: `
Create professional signatures:

1. Go to Settings → Signatures
2. Click "Add Signature"
3. Design your signature:
   - Text formatting
   - Links and social media
   - Images/logos (base64 embedded)
4. Assign to specific accounts
5. Set as default for new emails

Tips:
- Keep signatures concise
- Include essential contact info
- Use consistent branding
- Test on mobile devices
- Avoid large images`
        },
        {
          title: 'Notification Preferences',
          content: `
Customize your notifications:

Desktop Notifications:
- New email alerts
- Sound preferences
- Do not disturb mode

Email Notifications:
- Security alerts
- Account activity
- Newsletter subscription

Mobile (PWA):
- Push notifications
- Badge counts
- Vibration settings

Configure in Settings → Notifications`
        }
      ]
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: <HelpCircle className="w-5 h-5" />,
      articles: [
        {
          title: 'Connection Issues',
          content: `
Can't connect to email account?

Common solutions:
1. Verify IMAP/SMTP settings with your provider
2. Check username (often full email address)
3. Generate app-specific password if using:
   - Gmail (with 2FA enabled)
   - Outlook/Hotmail
   - Yahoo Mail
4. Enable "Less secure apps" if required
5. Check firewall/antivirus settings
6. Verify port numbers:
   - IMAP: 993 (SSL), 143 (STARTTLS)
   - SMTP: 465 (SSL), 587 (STARTTLS)

Error messages:
- "Authentication failed": Wrong password or need app password
- "Connection timeout": Check server address and ports
- "Certificate error": Verify security settings`
        },
        {
          title: 'Email Sync Problems',
          content: `
Emails not syncing properly?

Try these steps:
1. Pull down to refresh manually
2. Check account connection status
3. Verify IMAP folder settings
4. Clear cache in Settings
5. Remove and re-add account
6. Check email provider limits

Common issues:
- Missing emails: Check spam/trash folders
- Delayed emails: Normal delay is 1-5 minutes
- Duplicate emails: Clear cache and resync
- Attachments not loading: Check size limits`
        },
        {
          title: 'Login and Password Issues',
          content: `
Can't log into Nubo?

Password reset:
1. Click "Forgot Password" on login page
2. Enter your email address
3. Check your email for reset link
4. Create a new password
5. Log in with new credentials

2FA issues:
- Lost authenticator: Use backup codes
- Backup codes lost: Contact support
- Wrong code: Check device time sync

Account locked:
- Too many failed attempts
- Wait 15 minutes or contact support
- Verify account ownership`
        }
      ]
    },
    {
      id: 'advanced',
      title: 'Advanced Features',
      icon: <Server className="w-5 h-5" />,
      articles: [
        {
          title: 'Keyboard Shortcuts',
          content: `
Master Nubo with keyboard shortcuts:

Navigation:
- J: Next email
- K: Previous email
- G then I: Go to inbox
- G then S: Go to sent
- G then D: Go to drafts
- G then T: Go to trash

Actions:
- C: Compose new email
- R: Reply
- A: Reply all
- F: Forward
- E: Archive
- #: Delete
- U: Mark unread
- S: Star/unstar
- /: Search

Compose:
- Ctrl/Cmd + Enter: Send
- Ctrl/Cmd + S: Save draft
- Esc: Cancel compose`
        },
        {
          title: 'Search and Filters',
          content: `
Powerful search capabilities:

Basic search:
- Keywords in subject or body
- Sender name or email
- Date ranges

Advanced search:
- from:sender@email.com
- to:recipient@email.com
- subject:"exact phrase"
- has:attachment
- is:unread
- is:starred
- before:2025/01/01
- after:2024/12/01

Combine operators:
from:boss@company.com has:attachment after:2024/12/01

Save searches as filters for quick access`
        },
        {
          title: 'Self-Hosting Nubo',
          content: `
Host your own Nubo instance:

Requirements:
- Docker and Docker Compose
- 2GB RAM minimum
- 10GB storage
- Domain name (optional)
- SSL certificate (recommended)

Installation:
1. Clone the repository
2. Configure environment variables
3. Run docker-compose up
4. Access at http://localhost:3000

Benefits:
- Complete data control
- Custom features
- No user limits
- Private deployment

See GitHub for detailed instructions`
        }
      ]
    }
  ];

  const filteredSections = helpSections.map(section => ({
    ...section,
    articles: section.articles.filter(article =>
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(section => section.articles.length > 0 || searchQuery === '');

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-6xl mx-auto p-6 md:p-8">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">Help Center</h1>
            <p className="text-neutral-600 dark:text-neutral-400 text-lg">
              Everything you need to know about using Nubo.email
            </p>
          </div>

          <div className="relative mb-8">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 py-6 text-lg"
            />
          </div>

          <div className="grid gap-6">
            {filteredSections.map((section) => (
              <div key={section.id} className="border dark:border-neutral-800 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                  className="w-full px-6 py-4 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {section.icon}
                    <h2 className="text-xl font-semibold">{section.title}</h2>
                    <span className="text-sm text-neutral-500">({section.articles.length} articles)</span>
                  </div>
                  <ChevronRight className={`w-5 h-5 transition-transform ${expandedSection === section.id ? 'rotate-90' : ''}`} />
                </button>
                
                {expandedSection === section.id && (
                  <div className="p-6 space-y-6">
                    {section.articles.map((article, index) => (
                      <div key={index} className="border-l-4 border-blue-500 pl-4">
                        <h3 className="font-semibold text-lg mb-2">{article.title}</h3>
                        <div className="text-neutral-600 dark:text-neutral-400 whitespace-pre-line text-sm">
                          {article.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-center">
            <h3 className="text-lg font-semibold mb-2">Still need help?</h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              Our support team is here to assist you
            </p>
            <Button
              onClick={() => {
                window.location.href = 'mailto:support@nubo.email?subject=Help Request';
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Mail className="w-4 h-4 mr-2" />
              Contact Support
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}