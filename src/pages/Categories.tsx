import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { ContentPlayerModal } from "@/components/ContentPlayerModal";
import { EpisodeSelector } from "@/components/EpisodeSelector";
import { DownloadModal } from "@/components/DownloadModal";
import { QuickViewModal } from "@/components/QuickViewModal";
import { CinemaWarningModal } from "@/components/CinemaWarningModal";
import { AdManager } from "@/components/AdManager";
import { CategoryTypeFilter } from "@/components/categories/CategoryTypeFilter";
import { CategoryAccessFilter } from "@/components/categories/CategoryAccessFilter";
import { CategoryEmptyState } from "@/components/categories/CategoryEmptyState";
import { ContentCard } from "@/components/ContentCard";
import { Content } from "@/types/content";
import { getAllContents, addToMyList, removeFromMyList, getMyList } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Compass, Sparkles, MonitorPlay, Film } from "lucide-react";
import { useSpatialNavigation, FOCUSABLE_CLASS } from "@/hooks/useSpatialNavigation";

const GENRES = ['Ação', 'Aventura', 'Comédia', 'Drama', 'Terror', 'Romance', 'Ficção', 'Animação', 'Documentário', 'Infantil', 'Fantasia', 'Suspense'];

const MAIN_CATEGORIES = [
    { name: 'Tudo', icon: Compass },
    { name: 'Novidades', icon: Sparkles },
    { name: 'Canais 24h', icon: MonitorPlay },
    { name: 'Nostalgia', icon: Film }
];

