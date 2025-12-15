import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ContentCard } from './ContentCard';
import { Content } from '@/types/content';

interface MarqueeContentRowProps {
    title: string;
    contents: Content[];
    onPlayContent: (content: Content) => void;
    onInfoContent: (content: Content) => void;
    onDownloadContent: (content: Content) => void;
    showNumbers?: boolean;
}

export const MarqueeContentRow = ({
    title,
    contents,
    onPlayContent,
    onInfoContent,
    onDownloadContent,
    showNumbers = false,
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

    if (contents.length === 0) return null;

    return (
        <div className="mb-8 group/row">
            <h2 className="text-2xl font-bold mb-4 px-4 md:px-8">{title}</h2>
            <div className="relative px-4 md:px-8">
                {/* Left Arrow */}
                {scrollPosition > 0 && (
                    <button
                        onClick={() => scroll('left')}
                        className="absolute left-0 top-0 bottom-0 z-20 w-12 bg-gradient-to-r from-background to-transparent flex items-center justify-start pl-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
                        aria-label="Scroll left"
                    >
                        <div className="bg-black/80 hover:bg-black rounded-full p-2">
                            <ChevronLeft className="w-6 h-6" />
                        </div>
                    </button>
                )}

                {/* Content Container */}
                <div className="overflow-hidden">
                    <div
                        className="flex gap-3 transition-transform duration-500 ease-out"
                        style={{
                            transform: `translateX(-${scrollPosition * (itemWidth + 12)}px)`,
                        }}
                    >
                        {contents.map((content, index) => (
                            <div key={content.id} className="flex-shrink-0 relative group/card">
                                {showNumbers && (
                                    <div className="absolute -left-4 top-0 bottom-0 flex items-end pb-2 z-10 pointer-events-none">
                                        <span className="text-[140px] font-black leading-none text-stroke-2 text-transparent select-none" style={{
                                            WebkitTextStroke: '2px rgba(255,255,255,0.3)',
                                            textShadow: '0 0 20px rgba(0,0,0,0.8)'
                                        }}>
                                            {index + 1}
                                        </span>
                                    </div>
                                )}
                                <div className={showNumbers ? 'relative z-20' : ''}>
                                    <ContentCard
                                        title={content.title}
                                        thumbnail={content.thumbnail_url}
                                        onPlay={() => onPlayContent(content)}
                                        onInfo={() => onInfoContent(content)}
                                        onDownload={content.download_url ? () => onDownloadContent(content) : undefined}
                                        isPremium={content.isPremium}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Arrow */}
                {scrollPosition < maxScroll && (
                    <button
                        onClick={() => scroll('right')}
                        className="absolute right-0 top-0 bottom-0 z-20 w-12 bg-gradient-to-l from-background to-transparent flex items-center justify-end pr-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
                        aria-label="Scroll right"
                    >
                        <div className="bg-black/80 hover:bg-black rounded-full p-2">
                            <ChevronRight className="w-6 h-6" />
                        </div>
                    </button>
                )}
            </div>
        </div>
    );
};
