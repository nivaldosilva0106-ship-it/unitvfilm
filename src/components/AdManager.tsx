import { useEffect, useState } from 'react';
import { getActiveAdsByPlacement } from '@/lib/firebase';
import type { Ad } from '@/types/ad';

interface AdManagerProps {
  placement: Ad['placement'];
  className?: string;
}

export const AdManager = ({ placement, className = '' }: AdManagerProps) => {
  const [ads, setAds] = useState<Ad[]>([]);

  useEffect(() => {
    loadAds();
  }, [placement]);

  const loadAds = async () => {
    try {
      const activeAds = await getActiveAdsByPlacement(placement);
      setAds(activeAds);
    } catch (error) {
      console.error('Erro ao carregar anúncios:', error);
    }
  };

  if (ads.length === 0) return null;

  return (
    <div className={`ad-container ${className}`}>
      {ads.map((ad) => (
        <div 
          key={ad.id} 
          className="ad-wrapper my-4"
          dangerouslySetInnerHTML={{ __html: ad.code }}
        />
      ))}
    </div>
  );
};
