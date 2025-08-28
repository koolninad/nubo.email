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

// Initiate OAuth flow
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

// OAuth callback handler
router.get('/auth/callback/:provider', async (req, res) => {
  try {
    const { provider: providerId } = req.params;
    const { code, state, error: authError } = req.query;
    
    if (authError) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=${authError}`);
    }
    
    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=missing_parameters`);
    }
    
    // Verify state
    const stateData = await OAuthService.verifyOAuthState(state as string);
    if (!stateData || stateData.provider !== providerId) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=invalid_state`);
    }
    
    const provider = getProvider(providerId);
    if (!provider) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings/accounts?error=invalid_provider`);
    }
    
    // Exchange code for tokens
    const tokenData = await OAuthService.exchangeCodeForTokens(
      provider,
      code as string,
      stateData.codeVerifier
    );
    
    // Get user info
    const userInfo = await OAuthService.getUserInfo(provider, tokenData.access_token);
    
    // Save OAuth account
    if (stateData.userId) {
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