// Brand logo fetching with BIMI support
interface BrandLogoResult {
  url: string;
  source: 'bimi' | 'clearbit' | 'favicon' | 'default';
}

// DNS lookup for BIMI would require server-side implementation
// For now, we'll use a fallback approach with client-side alternatives
export async function getBrandLogo(domain: string): Promise<BrandLogoResult> {
  if (!domain) {
    return { 
      url: '/default-avatar.png', 
      source: 'default' 
    };
  }

  // Clean domain (remove any protocol or path)
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
  
  // Try Clearbit first (most reliable for company logos)
  try {
    const clearbitUrl = `https://logo.clearbit.com/${cleanDomain}`;
    const response = await fetch(clearbitUrl, { method: 'HEAD' });
    if (response.ok) {
      return { 
        url: clearbitUrl, 
        source: 'clearbit' 
      };
    }
  } catch {
    console.log('Clearbit logo not found for', cleanDomain);
  }

  // Fallback to DuckDuckGo favicon service
  try {
    const faviconUrl = `https://icons.duckduckgo.com/ip3/${cleanDomain}.ico`;
    return { 
      url: faviconUrl, 
      source: 'favicon' 
    };
  } catch {
    console.log('Favicon not found for', cleanDomain);
  }

  // Default fallback
  return { 
    url: '/default-avatar.png', 
    source: 'default' 
  };
}

// Cache logos to avoid repeated fetches
const logoCache = new Map<string, BrandLogoResult>();

export async function getCachedBrandLogo(email: string): Promise<BrandLogoResult> {
  const domain = email.split('@')[1];
  if (!domain) {
    return { url: '/default-avatar.png', source: 'default' };
  }

  if (logoCache.has(domain)) {
    return logoCache.get(domain)!;
  }

  const result = await getBrandLogo(domain);
  logoCache.set(domain, result);
  return result;
}