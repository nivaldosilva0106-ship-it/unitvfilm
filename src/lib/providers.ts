export interface ProviderConfig {
  id: string;
  name: string;
  logo: string;
}

export const STREAMING_PROVIDERS: ProviderConfig[] = [
  { id: 'netflix', name: 'Netflix', logo: '/icons/providers/netflix.png' },
  { id: 'amazon', name: 'Prime Video', logo: '/icons/providers/amazon.png' },
  { id: 'hbo', name: 'HBO Max', logo: '/icons/providers/hbo.png' },
  { id: 'disney', name: 'Disney+', logo: '/icons/providers/disney.png' },
  { id: 'apple', name: 'Apple TV+', logo: '/icons/providers/apple.png' },
  { id: 'hulu', name: 'Hulu', logo: '/icons/providers/hulu.png' },
  { id: 'paramount', name: 'Paramount+', logo: '/icons/providers/paramount.png' },
  { id: 'starplus', name: 'Star+', logo: '/icons/providers/starplus.png' },
  { id: 'globoplay', name: 'Globoplay', logo: '/icons/providers/globoplay.png' },
  { id: 'crunchyroll', name: 'Crunchyroll', logo: '/icons/providers/crunchyroll.png' },
  { id: 'skyshowtime', name: 'SkyShowtime', logo: '/icons/providers/skyshowtime.png' },
  { id: 'youtube', name: 'YouTube', logo: '/icons/providers/youtube.png' },
];

export const getProviderConfig = (providerName?: string): ProviderConfig | null => {
  if (!providerName) return null;
  
  const searchName = providerName.toLowerCase();
  
  // Direct match or partial match
  const provider = STREAMING_PROVIDERS.find(p => 
    searchName.includes(p.id) || 
    p.id.includes(searchName) ||
    (p.id === 'amazon' && searchName.includes('prime')) ||
    (p.id === 'hbo' && searchName.includes('max')) ||
    (p.id === 'disney' && searchName.includes('plus'))
  );
  
  return provider || null;
};
