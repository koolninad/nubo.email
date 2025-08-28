// Generate XOAUTH2 token string for IMAP/SMTP authentication
export function generateXOAuth2Token(email: string, accessToken: string): string {
  // XOAUTH2 format: user=<email>\x01auth=Bearer <token>\x01\x01
  const authString = `user=${email}\x01auth=Bearer ${accessToken}\x01\x01`;
  return Buffer.from(authString, 'utf-8').toString('base64');
}

// Generate XOAUTH2 SASL string for direct authentication
export function generateXOAuth2SaslString(email: string, accessToken: string): string {
  return `user=${email}\x01auth=Bearer ${accessToken}\x01\x01`;
}