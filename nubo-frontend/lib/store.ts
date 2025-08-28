import { create } from 'zustand';

interface User {
  id: number;
  username: string;
  email: string;
}

interface EmailAccount {
  id: number;
  email_address: string;
  display_name: string;
  imap_host: string;
  smtp_host: string;
  is_active: boolean;
}

interface Email {
  id: number;
  email_account_id: number;
  account_email: string;
  uid: string;
  subject: string;
  from_address: string;
  from_name: string;
  to_addresses: string;
  cc_addresses?: string;
  bcc_addresses?: string;
  date: string;
  snippet: string;
  is_read: boolean;
  is_starred: boolean;
  is_archived: boolean;
  is_draft?: boolean;
  is_spam?: boolean;
  is_trash?: boolean;
  is_snoozed?: boolean;
  snoozed_until?: string;
  labels?: string[];
  folder?: string;
  text_body?: string;
  html_body?: string;
}

interface AppState {
  user: User | null;
  token: string | null;
  emailAccounts: EmailAccount[];
  emails: Email[];
  selectedAccountId: number | null;
  selectedEmailId: number | null;
  isLoading: boolean;
  
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setEmailAccounts: (accounts: EmailAccount[]) => void;
  setEmails: (emails: Email[]) => void;
  setSelectedAccount: (id: number | null) => void;
  setSelectedEmail: (id: number | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  token: null,
  emailAccounts: [],
  emails: [],
  selectedAccountId: null,
  selectedEmailId: null,
  isLoading: false,
  
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setEmailAccounts: (emailAccounts) => set({ emailAccounts }),
  setEmails: (emails) => set({ emails: Array.isArray(emails) ? emails : [] }),
  setSelectedAccount: (selectedAccountId) => set({ selectedAccountId }),
  setSelectedEmail: (selectedEmailId) => set({ selectedEmailId }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => {
    // Clear all storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('loginExpiry');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    
    set({ 
      user: null, 
      token: null, 
      emailAccounts: [], 
      emails: [], 
      selectedAccountId: null,
      selectedEmailId: null 
    });
  },
  hydrate: () => {
    if (typeof window === 'undefined') return;
    
    // Helper function to get auth data from storage
    const getStoredAuthData = () => {
      // Check if remember me is enabled and token hasn't expired
      const rememberMe = localStorage.getItem('rememberMe') === 'true';
      const loginExpiry = localStorage.getItem('loginExpiry');
      
      if (rememberMe && loginExpiry && Date.now() < parseInt(loginExpiry)) {
        return {
          token: localStorage.getItem('token'),
          user: localStorage.getItem('user')
        };
      }
      
      // Otherwise check sessionStorage
      return {
        token: sessionStorage.getItem('token') || localStorage.getItem('token'),
        user: sessionStorage.getItem('user') || localStorage.getItem('user')
      };
    };
    
    const { token, user: userStr } = getStoredAuthData();
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, token });
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        // Clear invalid data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
      }
    }
  },
}));