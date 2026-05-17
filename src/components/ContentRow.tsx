import { ContentCard } from "./ContentCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useEffect, useCallback, memo } from "react";
import { Button } from "./ui/button";

import { Content } from "@/types/content";

interface ContentRowProps {
  title: string;
  contents: Content[];
  onPlayContent?: (content: Content) => void;
  onInfoContent?: (content: Content) => void;
  onDetailsContent?: (content: Content) => void;
  onTrailerContent?: (content: Content) => void;
  onDownloadContent?: (content: Content) => void;
  hideDownloadIcon?: boolean;
  providerLogos?: Record<string, string>;
}

export const ContentRow = memo(({ title, contents, onPlayContent, onInfoContent, onDetailsContent, onTrailerContent, onDownloadContent, hideDownloadIcon, providerLogos }: ContentRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  // Lazy-render: only render the cards when the row is near the viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px 0px' } // Start rendering 200px before entering viewport
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Debounced scroll arrow check
  const checkScrollArrows = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
    }
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const currentRef = scrollRef.current;
    if (currentRef) {
      currentRef.addEventListener('scroll', checkScrollArrows, { passive: true });
      checkScrollArrows();
    }

    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(checkScrollArrows, 200);
    };
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      if (currentRef) {
        currentRef.removeEventListener('scroll', checkScrollArrows);
      }
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [contents, checkScrollArrows, isVisible]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 600;
      const newScrollPosition =
        direction === "left"
          ? scrollRef.current.scrollLeft - scrollAmount
          : scrollRef.current.scrollLeft + scrollAmount;

      scrollRef.current.scrollTo({
        left: newScrollPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="mb-8" ref={containerRef}>
      <h2 className="text-2xl font-bold text-foreground mb-4 px-4 sm:px-8">{title}</h2>
      {!isVisible ? (
        // Lightweight placeholder while off-screen
        <div className="h-[260px] px-4 sm:px-8" />
      ) : (
      <div className="relative group/row">
        {showLeftArrow && (
          <Button
            onClick={() => scroll("left")}
            variant="ghost"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-foreground h-full rounded-none opacity-0 group-hover/row:opacity-100 transition-opacity"
            tabIndex={-1} // Não deve ser focado pela navegação de teclado
          >
            <ChevronLeft className="w-8 h-8" />
          </Button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide px-4 sm:px-8 py-2"
        >
          {contents.map((content) => (
            <div key={content.id} className="content-card-item flex-shrink-0 w-[200px] xs:w-[240px] sm:w-[260px] md:w-[280px]">
              <ContentCard
                title={content.title}
                thumbnail={content.thumbnail_url}
                onPlay={() => onPlayContent?.(content)}
                onInfo={() => onInfoContent?.(content)}
                onDetails={() => onDetailsContent?.(content)}
                onTrailer={content.trailer_url ? () => onTrailerContent?.(content) : undefined}
                onDownload={(content.download_url || (content.downloads && content.downloads.length > 0)) ? () => onDownloadContent?.(content) : undefined}
                isPremium={content.isPremium}
                isNew={content.is_new}
                newSince={content.new_since}
                category={content.category}
                hasDownloads={!!(content.download_url || (content.downloads && content.downloads.length > 0))}
                internal_player_url={content.internal_player_url}
                classification={content.classification}
                hasInternalPlayer={!!content.internal_player_url}
                hasDownload={!!(content.download_url || (content.downloads && content.downloads.length > 0))}
                hideDownloadIcon={hideDownloadIcon}
                watch_provider={content.watch_provider}
                providerLogos={providerLogos}
              />
            </div>
          ))}
        </div>

        {showRightArrow && (
          <Button
            onClick={() => scroll("right")}
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-foreground h-full rounded-none opacity-0 group-hover/row:opacity-100 transition-opacity"
            tabIndex={-1} // Não deve ser focado pela navegação de teclado
          >
            <ChevronRight className="w-8 h-8" />
          </Button>
        )}
      </div>
      )}
    </div>
  );
});

ContentRow.displayName = 'ContentRow';