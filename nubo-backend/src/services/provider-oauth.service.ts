import axios from 'axios';
import crypto from 'crypto';
import { OAuthProvider } from '../config/oauth-providers';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
  id_token?: string;
}

interface UserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export class ProviderOAuthService {
  /**
   * Build provider-specific authorization URL
   */
  static buildAuthUrl(provider: OAuthProvider, state: string, codeChallenge: string): string {
    console.log(`Building ${provider.id} auth URL with redirect URI:`, provider.redirectUri);
    
    const params = new URLSearchParams();
    
    switch (provider.id) {
      case 'google':
        // Google OAuth 2.0 with PKCE
        params.set('client_id', provider.clientId);
        params.set('redirect_uri', provider.redirectUri);
        params.set('response_type', 'code');
        params.set('scope', provider.scope);
        params.set('state', state);
        params.set('code_challenge', codeChallenge);
        params.set('code_challenge_method', 'S256');
        params.set('access_type', 'offline');
        params.set('prompt', 'consent');
        break;
        
      case 'microsoft':
        // Microsoft OAuth 2.0 with PKCE
        params.set('client_id', provider.clientId);
        params.set('redirect_uri', provider.redirectUri);
        params.set('response_type', 'code');
        params.set('response_mode', 'query');
        params.set('scope', provider.scope);
        params.set('state', state);
        params.set('code_challenge', codeChallenge);
        params.set('code_challenge_method', 'S256');
        params.set('prompt', 'consent');
        break;
        
      case 'yahoo':
        // Yahoo OAuth 2.0 (no PKCE)
        params.set('client_id', provider.clientId);
        params.set('redirect_uri', provider.redirectUri);
        params.set('response_type', 'code');
        params.set('scope', provider.scope);
        params.set('state', state);
        params.set('language', 'en-us');
        // Yahoo doesn't support PKCE
        break;
        
      default:
        // Default OAuth 2.0 flow
        params.set('client_id', provider.clientId);
        params.set('redirect_uri', provider.redirectUri);
        params.set('response_type', 'code');
        params.set('scope', provider.scope);
        params.set('state', state);
        if (provider.supportedFeatures.oauth) {
          params.set('code_challenge', codeChallenge);
          params.set('code_challenge_method', 'S256');
        }
    }
    
    const authUrl = `${provider.authUrl}?${params.toString()}`;
    console.log(`${provider.id} auth URL:`, authUrl);
    return authUrl;
  }
  
