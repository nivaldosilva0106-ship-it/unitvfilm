import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { getAllContents, incrementDailyUsage, saveUserProgress, getUserProgress, getUserAllProgress, addToMyList, removeFromMyList, getMyList, getSiteSettings, type SiteSettings } from "@/lib/firebase";
import { getProviderConfig } from "@/lib/providers";
import { Content } from "@/types/content";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { X, ArrowLeft, Film, Maximize, Minimize, List, Star, ChevronRight, ChevronDown, Crown, Play, Plus, Check, ShieldCheck, WifiOff, Download, LayoutGrid, MoreVertical } from "lucide-react";
import { AdManager } from "@/components/AdManager";
import { useContentProtection } from "@/hooks/useContentProtection";
import { toast } from "sonner";
import { isContentAllowedForProfile } from "@/lib/utils";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Capacitor } from '@capacitor/core';
import { useAppConfig } from "@/hooks/useAppConfig";
import React, { Suspense } from "react";
import { useSpatialNavigation, FOCUSABLE_CLASS } from "@/hooks/useSpatialNavigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Helper to handle lazy loading errors (ChunkLoadError)
const lazyWithRetry = (componentImport: () => Promise<any>) =>
  React.lazy(() =>
    componentImport().catch((error) => {
      console.error("Chunk load error detected, reloading page...", error);
      window.location.reload();
      return { default: () => null };
    })
  );

const DownloadModal = lazyWithRetry(() => import("@/components/DownloadModal").then(module => ({ default: module.DownloadModal })));
const EpisodeSelector = lazyWithRetry(() => import("@/components/EpisodeSelector").then(module => ({ default: module.EpisodeSelector })));


