// Generate XOAUTH2 token string for IMAP/SMTP authentication
export function generateXOAuth2Token(email: string, accessToken: string): string {
  const authString = [
    `user=${email}`,
    `auth=Bearer ${accessToken}`,
    '',
    ''
  ].join('\x01');
  
  return Buffer.from(authString).toString('base64');
}