  /**
   * Exchange authorization code for tokens (provider-specific)
   */
  static async exchangeCodeForTokens(
    provider: OAuthProvider,
    code: string,
    codeVerifier: string
  ): Promise<TokenResponse> {
    console.log(`Exchanging code for tokens with ${provider.id}`);
    
    let params: URLSearchParams;
    let headers: any = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    
    switch (provider.id) {
      case 'google':
        // Google uses standard OAuth 2.0 with PKCE
        params = new URLSearchParams({
          client_id: provider.clientId,
          client_secret: provider.clientSecret,
          code: code,
          code_verifier: codeVerifier,
          redirect_uri: provider.redirectUri,
          grant_type: 'authorization_code',
        });
        break;
        
      case 'microsoft':
        // Microsoft uses standard OAuth 2.0 with PKCE
        params = new URLSearchParams({
          client_id: provider.clientId,
          client_secret: provider.clientSecret,
          code: code,
          code_verifier: codeVerifier,
          redirect_uri: provider.redirectUri,
          grant_type: 'authorization_code',
        });
        break;
        
      case 'yahoo':
        // Yahoo uses client credentials in form params (no PKCE)
        params = new URLSearchParams({
          client_id: provider.clientId,
          client_secret: provider.clientSecret,
          code: code,
          redirect_uri: provider.redirectUri,
          grant_type: 'authorization_code',
        });
        break;
        
      default:
        // Default OAuth 2.0 implementation
        params = new URLSearchParams({
          client_id: provider.clientId,
          client_secret: provider.clientSecret,
          code: code,
          redirect_uri: provider.redirectUri,
          grant_type: 'authorization_code',
        });
        if (provider.supportedFeatures.oauth) {
          params.set('code_verifier', codeVerifier);
        }
    }
    
    try {
      console.log(`Token exchange URL for ${provider.id}:`, provider.tokenUrl);
      console.log(`Token exchange params for ${provider.id}:`, Array.from(params.entries()));
      console.log(`Token exchange headers for ${provider.id}:`, headers);
      
      const response = await axios.post(provider.tokenUrl, params.toString(), { headers });
      
      console.log(`${provider.id} token exchange successful`);
      console.log(`${provider.id} token response:`, {
        has_access_token: !!response.data.access_token,
        has_refresh_token: !!response.data.refresh_token,
        expires_in: response.data.expires_in
      });
      return response.data;
    } catch (error: any) {
      console.error(`${provider.id} token exchange failed:`);
      console.error('Status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      console.error('Error message:', error.message);
      
      const errorDetail = error.response?.data?.error_description || 
                          error.response?.data?.error || 
                          error.message;
      throw new Error(`Failed to exchange code for tokens with ${provider.id}: ${errorDetail}`);
    }
  }
  
  /**
   * Get user info from provider
   */
  static async getUserInfo(provider: OAuthProvider, accessToken: string): Promise<UserInfo> {
    if (!provider.userInfoUrl) {
      // For providers without userInfo endpoint, return minimal data
      return {
        id: 'oauth_user',
        email: 'user@' + provider.id + '.com',
      };
    }
    
    try {
      console.log(`Fetching user info from ${provider.id}`);
      console.log(`Using access token: ${accessToken.substring(0, 20)}...`);
      
      const headers: any = {
        'Authorization': `Bearer ${accessToken}`,
      };
      
      // Microsoft Graph API requires specific headers
      if (provider.id === 'microsoft') {
        headers['Accept'] = 'application/json';
      }
      
      const response = await axios.get(provider.userInfoUrl, { 
        headers,
        timeout: 10000 // 10 second timeout
      });
      
      const data = response.data;
      console.log(`${provider.id} user info response:`, data);
      
      // Provider-specific user info mapping
      switch (provider.id) {
        case 'google':
          return {
            id: data.id || data.sub,
            email: data.email,
            name: data.name,
            picture: data.picture,
          };
          
        case 'microsoft':
          // Microsoft returns different fields in Graph API response
          return {
            id: data.id,
            email: data.mail || data.userPrincipalName || data.email,
            name: data.displayName || data.name,
            picture: data.photo,
          };
          
        case 'yahoo':
          return {
            id: data.sub || data.user_id,
            email: data.email || data.email_verified,
            name: data.name || data.given_name,
            picture: data.picture,
          };
          
        default:
          return {
            id: data.id || data.sub || data.user_id,
            email: data.email || data.mail || data.email_address,
            name: data.name || data.display_name || data.displayName,
            picture: data.picture || data.avatar || data.profile_image,
          };
      }
    } catch (error: any) {
      console.error(`Failed to get user info from ${provider.id}:`);
      console.error('Status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      console.error('Error message:', error.message);
      console.error('URL attempted:', provider.userInfoUrl);
      const errorDetail = error.response?.data?.error_description || 
                         error.response?.data?.error || 
                         error.response?.data?.message ||
                         error.message;
      throw new Error(`Failed to get user info from ${provider.id}: ${errorDetail}`);
    }
  }
  
  /**
   * Refresh access token (provider-specific)
   */
  static async refreshAccessToken(
    provider: OAuthProvider,
    refreshToken: string
  ): Promise<TokenResponse> {
    console.log(`Refreshing token for ${provider.id}`);
    
    let params: URLSearchParams;
    let headers: any = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    
    switch (provider.id) {
      case 'google':
        // Standard refresh token flow
        params = new URLSearchParams({
          client_id: provider.clientId,
          client_secret: provider.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        });
        break;
        
      case 'microsoft':
        // Microsoft requires resource/scope for IMAP access
        params = new URLSearchParams({
          client_id: provider.clientId,
          client_secret: provider.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          scope: 'https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send offline_access'
        });
        break;
        
      case 'yahoo':
        // Yahoo refresh token flow with mail scopes
        params = new URLSearchParams({
          client_id: provider.clientId,
          client_secret: provider.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          // Explicitly request mail scopes on refresh
          scope: 'openid profile email mail-r mail-w'
        });
        break;
        
      default:
        params = new URLSearchParams({
          client_id: provider.clientId,
          client_secret: provider.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        });
    }
    
    try {
      console.log(`🔄 Token refresh request for ${provider.id}:`, {
        url: provider.tokenUrl,
        params: Array.from(params.entries()),
        hasRefreshToken: !!refreshToken
      });
      
      const response = await axios.post(provider.tokenUrl, params.toString(), { headers });
      
      console.log(`✅ ${provider.id} token refresh successful:`, {
        hasAccessToken: !!response.data.access_token,
        hasRefreshToken: !!response.data.refresh_token,
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type,
        scope: response.data.scope
      });
      
      return response.data;
    } catch (error: any) {
      console.error(`❌ ${provider.id} token refresh failed:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`Failed to refresh token for ${provider.id}: ${error.message}`);
    }
  }
}