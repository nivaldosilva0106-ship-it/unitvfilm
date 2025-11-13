import { ContentCard } from "./ContentCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";

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
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  
  // Estado para rastrear se algum elemento dentro desta linha está focado
  const [isRowFocused, setIsRowFocused] = useState(false);

  // Função para verificar o estado das setas de scroll
  const checkScrollArrows = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    const currentRef = scrollRef.current;
    if (currentRef) {
      currentRef.addEventListener('scroll', checkScrollArrows);
      checkScrollArrows();
    }
    window.addEventListener('resize', checkScrollArrows);

    return () => {
      if (currentRef) {
        currentRef.removeEventListener('scroll', checkScrollArrows);
      }
      window.removeEventListener('resize', checkScrollArrows);
    };
  }, [contents]);

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
  
  // Lógica de navegação por teclado/controle remoto
  const handleFocusChange = useCallback((e: FocusEvent) => {
    const rowElement = scrollRef.current?.parentElement?.parentElement;
    const isFocusInside = rowElement?.contains(e.target as Node);
    setIsRowFocused(!!isFocusInside);

    if (isFocusInside && e.target instanceof HTMLElement) {
      // Garante que o elemento focado esteja visível
      e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, []);

  useEffect(() => {
    document.addEventListener('focusin', handleFocusChange);
    return () => document.removeEventListener('focusin', handleFocusChange);
  }, [handleFocusChange]);


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
          className="flex gap-3 overflow-x-auto scrollbar-hide px-4 sm:px-8 py-2"
        >
          {contents.map((content, index) => (
            <div 
              key={content.id} 
              className="content-card-item"
              ref={(el) => (cardRefs.current[index] = el)}
            >
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