import { useEffect, useState, useRef } from 'react';
import { getActiveAdsByPlacement } from '@/lib/firebase';
import type { Ad } from '@/types/ad';
import { useAppConfig } from '@/hooks/useAppConfig';

interface AdManagerProps {
  placement: Ad['placement'];
  className?: string;
}

export const AdManager = ({ placement, className = '' }: AdManagerProps) => {
  const { isLiteMode } = useAppConfig();
  const [ads, setAds] = useState<Ad[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLiteMode) return;
    loadAds();
  }, [placement, isLiteMode]);

  useEffect(() => {
    // Execute scripts only when ads change
    if (ads.length > 0 && containerRef.current) {
      ads.forEach((ad) => {
        const adContainer = document.getElementById(`ad-slot-${ad.id}`);
        if (adContainer) {
          executeScripts(adContainer, ad.code);
        }
      });
    }
  }, [ads]);

  const loadAds = async () => {
    try {
      const activeAds = await getActiveAdsByPlacement(placement);
      setAds(activeAds);
    } catch (error) {
      console.error('Erro ao carregar anúncios:', error);
    }
  };

  /**
   * Helper function to execute scripts inserted via innerHTML
   * React safely ignores script tags in dangerouslySetInnerHTML, so we must recreate them
   */
  const executeScripts = (container: HTMLElement, code: string) => {
    // Reset container using a temporary implementation safer than typical DOM manipulation for ads
    // But since we need to render the HTML structure provided by the ad network first:
    container.innerHTML = code;

    // Find all script tags
    const scripts = container.querySelectorAll('script');
    scripts.forEach((oldScript) => {
      const newScript = document.createElement('script');

      // Copy attributes
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });

      // Copy content
      if (oldScript.innerHTML) {
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
      }

      // Replace old script with new script to trigger execution
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
  };

  if (ads.length === 0) return null;

  return (
    <div className={`ad-container ${className}`} ref={containerRef}>
      {ads.map((ad) => (
        <div
          key={ad.id}
          id={`ad-slot-${ad.id}`}
          className="ad-wrapper my-4 flex justify-center items-center overflow-hidden"
        // Initial render for non-script content
        // Scripts will be re-executed by the useEffect
        />
      ))}
    </div>
  );
};
