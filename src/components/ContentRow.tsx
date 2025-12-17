import { ContentCard } from "./ContentCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { Button } from "./ui/button";

import { Content } from "@/types/content";

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

  // Função para verificar o estado das setas de scroll
  const checkScrollArrows = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1); // -1 para tolerância
    }
  };

  useEffect(() => {
    // Monitorar scroll para mostrar/esconder setas
    const currentRef = scrollRef.current;
    if (currentRef) {
      currentRef.addEventListener('scroll', checkScrollArrows);
      // Inicializa o estado das setas após a renderização
      checkScrollArrows();
    }

    // Adiciona um listener para redimensionamento para recalcular as setas
    window.addEventListener('resize', checkScrollArrows);

    return () => {
      if (currentRef) {
        currentRef.removeEventListener('scroll', checkScrollArrows);
      }
      window.removeEventListener('resize', checkScrollArrows);
    };
  }, [contents]); // Recalcula se o conteúdo mudar

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

      // O checkScrollArrows será chamado pelo evento 'scroll'
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
            <div key={content.id} className="content-card-item">
              <ContentCard
                title={content.title}
                thumbnail={content.thumbnail_url}
                onPlay={() => onPlayContent?.(content)}
                onInfo={() => onInfoContent?.(content)}
                onDownload={content.download_url ? () => onDownloadContent?.(content) : undefined}
                isPremium={content.isPremium}
                classification={content.classification}
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
    </div>
  );
};