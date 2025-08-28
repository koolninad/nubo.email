import { Router } from 'express';
import { OAuthService } from '../services/oauth.service';
import { OAuthEmailIntegration } from '../services/oauth-email-integration';
import { getProvider, getPopularProviders, getOtherProviders } from '../config/oauth-providers';
import { authenticateToken } from '../middleware/auth';
import { pool } from '../config/database';

const router = Router();

// Get available OAuth providers
router.get('/providers', (req, res) => {
  const popular = getPopularProviders().map(p => ({
    id: p.id,
    name: p.displayName,
    logo: p.logo,
    color: p.color,
    supportedFeatures: p.supportedFeatures,
    setupInstructions: p.setupInstructions,
  }));
  
  const other = getOtherProviders().map(p => ({
    id: p.id,
    name: p.displayName,
    logo: p.logo,
    color: p.color,
    supportedFeatures: p.supportedFeatures,
    setupInstructions: p.setupInstructions,
  }));
  
  res.json({ popular, other });
});

// Initiate OAuth flow (authenticated users)
router.post('/auth/init/:provider', authenticateToken, async (req, res) => {
  try {
    const { provider: providerId } = req.params;
    const { redirectUrl } = req.body;
    const userId = (req as any).user.id;
    
    const provider = getProvider(providerId);
    if (!provider) {
      return res.status(400).json({ error: 'Invalid provider' });
    }
    
    if (!provider.supportedFeatures.oauth) {
      return res.status(400).json({ 
        error: 'Provider does not support OAuth',
        setupInstructions: provider.setupInstructions 
      });
    }
    
    // Generate OAuth parameters
    const { state, codeVerifier, codeChallenge } = OAuthService.generateAuthParams();
    
    // Save state for verification
    await OAuthService.saveOAuthState(state, providerId, codeVerifier, userId, redirectUrl);
    
    // Build authorization URL
    const authUrl = OAuthService.buildAuthUrl(provider, state, codeChallenge);
    
    res.json({ authUrl });
  } catch (error: any) {
    console.error('OAuth init error:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

// Initiate OAuth flow for welcome page (no authentication required)
router.post('/welcome/auth/init/:provider', async (req, res) => {
  try {
    const { provider: providerId } = req.params;
    const { redirectUrl, email, name } = req.body;
    
    const provider = getProvider(providerId);
    if (!provider) {
      return res.status(400).json({ error: 'Invalid provider' });
    }
    
    if (!provider.supportedFeatures.oauth) {
      return res.status(400).json({ 
        error: 'Provider does not support OAuth',
        setupInstructions: provider.setupInstructions 
      });
    }
    
    // Generate OAuth parameters
    const { state, codeVerifier, codeChallenge } = OAuthService.generateAuthParams();
    
    // Save state for verification (no userId for welcome flow)
    await OAuthService.saveOAuthState(
      state, 
      providerId, 
      codeVerifier, 
      undefined, // No userId yet
      redirectUrl || `${process.env.FRONTEND_URL}/welcome?oauth=success`
    );
    
    // Store welcome flow data in the state
    if (email || name) {
      await pool.query(
        'UPDATE oauth_states SET metadata = $1 WHERE state = $2',
        [JSON.stringify({ email, name, isWelcomeFlow: true }), state]
      );
    }
    
    // Build authorization URL
    const authUrl = OAuthService.buildAuthUrl(provider, state, codeChallenge);
    
    res.json({ authUrl });
  } catch (error: any) {
    console.error('Welcome OAuth init error:', error);
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

// OAuth callback handler
router.get('/auth/callback/:provider', async (req, res) => {
  try {
    const { provider: providerId } = req.params;
    const { code, state, error: authError, error_description } = req.query;
    
    console.log(`OAuth callback received for ${providerId}`);
    console.log('Query params:', { code: !!code, state: !!state, error: authError, error_description });
    
    if (authError) {
      console.error(`OAuth error from ${providerId}:`, authError, error_description);
      return res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=${authError}&desc=${error_description || ''}`);
    }
    
    if (!code || !state) {
      console.error(`Missing parameters for ${providerId} callback`);
      return res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=missing_parameters`);
    }
    
    // Verify state
    const stateData = await OAuthService.verifyOAuthState(state as string);
    if (!stateData || stateData.provider !== providerId) {
      console.error(`Invalid state for ${providerId}. Expected provider: ${stateData?.provider}`);
      return res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=invalid_state`);
    }
    
    console.log(`State verified for ${providerId}, proceeding with token exchange`);
    
    const provider = getProvider(providerId);
    if (!provider) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=invalid_provider`);
    }
    
    // Exchange code for tokens
    console.log(`Exchanging code for tokens with ${providerId}`);
    let tokenData;
    try {
      tokenData = await OAuthService.exchangeCodeForTokens(
        provider,
        code as string,
        stateData.codeVerifier
      );
      console.log(`Token exchange successful for ${providerId}`);
    } catch (error: any) {
      console.error(`Token exchange failed for ${providerId}:`, error.message);
      return res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=token_exchange_failed&provider=${providerId}`);
    }
    
    // Get user info
    console.log(`Getting user info for ${providerId}`);
    let userInfo;
    try {
      userInfo = await OAuthService.getUserInfo(provider, tokenData.access_token);
      console.log(`User info retrieved for ${providerId}:`, userInfo.email);
    } catch (error: any) {
      console.error(`Failed to get user info for ${providerId}:`, error.message);
      return res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=userinfo_failed&provider=${providerId}`);
    }
    
    // Handle welcome flow vs authenticated user flow
    if (stateData.userId) {
      // Authenticated user - save OAuth account directly
      const oauthAccountId = await OAuthService.saveOAuthAccount(
        stateData.userId,
        providerId,
        tokenData,
        userInfo
      );
      
      // Create or update email account for syncing
      try {
        await OAuthEmailIntegration.createEmailAccount(oauthAccountId);
        console.log(`Created email account for OAuth account ${oauthAccountId}`);
      } catch (error) {
        console.error('Failed to create email account:', error);
      }
    } else {
      // Welcome flow - create user first, then OAuth account
      console.log('Processing welcome flow OAuth callback');
      
      try {
        // Check if user already exists with this email
        let userResult = await pool.query(
          'SELECT id, email FROM users WHERE email = $1',
          [userInfo.email]
        );
        
        let userId;
        if (userResult.rows.length > 0) {
          userId = userResult.rows[0].id;
          console.log(`Existing user found: ${userInfo.email}`);
        } else {
          // Create new user
          const newUserResult = await pool.query(
            `INSERT INTO users (email, password_hash, is_verified, display_name) 
             VALUES ($1, $2, true, $3) 
             RETURNING id`,
            [
              userInfo.email,
              'oauth_user', // Placeholder for OAuth users
              userInfo.name || userInfo.email.split('@')[0]
            ]
          );
          userId = newUserResult.rows[0].id;
          console.log(`Created new user: ${userInfo.email}`);
        }
        
        // Save OAuth account
        const oauthAccountId = await OAuthService.saveOAuthAccount(
          userId,
          providerId,
          tokenData,
          userInfo
        );
        
        // Create email account for syncing
        await OAuthEmailIntegration.createEmailAccount(oauthAccountId);
        console.log(`Created OAuth and email accounts for user ${userId}`);
        
        // Redirect to login with success message
        return res.redirect(`${process.env.FRONTEND_URL}/login?oauth=success&provider=${providerId}&email=${encodeURIComponent(userInfo.email)}`);
        
      } catch (error) {
        console.error('Welcome flow OAuth error:', error);
        return res.redirect(`${process.env.FRONTEND_URL}/welcome?error=oauth_failed&provider=${providerId}`);
      }
    }
    
    // Redirect to success page
    const redirectUrl = stateData.redirectUrl || `${process.env.FRONTEND_URL}/settings/accounts`;
    res.redirect(`${redirectUrl}?success=true&provider=${providerId}`);
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=oauth_failed`);
  }
});

// Get user's OAuth accounts
router.get('/accounts', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const accounts = await OAuthService.getUserOAuthAccounts(userId);
    res.json(accounts);
  } catch (error: any) {
    console.error('Get OAuth accounts error:', error);
    res.status(500).json({ error: 'Failed to get OAuth accounts' });
  }
});

// Remove OAuth account
router.delete('/accounts/:accountId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const accountId = parseInt(req.params.accountId);
    
    await OAuthService.removeOAuthAccount(userId, accountId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Remove OAuth account error:', error);
    res.status(500).json({ error: 'Failed to remove OAuth account' });
  }
});

// Refresh token for an account
router.post('/accounts/:accountId/refresh', authenticateToken, async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    await OAuthService.refreshAccessToken(accountId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: error.message || 'Failed to refresh token' });
  }
});

// Add app password account (for providers without OAuth)
router.post('/accounts/app-password', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { provider: providerId, email, password, displayName } = req.body;
    
    const provider = getProvider(providerId);
    if (!provider) {
      return res.status(400).json({ error: 'Invalid provider' });
    }
    
    if (provider.supportedFeatures.oauth) {
      return res.status(400).json({ error: 'Provider supports OAuth. Use OAuth flow instead.' });
    }
    
    // Save app password account
    const result = await pool.query(
      `INSERT INTO oauth_accounts (
        user_id, provider, email_address, display_name, 
        app_password, auth_method
      ) VALUES ($1, $2, $3, $4, $5, 'PASSWORD')
      ON CONFLICT (user_id, provider, email_address)
      DO UPDATE SET
        app_password = $5,
        display_name = $4,
        updated_at = NOW()
      RETURNING id`,
      [userId, providerId, email, displayName || email, password]
    );
    
    res.json({ success: true, accountId: result.rows[0].id });
  } catch (error: any) {
    console.error('Add app password error:', error);
    res.status(500).json({ error: 'Failed to add account' });
  }
});

export default router;