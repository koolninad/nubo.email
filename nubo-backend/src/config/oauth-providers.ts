export interface OAuthProvider {
  id: string;
  name: string;
  displayName: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  isPopular: boolean;
  supportedFeatures: {
    oauth: boolean;
    imap: boolean;
    smtp: boolean;
    refresh: boolean;
  };
  imapConfig?: {
    host: string;
    port: number;
    secure: boolean;
    authMethod: 'XOAUTH2' | 'PASSWORD';
  };
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    authMethod: 'XOAUTH2' | 'PASSWORD';
  };
  logo?: string;
  color?: string;
  setupInstructions?: string;
}

export const oauthProviders: Record<string, OAuthProvider> = {
  google: {
    id: 'google',
    name: 'google',
    displayName: 'Gmail',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scope: 'https://mail.google.com/ email profile',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: `${process.env.API_URL || 'https://api.nubo.email'}/api/oauth/auth/callback/google`,
    isPopular: true,
    supportedFeatures: {
      oauth: true,
      imap: true,
      smtp: true,
      refresh: true,
    },
    imapConfig: {
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      authMethod: 'XOAUTH2',
    },
    smtpConfig: {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      authMethod: 'XOAUTH2',
    },
    logo: '/logos/google.svg',
    color: '#4285F4',
  },
  
  microsoft: {
    id: 'microsoft',
    name: 'microsoft',
    displayName: 'Outlook',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scope: 'offline_access User.Read https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send',
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
    redirectUri: `${process.env.API_URL || 'https://api.nubo.email'}/api/oauth/auth/callback/microsoft`,
    isPopular: true,
    supportedFeatures: {
      oauth: true,
      imap: true,
      smtp: true,
      refresh: true,
    },
    imapConfig: {
      host: 'outlook.office365.com',
      port: 993,
      secure: true,
      authMethod: 'XOAUTH2',
    },
    smtpConfig: {
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      authMethod: 'XOAUTH2',
    },
    logo: '/logos/outlook.svg',
    color: '#0078D4',
  },
};

export function getProvider(providerId: string): OAuthProvider | undefined {
  return oauthProviders[providerId];
}

export function getPopularProviders(): OAuthProvider[] {
  return Object.values(oauthProviders).filter(p => p.isPopular);
}

export function getOtherProviders(): OAuthProvider[] {
  return Object.values(oauthProviders).filter(p => !p.isPopular);
}