import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ArrowLeft, Play, Info, Search, Filter } from "lucide-react";
import { ContentCard } from "@/components/ContentCard";
import { Content } from "@/types/content";
import { getAllContents, getSiteSettings, type SiteSettings } from "@/lib/firebase";
import { STREAMING_PROVIDERS, getProviderConfig } from "@/lib/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

const ProviderView = () => {
    const { providerId } = useParams();
    const navigate = useNavigate();
    const [allContent, setAllContent] = useState<Content[]>([]);
    const [loading, setLoading] = useState(true);
    const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

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
                <div className="relative mb-12 rounded-3xl overflow-hidden">
                    {/* Background Dynamic Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-zinc-900 to-black opacity-50" />
                    
                    <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 backdrop-blur-sm border border-white/5">
                        <Button 
                            variant="ghost" 
                            onClick={() => navigate("/")}
                            className="absolute top-4 left-4 text-white/60 hover:text-white hover:bg-white/10"
                        >
                            <ArrowLeft className="w-5 h-5 mr-2" /> Voltar
                        </Button>

                        <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-32 h-32 md:w-40 md:h-40 bg-zinc-900/80 rounded-2xl p-6 border border-white/10 shadow-2xl flex items-center justify-center"
                        >
                            <img 
                                src={providerLogo} 
                                alt={providerConfig.name} 
                                className="w-full h-full object-contain"
                            />
                        </motion.div>

                        <div className="text-center md:text-left">
                            <motion.h1 
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter mb-2"
                            >
                                {providerConfig.name}
                            </motion.h1>
                            <motion.p 
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.1 }}
                                className="text-zinc-400 text-lg max-w-2xl"
                            >
                                Descubra os melhores filmes e séries disponíveis no catálogo {providerConfig.name} através do UniTvFilm.
                            </motion.p>
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
                <AnimatePresence mode="popLayout">
                    {filteredContent.length > 0 ? (
                        <motion.div 
                            layout
                            className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-4 sm:gap-6"
                        >
                            {filteredContent.map((content, index) => (
                                <motion.div
                                    key={content.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    layout
                                >
                                    <ContentCard 
                                        title={content.title}
                                        thumbnail={content.thumbnail_url}
                                        onPlay={() => navigate(`/watch/${content.id}`)}
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
                                </motion.div>
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-20 flex flex-col items-center justify-center text-zinc-500"
                        >
                            <Filter className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-xl">Nenhum conteúdo encontrado para sua busca.</p>
                            <Button 
                                variant="link" 
                                onClick={() => setSearchQuery("")}
                                className="text-primary mt-2"
                            >
                                Limpar pesquisa
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <Footer />
        </div>
    );
};

export default ProviderView;