const Player = () => {
    // Initialize TV Spatial Navigation
    useSpatialNavigation({ 
        enabled: true,
        onBack: () => {
            if (showEpisodeSelector) {
                setShowEpisodeSelector(false);
            } else if (isSuggestionsOpen) {
                setIsSuggestionsOpen(false);
            } else if (isContinueWatchingOpen) {
                setIsContinueWatchingOpen(false);
            } else if (downloadModal.open) {
                setDownloadModal({ ...downloadModal, open: false });
            } else {
                navigate(-1);
            }
        }
    });

    const { id } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { profile, currentProfile, isAdmin, checkAccess, plan, user } = useAuth();
    const { isLiteMode } = useAppConfig();

    const [content, setContent] = useState<Content | null>(null);
    const [loading, setLoading] = useState(true);
    const [videoUrl, setVideoUrl] = useState<string>("");
    const [currentTitle, setCurrentTitle] = useState<string>("");
    const [nextEpisode, setNextEpisode] = useState<any>(null);
    const [accessState, setAccessState] = useState<{ granted: boolean; reason?: string | null }>({ granted: false }); // Default false until checked

    // Progress Tracking State
    const [lastPositionSeconds, setLastPositionSeconds] = useState<number>(0);
    const [showResumePrompt, setShowResumePrompt] = useState(false);
    const [isResuming, setIsResuming] = useState(false);
    const [showResumeArrow, setShowResumeArrow] = useState(false);
    const sessionStartTimestamp = useRef<number>(Date.now());
    const progressSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const internalPlaybackPositionRef = useRef<number>(0);

    // Player state
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const [showSourceMenu, setShowSourceMenu] = useState(false);
    const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showWatchingCard, setShowWatchingCard] = useState(false);
    const [cardProgress, setCardProgress] = useState(100);
    const [showIntro, setShowIntro] = useState(true);
    const [showAdBlockModal, setShowAdBlockModal] = useState(false);
    const [suggestions, setSuggestions] = useState<Content[]>([]);
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false); // Sidebar toggle state
    const [showControls, setShowControls] = useState(true);
    const [continueWatchingList, setContinueWatchingList] = useState<any[]>([]); // Progress + Content data
    const [isContinueWatchingOpen, setIsContinueWatchingOpen] = useState(false);
    const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);

    // My List State
    const [isInMyList, setIsInMyList] = useState(false);
    const [myListId, setMyListId] = useState<string | null>(null);

    // Download Modal State
    const [downloadModal, setDownloadModal] = useState<{ open: boolean, url: string, downloads?: { label: string; url: string; type?: 'direct' | 'torrent' }[], download_mode?: 'direct' | 'torrent' | 'mixed', title: string, thumbnail: string }>({ open: false, url: '', title: '', thumbnail: '' });
    const [showEpisodeSelector, setShowEpisodeSelector] = useState(false);


    const watchingCardTimerRef = useRef<NodeJS.Timeout | null>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const hasIncrementedRef = useRef(false);
    const hasPromptedRef = useRef<string | null>(null);

    const seasonParam = searchParams.get('season');
    const episodeParam = searchParams.get('episode');

    useContentProtection(true);

    // Check My List Status
    useEffect(() => {
        const checkMyList = async () => {
            if (user?.uid && content) {
                try {
                    const list = await getMyList(user.uid);
                    const found = list.find(item => item.contentId === content.id);
                    if (found) {
                        setIsInMyList(true);
                        setMyListId(found.id);
                    } else {
                        setIsInMyList(false);
                        setMyListId(null);
                    }
                } catch (error) {
                    console.error("Error checking My List:", error);
                }
            }
        };
        checkMyList();
    }, [user, content]);

    const handleToggleMyList = async () => {
        if (!user || !content) return;

        try {
            if (isInMyList && myListId) {
                await removeFromMyList(user.uid, myListId);
                setIsInMyList(false);
                setMyListId(null);
                toast.success("Removido da Minha Lista");
            } else {
                const newItem = await addToMyList(user.uid, content);
                setIsInMyList(true);
                setMyListId(newItem.id);
                toast.success("Adicionado à Minha Lista");
            }
        } catch (error) {
            toast.error("Erro ao atualizar Minha Lista");
        }
    };

    // 1. Load Content
    // 1. Load Content & Intro Timer
    useEffect(() => {
        const loadContentData = async () => {
            try {
                setLoading(true);
                const [allContents, settings] = await Promise.all([
                    getAllContents(),
                    getSiteSettings()
                ]);
                setSiteSettings(settings);
                
                const found = allContents.find(c => c.id === id);
                if (!found) {
                    toast.error("Conteúdo não encontrado");
                    navigate("/");
                    return;
                }
                setContent(found);
                
                if (found.adBlockFriendly) {
                    setShowAdBlockModal(true);
                }

                // Shuffle recommendations
                const filtered = allContents.filter(c => c.id !== found.id && c.category !== 'canais24h');
                setSuggestions(filtered.sort(() => 0.5 - Math.random()).slice(0, 15));

                const isSeries = found.category?.toLowerCase() === 'series' || 
                                found.category?.toLowerCase() === 'série' || 
                                found.category?.toLowerCase() === 'serie' ||
                                (found.episodes && found.episodes.length > 0);

                if (isSeries && found.episodes) {
                    const season = parseInt(seasonParam || '1');
                    const episode = parseInt(episodeParam || '1');
                    const ep = found.episodes.find(e => e.season === season && e.episode === episode);
                    
                    if (ep) {
                        setVideoUrl(ep.url);
                        setCurrentTitle(`${found.title} - T${season} E${episode}: ${ep.title}`);
                        
                        // Find next episode
                        const sorted = [...found.episodes].sort((a,b) => (a.season - b.season) || (a.episode - b.episode));
                        const currIdx = sorted.findIndex(e => e.season === season && e.episode === episode);
                        if (currIdx !== -1 && currIdx < sorted.length - 1) {
                            setNextEpisode(sorted[currIdx + 1]);
                        }
                    } else if (found.episodes.length > 0) {
                        // Fallback to first episode
                        const first = found.episodes[0];
                        setVideoUrl(first.url);
                        setCurrentTitle(`${found.title} - T${first.season} E${first.episode}: ${first.title}`);
                    }
                } else {
                    setVideoUrl(found.video_url || "");
                    setCurrentTitle(found.title);
                }
            } catch (error) {
                console.error("Error loading data:", error);
                toast.error("Erro ao carregar dados do player");
            } finally {
                setLoading(false);
            }
        };

        loadContentData();
    }, [id, navigate, seasonParam, episodeParam]);

    // Added check for content protection
    useEffect(() => {
        if (!loading && content) {
            if (!isContentAllowedForProfile(content.classification, currentProfile?.isKids || false)) {
                toast.error("Acesso Restrito: Este conteúdo não é permitido para perfis Kids.");
                navigate("/");
            }
        }
    }, [loading, content, currentProfile, navigate]);

    // Intro timer etc
    useEffect(() => {
        // Intro Animation Timer
        const introTimer = setTimeout(() => {
            setShowIntro(false);
        }, 2500);

        return () => {
            clearTimeout(introTimer);
        };
    }, [id, navigate]);

    // 2. Determine Video & Access
    useEffect(() => {
        if (!content) return;

        let url = "";
        let title = content.title;
        let nextEp = null;
        let isEpisode = false;

        const isSeries = content.category?.toLowerCase() === 'series' || 
                        content.category?.toLowerCase() === 'série' || 
                        content.category?.toLowerCase() === 'serie' ||
                        (content.episodes && content.episodes.length > 0);

        if (isSeries && seasonParam && episodeParam) {
            const s = parseInt(seasonParam);
            const e = parseInt(episodeParam);
            const episodeData = content.episodes?.find(ep => ep.season === s && ep.episode === e);

            if (episodeData) {
                // Prefer internal_player_url, fallback to url
                url = episodeData.internal_player_url || episodeData.url;
                title = `${content.title} - T${s}E${e}: ${episodeData.title}`;
                isEpisode = true;

                // Calculate next episode
                const sortedEpisodes = [...(content.episodes || [])].sort((a, b) => (a.season - b.season) || (a.episode - b.episode));
                const currentIndex = sortedEpisodes.findIndex(ep => ep.season === s && ep.episode === e);
                if (currentIndex >= 0 && currentIndex < sortedEpisodes.length - 1) {
                    nextEp = sortedEpisodes[currentIndex + 1];
                }
            }
        } else {
            url = content.video_url || "";
        }

        setVideoUrl(url);
        setCurrentTitle(title);
        setNextEpisode(nextEp);

        // Check Access
        const accessMock = {
            isPremium: content.isPremium,
            category: content.category || (isEpisode ? 'series' : 'movie')
        };
        const access = checkAccess(accessMock as any);

        if (access.allowed) {
            setAccessState({ granted: true });

            // 2b. Check existing progress (Only if not already prompted for this specific content/episode)
            const contentKey = `${content.id}-${seasonParam || '0'}-${episodeParam || '0'}`;
            if (currentProfile && hasPromptedRef.current !== contentKey && !isResuming && !showResumePrompt) {
                const s = seasonParam ? parseInt(seasonParam) : undefined;
                const e = episodeParam ? parseInt(episodeParam) : undefined;
                getUserProgress(currentProfile.id, content.id, s, e).then(progress => {
                    if (progress && progress.lastPositionSeconds > 60) {
                        setLastPositionSeconds(progress.lastPositionSeconds);
                        setShowResumePrompt(true);
                    }
                    // Mark as prompted regardless of result to avoid repeating
                    hasPromptedRef.current = contentKey;
                });
            }

            if (currentProfile) {
                getUserAllProgress(currentProfile.id).then(async (allProgress) => {
                    const allContents = await getAllContents();
                    const list = allProgress
                        .map(p => {
                            const c = allContents.find(item => item.id === p.contentId);
                            if (!c) return null;

                            const duration = p.durationSeconds || (c.category === 'series' ? 2400 : 5400);
                            const percent = Math.min(Math.round((p.lastPositionSeconds / duration) * 100), 95);

                            if (percent > 90) return null; // Already finished mostly

                            return { ...p, content: c, percent };
                        })
                        .filter(Boolean)
                        .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                        .slice(0, 6);

                    setContinueWatchingList(list);
                });
            }

            // Increment usage if not already done for this session/load
            if (profile && !isAdmin && !hasIncrementedRef.current) {
                incrementDailyUsage(profile.id, accessMock.category === 'series' ? 'episode' : 'movie');
                hasIncrementedRef.current = true;
            }
        } else {
            setAccessState({ granted: false, reason: access.reason });
        }

    }, [content, seasonParam, episodeParam, checkAccess, isAdmin, profile, currentProfile]);

    const currentEpisodeData = useMemo(() => {
        const isSeries = content?.category?.toLowerCase() === 'series' || 
                        content?.category?.toLowerCase() === 'série' || 
                        content?.category?.toLowerCase() === 'serie' ||
                        (content?.episodes && content.episodes.length > 0);

        if (isSeries && seasonParam && episodeParam) {
            const s = parseInt(seasonParam);
            const e = parseInt(episodeParam);
            return content.episodes?.find(ep => ep.season === s && ep.episode === e);
        }
        return null;
    }, [content, seasonParam, episodeParam]);

    const handleDownloadClick = () => {
        if (!content) return;
        
        const isSeries = content.category?.toLowerCase() === 'series' || 
                        content.category?.toLowerCase() === 'série' || 
                        content.category?.toLowerCase() === 'serie' ||
                        (content.episodes && content.episodes.length > 0);

        if (isSeries && currentEpisodeData) {
            setDownloadModal({
                open: true,
                url: currentEpisodeData.download_url || '',
                downloads: currentEpisodeData.downloads,
                download_mode: currentEpisodeData.download_mode,
                title: `${content.title} - T${currentEpisodeData.season}E${currentEpisodeData.episode}: ${currentEpisodeData.title}`,
                thumbnail: content.thumbnail_url
            });
        } else {
            setDownloadModal({
                open: true,
                url: content.download_url || '',
                downloads: content.downloads,
                download_mode: content.download_mode,
                title: content.title,
                thumbnail: content.thumbnail_url
            });
        }
    };


    // 2c. Progress Tracking Timer
    useEffect(() => {
        if (!accessState.granted || !content || !currentProfile) return;

        sessionStartTimestamp.current = Date.now();

        // Timer to sync progress every 30 seconds
        progressSyncIntervalRef.current = setInterval(() => {
            let totalPosition = 0;
            
            if (currentSource?.type === 'internal') {
                totalPosition = Math.floor(internalPlaybackPositionRef.current);
            } else {
                const elapsed = Math.floor((Date.now() - sessionStartTimestamp.current) / 1000);
                totalPosition = lastPositionSeconds + elapsed;
            }

            if (totalPosition > 5) { // Only save if we have some progress
                saveUserProgress({
                    userId: profile?.id || '',
                    profileId: currentProfile.id,
                    contentId: content.id,
                    season: seasonParam ? parseInt(seasonParam) : undefined,
                    episode: episodeParam ? parseInt(episodeParam) : undefined,
                    lastPositionSeconds: totalPosition,
                });
            }
        }, 30000);

        return () => {
            if (progressSyncIntervalRef.current) clearInterval(progressSyncIntervalRef.current);
        };
    }, [accessState.granted, content, currentProfile, lastPositionSeconds, seasonParam, episodeParam, profile]);


    // 3. Sources Logic
    const allSources = useMemo(() => {
        if (!content) return [];

        const sources: { name: string; url: string; type: 'internal' | 'embed'; subtitle_url?: string }[] = [];

        // For series with episodes, check if current episode has internal_player_url
        const isSeries = content.category?.toLowerCase() === 'series' || 
                        content.category?.toLowerCase() === 'série' || 
                        content.category?.toLowerCase() === 'serie' ||
                        (content.episodes && content.episodes.length > 0);

        if (isSeries && seasonParam && episodeParam) {
            const s = parseInt(seasonParam);
            const e = parseInt(episodeParam);
            const episodeData = content.episodes?.find(ep => ep.season === s && ep.episode === e);

            if (episodeData?.internal_player_url) {
                sources.push({
                    name: 'Player Interno',
                    url: episodeData.internal_player_url,
                    type: 'internal',
                    subtitle_url: episodeData.subtitle_url
                });
            }
            if (episodeData?.url) {
                sources.push({ name: 'Player Embed', url: episodeData.url, type: 'embed' });
            }
        } else {
            // For movies/TV
            if (content.internal_player_url) {
                sources.push({
                    name: 'Player Interno',
                    url: content.internal_player_url,
                    type: 'internal',
                    subtitle_url: content.subtitle_url
                });
            }

            const currentUrls = (content.video_urls && content.video_urls.length > 0)
                ? content.video_urls
                : content.video_url ? [content.video_url] : [];

            currentUrls.forEach((u, index) => {
                if (u) sources.push({ name: `Player ${index + 1}`, url: u, type: 'embed' });
            });
        }

        return sources;
    }, [content, seasonParam, episodeParam]);

    const currentSource = allSources[currentSourceIndex] || allSources[0];

    const hasMultipleSeasons = useMemo(() => {
        if (content?.episodes) {
            const seasons = new Set(content.episodes.map(ep => ep.season));
            return seasons.size > 1;
        }
        return false;
    }, [content]);

    const estimatedDuration = useMemo(() => {
        if (!content) return 5400;
        const isSeries = content.category?.toLowerCase() === 'series' || 
                        content.category?.toLowerCase() === 'série' || 
                        content.category?.toLowerCase() === 'serie' ||
                        (content.episodes && content.episodes.length > 0);

        if (isSeries) {
            if (seasonParam && episodeParam && content.episodes) {
                const ep = content.episodes.find(e => e.season === parseInt(seasonParam) && e.episode === parseInt(episodeParam));
                if (ep?.duration) return Number(ep.duration) * 60;
            }
            return 2400; // 40 minutes as fallback
        }
        if (content.duration) {
            let secs = 0;
            const dStr = content.duration.toString().toLowerCase().trim();
            if (dStr.includes(':')) {
                const parts = dStr.split(':');
                if (parts.length === 3) {
                    secs = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
                } else if (parts.length === 2) {
                    secs = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                }
            } else if (dStr.includes('h') && dStr.includes('m')) {
                const parts = dStr.split('h');
                secs = parseInt(parts[0]) * 3600 + parseInt(parts[1].replace(/[^0-9]/g, '')) * 60;
            } else if (dStr.match(/[0-9]+/)) {
                secs = parseInt(dStr.replace(/[^0-9]/g, '')) * 60;
            }
            if (!isNaN(secs) && secs > 0) return secs;
        }
        return 5400; // 90 minutes fallback
    }, [content, seasonParam, episodeParam]);

    useEffect(() => {
        if (showResumeArrow) {
            const timer = setTimeout(() => setShowResumeArrow(false), 20000);
            return () => clearTimeout(timer);
        }
    }, [showResumeArrow]);

    const secureVideoUrl = useMemo(() => {
        if (!currentSource || currentSource.type !== 'embed') return '';
        const url = currentSource.url;
        const separator = url.includes('?') ? '&' : '?';

        let finalUrl = `${url}${separator}autoplay=1&mute=0&controls=1`;

        if (isResuming && lastPositionSeconds > 0) {
            finalUrl += `&start=${lastPositionSeconds}`;
        }

        return finalUrl;
    }, [currentSource, isResuming, lastPositionSeconds]);



    // 4. Watching Card Effect
    useEffect(() => {
        if (!loading && accessState.granted) {
            const showWatchingCardCycle = () => {
                setShowWatchingCard(true);
                setCardProgress(100);

                const duration = 5000;
                const intervalTime = 50;
                const decrementAmount = (100 / duration) * intervalTime;

                progressIntervalRef.current = setInterval(() => {
                    setCardProgress(prev => {
                        const newProgress = prev - decrementAmount;
                        if (newProgress <= 0) {
                            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                            return 0;
                        }
                        return newProgress;
                    });
                }, intervalTime);

                watchingCardTimerRef.current = setTimeout(() => {
                    setShowWatchingCard(false);
                    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                    
                }, duration);
            };

            const initialTimer = null;

            return () => {
                clearTimeout(initialTimer);
                if (watchingCardTimerRef.current) clearTimeout(watchingCardTimerRef.current);
                if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            }
        }
    }, [loading, accessState.granted]);

    // Optimize connection for external embeds
    useEffect(() => {
        if (secureVideoUrl) {
            try {
                const url = new URL(secureVideoUrl);
                const link = document.createElement('link');
                link.rel = 'preconnect';
                link.href = url.origin;
                link.crossOrigin = 'anonymous';
                document.head.appendChild(link);

                return () => {
                    document.head.removeChild(link);
                };
            } catch (e) {
                // Ignore invalid URLs
            }
        }
    }, [secureVideoUrl]);

    // Desktop Control Auto-hide
    useEffect(() => {
        

        let timeout: NodeJS.Timeout;
        const handleActivity = () => {
            setShowControls(true);
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        };

        // Initial hide after delay
        timeout = setTimeout(() => setShowControls(false), 3000);

        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('click', handleActivity);

        return () => {
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('click', handleActivity);
            clearTimeout(timeout);
        };
    }, [isLiteMode]);

    // Fullscreen
    useEffect(() => {
        const handleFullscreenChange = async () => {
            const isFull = !!document.fullscreenElement;
            setIsFullscreen(isFull);
            
            try {
                if (Capacitor.isNativePlatform()) {
                    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
                    if (isFull) {
                        await ScreenOrientation.lock({ orientation: 'landscape' });
                    } else {
                        await ScreenOrientation.unlock();
                    }
                } else {
                    // Browser fallback
                    if (isFull && screen.orientation && (screen.orientation as any).lock) {
                        (screen.orientation as any).lock('landscape').catch((e: any) => console.log('Orientation lock failed:', e));
                    } else if (!isFull && screen.orientation && (screen.orientation as any).unlock) {
                        (screen.orientation as any).unlock();
                    }
                }
            } catch (err) {
                console.log('Screen orientation error:', err);
            }
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                await playerContainerRef.current?.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (err) {
            console.error('Fullscreen error:', err);
        }
    };

    const handleNextEpisode = () => {
        if (nextEpisode) {
            setSearchParams({ season: nextEpisode.season.toString(), episode: nextEpisode.episode.toString() });
            // Reset states for new episode
            setIsSuggestionsOpen(false);
            setLastPositionSeconds(0);
            setIsResuming(false);
            setShowResumePrompt(false);
            setShowResumeArrow(false);
            sessionStartTimestamp.current = Date.now();
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Auto-click simulation (programmatic focus)
    useEffect(() => {
        if (!loading && !showIntro && iframeRef.current) {
            iframeRef.current.focus();
        }
    }, [loading, showIntro]);

    // Auto-hide controls after 5 seconds in Lite mode if showing
    useEffect(() => {
        if (isLiteMode && showControls) {
            const timer = setTimeout(() => setShowControls(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [isLiteMode, showControls]);

    // Remote control toggle - Any key shows controls in Lite mode
    useEffect(() => {
        if (!isLiteMode) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // If controls are hidden, show them on any navigation/action key
            if (!showControls) {
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Backspace'].includes(e.key)) {
                    setShowControls(true);
                    e.preventDefault();
                }
            } else {
                // If back/escape pressed and controls are showing, hide them
                if (e.key === 'Escape' || e.key === 'Backspace') {
                    setShowControls(false);
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLiteMode, showControls]);

    const isOnline = navigator.onLine;

    if (loading || showIntro) {
        return (
            <div className="fixed inset-0 w-screen h-screen flex flex-col items-center justify-center z-[100] bg-[#0a0a0a] overflow-hidden">
                {isOnline && <AdManager placement="player" />}
                {/* Background Image */}
                {content && (
                    <div className="absolute inset-0 z-0">
                        <img
                            src={content.backdrop_url || content.thumbnail_url}
                            alt="Background"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                    </div>
                )}

                {/* Fallback Background */}
                {!content && <div className="absolute inset-0 bg-[#0a0a0a] z-0" />}

                <div className="relative z-10 flex flex-col items-center animate-pulse">
                    <div className="bg-primary p-4 rounded-2xl shadow-[0_0_30px_rgba(220,38,38,0.5)] mb-6 transform scale-110">
                        <Film className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2 tracking-tight drop-shadow-xl">
                        Uni<span className="text-primary">Tv</span>Film
                    </h1>
                    <p className="text-gray-200 text-sm tracking-widest uppercase drop-shadow-md">Carregando Player</p>
                </div>
                <div className="relative z-10 mt-12 w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin shadow-xl"></div>
            </div>
        );
    }

    if (!accessState.granted) {
        return (
            <div className="w-screen h-screen bg-black flex items-center justify-center">
                <div className="text-center max-w-md px-8">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/20 border-2 border-primary mb-6">
                        <Crown className="w-12 h-12 text-primary" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Acesso Bloqueado
                    </h2>
                    <p className="text-gray-400 mb-8 text-lg">
                        {accessState.reason === 'premium_content' ? 'Conteúdo exclusivo para Premium.' : 'Você atingiu seu limite ou não tem permissão.'} <br />
                    </p>
                    <div className="flex flex-col gap-3">
                        <Button size="lg" className="w-full" onClick={() => navigate('/profiles')}>Voltar</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (!currentSource) return <div className="w-screen h-screen bg-black text-white flex items-center justify-center">Vídeo indisponível</div>;

    if (showAdBlockModal && content?.adBlockFriendly) {
        return (
            <div className="w-screen h-screen bg-black/90 flex items-center justify-center z-[100] fixed inset-0 backdrop-blur-md">
                {/* Background Image for Modal */}
                <div className="absolute inset-0 z-0 opacity-30">
                    <img
                        src={content.backdrop_url || content.thumbnail_url}
                        alt="Background"
                        className="w-full h-full object-cover grayscale"
                    />
                </div>

                <div className="relative z-10 max-w-md w-full mx-4 bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
                    <div className="flex flex-col items-center text-center space-y-6">
                        <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mb-2 animate-bounce">
                            <ShieldCheck className="w-10 h-10 text-amber-500" />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-white">Atenção: Player com Anúncios</h2>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Este player contém anúncios externos. Ao clicar na tela, janelas (pop-ups) podem abrir. Basta fechá-las para continuar assistindo. Ative bloqueadores de anúncio se preferir.
                            </p>
                        </div>

                        <Button
                            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-6 text-lg rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-all hover:scale-105"
                            onClick={() => setShowAdBlockModal(false)}
                        >
                            <Play className="w-5 h-5 mr-2 fill-current" />
                            Entendi, ir para o vídeo
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // isOnline already declared above

    if (!isOnline && currentSource?.type === 'embed') {
        return (
            <div className="w-screen h-screen bg-black flex items-center justify-center">
                <div className="text-center max-w-md px-8">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-900/20 border-2 border-red-600 mb-6">
                        <WifiOff className="w-12 h-12 text-red-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Modo Offline
                    </h2>
                    <p className="text-gray-400 mb-8 text-lg">
                        Você está sem internet. Este vídeo precisa de conexão para ser reproduzido.
                    </p>
                    <div className="flex flex-col gap-3">
                        <Button size="lg" className="w-full" onClick={() => navigate('/')}>Voltar para o Início</Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen bg-black text-white relative transition-all duration-300 ${isLiteMode ? 'overflow-hidden' : ''}`}>
            <div className="w-full relative group">
                <AdManager placement="player" className="absolute top-20 left-1/2 -translate-x-1/2 z-40" />

                {/* Controls Container */}
                <div 
                    ref={playerContainerRef} 
                    className="group relative w-full h-screen bg-black overflow-hidden shadow-2xl"
                >
                    {/* GLOBAL OVERLAY (CONTROLS) */}
                    <div className={`absolute inset-0 z-[60] flex flex-col justify-between transition-opacity duration-500 bg-gradient-to-t from-black/60 via-transparent to-black/60 ${showControls ? 'opacity-100' : 'opacity-0'} pointer-events-none`}>

                    {/* Resume Playback Prompt */}
                    {showResumePrompt && (
                        <div className="absolute inset-0 flex items-center justify-center z-[60] bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-300 pointer-events-auto">
                            <div className="bg-zinc-900/90 border border-white/10 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center space-y-6">
                                <div className="flex justify-center">
                                    <div className="p-4 bg-primary/20 rounded-full">
                                        <Play className="w-10 h-10 text-primary fill-primary" />
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5 sm:mb-2 text-center sm:text-left">Continuar assistindo?</h3>
                                    <p className="text-gray-400 text-xs sm:text-sm text-center sm:text-left">
                                        Você parou em <span className="text-white font-mono">{formatTime(lastPositionSeconds)}</span>.
                                        Deseja retomar de onde parou?
                                    </p>
                                </div>
                                <div className="flex flex-col gap-2.5">
                                    <Button
                                        onClick={() => {
                                            setIsResuming(true);
                                            setShowResumePrompt(false);
                                            sessionStartTimestamp.current = Date.now();
                                            if (currentSource?.type === 'embed') {
                                                setShowResumeArrow(true);
                                            }
                                        }}
                                        className={`bg-primary hover:bg-primary/90 text-white font-bold py-5 sm:py-6 rounded-xl text-sm sm:text-base w-full ${FOCUSABLE_CLASS}`}
                                    >
                                        Continuar ({formatTime(lastPositionSeconds)})
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            setIsResuming(false);
                                            setShowResumePrompt(false);
                                            setShowResumeArrow(false);
                                            setLastPositionSeconds(0);
                                            sessionStartTimestamp.current = Date.now();
                                        }}
                                        className={`text-gray-400 hover:text-white hover:bg-white/5 py-5 sm:py-6 text-sm sm:text-base w-full ${FOCUSABLE_CLASS}`}
                                    >
                                        Recomeçar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Header Controls (Close, Title, etc) */}
                    <div className="absolute top-0 left-0 right-0 p-2 sm:p-6 flex justify-between items-start z-50 pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100">
                        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-4 max-w-[65%] sm:max-w-none">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(-1)}
                                className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-black/50 text-white hover:bg-white/20 backdrop-blur-md border border-white/20 pointer-events-auto ${FOCUSABLE_CLASS}`}
                                tabIndex={0}
                            >
                                <ArrowLeft className="w-4 h-4 sm:w-6 sm:h-6" />
                            </Button>

                            <div className="px-2 sm:px-4 py-1 sm:py-2 bg-black/50 backdrop-blur-md rounded-full border border-white/20 flex items-center gap-1.5 sm:gap-3 min-w-0 overflow-hidden">
                                {/* Logo */}
                                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                    <div className="bg-primary p-0.5 sm:p-1 rounded">
                                        <Film className="w-2 h-2 sm:w-3 sm:h-3 text-white" />
                                    </div>
                                    <span className="text-white font-bold text-[8px] sm:text-sm hidden sm:inline">Uni<span className="text-primary">Tv</span>Film</span>
                                </div>

                                <div className="w-px h-3 sm:h-4 bg-white/20 flex-shrink-0" />

                                {content?.thumbnail_url && (
                                    <img src={content.thumbnail_url} alt="" className="w-5 h-5 sm:w-8 sm:h-8 rounded-full border border-white/20 object-cover flex-shrink-0" />
                                )}
                                <div className="flex flex-col min-w-0">
                                    <h1 className="text-white font-bold text-[9px] sm:text-xs truncate">{currentTitle}</h1>
                                </div>
                            </div>
                        </div>

                        <div className="pointer-events-auto flex items-center gap-1 sm:gap-3">
                            {/* --- MOBILE DROPDOWN (sm:hidden) --- */}
                            <div className="sm:hidden block">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`w-8 h-8 rounded-full bg-black/50 text-white hover:bg-white/20 backdrop-blur-md border border-white/20 ${FOCUSABLE_CLASS}`}
                                            tabIndex={0}
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="bg-black/95 border-white/20 backdrop-blur-xl w-48 z-[90]"
                                    >
                                        {allSources.length > 1 && (
                                            <>
                                                <div className="px-2 py-1.5 text-xs text-gray-400 font-semibold">Fontes</div>
                                                {allSources.map((source, index) => (
                                                    <DropdownMenuItem
                                                        key={index}
                                                        onClick={() => setCurrentSourceIndex(index)}
                                                        className={`text-white text-sm ${currentSourceIndex === index ? 'bg-primary/20' : ''}`}
                                                    >
                                                        {source.name}
                                                        {currentSourceIndex === index && <span className="ml-auto text-primary">✓</span>}
                                                    </DropdownMenuItem>
                                                ))}
                                                <div className="h-px bg-white/10 my-1" />
                                            </>
                                        )}

                                        {!isLiteMode && (
                                            <DropdownMenuItem onClick={handleToggleMyList} className="text-white text-sm">
                                                {isInMyList ? <Check className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                                {isInMyList ? "Na Minha Lista" : "Adicionar à Lista"}
                                            </DropdownMenuItem>
                                        )}

                                        {hasMultipleSeasons && (
                                            <DropdownMenuItem onClick={() => setShowEpisodeSelector(true)} className="text-white text-sm">
                                                <List className="w-4 h-4 mr-2" />
                                                Trocar Temporada
                                            </DropdownMenuItem>
                                        )}

                                        <DropdownMenuItem onClick={handleDownloadClick} className="text-white text-sm">
                                            <Download className="w-4 h-4 mr-2 text-emerald-400" />
                                            Baixar Episódio
                                        </DropdownMenuItem>

                                        {suggestions.length > 0 && (
                                            <DropdownMenuItem onClick={() => setIsSuggestionsOpen(!isSuggestionsOpen)} className="text-white text-sm">
                                                <LayoutGrid className="w-4 h-4 mr-2" />
                                                Recomendações
                                            </DropdownMenuItem>
                                        )}
                                        
                                        <DropdownMenuItem onClick={toggleFullscreen} className="text-white text-sm">
                                            {isFullscreen ? <Minimize className="w-4 h-4 mr-2" /> : <Maximize className="w-4 h-4 mr-2" />}
                                            Tela Cheia
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* --- DESKTOP BUTTONS (hidden sm:flex) --- */}
                            <div className="hidden sm:flex items-center gap-3">
                                {allSources.length > 1 && (
                                    <div className="relative">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setShowSourceMenu(!showSourceMenu)}
                                            className={`w-10 h-10 rounded-full bg-black/50 text-white hover:bg-white/20 backdrop-blur-md border border-white/20 ${FOCUSABLE_CLASS}`}
                                            tabIndex={0}
                                        >
                                            <List className="w-5 h-5" />
                                        </Button>
                                        {showSourceMenu && (
                                            <div className="absolute top-12 right-0 bg-black/90 backdrop-blur-md rounded-lg shadow-xl border border-white/20 overflow-hidden min-w-[150px]">
                                                {allSources.map((source, index) => (
                                                    <button
                                                        key={index}
                                                        onClick={() => {
                                                            setCurrentSourceIndex(index);
                                                            setShowSourceMenu(false);
                                                        }}
                                                        className={`w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors flex items-center justify-between ${currentSourceIndex === index ? 'bg-primary/20' : ''} ${FOCUSABLE_CLASS}`}
                                                        tabIndex={0}
                                                    >
                                                        <span className="text-sm">{source.name}</span>
                                                        {currentSourceIndex === index && <span className="text-primary">✓</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!isLiteMode && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleToggleMyList}
                                        className={`w-10 h-10 rounded-full bg-black/50 text-white hover:bg-white/20 backdrop-blur-md border border-white/20 ${FOCUSABLE_CLASS}`}
                                        title={isInMyList ? "Remover da lista" : "Assistir mais tarde"}
                                        tabIndex={0}
                                    >
                                        {isInMyList ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                    </Button>
                                )}

                                {hasMultipleSeasons && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setShowEpisodeSelector(true)}
                                        className={`w-10 h-10 rounded-full bg-black/50 text-white hover:bg-white/20 backdrop-blur-md border border-white/20 ${FOCUSABLE_CLASS}`}
                                        title="Trocar Temporada"
                                        tabIndex={0}
                                    >
                                        <List className="w-5 h-5" />
                                    </Button>
                                )}

                                {/* Download Button */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleDownloadClick}
                                    className={`w-10 h-10 rounded-full bg-black/50 text-white hover:bg-white/20 backdrop-blur-md border border-white/20 ${FOCUSABLE_CLASS}`}
                                    title="Baixar este conteúdo"
                                    tabIndex={0}
                                >
                                    <Download className="w-5 h-5 text-emerald-400" />
                                </Button>

                                {/* Recommendations Button */}
                                {suggestions.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsSuggestionsOpen(!isSuggestionsOpen)}
                                        className={`w-10 h-10 rounded-full text-white hover:bg-white/20 backdrop-blur-md border transition-all ${isSuggestionsOpen ? 'bg-primary border-primary' : 'bg-black/50 border-white/20'} ${FOCUSABLE_CLASS}`}
                                        title="Ver recomendações"
                                        tabIndex={0}
                                    >
                                        <LayoutGrid className="w-5 h-5" />
                                    </Button>
                                )}

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={toggleFullscreen}
                                    className={`w-10 h-10 rounded-full bg-black/50 text-white hover:bg-white/20 backdrop-blur-md border border-white/20 ${FOCUSABLE_CLASS}`}
                                    tabIndex={0}
                                >
                                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                                </Button>
                            </div>

                            {/* CLOSE BUTTON - ALWAYS VISIBLE */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/')}
                                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/50 text-white hover:bg-red-600 backdrop-blur-md border border-white/20 ${FOCUSABLE_CLASS}`}
                                tabIndex={0}
                            >
                                <X className="w-4 h-4 sm:w-5 sm:h-5" />
                            </Button>
                        </div>
                    </div>

                    {/* NEXT EPISODE BUTTON - FAR RIGHT */}
                    {nextEpisode && (
                        <div className={`absolute top-1/2 right-4 -translate-y-1/2 z-[100] transition-opacity duration-300 flex flex-col items-center gap-2 ${isFullscreen ? 'opacity-0 group-hover:opacity-100' : ''}`}>
                            <Button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleNextEpisode();
                                }}
                                variant="ghost"
                                size="icon"
                                className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-black/60 hover:bg-primary text-white backdrop-blur-md border-2 border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-all duration-300 hover:scale-110 flex items-center justify-center pointer-events-auto group/btn ${FOCUSABLE_CLASS}`}
                                title={`Próximo: ${nextEpisode.title}`}
                                tabIndex={0}
                            >
                                <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8 ml-0.5 transition-transform group-hover/btn:translate-x-1" />
                            </Button>
                            <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block shadow-lg">
                                <span className="text-[10px] text-white uppercase font-bold tracking-wider">Próximo Episódio</span>
                            </div>
                        </div>
                    )}

                    {/* WATCHING CARD */}
                    <div className={`absolute bottom-16 sm:bottom-24 left-3 sm:left-6 z-50 max-w-[200px] sm:max-w-sm bg-black/80 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 overflow-hidden transition-all duration-500 ease-out pointer-events-auto ${showWatchingCard ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none'}`}>
                        <div className="p-2 sm:p-4">
                            <p className="text-[9px] sm:text-xs text-primary font-semibold uppercase tracking-wider mb-1 sm:mb-2">Você está assistindo</p>
                            <div className="flex gap-2 sm:gap-3">
                                {content.thumbnail_url && <img src={content.thumbnail_url} className="w-10 h-14 sm:w-20 sm:h-28 object-cover rounded-lg flex-shrink-0" alt="Capa" />}
                                <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
                                    <h3 className="text-white font-bold text-[10px] sm:text-sm line-clamp-1">{currentTitle}</h3>
                                    <p className="text-[9px] sm:text-xs text-gray-300 line-clamp-2 leading-relaxed opacity-90">{content.description}</p>
                                    {content.rating && (
                                        <div className="flex items-center gap-1 mt-0.5 sm:mt-1">
                                            <Star className="w-2 h-2 sm:w-3 sm:h-3 text-yellow-500 fill-yellow-500" />
                                            <span className="text-yellow-500 text-[9px] sm:text-xs font-medium">{content.rating.toFixed(1)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                            <div className="h-full bg-primary transition-all duration-75 ease-linear" style={{ width: `${cardProgress}%` }} />
                        </div>
                    </div>

                    {/* SUGGESTIONS SIDEBAR (Right Center) */}
                    {isSuggestionsOpen && suggestions.length > 0 && (
                        <div className="absolute top-0 bottom-0 right-0 z-[80] w-[260px] sm:w-[320px] bg-black/80 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col pointer-events-auto animate-in slide-in-from-right duration-300">
                            <div className="p-4 sm:p-6 flex items-center justify-between border-b border-white/10">
                                <h3 className="text-white font-bold text-sm sm:text-base uppercase tracking-wider">Recomendados</h3>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsSuggestionsOpen(false)}
                                    className={`w-8 h-8 rounded-full text-gray-400 hover:text-white hover:bg-white/10 ${FOCUSABLE_CLASS}`}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-3 sm:gap-4 scrollbar-hide">
                                {suggestions.map((suggestion) => (
                                    <div
                                        key={suggestion.id}
                                        onClick={() => {
                                            setIsSuggestionsOpen(false);
                                            navigate(`/watch/${suggestion.id}`);
                                        }}
                                        className={`relative flex gap-3 sm:gap-4 p-2 sm:p-3 rounded-xl hover:bg-white/10 cursor-pointer transition-all group/item hover:scale-105 ${FOCUSABLE_CLASS}`}
                                    >
                                        <div className="relative w-16 h-24 sm:w-20 sm:h-28 shrink-0">
                                            <img
                                                src={suggestion.thumbnail_url}
                                                alt={suggestion.title}
                                                className="w-full h-full object-cover rounded-lg shadow-md"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                                                <Play className="w-6 h-6 text-white fill-white" />
                                            </div>
                                        </div>
                                        <div className="flex flex-col min-w-0 flex-1 justify-center">
                                            <h4 className="text-white text-xs sm:text-sm font-bold line-clamp-2 leading-tight group-hover/item:text-primary transition-colors">{suggestion.title}</h4>
                                            <p className="text-gray-400 text-[10px] sm:text-xs mt-1 line-clamp-2">{suggestion.description}</p>
                                            {suggestion.rating && (
                                                <div className="flex items-center gap-1 mt-2">
                                                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                                    <span className="text-yellow-500 text-[10px] sm:text-xs font-medium">{suggestion.rating.toFixed(1)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* VIDEO PLAYER */}
                {showResumeArrow && currentSource.type === 'embed' && (
                    <div 
                        className="absolute bottom-[80px] sm:bottom-[100px] z-[70] animate-bounce pointer-events-none flex flex-col items-center drop-shadow-2xl"
                        style={{ left: `${Math.min(Math.max((lastPositionSeconds / estimatedDuration) * 100, 2), 98)}%`, transform: 'translateX(-50%)' }}
                    >
                        <div className="bg-primary px-3 py-1.5 rounded-lg text-white text-xs font-bold whitespace-nowrap mb-1.5 shadow-2xl border border-white/20 text-center">
                            <span>Parou em: {formatTime(lastPositionSeconds)}</span>
                            <div className="text-[10px] sm:text-xs font-medium opacity-90 mt-0.5">Clique na barra abaixo</div>
                        </div>
                        <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-primary filter drop-shadow-[0_4px_4px_rgba(220,38,38,0.5)]" />
                    </div>
                )}

                {currentSource.type === 'internal' ? (
                    <div className="absolute inset-0 w-full h-full bg-black">
                        <VideoPlayer
                            key={currentSource.url}
                            url={currentSource.url}
                            poster={content?.backdrop_url || content?.thumbnail_url}
                            title={currentTitle}
                            autoPlay
                            startTime={isResuming ? lastPositionSeconds : 0}
                            subtitles={currentSource.subtitle_url}
                            onTimeUpdate={(time) => {
                                internalPlaybackPositionRef.current = time;
                            }}
                            onEnded={() => {
                                if (nextEpisode && content) {
                                    toast.info("Reproduzindo próximo episódio...");
                                    navigate(`/watch/${content.id}?season=${nextEpisode.season}&episode=${nextEpisode.episode}`);
                                }
                            }}
                        />
                    </div>
                ) : (
                    <iframe
                        key={secureVideoUrl}
                        ref={iframeRef}
                        src={secureVideoUrl}
                        title={`Player - ${currentTitle}`}
                        className="absolute inset-0 w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                        loading="eager"
                        // @ts-ignore
                        fetchPriority="high"
                        tabIndex={-1}
                        sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
                    />
                )}

                {/* CONTINUE WATCHING TOGGLE ARROW */}
                {continueWatchingList.length > 0 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-300 pointer-events-auto">
                        <Button
                            onClick={() => {
                                setIsContinueWatchingOpen(!isContinueWatchingOpen);
                                if (!isContinueWatchingOpen) {
                                    setTimeout(() => {
                                        window.scrollTo({
                                            top: window.innerHeight,
                                            behavior: 'smooth'
                                        });
                                    }, 100);
                                }
                            }}
                            variant="ghost"
                            size="icon"
                            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 text-white border border-white/20 backdrop-blur-md transition-all duration-300 hover:bg-primary hover:scale-110 ${isContinueWatchingOpen ? 'rotate-180' : ''} ${FOCUSABLE_CLASS}`}
                        >
                            <ChevronDown className="w-6 h-6 sm:w-8 sm:h-8" />
                        </Button>
                    </div>
                )}
            </div>

            {/* Continue Watching List Section */}
            {continueWatchingList.length > 0 && (
                <div className={`transition-all duration-700 ease-in-out overflow-hidden ${isContinueWatchingOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="px-6 md:px-12 py-12 pb-24 bg-gradient-to-b from-black to-[#0a0a0a]">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-1 h-8 bg-primary rounded-full shadow-[0_0_10px_rgba(220,38,38,0.5)]"></div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Continuar Assistindo</h2>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                            {continueWatchingList.map((item, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        if (item.content.category === 'nostalgia') {
                                            navigate(`/nostalgia/${item.contentId}`);
                                        } else {
                                            const path = `/watch/${item.contentId}${item.season ? `?season=${item.season}&episode=${item.episode}` : ''}`;
                                            navigate(path);
                                        }
                                        window.scrollTo(0, 0);
                                    }}
                                    className={`group/card relative cursor-pointer ${FOCUSABLE_CLASS}`}
                                >
                                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/5 shadow-xl transition-all duration-300 group-hover/card:scale-105 group-hover/card:border-primary/50 group-hover/card:shadow-primary/20">
                                        <img
                                            src={item.content.thumbnail_url}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110"
                                            alt={item.content.title}
                                        />

                                        {item.content.watch_provider && getProviderConfig(item.content.watch_provider, siteSettings?.providerLogos) && (
                                            <div className="absolute top-2 left-2 z-10 bg-black/40 backdrop-blur-md p-1 rounded-md border border-white/10 shadow-lg">
                                                <img 
                                                    src={getProviderConfig(item.content.watch_provider, siteSettings?.providerLogos)?.logo} 
                                                    alt="" 
                                                    className="h-5 w-auto object-contain" 
                                                />
                                            </div>
                                        )}

                                        {item.content.classification && (
                                            <div className={`absolute ${item.content.watch_provider ? 'top-[34px]' : 'top-2'} left-2 z-10 px-1 py-0.5 rounded text-[8px] font-bold text-white shadow-sm
                                                ${item.content.classification === 'L' ? 'bg-green-500' :
                                                item.content.classification === '10' ? 'bg-blue-400' :
                                                item.content.classification === '12' ? 'bg-yellow-400' :
                                                item.content.classification === '14' ? 'bg-orange-400' :
                                                item.content.classification === '16' ? 'bg-red-500' :
                                                item.content.classification === '18' ? 'bg-black' : 'bg-zinc-500'
                                            }`}>
                                                {item.content.classification}
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60"></div>

                                        {/* Play Overlay */}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
                                            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-2xl transform scale-75 group-hover/card:scale-100 transition-transform duration-300">
                                                <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60">
                                            <div
                                                className="h-full bg-primary shadow-[0_0_8px_rgba(220,38,38,0.8)]"
                                                style={{ width: `${item.percent}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <h3 className="text-sm font-bold text-white line-clamp-1 group-hover/card:text-primary transition-colors">
                                            {item.content.title}
                                        </h3>
                                        {item.season && (
                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                                                T{item.season} E{item.episode}
                                            </p>
                                        )}
                                        <p className="text-[10px] text-primary/80 font-bold mt-1">
                                            {item.percent}% assistido
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <Suspense fallback={null}>
                <DownloadModal
                    open={downloadModal.open}
                    onClose={() => setDownloadModal(prev => ({ ...prev, open: false }))}
                    downloadUrl={downloadModal.url}
                    downloads={downloadModal.downloads}
                    download_mode={downloadModal.download_mode}
                    title={downloadModal.title}
                    thumbnail={downloadModal.thumbnail}
                    contentId={content?.id || ''}
                />

                {showEpisodeSelector && content && content.episodes && (
                    <EpisodeSelector
                        open={showEpisodeSelector}
                        onClose={() => setShowEpisodeSelector(false)}
                        episodes={content.episodes}
                        title={content.title}
                        trailerUrl={content.trailer_url}
                        thumbnail={content.thumbnail_url}
                        onPlayEpisode={(ep) => {
                            setSearchParams({ season: ep.season.toString(), episode: ep.episode.toString() });
                            setShowEpisodeSelector(false);
                        }}
                    />
                )}
            </Suspense>
        </div>
    </div>
    );
};

export default Player;
