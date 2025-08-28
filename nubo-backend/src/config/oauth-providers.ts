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
    displayName: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scope: 'https://mail.google.com/ email profile',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: `${process.env.API_URL || 'https://api.nubo.email'}/auth/callback/google`,
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
  
  yahoo: {
    id: 'yahoo',
    name: 'yahoo',
    displayName: 'Yahoo',
    authUrl: 'https://api.login.yahoo.com/oauth2/request_auth',
    tokenUrl: 'https://api.login.yahoo.com/oauth2/get_token',
    userInfoUrl: 'https://api.login.yahoo.com/openid/v1/userinfo',
    scope: 'openid email profile mail-r mail-w',
    clientId: process.env.YAHOO_CLIENT_ID || '',
    clientSecret: process.env.YAHOO_CLIENT_SECRET || '',
    redirectUri: `${process.env.API_URL || 'https://api.nubo.email'}/oauth/auth/callback/yahoo`,
    isPopular: true,
    supportedFeatures: {
      oauth: true,
      imap: true,
      smtp: true,
      refresh: true,
    },
    imapConfig: {
      host: 'imap.mail.yahoo.com',
      port: 993,
      secure: true,
      authMethod: 'XOAUTH2',
    },
    smtpConfig: {
      host: 'smtp.mail.yahoo.com',
      port: 465,
      secure: true,
      authMethod: 'XOAUTH2',
    },
    logo: '/logos/yahoo.svg',
    color: '#6001D2',
  },
  
  microsoft: {
    id: 'microsoft',
    name: 'microsoft',
    displayName: 'Outlook',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scope: 'https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send openid email profile offline_access',
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
    redirectUri: `${process.env.API_URL || 'https://api.nubo.email'}/oauth/auth/callback/microsoft`,
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
  
  proton: {
    id: 'proton',
    name: 'proton',
    displayName: 'Proton Mail',
    authUrl: '', // Proton requires Bridge/App Password
    tokenUrl: '',
    scope: '',
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    isPopular: true,
    supportedFeatures: {
      oauth: false,
      imap: true, // Via Bridge
      smtp: true, // Via Bridge
      refresh: false,
    },
    imapConfig: {
      host: '127.0.0.1', // Proton Bridge local
      port: 1143,
      secure: false,
      authMethod: 'PASSWORD',
    },
    smtpConfig: {
      host: '127.0.0.1', // Proton Bridge local
      port: 1025,
      secure: false,
      authMethod: 'PASSWORD',
    },
    logo: '/logos/proton.svg',
    color: '#6D4AFF',
    setupInstructions: 'Proton Mail requires the Proton Bridge application. Please install it and use the app password provided by the Bridge.',
  },
  
  icloud: {
    id: 'icloud',
    name: 'icloud',
    displayName: 'iCloud Mail',
    authUrl: '', // iCloud uses app-specific passwords
    tokenUrl: '',
    scope: '',
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    isPopular: false,
    supportedFeatures: {
      oauth: false,
      imap: true,
      smtp: true,
      refresh: false,
    },
    imapConfig: {
      host: 'imap.mail.me.com',
      port: 993,
      secure: true,
      authMethod: 'PASSWORD',
    },
    smtpConfig: {
      host: 'smtp.mail.me.com',
      port: 587,
      secure: false,
      authMethod: 'PASSWORD',
    },
    logo: '/logos/icloud.svg',
    color: '#007AFF',
    setupInstructions: 'For iCloud Mail, you need to generate an app-specific password from your Apple ID settings.',
  },
  
  zoho: {
    id: 'zoho',
    name: 'zoho',
    displayName: 'Zoho Mail',
    authUrl: 'https://accounts.zoho.com/oauth/v2/auth',
    tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
    userInfoUrl: 'https://accounts.zoho.com/oauth/user/info',
    scope: 'ZohoMail.messages.ALL ZohoMail.accounts.READ',
    clientId: process.env.ZOHO_CLIENT_ID || '',
    clientSecret: process.env.ZOHO_CLIENT_SECRET || '',
    redirectUri: `${process.env.API_URL || 'https://api.nubo.email'}/oauth/auth/callback/zoho`,
    isPopular: false,
    supportedFeatures: {
      oauth: true,
      imap: true,
      smtp: true,
      refresh: true,
    },
    imapConfig: {
      host: 'imap.zoho.com',
      port: 993,
      secure: true,
      authMethod: 'XOAUTH2',
    },
    smtpConfig: {
      host: 'smtp.zoho.com',
      port: 465,
      secure: true,
      authMethod: 'XOAUTH2',
    },
    logo: '/logos/zoho.svg',
    color: '#DC4A38',
  },
  
  fastmail: {
    id: 'fastmail',
    name: 'fastmail',
    displayName: 'Fastmail',
    authUrl: '', // Fastmail uses app passwords
    tokenUrl: '',
    scope: '',
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    isPopular: false,
    supportedFeatures: {
      oauth: false,
      imap: true,
      smtp: true,
      refresh: false,
    },
    imapConfig: {
      host: 'imap.fastmail.com',
      port: 993,
      secure: true,
      authMethod: 'PASSWORD',
    },
    smtpConfig: {
      host: 'smtp.fastmail.com',
      port: 465,
      secure: true,
      authMethod: 'PASSWORD',
    },
    logo: '/logos/fastmail.svg',
    color: '#69B7E5',
    setupInstructions: 'Fastmail requires an app-specific password. Generate one from your Fastmail settings.',
  },
  
  tutanota: {
    id: 'tutanota',
    name: 'tutanota',
    displayName: 'Tutanota',
    authUrl: '',
    tokenUrl: '',
    scope: '',
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    isPopular: false,
    supportedFeatures: {
      oauth: false,
      imap: false, // Tutanota doesn't support IMAP
      smtp: false, // Tutanota doesn't support SMTP
      refresh: false,
    },
    logo: '/logos/tutanota.svg',
    color: '#A01E22',
    setupInstructions: 'Tutanota does not support standard email protocols (IMAP/SMTP). Integration is limited.',
  },
  
  yandex: {
    id: 'yandex',
    name: 'yandex',
    displayName: 'Yandex Mail',
    authUrl: 'https://oauth.yandex.com/authorize',
    tokenUrl: 'https://oauth.yandex.com/token',
    userInfoUrl: 'https://login.yandex.ru/info',
    scope: 'mail:imap_full mail:smtp mail:user',
    clientId: process.env.YANDEX_CLIENT_ID || '',
    clientSecret: process.env.YANDEX_CLIENT_SECRET || '',
    redirectUri: `${process.env.API_URL || 'https://api.nubo.email'}/oauth/auth/callback/yandex`,
    isPopular: false,
    supportedFeatures: {
      oauth: true,
      imap: true,
      smtp: true,
      refresh: true,
    },
    imapConfig: {
      host: 'imap.yandex.com',
      port: 993,
      secure: true,
      authMethod: 'XOAUTH2',
    },
    smtpConfig: {
      host: 'smtp.yandex.com',
      port: 465,
      secure: true,
      authMethod: 'XOAUTH2',
    },
    logo: '/logos/yandex.svg',
    color: '#FF0000',
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