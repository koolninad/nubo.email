import { Router } from 'express';
import { authService } from '../services/authService';
import { backgroundEmailSync } from '../services/backgroundEmailSync';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * Login with refresh token support
 */
router.post('/login', async (req, res) => {
  const { email, password, rememberMe } = req.body;
  
  try {
    const result = await authService.login(email, password, rememberMe || false, req.get('user-agent'));
    
    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: rememberMe ? 90 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000 // 90 or 30 days
    });
    
    res.json({
      user: result.user,
      accessToken: result.accessToken
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message || 'Login failed' });
  }
});

/**
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }
  
  try {
    const result = await authService.refreshAccessToken(refreshToken);
    
    // If new refresh token is provided (rotation), update cookie
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
    }
    
    res.json({
      user: result.user,
      accessToken: result.accessToken
    });
  } catch (error: any) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: error.message || 'Invalid refresh token' });
  }
});

/**
 * Logout and revoke refresh token
 */
router.post('/logout', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
  
  if (refreshToken) {
    try {
      await authService.revokeRefreshToken(refreshToken);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  // Clear cookie
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

/**
 * Revoke all tokens for current user (logout from all devices)
 */
router.post('/logout-all', authenticateToken, async (req: any, res) => {
  try {
    await authService.revokeAllUserTokens(req.user.id);
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out from all devices' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ error: 'Failed to logout from all devices' });
  }
});

/**
 * Get current session info
 */
router.get('/session', authenticateToken, async (req: any, res) => {
  res.json({
    user: req.user,
    authenticated: true
  });
});

/**
 * Check if refresh token is valid (for auto-login)
 */
router.get('/check-session', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  
  if (!refreshToken) {
    return res.json({ authenticated: false });
  }
  
  try {
    const result = await authService.refreshAccessToken(refreshToken);
    
    // Optionally refresh the cookie expiry
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // Refresh for another 30 days
    });
    
    res.json({
      authenticated: true,
      user: result.user,
      accessToken: result.accessToken
    });
  } catch (error) {
    res.json({ authenticated: false });
  }
});

/**
 * Force email sync for current user
 */
router.post('/sync-emails', authenticateToken, async (req: any, res) => {
  try {
    // Trigger background sync for user
    await backgroundEmailSync.syncUserAccounts(req.user.id);
    res.json({ message: 'Email sync initiated' });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to initiate email sync' });
  }
});

/**
 * Get email sync status
 */
router.get('/sync-status', authenticateToken, async (req: any, res) => {
  const syncStatus = backgroundEmailSync.getSyncStatus();
  
  // Filter to show only current user's accounts
  const userStatus = {
    ...syncStatus,
    accounts: syncStatus.accounts.filter(acc => acc.userId === req.user.id)
  };
  
  res.json(userStatus);
});

export default router;