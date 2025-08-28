import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

class AuthClient {
  private api: AxiosInstance;
  private accessToken: string | null = null;
  private refreshPromise: Promise<any> | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      withCredentials: true, // Important for cookies
    });

    // Request interceptor to add access token
    this.api.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers['Authorization'] = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          // Prevent multiple refresh requests
          if (!this.refreshPromise) {
            this.refreshPromise = this.refreshAccessToken();
          }

          try {
            await this.refreshPromise;
            this.refreshPromise = null;
            
            // Retry original request with new token
            originalRequest.headers['Authorization'] = `Bearer ${this.accessToken}`;
            return this.api(originalRequest);
          } catch (refreshError) {
            this.refreshPromise = null;
            this.logout();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string, rememberMe: boolean = false) {
    const response = await this.api.post('/api/auth-v2/login', {
      email,
      password,
      rememberMe
    });

    this.accessToken = response.data.accessToken;
    
    // Store in localStorage for client-side access
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', this.accessToken);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      }
    }

    return response.data;
  }

  /**
   * Check session on app load
   */
  async checkSession() {
    try {
      const response = await this.api.get('/api/auth-v2/check-session');
      
      if (response.data.authenticated) {
        this.accessToken = response.data.accessToken;
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', this.accessToken);
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        
        return response.data;
      }
      
      return { authenticated: false };
    } catch (error) {
      console.error('Session check failed:', error);
      return { authenticated: false };
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken() {
    const response = await this.api.post('/api/auth-v2/refresh');
    this.accessToken = response.data.accessToken;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', this.accessToken);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    
    return response.data;
  }

  /**
   * Logout
   */
  async logout() {
    try {
      await this.api.post('/api/auth-v2/logout');
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    this.accessToken = null;
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      localStorage.removeItem('rememberMe');
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAll() {
    await this.api.post('/api/auth-v2/logout-all');
    this.logout();
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    if (typeof window === 'undefined') return null;
    
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.accessToken;
  }

  /**
   * Force email sync
   */
  async syncEmails() {
    return await this.api.post('/api/auth-v2/sync-emails');
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    const response = await this.api.get('/api/auth-v2/sync-status');
    return response.data;
  }

  /**
   * Make authenticated API call
   */
  async apiCall(method: string, url: string, data?: any) {
    const response = await this.api.request({
      method,
      url,
      data
    });
    return response.data;
  }
}

// Export singleton instance
export const authClient = new AuthClient();