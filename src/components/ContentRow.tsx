import { ContentCard } from "./ContentCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { Button } from "./ui/button";

interface Content {
  id: string;
  title: string;
  thumbnail_url: string;
  video_url?: string;
  download_url?: string;
}

interface ContentRowProps {
  title: string;
  contents: Content[];
  onPlayContent?: (content: Content) => void;
  onInfoContent?: (content: Content) => void;
  onDownloadContent?: (content: Content) => void;
}

export const ContentRow = ({ title, contents, onPlayContent, onInfoContent, onDownloadContent }: ContentRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isCardFocused = activeElement?.closest('.content-card-item');
      
      if (!isCardFocused) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        scroll('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        scroll('right');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 800;
      const newScrollPosition =
        direction === "left"
          ? scrollRef.current.scrollLeft - scrollAmount
          : scrollRef.current.scrollLeft + scrollAmount;

      scrollRef.current.scrollTo({
        left: newScrollPosition,
        behavior: "smooth",
      });

      setTimeout(() => {
        if (scrollRef.current) {
          setShowLeftArrow(scrollRef.current.scrollLeft > 0);
          setShowRightArrow(
            scrollRef.current.scrollLeft <
              scrollRef.current.scrollWidth - scrollRef.current.clientWidth
          );
        }
      }, 300);
    }
  };

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-foreground mb-4 px-4 sm:px-8">{title}</h2>
      <div className="relative group/row">
        {showLeftArrow && (
          <Button
            onClick={() => scroll("left")}
            variant="ghost"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-foreground h-full rounded-none opacity-0 group-hover/row:opacity-100 transition-opacity"
            tabIndex={-1}
          >
            <ChevronLeft className="w-8 h-8" />
          </Button>
        )}
        
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-8 py-2"
        >
          {contents.map((content) => (
            <div key={content.id} className="content-card-item">
              <ContentCard
                title={content.title}
                thumbnail={content.thumbnail_url}
                onPlay={() => onPlayContent?.(content)}
                onInfo={() => onInfoContent?.(content)}
                onDownload={content.download_url ? () => onDownloadContent?.(content) : undefined}
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
            tabIndex={-1}
          >
            <ChevronRight className="w-8 h-8" />
          </Button>
        )}
      </div>
    </div>
  );
};
