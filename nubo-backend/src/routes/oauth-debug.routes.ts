import { Router } from 'express';
import { getProvider } from '../config/oauth-providers';
import axios from 'axios';

const router = Router();

// Debug endpoint to test OAuth configuration
router.get('/debug/:provider', async (req, res) => {
  const { provider: providerId } = req.params;
  const provider = getProvider(providerId);
  
  if (!provider) {
    return res.status(404).json({ error: 'Provider not found' });
  }
  
  const debugInfo: any = {
    provider: providerId,
    configuration: {
      authUrl: provider.authUrl,
      tokenUrl: provider.tokenUrl,
      redirectUri: provider.redirectUri,
      clientId: provider.clientId,
      hasClientSecret: !!provider.clientSecret,
      scopes: provider.scope.split(' '),
    },
    requirements: {}
  };
  
  // Provider-specific requirements
  switch (providerId) {
    case 'microsoft':
      debugInfo.requirements = {
        platform: 'Must be configured as "Web" platform in Azure',
        redirectUri: 'Must exactly match: ' + provider.redirectUri,
        apiPermissions: [
          'openid',
          'offline_access',
          'https://outlook.office.com/IMAP.AccessAsUser.All',
          'https://outlook.office.com/SMTP.Send'
        ],
        notes: [
          'Ensure redirect URI is under Web platform, not SPA',
          'Grant admin consent if required',
          'Check if multi-tenant is enabled'
        ]
      };
      break;
      
    case 'yahoo':
      debugInfo.requirements = {
        appType: 'Must be "Confidential Client"',
        redirectUri: 'Must exactly match: ' + provider.redirectUri,
        apiPermissions: [
          'OpenID Connect Permissions',
          'Email',
          'Profile',
          'Mail API (mail-r, mail-w)'
        ],
        notes: [
          'Yahoo requires HTTPS for redirect URIs',
          'Mail API permissions must be explicitly enabled',
          'Check if app is approved/active'
        ]
      };
      break;
      
    case 'google':
      debugInfo.requirements = {
        appType: 'OAuth 2.0 Client ID for Web application',
        redirectUri: 'Must be added to authorized redirect URIs: ' + provider.redirectUri,
        apiPermissions: [
          'Gmail API',
          'Email',
          'Profile'
        ],
        notes: [
          'Enable Gmail API in Google Cloud Console',
          'Add redirect URI to OAuth 2.0 Client',
          'Verify app is not in testing mode (or add test users)'
        ]
      };
      break;
  }
  
  // Test connectivity to OAuth endpoints
  try {
    const authResponse = await axios.head(provider.authUrl);
    debugInfo.connectivity = {
      authEndpoint: 'Reachable',
      authStatus: authResponse.status
    };
  } catch (error: any) {
    debugInfo.connectivity = {
      authEndpoint: 'Failed',
      authError: error.message
    };
  }
  
  res.json(debugInfo);
});

// Test callback endpoint to see what's being received
router.all('/test-callback/:provider', (req, res) => {
  console.log(`Test callback for ${req.params.provider}`);
  console.log('Method:', req.method);
  console.log('Query params:', req.query);
  console.log('Body:', req.body);
  console.log('Headers:', req.headers);
  
  res.json({
    message: 'Test callback received',
    provider: req.params.provider,
    method: req.method,
    query: req.query,
    body: req.body,
    headers: {
      'user-agent': req.headers['user-agent'],
      'referer': req.headers['referer']
    }
  });
});

export default router;