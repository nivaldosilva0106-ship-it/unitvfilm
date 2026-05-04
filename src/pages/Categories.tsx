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
import { CategoryGenreSection } from "@/components/categories/CategoryGenreSection";
import { CategoryEmptyState } from "@/components/categories/CategoryEmptyState";
import { Content } from "@/types/content";
import { getAllContents, addToMyList, removeFromMyList, getMyList } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Filter } from "lucide-react";

const GENRES = ['Ação', 'Aventura', 'Comédia', 'Drama', 'Terror', 'Romance', 'Ficção', 'Animação', 'Documentário', 'Infantil', 'Fantasia', 'Suspense'];

export default function Categories() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Data State
    const [allContent, setAllContent] = useState<Content[]>([]);
    const [loading, setLoading] = useState(true);
    const [myList, setMyList] = useState<string[]>([]);

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
            if (accessFilter === 'premium') filtered = filtered.filter(c => c.isPremium);
        } else {
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
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground font-sans">
            <Header />

            <div className="pt-20 sm:pt-24 pb-8 container mx-auto px-4">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
                    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                        <Filter className="w-6 h-6 sm:w-8 sm:h-8 text-primary" /> Categorias
                    </h1>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full md:w-auto">
                        <CategoryTypeFilter value={typeFilter} onChange={setTypeFilter} />
                        <CategoryAccessFilter value={accessFilter} onChange={setAccessFilter} />
                    </div>
                </div>

                <AdManager placement="header" className="mb-8" />

                {/* Content Rows by Genre */}
                {filteredContent.length > 0 ? (
                    <CategoryGenreSection
                        filteredContent={filteredContent}
                        genres={GENRES}
                        onPlayContent={handlePlayContent}
                        onInfoContent={handleInfoContent}
                        onDetailsContent={handleDetailsContent}
                        onDownloadContent={handleDownloadContent}
                    />
                ) : (
                    <CategoryEmptyState />
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
