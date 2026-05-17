import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ArrowLeft, Search, Filter } from "lucide-react";
import { ContentCard } from "@/components/ContentCard";
import { EpisodeSelector } from "@/components/EpisodeSelector";
import { Content } from "@/types/content";
import { getAllContents, getSiteSettings, type SiteSettings } from "@/lib/firebase";
import { STREAMING_PROVIDERS, getProviderConfig } from "@/lib/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ProviderView = () => {
    const { providerId } = useParams();
    const navigate = useNavigate();
    const [allContent, setAllContent] = useState<Content[]>([]);
    const [loading, setLoading] = useState(true);
    const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSeries, setSelectedSeries] = useState<Content | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [contentData, settingsData] = await Promise.all([
                    getAllContents(),
                    getSiteSettings()
                ]);
                setAllContent(contentData);
                setSiteSettings(settingsData);
            } catch (error) {
                console.error("Error loading provider content:", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const providerConfig = useMemo(() => {
        return STREAMING_PROVIDERS.find(p => p.id === providerId);
    }, [providerId]);

    const filteredContent = useMemo(() => {
        return allContent.filter(c => {
            const config = getProviderConfig(c.watch_provider, siteSettings?.providerLogos);
            const matchesProvider = config?.id === providerId;
            const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesProvider && matchesSearch;
        });
    }, [allContent, providerId, siteSettings, searchQuery]);

    const handlePlayContent = (content: Content) => {
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

        navigate(`/watch/${content.id}`);
    };

    if (loading) return <LoadingScreen />;

    if (!providerConfig) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
                <h1 className="text-2xl font-bold text-white mb-4">Provedor não encontrado</h1>
                <Button onClick={() => navigate("/")}>Voltar para o Início</Button>
            </div>
        );
    }

    const providerLogo = siteSettings?.providerLogos?.[providerId!] || providerConfig.logo;

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
            <Header />
            
            <main className="pt-24 pb-20 px-4 sm:px-8">
                {/* Hero / Header Section */}
                <div className="relative mb-12 rounded-3xl overflow-hidden animate-fade-in">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-zinc-900 to-black opacity-50" />
                    
                    <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 backdrop-blur-sm border border-white/5">
                        <Button 
                            variant="ghost" 
                            onClick={() => navigate("/")}
                            className="absolute top-4 left-4 text-white/60 hover:text-white hover:bg-white/10"
                        >
                            <ArrowLeft className="w-5 h-5 mr-2" /> Voltar
                        </Button>

                        <div className="w-32 h-32 md:w-40 md:h-40 bg-zinc-900/80 rounded-2xl p-6 border border-white/10 shadow-2xl flex items-center justify-center animate-scale-in">
                            <img 
                                src={providerLogo} 
                                alt={providerConfig.name} 
                                className="w-full h-full object-contain"
                            />
                        </div>

                        <div className="text-center md:text-left">
                            <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter mb-2 animate-slide-up">
                                {providerConfig.name}
                            </h1>
                            <p className="text-zinc-400 text-lg max-w-2xl animate-slide-up" style={{ animationDelay: '100ms' }}>
                                Descubra os melhores filmes e séries disponíveis no catálogo {providerConfig.name} através do UniTvFilm.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <Input 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={`Pesquisar na ${providerConfig.name}...`}
                            className="pl-10 bg-zinc-900/50 border-white/10 focus:border-primary/50 h-11"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-500">
                            {filteredContent.length} resultados encontrados
                        </span>
                    </div>
                </div>

                {/* Content Grid */}
                {filteredContent.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                        {filteredContent.map((content, index) => (
                            <div
                                key={content.id}
                                className="animate-fade-in-up"
                                style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
                            >
                                <ContentCard 
                                    title={content.title}
                                    thumbnail={content.thumbnail_url}
                                    onPlay={() => handlePlayContent(content)}
                                    onInfo={() => navigate(`/content/${content.id}`)}
                                    onDetails={() => navigate(`/content/${content.id}`)}
                                    isPremium={content.isPremium}
                                    isNew={content.is_new}
                                    newSince={content.new_since}
                                    category={content.category}
                                    classification={content.classification}
                                    watch_provider={content.watch_provider}
                                    providerLogos={siteSettings?.providerLogos}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-20 flex flex-col items-center justify-center text-zinc-500 animate-fade-in">
                        <Filter className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-xl">Nenhum conteúdo encontrado para sua busca.</p>
                        <Button 
                            variant="link" 
                            onClick={() => setSearchQuery("")}
                            className="text-primary mt-2"
                        >
                            Limpar pesquisa
                        </Button>
                    </div>
                )}

                {/* Modals */}
                {selectedSeries && (
                    <EpisodeSelector
                        open={!!selectedSeries}
                        onClose={() => setSelectedSeries(null)}
                        episodes={selectedSeries.episodes || []}
                        title={selectedSeries.title}
                        trailerUrl={selectedSeries.trailer_url}
                        thumbnail={selectedSeries.thumbnail_url}
                        onPlayEpisode={(url, episodeTitle) => {
                            const foundEp = selectedSeries.episodes?.find(e => e.url === url);
                            if (foundEp) {
                                navigate(`/watch/${selectedSeries.id}?season=${foundEp.season}&episode=${foundEp.episode}`);
                            }
                        }}
                    />
                )}
            </main>

            <Footer />

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.8); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fadeIn 0.6s ease-out both;
                }
                .animate-scale-in {
                    animation: scaleIn 0.5s ease-out both;
                }
                .animate-slide-up {
                    animation: slideUp 0.6s ease-out both;
                }
                .animate-fade-in-up {
                    animation: fadeInUp 0.5s ease-out both;
                }
            `}</style>
        </div>
    );
};

export default ProviderView;
