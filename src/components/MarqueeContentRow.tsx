import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ContentCard } from './ContentCard';
import { Content } from '@/types/content';

interface MarqueeContentRowProps {
    title: string;
    contents: Content[];
    onPlayContent: (content: Content) => void;
    onInfoContent: (content: Content) => void;
    onDetailsContent?: (content: Content) => void;
    onTrailerContent?: (content: Content) => void;
    onDownloadContent: (content: Content) => void;
    showNumbers?: boolean;
    hideDownloadIcon?: boolean;
}

export const MarqueeContentRow = ({
    title,
    contents,
    onPlayContent,
    onInfoContent,
    onDetailsContent,
    onTrailerContent,
    onDownloadContent,
    showNumbers = false,
    hideDownloadIcon = false,
}: MarqueeContentRowProps) => {
    const [scrollPosition, setScrollPosition] = useState(0);
    const itemWidth = 200; // Approximate width of each card
    const visibleItems = 6;
    const maxScroll = Math.max(0, contents.length - visibleItems);

    const scroll = (direction: 'left' | 'right') => {
        if (direction === 'left') {
            setScrollPosition(Math.max(0, scrollPosition - 1));
        } else {
            setScrollPosition(Math.min(maxScroll, scrollPosition + 1));
        }
    };

    // Auto-scroll effect
    useEffect(() => {
        if (contents.length <= visibleItems) return; // Don't auto-scroll if all items fit

        const interval = setInterval(() => {
            setScrollPosition((prev) => {
                // If at the end, go back to start
                if (prev >= maxScroll) {
                    return 0;
                }
                return prev + 1;
            });
        }, 3000); // Scroll every 3 seconds

        return () => clearInterval(interval);
    }, [maxScroll, contents.length, visibleItems]);

    if (contents.length === 0) return null;

    return (
        <div className="mb-6 sm:mb-8 group/row">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 px-4 md:px-8 tracking-tight">{title}</h2>
            <div className="relative px-4 md:px-8 lg:px-12">
                {/* Desktop Left Arrow */}
                {scrollPosition > 0 && (
                    <button
                        onClick={() => scroll('left')}
                        className="hidden md:flex absolute left-0 top-0 bottom-0 z-20 w-12 bg-gradient-to-r from-background to-transparent items-center justify-start pl-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
                        aria-label="Scroll left"
                    >
                        <div className="bg-black/80 hover:bg-black rounded-full p-2 border border-white/5">
                            <ChevronLeft className="w-6 h-6" />
                        </div>
                    </button>
                )}

                {/* Content Container */}
                <div className="overflow-x-auto md:overflow-hidden scrollbar-hide snap-x snap-mandatory">
                    <div
                        className="flex gap-2.5 sm:gap-4 transition-transform duration-500 ease-out"
                        style={{
                            transform: `translateX(-${scrollPosition * (itemWidth + 16)}px)`,
                        }}
                    >
                        {contents.map((content, index) => (
                            <div key={content.id} className="flex-shrink-0 relative snap-start w-[140px] xs:w-[160px] sm:w-[180px] md:w-[200px]">
                                <ContentCard
                                    title={content.title}
                                    thumbnail={content.thumbnail_url}
                                    onPlay={() => onPlayContent(content)}
                                    onInfo={() => onInfoContent(content)}
                                    onDetails={() => onDetailsContent?.(content)}
                                    onDownload={(content.download_url || (content.downloads && content.downloads.length > 0)) ? () => onDownloadContent(content) : undefined}
                                    isPremium={content.isPremium}
                                    isNew={content.is_new}
                                    newSince={content.new_since}
                                    category={content.category}
                                    classification={content.classification}
                                    hasDownloads={!!(content.download_url || (content.downloads && content.downloads.length > 0))}
                                    internal_player_url={content.internal_player_url}
                                    hideDownloadIcon={hideDownloadIcon}
                                    watch_provider={content.watch_provider}
                                />
                                {showNumbers && (
                                    <div className="absolute -left-4 sm:-left-6 top-0 bottom-0 flex items-end pb-2 sm:pb-4 z-30 pointer-events-none">
                                        <span
                                            className="text-[100px] sm:text-[160px] font-black leading-none select-none"
                                            style={{
                                                WebkitTextStroke: '2px rgba(255,255,255,0.6)',
                                                color: 'transparent',
                                                paintOrder: 'stroke fill',
                                                filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.8))'
                                            }}
                                        >
                                            {index + 1}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Desktop Right Arrow */}
                {scrollPosition < maxScroll && (
                    <button
                        onClick={() => scroll('right')}
                        className="hidden md:flex absolute right-0 top-0 bottom-0 z-20 w-12 bg-gradient-to-l from-background to-transparent items-center justify-end pr-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
                        aria-label="Scroll right"
                    >
                        <div className="bg-black/80 hover:bg-black rounded-full p-2 border border-white/5">
                            <ChevronRight className="w-6 h-6" />
                        </div>
                    </button>
                )}
            </div>
        </div >
    );
};