export default function Categories() {
    const navigate = useNavigate();
    const { user, currentProfile } = useAuth();

    // Data State
    const [allContent, setAllContent] = useState<Content[]>([]);
    const [loading, setLoading] = useState(true);
    const [myList, setMyList] = useState<string[]>([]);

    // Navigation/Filter State
    const [selectedCategory, setSelectedCategory] = useState<string>('Tudo');
    const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'series' | 'tv' | 'nostalgia'>('all');
    const [accessFilter, setAccessFilter] = useState<'all' | 'free' | 'premium'>('all');

    // Modal State
    const [selectedSeries, setSelectedSeries] = useState<Content | null>(null);
    const [playerModal, setPlayerModal] = useState<{ open: boolean, url: string, urls?: string[], internalUrl?: string, title: string, isPremium?: boolean, image?: string, description?: string, rating?: number, episodeTitle?: string }>({ open: false, url: '', title: '', isPremium: false });
    const [downloadModal, setDownloadModal] = useState<{ open: boolean, url: string, title: string, thumbnail: string, download_mode?: 'direct' | 'torrent' | 'mixed', downloads?: any[] }>({ open: false, url: '', title: '', thumbnail: '' });
    const [quickViewContent, setQuickViewContent] = useState<Content | null>(null);
    const [showCinemaModal, setShowCinemaModal] = useState(false);
    const [pendingPlayerState, setPendingPlayerState] = useState<any>(null);

    useSpatialNavigation({
        enabled: true,
        onBack: () => {
            if (selectedSeries) {
                setSelectedSeries(null);
            } else if (playerModal.open) {
                setPlayerModal({ open: false, url: '', title: '', isPremium: false });
            } else if (downloadModal.open) {
                setDownloadModal({ open: false, url: '', title: '', thumbnail: '' });
            } else if (quickViewContent) {
                setQuickViewContent(null);
            } else if (showCinemaModal) {
                setShowCinemaModal(false);
            } else {
                navigate("/");
            }
        },
        onEnter: (el) => {
            el.click();
        }
    });

    useEffect(() => {
        loadData();
    }, [user, currentProfile]);

    const loadData = async () => {
        try {
            const contents = await getAllContents();
            setAllContent(contents);

            if (currentProfile) {
                const list = await getMyList(currentProfile.id);
                setMyList(list.map(l => l.contentId));
            }
        } catch (e) {
            console.error("Error loading content", e);
            toast.error("Erro ao carregar conteúdos");
        } finally {
            setLoading(false);
        }
    };

    // Combine standard genres with any dynamic genres from content
    const dynamicGenres = useMemo(() => {
        const set = new Set<string>(GENRES);
        allContent.forEach(c => {
            if (c.genre && Array.isArray(c.genre)) {
                c.genre.forEach(g => {
                    if (g && g.trim() !== '') {
                        const capitalized = g.trim().charAt(0).toUpperCase() + g.trim().slice(1);
                        set.add(capitalized);
                    }
                });
            }
        });
        return Array.from(set).sort();
    }, [allContent]);

    // Count utility for sidebar indicators
    const getCategoryCount = (cat: string) => {
        if (cat === 'Tudo') return allContent.length;
        if (cat === 'Novidades') {
            return allContent.filter(c => c.isNew || (c.newSince && (new Date().getTime() - new Date(c.newSince).getTime() < 86400000 * 7))).length;
        }
        if (cat === 'Canais 24h') {
            return allContent.filter(c => c.category === 'tv').length;
        }
        if (cat === 'Nostalgia') {
            return allContent.filter(c => c.category === 'nostalgia').length;
        }
        // Genre filter
        return allContent.filter(c => {
            if (c.genre && Array.isArray(c.genre)) {
                return c.genre.some(g => g.toLowerCase() === cat.toLowerCase());
            }
            return c.description?.toLowerCase().includes(cat.toLowerCase()) ||
                c.title.toLowerCase().includes(cat.toLowerCase());
        }).length;
    };

    const filteredContent = useMemo(() => {
        let filtered = allContent;

        // 1. Menu Category Filter
        if (selectedCategory === 'Novidades') {
            filtered = filtered.filter(c => c.isNew || (c.newSince && (new Date().getTime() - new Date(c.newSince).getTime() < 86400000 * 7)));
        } else if (selectedCategory === 'Canais 24h') {
            filtered = filtered.filter(c => c.category === 'tv');
        } else if (selectedCategory === 'Nostalgia') {
            filtered = filtered.filter(c => c.category === 'nostalgia');
        } else if (selectedCategory !== 'Tudo') {
            filtered = filtered.filter(c => {
                if (c.genre && Array.isArray(c.genre)) {
                    return c.genre.some(g => g.toLowerCase() === selectedCategory.toLowerCase());
                }
                return c.description?.toLowerCase().includes(selectedCategory.toLowerCase()) ||
                    c.title.toLowerCase().includes(selectedCategory.toLowerCase());
            });
        }

        // 2. Type Filter (Filmes, Séries, etc.)
        if (typeFilter !== 'all') {
            filtered = filtered.filter(c => c.category === typeFilter);
        }

        // 3. Access Filter (Grátis, Premium)
        if (accessFilter !== 'all') {
            if (accessFilter === 'premium') {
                filtered = filtered.filter(c => c.isPremium);
            } else {
                filtered = filtered.filter(c => !c.isPremium);
            }
        }

        return filtered;
    }, [allContent, selectedCategory, typeFilter, accessFilter]);

    // Handlers
    const handlePlayContent = (content: Content) => {
        if (content.category === 'nostalgia') {
            navigate(`/nostalgia/${content.id}`);
            return;
        }

        const isSeries = content.category?.toLowerCase() === 'series' || 
                        content.category?.toLowerCase() === 'série' || 
                        content.category?.toLowerCase() === 'serie' ||
                        (content.episodes && content.episodes.length > 0);

        if (isSeries) {
            setSelectedSeries(content);
            return;
        }

        if (content.category === 'tv') {
            navigate(`/tv?channelId=${content.id}`);
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
        if (!currentProfile) { toast.error("Faça login para salvar na lista"); return; }
        const isSaved = myList.includes(content.id);

        try {
            if (isSaved) {
                await removeFromMyList(currentProfile.id, content.id);
                setMyList(prev => prev.filter(id => id !== content.id));
                toast.success("Removido da lista");
            } else {
                await addToMyList(currentProfile.id, content);
                setMyList(prev => [...prev, content.id]);
                toast.success("Adicionado à lista");
            }
        } catch (e) {
            toast.error("Erro ao atualizar lista");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground font-sans">
            <Header />

            <div className="pt-24 sm:pt-28 pb-16 container mx-auto px-4">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    
                    {/* Left Sidebar Menu - Desktop Only */}
                    <div className="hidden md:flex flex-col w-64 lg:w-72 sticky top-24 shrink-0 max-h-[calc(100vh-140px)] overflow-y-auto pr-4 premium-scrollbar space-y-6">
                        <div>
                            <p className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase mb-3 px-3">
                                Suas Categorias
                            </p>
                            <div className="space-y-1">
                                {MAIN_CATEGORIES.map(cat => {
                                    const Icon = cat.icon;
                                    const isActive = selectedCategory === cat.name;
                                    return (
                                        <button
                                            key={cat.name}
                                            onClick={() => setSelectedCategory(cat.name)}
                                            className={`w-full text-left py-2.5 px-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-between group ${
                                                isActive
                                                    ? "text-primary bg-primary/10 border-l-[4px] border-primary pl-3.5 font-bold shadow-[inset_1px_0_0_rgba(16,185,129,0.1)]"
                                                    : "text-foreground/60 hover:text-foreground pl-4 hover:bg-white/5"
                                            } ${FOCUSABLE_CLASS}`}
                                            tabIndex={0}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-foreground/45 group-hover:text-foreground/80'}`} />
                                                <span>{cat.name}</span>
                                            </div>
                                            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white/50 font-medium group-hover:text-white/80 transition-colors">
                                                {getCategoryCount(cat.name)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="h-px bg-white/5 w-full" />

                        <div>
                            <p className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase mb-3 px-3">
                                Todos os Gêneros
                            </p>
                            <div className="space-y-1">
                                {dynamicGenres.map(genre => {
                                    const isActive = selectedCategory === genre;
                                    return (
                                        <button
                                            key={genre}
                                            onClick={() => setSelectedCategory(genre)}
                                            className={`w-full text-left py-2.5 px-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-between group ${
                                                isActive
                                                    ? "text-primary bg-primary/10 border-l-[4px] border-primary pl-3.5 font-bold shadow-[inset_1px_0_0_rgba(16,185,129,0.1)]"
                                                    : "text-foreground/60 hover:text-foreground pl-4 hover:bg-white/5"
                                            } ${FOCUSABLE_CLASS}`}
                                            tabIndex={0}
                                        >
                                            <span>{genre}</span>
                                            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white/50 font-medium group-hover:text-white/80 transition-colors">
                                                {getCategoryCount(genre)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Top Horizontal Scrollbar - Mobile Only */}
                    <div className="flex md:hidden items-center gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 sticky top-16 bg-background/95 backdrop-blur z-20 border-b border-white/5 mb-4 w-[100vw]">
                        {MAIN_CATEGORIES.map(cat => {
                            const Icon = cat.icon;
                            const isActive = selectedCategory === cat.name;
                            return (
                                <button
                                    key={cat.name}
                                    onClick={() => setSelectedCategory(cat.name)}
                                    className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap border ${
                                        isActive
                                            ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                                            : "bg-white/5 text-foreground/75 border-white/5 hover:text-white"
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    <span>{cat.name}</span>
                                    <span className="text-[9px] opacity-60">
                                        ({getCategoryCount(cat.name)})
                                    </span>
                                </button>
                            );
                        })}
                        <div className="w-px h-6 bg-white/10 shrink-0" />
                        {dynamicGenres.map(genre => {
                            const isActive = selectedCategory === genre;
                            return (
                                <button
                                    key={genre}
                                    onClick={() => setSelectedCategory(genre)}
                                    className={`px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap border ${
                                        isActive
                                            ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                                            : "bg-white/5 text-foreground/75 border-white/5 hover:text-white"
                                    }`}
                                >
                                    <span>{genre}</span>
                                    <span className="text-[9px] opacity-60">
                                        ({getCategoryCount(genre)})
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Main Grid Section */}
                    <div className="flex-1 w-full">
                        {/* Header Row */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-6">
                            <div>
                                <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
                                    <span className="w-1.5 h-8 bg-primary rounded-full shadow-[0_0_12px_hsl(var(--primary))]" />
                                    {selectedCategory}
                                </h2>
                                <p className="text-xs text-muted-foreground mt-1 ml-4.5">
                                    {filteredContent.length} {filteredContent.length === 1 ? 'título disponível' : 'títulos disponíveis'}
                                </p>
                            </div>

                            {/* Filters Pills */}
                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                                <CategoryTypeFilter value={typeFilter} onChange={setTypeFilter} />
                                <CategoryAccessFilter value={accessFilter} onChange={setAccessFilter} />
                            </div>
                        </div>

                        <AdManager placement="header" className="mb-6" />

                        {/* Poster Grid */}
                        {filteredContent.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-6">
                                {filteredContent.map(content => (
                                    <ContentCard
                                        key={content.id}
                                        title={content.title}
                                        thumbnail={content.thumbnail_url}
                                        onPlay={() => handlePlayContent(content)}
                                        onInfo={() => handleInfoContent(content)}
                                        onDetails={() => handleDetailsContent(content)}
                                        onDownload={() => handleDownloadContent(content)}
                                        isPremium={content.isPremium}
                                        isNew={content.isNew}
                                        newSince={content.newSince}
                                        category={content.category}
                                        classification={content.classification}
                                        internal_player_url={content.internal_player_url}
                                        hasDownloads={content.downloads && content.downloads.length > 0}
                                        hasInternalPlayer={!!content.internal_player_url}
                                        hasDownload={!!content.download_url}
                                        watch_provider={content.watch_provider}
                                    />
                                ))}
                            </div>
                        ) : (
                            <CategoryEmptyState />
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            {selectedSeries && (
                <EpisodeSelector
                    open={!!selectedSeries}
                    onClose={() => setSelectedSeries(null)}
                    episodes={selectedSeries.episodes || []}
                    title={selectedSeries.title}
                    trailerUrl={selectedSeries.trailer_url}
                    thumbnail={selectedSeries.thumbnail_url}
                    onPlayEpisode={(ep) => {
                        const watchUrl = `/watch/${selectedSeries.id}?season=${ep.season}&episode=${ep.episode}`;
                        if (selectedSeries.is_cinema_mode) {
                            setPendingPlayerState({ contentId: selectedSeries.id, season: ep.season, episode: ep.episode });
                            setShowCinemaModal(true);
                        } else {
                            navigate(watchUrl);
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
                suggestions={allContent.slice(0, 5)}
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
