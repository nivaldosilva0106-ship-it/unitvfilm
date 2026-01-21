import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { MarqueeContentRow } from "@/components/MarqueeContentRow";
import { ContentPlayerModal } from "@/components/ContentPlayerModal";
import { EpisodeSelector } from "@/components/EpisodeSelector";
import { DownloadModal } from "@/components/DownloadModal";
import { QuickViewModal } from "@/components/QuickViewModal";
import { Content } from "@/types/content";
import { getAllContents, addToMyList, removeFromMyList, getMyList } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Film, MonitorPlay, Tv, Lock, Unlock, Filter, PlayCircle } from "lucide-react";
import { AdManager } from "@/components/AdManager";
import { useNavigate } from "react-router-dom";
import { CinemaWarningModal } from "@/components/CinemaWarningModal";

const GENRES = ['Ação', 'Aventura', 'Comédia', 'Drama', 'Terror', 'Romance', 'Ficção', 'Animação', 'Documentário', 'Infantil', 'Fantasia', 'Suspense'];

export default function Categories() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Data State
    const [allContent, setAllContent] = useState<Content[]>([]);
    const [loading, setLoading] = useState(true);
    const [myList, setMyList] = useState<string[]>([]); // Store IDs for quick check

    // Filter State
    const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'series' | 'tv' | 'nostalgia'>('all');
    const [accessFilter, setAccessFilter] = useState<'all' | 'free' | 'premium'>('all');

    // Modal State
    const [selectedSeries, setSelectedSeries] = useState<Content | null>(null);
    const [playerModal, setPlayerModal] = useState<{ open: boolean, url: string, urls?: string[], internalUrl?: string, title: string, isPremium?: boolean, image?: string, description?: string, rating?: number, episodeTitle?: string }>({ open: false, url: '', title: '', isPremium: false });
    const [downloadModal, setDownloadModal] = useState<{ open: boolean, url: string, title: string, thumbnail: string, download_mode?: 'direct' | 'torrent' | 'mixed', downloads?: any[] }>({ open: false, url: '', title: '', thumbnail: '' });
    const [quickViewContent, setQuickViewContent] = useState<Content | null>(null);
    const [showCinemaModal, setShowCinemaModal] = useState(false);
    const [pendingPlayerState, setPendingPlayerState] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, [user]);

    const loadData = async () => {
        try {
            const contents = await getAllContents();
            setAllContent(contents);

            if (user) {
                const list = await getMyList(user.uid);
                setMyList(list.map(l => l.contentId));
            }
        } catch (e) {
            console.error("Error loading content", e);
            toast.error("Erro ao carregar conteúdos");
        } finally {
            setLoading(false);
        }
    };

    const filteredContent = useMemo(() => {
        let filtered = allContent;

        // Type Filter
        if (typeFilter !== 'all') {
            filtered = filtered.filter(c => c.category === typeFilter);
        }

        // Access Filter
        if (accessFilter !== 'free') {
            // If 'premium', show ONLY premium. If 'all', show all.
            if (accessFilter === 'premium') filtered = filtered.filter(c => c.isPremium);
        } else {
            // If 'free', show ONLY non-premium
            filtered = filtered.filter(c => !c.isPremium);
        }

        return filtered;
    }, [allContent, typeFilter, accessFilter]);

    // Handlers
    const handlePlayContent = (content: Content) => {
        if (content.category === 'nostalgia') {
            navigate(`/nostalgia/${content.id}`);
            return;
        }

        if (content.category === 'series') {
            setSelectedSeries(content);
            return;
        }

        if (content.is_cinema_mode) {
            setPendingPlayerState({ ...content, contentId: content.id });
            setShowCinemaModal(true);
        } else {
            navigate(`/watch/${content.id}`);
        }
    };

    const handleInfoContent = (content: Content) => {
        setQuickViewContent(content);
    };

    const handleDetailsContent = (content: Content) => {
        handlePlayContent(content);
    };

    const handleDownloadContent = (content: Content) => {
        if (content.download_url || (content.downloads && content.downloads.length > 0)) {
            setDownloadModal({
                open: true,
                url: content.download_url || '',
                downloads: content.downloads,
                download_mode: content.download_mode,
                title: content.title,
                thumbnail: content.thumbnail_url
            });
        } else {
            toast.error("Download indisponível");
        }
    };

    const handleToggleMyList = async (content: Content) => {
        if (!user) { toast.error("Faça login para salvar na lista"); return; }
        const isSaved = myList.includes(content.id);

        try {
            if (isSaved) {
                await removeFromMyList(user.uid, content.id);
                setMyList(prev => prev.filter(id => id !== content.id));
                toast.success("Removido da lista");
            } else {
                await addToMyList(user.uid, content);
                setMyList(prev => [...prev, content.id]);
                toast.success("Adicionado à lista");
            }
        } catch (e) {
            toast.error("Erro ao atualizar lista");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#141414] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#141414] text-white font-sans">
            <Header />

            <div className="pt-20 sm:pt-24 pb-8 container mx-auto px-4">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
                    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                        <Filter className="w-6 h-6 sm:w-8 sm:h-8 text-primary" /> Categorias
                    </h1>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full md:w-auto">
                        {/* Type Filters */}
                        <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800 w-full sm:w-auto overflow-x-auto scrollbar-hide">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setTypeFilter('all')}
                                className={`h-8 px-4 sm:px-3 rounded text-xs whitespace-nowrap ${typeFilter === 'all' ? 'bg-zinc-700 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                Todos
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setTypeFilter('movie')}
                                className={`h-8 px-4 sm:px-3 rounded text-xs gap-1 whitespace-nowrap ${typeFilter === 'movie' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Film className="w-3 h-3" /> Filmes
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setTypeFilter('series')}
                                className={`h-8 px-4 sm:px-3 rounded text-xs gap-1 whitespace-nowrap ${typeFilter === 'series' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Tv className="w-3 h-3" /> Séries
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setTypeFilter('tv')}
                                className={`h-8 px-4 sm:px-3 rounded text-xs gap-1 whitespace-nowrap ${typeFilter === 'tv' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                <MonitorPlay className="w-3 h-3" /> TV
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setTypeFilter('nostalgia')}
                                className={`h-8 px-4 sm:px-3 rounded text-xs gap-1 whitespace-nowrap ${typeFilter === 'nostalgia' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                <PlayCircle className="w-3 h-3" /> Nostalgia
                            </Button>
                        </div>

                        {/* Access Filters */}
                        <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800 w-full sm:w-auto overflow-x-auto scrollbar-hide">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAccessFilter('all')}
                                className={`h-8 px-4 sm:px-3 rounded text-xs whitespace-nowrap ${accessFilter === 'all' ? 'bg-zinc-700 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                Todos
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAccessFilter('free')}
                                className={`h-8 px-4 sm:px-3 rounded text-xs gap-1 whitespace-nowrap ${accessFilter === 'free' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Unlock className="w-3 h-3" /> Grátis
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAccessFilter('premium')}
                                className={`h-8 px-4 sm:px-3 rounded text-xs gap-1 whitespace-nowrap ${accessFilter === 'premium' ? 'bg-yellow-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Lock className="w-3 h-3" /> Premium
                            </Button>
                        </div>
                    </div>
                </div>

                <AdManager placement="header" className="mb-8" />

                {/* Content Rows by Genre */}
                <div className="space-y-4">
                    {(() => {
                        // 1. Determine all available genres from content + predefined list
                        const dynamicGenres = new Set<string>(GENRES);
                        filteredContent.forEach(c => {
                            if (c.genre && Array.isArray(c.genre)) {
                                c.genre.forEach(g => dynamicGenres.add(g));
                            }
                        });
                        const sortedGenres = Array.from(dynamicGenres).sort(); // Or keep GENRES order and append others?

                        // Let's prioritize GENRES order, then others
                        const finalGenres = [...GENRES];
                        sortedGenres.forEach(g => {
                            if (!finalGenres.includes(g)) finalGenres.push(g);
                        });

                        // Track which content has been shown to specific rows if we want to show an "Others" category
                        // But usually duplicates are fine. Let's just iterate genres.

                        return finalGenres.map(genre => {
                            const genreContents = filteredContent.filter(c => {
                                // Check structured genre tag first
                                if (c.genre && Array.isArray(c.genre) && c.genre.some(g => g.toLowerCase() === genre.toLowerCase())) {
                                    return true;
                                }
                                // Fallback to text search
                                return c.description?.toLowerCase().includes(genre.toLowerCase()) ||
                                    c.title.toLowerCase().includes(genre.toLowerCase());
                            });

                            if (genreContents.length === 0) return null;

                            return (
                                <MarqueeContentRow
                                    key={genre}
                                    title={genre}
                                    contents={genreContents}
                                    onPlayContent={handlePlayContent}
                                    onInfoContent={handleInfoContent}
                                    onDetailsContent={handleDetailsContent}
                                    onDownloadContent={handleDownloadContent}
                                />
                            );
                        });
                    })()}

                    {/* Show "Sem Categoria" for items that didn't match any of the above? 
                        This is complex because items might appear in multiple rows. 
                        If the user wants "All", they can see "Todos".
                        If an item has absolutely NO genre and NO description match, it currently disappears.
                        Let's add a "Outros" row for unmatched items.
                     */}
                    {(() => {
                        const matchedIds = new Set<string>();
                        const allGenres = [...GENRES]; // Re-calculate to be safe or lift up
                        // ... actually, the optimization above makes it hard to track unmatched without re-looping.
                        // Let's just do a simple check: Items with NO genre tags and NO description match to ANY genre.

                        const uncategorized = filteredContent.filter(c => {
                            const hasGenreTag = c.genre && c.genre.length > 0;
                            if (hasGenreTag) return false; // It likely matched one of its tags

                            // If no tags, did it match any keyword?
                            const matchesKeyword = GENRES.some(g =>
                                c.description?.toLowerCase().includes(g.toLowerCase()) ||
                                c.title.toLowerCase().includes(g.toLowerCase())
                            );
                            return !matchesKeyword;
                        });

                        if (uncategorized.length > 0) {
                            return (
                                <MarqueeContentRow
                                    key="outros"
                                    title="Outros"
                                    contents={uncategorized}
                                    onPlayContent={handlePlayContent}
                                    onInfoContent={handleInfoContent}
                                    onDownloadContent={handleDownloadContent}
                                />
                            );
                        }
                        return null;
                    })()}
                </div>

                {filteredContent.length === 0 && (
                    <div className="text-center py-20">
                        <p className="text-gray-500 text-lg">Nenhum conteúdo encontrado com esses filtros.</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            {selectedSeries && (
                <EpisodeSelector
                    open={!!selectedSeries}
                    onClose={() => setSelectedSeries(null)}
                    episodes={selectedSeries.episodes || []}
                    title={selectedSeries.title}
                    trailerUrl={selectedSeries.trailer_url}
                    onPlayEpisode={(url, episodeTitle) => {
                        const foundEp = selectedSeries.episodes?.find(e => e.url === url);
                        if (foundEp) {
                            navigate(`/watch/${selectedSeries.id}?season=${foundEp.season}&episode=${foundEp.episode}`);
                        }
                    }}
                />
            )}

            <ContentPlayerModal
                open={playerModal.open}
                onClose={() => setPlayerModal({ open: false, url: '', title: '', isPremium: false })}
                videoUrl={playerModal.url}
                videoUrls={playerModal.urls}
                internalPlayerUrl={playerModal.internalUrl}
                title={playerModal.title}
                isPremium={playerModal.isPremium}
                image={playerModal.image}
                description={playerModal.description}
                rating={playerModal.rating}
                episodeTitle={playerModal.episodeTitle}
                suggestions={allContent.slice(0, 5)} // Simple suggestions
                onPlayContent={(content) => handlePlayContent(content)}
                onAddToMyList={handleToggleMyList}
            />

            <DownloadModal
                open={downloadModal.open}
                onClose={() => setDownloadModal({ open: false, url: '', title: '', thumbnail: '' })}
                downloadUrl={downloadModal.url}
                downloads={downloadModal.downloads}
                download_mode={downloadModal.download_mode}
                title={downloadModal.title}
                thumbnail={downloadModal.thumbnail}
            />

            <QuickViewModal
                open={!!quickViewContent}
                content={quickViewContent}
                onClose={() => setQuickViewContent(null)}
                onPlay={handlePlayContent}
            />

            <CinemaWarningModal
                open={showCinemaModal}
                onClose={() => setShowCinemaModal(false)}
                onConfirm={() => {
                    if (pendingPlayerState) {
                        let watchUrl = '';
                        if (pendingPlayerState.season && pendingPlayerState.episode) {
                            watchUrl = `/watch/${pendingPlayerState.contentId}?season=${pendingPlayerState.season}&episode=${pendingPlayerState.episode}`;
                        } else if (pendingPlayerState.contentId) {
                            watchUrl = `/watch/${pendingPlayerState.contentId}`;
                        }
                        navigate(watchUrl);
                        setPendingPlayerState(null);
                        setShowCinemaModal(false);
                    }
                }}
            />
        </div>
    );
}
