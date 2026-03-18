import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Film, Play, Monitor, Smartphone, Tv, Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAllContents, getPlans } from '@/lib/firebase';
import { Content } from '@/types/content';
import { Plan } from '@/types/user';
import { ContentRow } from '@/components/ContentRow';
import { InstallAppButton } from '@/components/InstallAppButton';

export const Landing = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [allContent, setAllContent] = useState<Content[]>([]);
    const [heroContent, setHeroContent] = useState<Content | null>(null);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [plans, setPlans] = useState<Plan[]>([]);

    const [showIosInstructions, setShowIosInstructions] = useState(false);

    // ... (PWA useEffect) ...

    // Combined Data Loading
    useEffect(() => {
        const loadData = async () => {
            try {
                const [fetchedContent, fetchedPlans] = await Promise.all([
                    getAllContents(),
                    getPlans()
                ]);

                setAllContent(fetchedContent);
                if (fetchedContent.length > 0) {
                    setHeroContent(fetchedContent[Math.floor(Math.random() * fetchedContent.length)]);
                }

                // Filter active paid plans and sort by price
                const activePlans = fetchedPlans
                    .filter(p => p.isActive && p.price > 0 && p.requiresVerification)
                    .sort((a, b) => a.price - b.price)
                    .slice(0, 2); // Top 2

                setPlans(activePlans);
            } catch (error) {
                console.error("Error loading data", error);
            }
        };
        loadData();
    }, []);
    // PWA Install Event Listener
    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Store globally in case component unmounts
            (window as any).deferredPrompt = e;
        };

        // Check if event already happened
        if ((window as any).deferredPrompt) {
            setDeferredPrompt((window as any).deferredPrompt);
        }

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async (platform: 'android' | 'ios' | 'pc') => {
        if (platform === 'ios') {
            setShowIosInstructions(true);
            return;
        }

        const promptEvent = deferredPrompt || (window as any).deferredPrompt;

        if (!promptEvent) {
            // Check if already in standalone mode
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
            if (isStandalone) {
                alert("O App já está instalado e aberto!");
            } else {
                if (platform === 'pc') {
                    alert("Para instalar no PC:\n1. Olhe para a barra de endereços do navegador.\n2. Clique no ícone de 'Instalar' (computador com seta) ou (+).");
                } else {
                    alert("Instalação automática indisponível neste navegador.\n\nTente usar o Google Chrome e procure por 'Adicionar à Tela Inicial' no menu.");
                }
            }
            return;
        }

        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            (window as any).deferredPrompt = null;
        }
    };

    useEffect(() => {
        const loadContent = async () => {
            try {
                const data = await getAllContents();
                setAllContent(data);
                if (data.length > 0) {
                    // Select a random popular content for hero background/featured card
                    setHeroContent(data[Math.floor(Math.random() * data.length)]);
                }
            } catch (error) {
                console.error("Error loading landing content", error);
            }
        };
        loadContent();
    }, []);

    const categorizedContent = useMemo(() => {
        const shuffle = (array: Content[]) => [...array].sort(() => 0.5 - Math.random());
        return {
            popular: shuffle(allContent.filter(c => c.rating && c.rating > 7)).slice(0, 10),
            new: shuffle(allContent.filter(c => c.is_new)).slice(0, 10),
            action: shuffle(allContent.filter(c => c.genre?.some(g => g.toLowerCase().includes('ação') || g.toLowerCase().includes('action')))).slice(0, 10),
            series: shuffle(allContent.filter(c => c.category === 'series')).slice(0, 10)
        };
    }, [allContent]);

    const handleGetStarted = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        navigate('/signup');
    };

    const dummyRedirect = () => navigate('/signup');

    return (
        <div className="min-h-screen bg-[#021b16] text-white overflow-x-hidden font-sans selection:bg-[#0aff7a] selection:text-[#021b16]">

            {/* Navbar */}
            <nav className="fixed top-0 w-full z-50 bg-gradient-to-b from-[#021b16]/90 to-transparent backdrop-blur-[2px] px-4 md:px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <Link to="/" className="flex items-center gap-2 group">
                        <div className="bg-[#021b16] border border-[#0aff7a] p-1.5 rounded glow-effect group-hover:bg-[#0aff7a] transition-colors duration-300">
                            <Film className="w-5 h-5 text-[#0aff7a] group-hover:text-[#021b16]" />
                        </div>
                        <span className="text-xl md:text-2xl font-bold tracking-tight">UniTv<span className="text-[#0aff7a]">Film</span></span>
                    </Link>
                    <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-300">
                        <button onClick={dummyRedirect} className="hover:text-white transition-colors">Séries</button>
                        <button onClick={dummyRedirect} className="hover:text-white transition-colors">Filmes</button>
                        <button onClick={dummyRedirect} className="hover:text-white transition-colors">TV ao Vivo</button>
                        <button
                            onClick={() => window.open("https://unitvfbox.vercel.app/", "_blank")}
                            className="hover:text-white transition-colors flex items-center gap-1.5"
                        >
                            <Tv className="w-4 h-4 text-[#0aff7a]" />
                            UniTvBox
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <InstallAppButton variant="icon" />
                    <Link to="/login">
                        <Button variant="outline" className="border-[#0aff7a] text-white hover:bg-[#0aff7a]/10 hover:text-[#0aff7a] bg-transparent font-medium hidden sm:flex">
                            Entrar
                        </Button>
                    </Link>
                    <Link to="/signup">
                        <Button className="bg-[#0aff7a] text-[#021b16] hover:bg-[#0aff7a]/90 font-bold px-6">
                            Começar agora
                        </Button>
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="relative w-full h-[85vh] md:h-screen flex items-center justify-center overflow-hidden">
                {/* Hero Background Collage */}
                <div className="absolute inset-0 z-0 opacity-40 md:opacity-30">
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 transform -rotate-6 scale-110">
                        {allContent.slice(0, 18).map((c, i) => (
                            <div key={i} className="aspect-[2/3] bg-zinc-800 rounded-lg overflow-hidden relative">
                                <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover grayscale-[30%] hover:grayscale-0 transition-all duration-700" loading="lazy" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Gradient Overlay */}
                <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#021b16] via-[#021b16]/70 to-[#021b16]/50" />
                <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_0%,#021b16_100%)]" />

                {/* Hero Content */}
                <div className="relative z-20 text-center px-4 max-w-4xl mx-auto mt-12 md:mt-0">
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight leading-[1.1]">
                        Assista filmes, séries e TV <br className="hidden md:block" /> em qualquer lugar.
                    </h1>
                    <p className="text-lg md:text-2xl text-gray-200 mb-8 max-w-2xl mx-auto font-light">
                        Conteúdo em alta qualidade, reunido em um só lugar, <br className="hidden sm:block" /> com planos que cabem no seu bolso.
                    </p>

                    <form onSubmit={handleGetStarted} className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-xl mx-auto">
                        <div className="relative w-full">
                            <Input
                                type="email"
                                placeholder="Seu endereço de email"
                                className="h-12 md:h-14 bg-black/40 border-gray-600 text-white placeholder:text-gray-400 focus:border-[#0aff7a] focus:ring-1 focus:ring-[#0aff7a]"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                        <Button size="lg" type="submit" className="h-12 md:h-14 px-8 w-full sm:w-auto bg-[#0aff7a] text-[#021b16] hover:bg-[#0aff7a]/90 font-bold text-lg md:text-xl flex items-center gap-2 group whitespace-nowrap">
                            Começar <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </form>
                    <p className="mt-4 text-sm text-gray-400">Pronto para assistir? Crie uma conta em poucos minutos.</p>
                </div>
            </header>



        // ... (in JSX, replacing "Low Cost Plan Highlight" section)
            {/* Plans Section */}
            {plans.length > 0 && (
                <section className="relative z-20 -mt-20 md:-mt-32 px-4 pb-20">
                    <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 justify-center">
                        {plans.map((plan, index) => (
                            <div key={plan.id} className={`flex-1 relative overflow-hidden rounded-2xl p-6 md:p-8 border ${index === 1 ? 'bg-[#0aff7a]/10 border-[#0aff7a] shadow-[0_0_30px_rgba(10,255,122,0.15)]' : 'bg-[#062820] border-[#0aff7a]/30 shadow-lg'} transition-all hover:scale-[1.02]`}>
                                {index === 1 && (
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#0aff7a]/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                )}

                                <div className="flex flex-col h-full justify-between">
                                    <div>
                                        {index === 0 && <div className="inline-block px-3 py-1 bg-white/10 text-gray-300 text-xs font-bold rounded-full mb-4 uppercase tracking-wider">Econômico</div>}
                                        {index === 1 && <div className="inline-block px-3 py-1 bg-[#0aff7a] text-[#021b16] text-xs font-bold rounded-full mb-4 uppercase tracking-wider">Mais Popular</div>}

                                        <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                                        <p className="text-gray-300 text-sm mb-6 min-h-[40px]">{plan.description}</p>

                                        <div className="space-y-3 mb-8">
                                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                                <Check className="w-4 h-4 text-[#0aff7a]" />
                                                Accesso completo a Filmes e Séries
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                                <Check className="w-4 h-4 text-[#0aff7a]" />
                                                {plan.limits.moviesPerDay === -1 ? 'Filmes Ilimitados' : `${plan.limits.moviesPerDay} Filmes/dia`}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                                <Check className="w-4 h-4 text-[#0aff7a]" />
                                                {plan.limits.maxProfiles} Perfis de usuário
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-end gap-1 mb-6">
                                            <div className="text-3xl font-bold text-white">{plan.price} KZ</div>
                                            <div className="text-sm text-gray-400 mb-1.5">/{plan.durationDays === 365 ? 'ano' : 'mês'}</div>
                                        </div>

                                        <Button onClick={() => navigate('/signup')} className={`w-full font-bold h-12 ${index === 1 ? 'bg-[#0aff7a] text-[#021b16] hover:bg-[#0aff7a]/90' : 'bg-transparent border border-gray-600 hover:border-white hover:bg-white/5'}`}>
                                            Escolher Plano
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Content Rows */}
            <section className="pb-16 space-y-8 pl-4 md:pl-8">
                {categorizedContent.popular.length > 0 && (
                    <ContentRow
                        title="Populares na UniTvFilm"
                        contents={categorizedContent.popular}
                        hideDownloadIcon={true}
                        onDetailsContent={dummyRedirect}
                        onPlayContent={dummyRedirect}
                    />
                )}
                {categorizedContent.new.length > 0 && (
                    <ContentRow
                        title="Novos Lançamentos"
                        contents={categorizedContent.new}
                        hideDownloadIcon={true}
                        onDetailsContent={dummyRedirect}
                        onPlayContent={dummyRedirect}
                    />
                )}
                {categorizedContent.series.length > 0 && (
                    <ContentRow
                        title="Séries para Maratonar"
                        contents={categorizedContent.series}
                        hideDownloadIcon={true}
                        onDetailsContent={dummyRedirect}
                        onPlayContent={dummyRedirect}
                    />
                )}
            </section>

            {/* Features Section */}
            <section className="py-20 bg-gradient-to-b from-[#021b16] to-[#04120e] border-t border-white/5">
                <div className="max-w-7xl mx-auto px-4 md:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <div className="bg-[#062820]/30 p-6 rounded-xl border border-white/5 hover:border-[#0aff7a]/30 transition-colors">
                            <div className="w-12 h-12 bg-[#0aff7a]/10 rounded-lg flex items-center justify-center mb-4">
                                <Monitor className="w-6 h-6 text-[#0aff7a]" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Assista em qualquer lugar</h3>
                            <p className="text-gray-400 text-sm">Aproveite seus filmes e séries favoritos no seu celular, tablet, laptop e TV sem pagar a mais por isso.</p>
                        </div>
                        <div className="bg-[#062820]/30 p-6 rounded-xl border border-white/5 hover:border-[#0aff7a]/30 transition-colors">
                            <div className="w-12 h-12 bg-[#0aff7a]/10 rounded-lg flex items-center justify-center mb-4">
                                <Tv className="w-6 h-6 text-[#0aff7a]" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Feito para TV Box</h3>
                            <p className="text-gray-400 text-sm">Navegação otimizada para controles remotos. Transforme sua TV em um cinema com nossa interface fluida.</p>
                        </div>
                        <div className="bg-[#062820]/30 p-6 rounded-xl border border-white/5 hover:border-[#0aff7a]/30 transition-colors">
                            <div className="w-12 h-12 bg-[#0aff7a]/10 rounded-lg flex items-center justify-center mb-4">
                                <Check className="w-6 h-6 text-[#0aff7a]" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Planos para todos</h3>
                            <p className="text-gray-400 text-sm">Desde opções econômicas até planos familiares completos. Escolha o que melhor se adapta a você.</p>
                        </div>
                        <div className="bg-[#062820]/30 p-6 rounded-xl border border-white/5 hover:border-[#0aff7a]/30 transition-colors">
                            <div className="w-12 h-12 bg-[#0aff7a]/10 rounded-lg flex items-center justify-center mb-4">
                                <Smartphone className="w-6 h-6 text-[#0aff7a]" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Atualizado Sempre</h3>
                            <p className="text-gray-400 text-sm">Novos conteúdos adicionados semanalmente. Nunca fique sem ter o que assistir.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Footer */}
            <section className="py-24 bg-[#010b09] relative overflow-hidden text-center px-4">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#062820_0%,#010b09_70%)] opacity-50"></div>
                <div className="relative z-10 max-w-3xl mx-auto">
                    <h2 className="text-3xl md:text-5xl font-bold mb-6">Pronto para começar a maratonar?</h2>
                    <p className="text-lg text-gray-400 mb-8">
                        Crie sua conta UniTvFilm, escolha um plano e comece a assistir agora mesmo.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button onClick={() => navigate('/signup')} size="lg" className="h-14 px-8 bg-[#0aff7a] text-[#021b16] hover:bg-[#0aff7a]/90 font-bold text-lg w-full sm:w-auto">
                            Começar assistindo agora
                        </Button>
                        <Button onClick={() => navigate('/login')} size="lg" variant="outline" className="h-14 px-8 border-gray-700 text-white hover:bg-white/5 hover:border-gray-500 font-bold text-lg w-full sm:w-auto">
                            Já tem conta? Entrar
                        </Button>
                    </div>
                </div>
            </section>

            {/* Plain Footer */}
            <footer className="bg-[#000504] py-12 px-8 border-t border-white/5 text-sm text-gray-500">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-wrap justify-center gap-6">
                        <Link to="/about" className="hover:text-white transition-colors">Sobre Nós</Link>
                        <Link to="/terms" className="hover:text-white transition-colors">Termos de Uso</Link>
                        <Link to="/privacy" className="hover:text-white transition-colors">Política de Privacidade</Link>
                        <a href="#" className="hover:text-white transition-colors">Ajuda</a>
                    </div>
                    <div>
                        UniTvFilm © {new Date().getFullYear()}. Todos os direitos reservados.
                    </div>
                </div>

                {/* App Stores Links */}
                <div className="max-w-7xl mx-auto mt-12 border-t border-white/5 pt-8 flex flex-col items-center">
                    <p className="text-gray-400 mb-6 font-medium">Baixe nosso App para a melhor experiência</p>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <Button
                            variant="outline"
                            className="bg-black/40 border-gray-700 hover:bg-white/10 hover:border-white h-14 px-6 gap-3 group transition-all"
                            onClick={() => handleInstallClick('android')}
                        >
                            <Play className="w-6 h-6 fill-current text-[#0aff7a] group-hover:text-white transition-colors" />
                            <div className="text-left">
                                <div className="text-[10px] uppercase font-bold text-gray-400">Disponível no</div>
                                <div className="text-sm font-bold text-white group-hover:text-[#0aff7a] transition-colors leading-none">Google Play</div>
                            </div>
                        </Button>

                        <Button
                            variant="outline"
                            className="bg-black/40 border-gray-700 hover:bg-white/10 hover:border-white h-14 px-6 gap-3 group transition-all"
                            onClick={() => handleInstallClick('ios')}
                        >
                            {/* Apple Icon Mock using a simple shape or Lucide doesn't have proper Apple logo, sticking to text or generic Smartphone if needed. Using Smartphone as close proxy or just SVG */}
                            <svg viewBox="0 0 384 512" fill="currentColor" className="w-6 h-6 text-white group-hover:text-[#0aff7a] transition-colors">
                                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 49.5-25.2 80.7 30.6 2.1 48.2-12.8 69.1-43.1z" />
                            </svg>
                            <div className="text-left">
                                <div className="text-[10px] uppercase font-bold text-gray-400">Baixar na</div>
                                <div className="text-sm font-bold text-white group-hover:text-[#0aff7a] transition-colors leading-none">App Store</div>
                            </div>
                        </Button>

                        <Button
                            variant="outline"
                            className="bg-black/40 border-gray-700 hover:bg-white/10 hover:border-white h-14 px-6 gap-3 group transition-all"
                            onClick={() => handleInstallClick('pc')}
                        >
                            <Monitor className="w-6 h-6 text-[#0aff7a] group-hover:text-white transition-colors" />
                            <div className="text-left">
                                <div className="text-[10px] uppercase font-bold text-gray-400">Instalar no</div>
                                <div className="text-sm font-bold text-white group-hover:text-[#0aff7a] transition-colors leading-none">Computador</div>
                            </div>
                        </Button>
                    </div>
                </div>
            </footer>

            {/* iOS Instructions Modal */}
            {showIosInstructions && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none p-4 pb-8">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto" onClick={() => setShowIosInstructions(false)} />
                    <div className="relative bg-[#1a1a1a] border border-gray-700 p-6 rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto animate-in slide-in-from-bottom duration-300">
                        <button
                            onClick={() => setShowIosInstructions(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        >
                            <span className="sr-only">Fechar</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>

                        <div className="text-center space-y-4">
                            <div className="w-12 h-12 bg-[#0aff7a]/10 rounded-full flex items-center justify-center mx-auto text-[#0aff7a]">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" x2="12" y1="2" y2="15" /></svg>
                            </div>
                            <h3 className="text-lg font-bold text-white">Instalar no iPhone</h3>
                            <div className="text-sm text-gray-300 text-left space-y-3 font-medium">
                                <p>1. Toque no botão <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-700 rounded mx-1"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" x2="12" y1="2" y2="15" /></svg></span> <strong>Compartilhar</strong> na barra inferior.</p>
                                <p>2. Role para baixo e toque em <span className="inline-flex items-center gap-1 bg-gray-700 px-2 py-0.5 rounded text-white"><span className="text-lg leading-none">+</span> Adicionar à Tela de Início</span>.</p>
                                <p>3. Toque em <strong>Adicionar</strong> no canto superior direito.</p>
                            </div>
                            <Button className="w-full bg-[#0aff7a] text-black hover:bg-[#0aff7a]/90 font-bold" onClick={() => setShowIosInstructions(false)}>
                                Entendi
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Landing;
