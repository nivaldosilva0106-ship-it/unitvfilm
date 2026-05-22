import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Settings, SkipBack, SkipForward, Loader2, Captions, CaptionsOff,
  PictureInPicture, Scaling, Tv, Monitor
} from "lucide-react";
import Hls from "hls.js";
import { Slider } from "@/components/ui/slider";
import { createSecurePlaybackUrl, isProtectedUrl } from "@/lib/secure-url";
import { FOCUSABLE_CLASS } from "@/hooks/useSpatialNavigation";
import { useAppConfig } from "@/hooks/useAppConfig";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Gauge } from "lucide-react";

interface VideoPlayerProps {
  url: string;
  poster?: string;
  title?: string;
  onEnded?: () => void;
  onTimeUpdate?: (time: number, duration?: number) => void;
  autoPlay?: boolean;
  startTime?: number;
  subtitles?: string;
  isLive?: boolean;
  muted?: boolean;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
  initialPlaybackRate?: number;
  active?: boolean;
  watermarkUrl?: string;
  watermarkPosition?: string;
  watermarkSize?: number;
  initialAspect?: string;
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};export const VideoPlayer = ({
  url,
  poster,
  title,
  onEnded,
  onTimeUpdate,
  autoPlay = true,
  startTime = 0,
  subtitles,
  isLive = false,
  muted = false,
  onToggleFullscreen,
  isFullscreen: isFullscreenProp,
  initialPlaybackRate = 1,
  active = true,
  watermarkUrl,
  watermarkPosition,
  watermarkSize,
  initialAspect = 'contain'
}: VideoPlayerProps) => {
  const { isLiteMode } = useAppConfig();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pipWindowRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPiP, setIsPiP] = useState(false);

  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('unitv-player-volume');
      return saved !== null ? parseFloat(saved) : 1;
    }
    return 1;
  });
  const [isMuted, setIsMuted] = useState(muted);
  const [isFullscreenInternal, setIsFullscreenInternal] = useState(false);
  const [videoAspect, setVideoAspect] = useState<string>(initialAspect);
  
  const isFullscreen = isFullscreenProp !== undefined ? isFullscreenProp : isFullscreenInternal;
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [qualities, setQualities] = useState<{ height: number; level: number }[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [playbackRate, setPlaybackRate] = useState(initialPlaybackRate);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [showPlayFlash, setShowPlayFlash] = useState(false);
  const playFlashTimer = useRef<NodeJS.Timeout | null>(null);

  // Audio amplification refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [isAmplified, setIsAmplified] = useState(!isLiteMode);

  // State for resolved URL (for .txt files that contain redirect URLs)
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isTxtResolving, setIsTxtResolving] = useState(false);

  // Safeguard: Check if url exists before calling includes or other string methods
  if (!url) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Detect if URL needs secure proxying (to hide real URL from users)
  const needsSecureProxy = (u: string) => {
    if (!u) return false;
    // Already proxied/secured (either relative or absolute)
    if (u.includes('/api/stream-proxy') || u.includes('/api/secure-download')) return false;
    // Use the centralized protection check
    return isProtectedUrl(u);
  };

  // Use resolved URL if .txt was pre-fetched, otherwise use original
  const effectiveUrl = resolvedUrl || url;

  // Detect stream type — use path-only check to avoid query param false positives
  const effectivePath = effectiveUrl?.toLowerCase().split('?')[0] || '';
  const originalPath = url?.toLowerCase().split('?')[0] || '';
  const isTxtUrl = originalPath.endsWith('.txt');
  const isHLS = effectivePath.endsWith('.m3u8') || effectivePath.endsWith('.m3u') || 
    effectivePath.endsWith('.txt') || effectiveUrl?.includes('typezero.top');
  const isGoogleDrive = effectiveUrl?.includes('googleapis.com/drive') || effectiveUrl?.includes('drive.google.com');

  // Pre-fetch .txt URLs to detect if they contain a redirect URL or are actual manifests
  // Pre-fetch .txt URLs to detect if they contain a redirect URL or are actual manifests
  useEffect(() => {
    if (!isTxtUrl || resolvedUrl) return;

    const resolveTxtUrl = async () => {
      setIsTxtResolving(true);
      try {
        let text = '';
        let contentType = '';

        // Web/APK: Fetch through proxy to check the .txt content
        const proxyUrl = createSecurePlaybackUrl(url);
        const response = await fetch(proxyUrl, {
          headers: { 'Accept': '*/*' },
        });

        if (!response.ok) {
          console.warn('.txt pre-fetch failed, will try HLS directly:', response.status);
          setIsTxtResolving(false);
          return;
        }

        contentType = response.headers.get('content-type') || '';
        text = await response.text();
        
        // If the proxy/direct fetch already identified it as HLS manifest
        if (contentType.includes('mpegurl') || contentType.includes('application/vnd.apple')) {
          console.log('.txt is HLS manifest, proceeding normally');
          setIsTxtResolving(false);
          return;
        }

        const trimmed = text.trim();

        // If starts with #EXTM3U, it's a manifest — use as-is
        if (trimmed.startsWith('#EXTM3U') || trimmed.startsWith('#EXT-X-')) {
          console.log('.txt is HLS manifest content');
          setIsTxtResolving(false);
          return;
        }

        // If the .txt contains a single URL (redirect), use that URL instead
        const lines = trimmed.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
        if (lines.length >= 1) {
          const firstLine = lines[0].trim();
          if (firstLine.startsWith('http://') || firstLine.startsWith('https://')) {
            const resolvedPath = firstLine.toLowerCase().split('?')[0];
            // If the redirect URL is a direct stream, use it
            if (resolvedPath.endsWith('.m3u8') || resolvedPath.endsWith('.m3u') ||
                resolvedPath.endsWith('.mp4') || resolvedPath.endsWith('.ts') ||
                resolvedPath.endsWith('.mkv')) {
              console.log('.txt resolved to redirect URL:', firstLine.substring(0, 60) + '...');
              setResolvedUrl(firstLine);
              setIsTxtResolving(false);
              return;
            }
          }
        }

        // Default: treat as HLS manifest (most IPTV .txt files are disguised m3u8)
        console.log('.txt content could not be classified, treating as HLS');
      } catch (err) {
        console.warn('.txt pre-fetch error, will try HLS directly:', err);
      }
      setIsTxtResolving(false);
    };

    resolveTxtUrl();
  }, [url, isTxtUrl, resolvedUrl]);

  // Transform and SECURE video URL — the real URL is NEVER exposed
  const getVideoUrl = useCallback(() => {
    const targetUrl = resolvedUrl || url;

    if (isGoogleDrive) {
      // Extract file ID
      const match = targetUrl.match(/files\/([a-zA-Z0-9_-]+)/);
      if (match) {
        try {
          const urlObj = new URL(targetUrl);
          const params = new URLSearchParams(urlObj.search);
          if (!params.has('alt')) {
            params.set('alt', 'media');
          }
          const driveUrl = `https://www.googleapis.com/drive/v3/files/${match[1]}?${params.toString()}`;
          // Protect Google Drive URLs too
          return createSecurePlaybackUrl(driveUrl);
        } catch (e) {
          console.error("Error parsing Google Drive URL:", e);
          return createSecurePlaybackUrl(`https://www.googleapis.com/drive/v3/files/${match[1]}?alt=media`);
        }
      }
    }
    // Route ALL protected URLs through encrypted proxy
    if (needsSecureProxy(targetUrl)) {
      return createSecurePlaybackUrl(targetUrl);
    }
    return targetUrl;
  }, [url, resolvedUrl, isGoogleDrive, isTxtUrl]);

  // Initialize HLS or native video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Don't initialize while .txt URL is still being resolved
    if (isTxtUrl && isTxtResolving) return;

    const videoUrl = getVideoUrl();

    // Respect the muted prop on initialization (buffer player starts silent)
    video.muted = muted;
    video.volume = 1.0;

    const attemptPlay = async () => {
      try {
        await video.play();
        video.volume = 1.0;
        video.muted = false;
        setIsMuted(false);
        setVolume(1.0);
      } catch (err) {
        // If autoplay with sound fails, try muted autoplay then unmute
        console.log('Autoplay with sound blocked, trying muted...', err);
        video.muted = true;
        setIsMuted(true);
        try {
          await video.play();
        } catch (e) {
          console.log('Autoplay completely blocked', e);
        }
      }
    };

    if (isHLS && Hls.isSupported()) {
      let networkRetries = 0;
      const MAX_NETWORK_RETRIES = 5;
      let mediaErrorRetries = 0;
      const MAX_MEDIA_RETRIES = 3;

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: !isLiteMode,
        manifestLoadingTimeOut: isLiteMode ? 15000 : 30000,
        manifestLoadingMaxRetry: isLiteMode ? 3 : 5,
        manifestLoadingRetryDelay: isLiteMode ? 500 : 1000,
        levelLoadingTimeOut: isLiteMode ? 10000 : 20000,
        levelLoadingMaxRetry: isLiteMode ? 2 : 4,
        fragLoadingTimeOut: isLiteMode ? 15000 : 30000,
        fragLoadingMaxRetry: isLiteMode ? 3 : 6,
        xhrSetup: (xhr: XMLHttpRequest) => {
          xhr.withCredentials = false;
        },
      });

      hls.loadSource(videoUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        const levelsWithHeight = data.levels
          .filter(l => l.height)
          .map((l, i) => ({ height: l.height, level: i }))
          .sort((a, b) => b.height - a.height);
        setQualities(levelsWithHeight);

        if (autoPlay && active) {
          attemptPlay();
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setCurrentQuality(data.level);
      });

      // Smart fallback: if HLS fails, try multiple recovery strategies
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.warn('HLS fatal error:', data.type, data.details);
          
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < MAX_NETWORK_RETRIES) {
            networkRetries++;
            console.log(`HLS network retry ${networkRetries}/${MAX_NETWORK_RETRIES}`);
            setTimeout(() => hls.startLoad(), 1000 * networkRetries);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaErrorRetries < MAX_MEDIA_RETRIES) {
            mediaErrorRetries++;
            console.log(`HLS media error recovery ${mediaErrorRetries}/${MAX_MEDIA_RETRIES}`);
            hls.recoverMediaError();
          } else {
            // All retries exhausted — try fallback strategies
            console.log('HLS completely failed. Attempting fallback for:', effectiveUrl);
            hls.destroy();
            hlsRef.current = null;

            const targetUrl = resolvedUrl || url;
            const fallbackUrl = needsSecureProxy(targetUrl) ? createSecurePlaybackUrl(targetUrl) : targetUrl;

            // Strategy 1: Try loading as direct video source
            video.src = fallbackUrl;
            video.load();

            const onCanPlay = () => {
              video.removeEventListener('canplay', onCanPlay);
              video.removeEventListener('error', onFallbackError);
              if (autoPlay && active) attemptPlay();
            };

            const onFallbackError = () => {
              video.removeEventListener('canplay', onCanPlay);
              video.removeEventListener('error', onFallbackError);
              console.warn('Direct fallback also failed. Trying original URL without proxy...');

              // Strategy 2: Try the original URL directly (without proxy)
              // This works when the proxy is the problem (CORS, timeout, etc.)
              video.src = targetUrl;
              video.load();
              if (autoPlay && active) {
                video.play().catch(() => {
                  console.error('All playback strategies exhausted for:', targetUrl);
                });
              }
            };

            video.addEventListener('canplay', onCanPlay);
            video.addEventListener('error', onFallbackError);

            if (autoPlay && active) {
              attemptPlay();
            }
          }
        }
      });

      hlsRef.current = hls;

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = videoUrl;
      if (autoPlay && active) {
        attemptPlay();
      }
    } else {
      // Regular video (mp4, ts, etc.)
      video.src = videoUrl;
      if (autoPlay && active) {
        attemptPlay();
      }
    }
  }, [url, resolvedUrl, isHLS, isTxtResolving, autoPlay, getVideoUrl, effectiveUrl, active]);

  const hasSeekedRef = useRef<string | null>(null);

  // Playback rate management
  useEffect(() => {
    setPlaybackRate(initialPlaybackRate);
  }, [initialPlaybackRate]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Set start time once per URL to prevent repetition loops during sync
  useEffect(() => {
    const video = videoRef.current;
    if (video && startTime > 0 && duration > 0 && hasSeekedRef.current !== url) {
      // If we are at the end, don't seek to the end, loop to beginning
      const finalSeek = startTime >= duration ? startTime % duration : startTime;
      video.currentTime = finalSeek;
      hasSeekedRef.current = url; // Mark as seeked for THIS specific URL
    }
  }, [startTime, duration, url]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!active) return;
      setCurrentTime(video.currentTime);
      onTimeUpdate?.(video.currentTime, video.duration);
    };
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleEnded = () => {
      if (!active) return;
      setIsPlaying(false);
      onEnded?.();
    };
    const handleLoadedMetadata = () => {
      video.playbackRate = playbackRate;
      video.defaultPlaybackRate = playbackRate;
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [onEnded, onTimeUpdate, playbackRate, active]);

  // Sync active state with playback (pause if inactive)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (active) {
      if (autoPlay && video.paused) {
        video.play().catch(() => {});
      }
      // Delayed auto-unmute for smooth slot transition
      const t = setTimeout(() => {
        video.muted = false;
        setIsMuted(false);
        setVolume(1.0);
      }, 800);
      return () => clearTimeout(t);
    } else {
      video.pause();
      video.muted = true;
      setIsMuted(true);
    }
  }, [active, autoPlay]);

  // Create AudioContext only ONCE on first play to bypass browser autoplay rules
  // Disabled in lite mode for performance
  useEffect(() => {
    if (isLiteMode) return;
    const video = videoRef.current;
    if (!video) return;

    const initAudioContext = () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          sourceNodeRef.current = audioContextRef.current.createMediaElementSource(video);
          gainNodeRef.current = audioContextRef.current.createGain();

          sourceNodeRef.current.connect(gainNodeRef.current);
          gainNodeRef.current.connect(audioContextRef.current.destination);
          
          if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = isMuted || volume === 0 ? 0 : (isAmplified ? volume * 4.0 : volume);
          }
        }
      } catch (err) {
        console.warn("AudioContext failed (CORS or unsupported):", err);
      }
    };

    video.addEventListener('play', initAudioContext, { once: true });
  }, [isLiteMode]);

  // Sync volume with native video AND Web Audio API
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    video.volume = volume;
    video.muted = isMuted;

    if (!isLiteMode && gainNodeRef.current) {
       if (isMuted || volume === 0) {
           gainNodeRef.current.gain.value = 0;
       } else {
           gainNodeRef.current.gain.value = isAmplified ? volume * 4.0 : volume;
       }
    }
  }, [volume, isMuted, isAmplified, isLiteMode]);

  useEffect(() => {
    const handleFSChange = () => {
      const isFS = !!document.fullscreenElement;
      if (!onToggleFullscreen) {
        setIsFullscreenInternal(isFS);
      }

      // Unlock orientation when exiting fullscreen
      // @ts-ignore
      if (!isFS && window.screen?.orientation?.unlock) {
        // @ts-ignore
        try { window.screen.orientation.unlock(); } catch (e) {}
      }
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, [onToggleFullscreen]);

  // Persist volume
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('unitv-player-volume', volume.toString());
    }
  }, [volume]);



  // Hide controls on inactivity
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, isLiteMode ? 5000 : 3000);
    }
  }, [isPlaying, isLiteMode]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
    };
  }, [isPlaying, resetHideTimer]);

  // Control handlers
  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    // Resume AudioContext on user interaction
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (isPlaying) {
      video.pause();
    } else {
      // User interaction - unmute if was muted due to autoplay policy
      if (video.muted && isMuted) {
        video.muted = false;
        video.volume = volume || 1;
        setIsMuted(false);
      }
      try {
        await video.play();
        // Show play flash animation
        setShowPlayFlash(true);
        if (playFlashTimer.current) clearTimeout(playFlashTimer.current);
        playFlashTimer.current = setTimeout(() => setShowPlayFlash(false), 1200);
      } catch (e) {
        console.error("Play failed:", e);
      }
    }
  };

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    const newVolume = value[0];
    video.volume = newVolume;
    video.muted = newVolume === 0;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.muted = false;
      video.volume = volume || 1;
      setIsMuted(false);
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = async () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
      return;
    }

    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreenInternal(true);
        // @ts-ignore
        if (window.screen?.orientation?.lock) {
          // @ts-ignore
          await window.screen.orientation.lock("landscape").catch(() => {});
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreenInternal(false);
        // @ts-ignore
        if (window.screen?.orientation?.unlock) {
          // @ts-ignore
          window.screen.orientation.unlock();
        }
      }
    } catch (e) {
      console.error("Fullscreen failed:", e);
    }
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(video.currentTime + seconds, 0), duration);
  };

  const changeQuality = (level: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
      setCurrentQuality(level);
    }
  };

  const changePlaybackRate = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnterPiP = () => setIsPiP(true);
    const handleLeavePiP = () => setIsPiP(false);

    video.addEventListener('enterpictureinpicture', handleEnterPiP);
    video.addEventListener('leavepictureinpicture', handleLeavePiP);

    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnterPiP);
      video.removeEventListener('leavepictureinpicture', handleLeavePiP);
    };
  }, []);

  const toggleMiniPlayer = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error("Native PiP failed:", err);
    }
  };

  const getQualityLabel = (height: number): string => {
    if (height >= 2160) return '4K';
    if (height >= 1440) return '1440p';
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    if (height >= 360) return '360p';
    return `${height}p`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const aspectClasses: Record<string, string> = {
    'contain': 'w-full h-full object-contain',
    'cover': 'w-full h-full object-cover',
    '16:9': 'w-full h-full object-fill aspect-video',
    '21:9': 'w-full h-full object-fill aspect-[21/9]',
    '4:3': 'w-full h-full object-fill aspect-[4/3]',
  };

  return (
    <div
      id="video-player-container-root"
      ref={containerRef}
      className={`relative w-full h-full bg-black group ${isPiP ? 'fixed inset-0 z-[9999]' : ''} flex items-center justify-center ${(onToggleFullscreen ? isFullscreen : isFullscreenInternal) && !showControls ? 'cursor-none' : ''}`}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onClick={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'VIDEO') {
          togglePlay();
        }
      }}
    >
      <video
        ref={videoRef}
        className={aspectClasses[videoAspect] || aspectClasses['cover']}
        playsInline
        {...(isHLS || isGoogleDrive || needsSecureProxy(effectiveUrl) ? {} : { crossOrigin: 'anonymous' })}
        muted={isMuted}
        onContextMenu={(e) => e.preventDefault()}
      >
        {subtitles && showSubtitles && (
          <track
            label="Português"
            kind="subtitles"
            srcLang="pt"
            src={subtitles}
            default
          />
        )}
      </video>

      {/* Custom Poster Overlay - Fixes PiP native aspect ratio bug in Chromium */}
      {poster && currentTime === 0 && !isPlaying && (
        <img 
          src={poster} 
          alt="Poster" 
          className="absolute inset-0 w-full h-full object-contain bg-black pointer-events-none z-10 opacity-70"
        />
      )}

      {/* Buffering Indicator */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
          <Loader2 className="w-16 h-16 text-primary animate-spin" />
        </div>
      )}

      {/* Watermark Logo Overlay - Persistent visibility! */}
      {watermarkUrl && (
        <div className={`absolute ${
          watermarkPosition === 'top-left' ? 'top-6 left-6' :
          watermarkPosition === 'top-right' ? 'top-6 right-6' :
          watermarkPosition === 'bottom-right' ? 'bottom-6 right-6' :
          'bottom-6 left-6'
        } z-[25] pointer-events-none select-none transition-all duration-300 opacity-70`}>
           <img 
            src={watermarkUrl} 
            alt="Watermark" 
            style={{ height: `${(watermarkSize || 8) * 4}px` }}
            className="w-auto object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" 
           />
        </div>
      )}

      {/* Center Play Flash — shows briefly when play starts, then fades */}
      {showPlayFlash && !isLiteMode && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-16 h-16 md:w-24 md:h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center animate-ping-once">
            <Play className="w-8 h-8 md:w-12 md:h-12 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Center Play/Pause Button */}
      {showControls && !isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className={`w-16 h-16 md:w-20 md:h-20 ${isLiteMode ? 'bg-black/70' : 'bg-black/40 hover:bg-black/60 backdrop-blur-md'} rounded-full flex items-center justify-center ${isLiteMode ? '' : 'transition-all duration-300 hover:scale-110'} shadow-xl border border-white/10 pointer-events-auto ${FOCUSABLE_CLASS}`}
            tabIndex={0}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 md:w-10 md:h-10 text-white fill-white" />
            ) : (
              <Play className="w-8 h-8 md:w-10 md:h-10 text-white fill-white ml-2" />
            )}
          </button>
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-end ${isLiteMode ? '' : 'transition-opacity duration-300'} z-30 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
      >



        {/* Controls Container */}
        <div className="relative p-3 md:p-4 space-y-2 md:space-y-3">
          {/* Progress Bar */}
          {!isLive && (
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-white text-[10px] md:text-xs font-mono min-w-[35px] md:min-w-[45px]">
                {formatTime(currentTime)}
              </span>
              <div className="flex-1 group/progress">
                <Slider
                  value={[currentTime]}
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="cursor-pointer [&_[data-radix-slider-track]]:h-1 [&_[data-radix-slider-track]]:bg-white/30 [&_[data-radix-slider-range]]:bg-primary [&_[data-radix-slider-thumb]]:w-3 [&_[data-radix-slider-thumb]]:h-3 md:[&_[data-radix-slider-thumb]]:w-4 md:[&_[data-radix-slider-thumb]]:h-4 [&_[data-radix-slider-thumb]]:bg-primary [&_[data-radix-slider-thumb]]:border-2 [&_[data-radix-slider-thumb]]:border-white [&_[data-radix-slider-thumb]]:opacity-0 group-hover/progress:[&_[data-radix-slider-thumb]]:opacity-100 [&_[data-radix-slider-thumb]]:transition-opacity"
                />
              </div>
              <span className="text-white text-[10px] md:text-xs font-mono min-w-[35px] md:min-w-[45px] text-right">
                {formatTime(duration)}
              </span>
            </div>
          )}

          {/* Bottom Controls */}
          <div className="flex items-center justify-between">
            {/* Left Controls */}
            <div className="flex items-center gap-1 md:gap-2">
              <button
                onClick={togglePlay}
                className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors pointer-events-auto ${FOCUSABLE_CLASS}`}
                tabIndex={0}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 md:w-6 md:h-6 text-white fill-white" />
                ) : (
                  <Play className="w-4 h-4 md:w-6 md:h-6 text-white fill-white ml-0.5" />
                )}
              </button>

              {!isLive && (
                <>
                  <button
                    onClick={() => skip(-10)}
                    className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors pointer-events-auto ${FOCUSABLE_CLASS}`}
                    tabIndex={0}
                  >
                    <SkipBack className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </button>

                  <button
                    onClick={() => skip(10)}
                    className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors pointer-events-auto ${FOCUSABLE_CLASS}`}
                    tabIndex={0}
                  >
                    <SkipForward className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </button>
                </>
              )}

              {/* Volume — always visible */}
              <div className="flex items-center gap-1 md:gap-2">
                <button
                  onClick={toggleMute}
                  className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors pointer-events-auto ${FOCUSABLE_CLASS}`}
                  tabIndex={0}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  ) : (
                    <Volume2 className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  )}
                </button>
                <div className="w-16 md:w-20">
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={handleVolumeChange}
                    className="cursor-pointer [&_[data-radix-slider-track]]:h-1 [&_[data-radix-slider-track]]:bg-white/30 [&_[data-radix-slider-range]]:bg-primary [&_[data-radix-slider-thumb]]:w-3 [&_[data-radix-slider-thumb]]:h-3 [&_[data-radix-slider-thumb]]:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1 md:gap-2">

              {/* Aspect Ratio Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors pointer-events-auto ${FOCUSABLE_CLASS}`} title="Proporção da Tela" tabIndex={0}>
                    <Monitor className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  container={containerRef.current}
                  className={`bg-black/95 border-white/20 ${isLiteMode ? '' : 'backdrop-blur-xl'} min-w-[150px] md:min-w-[180px]`}
                >
                  <div className="px-2 py-1.5 text-[10px] md:text-xs text-gray-400 font-semibold">Proporção da Tela</div>
                  {[
                    { id: 'contain', label: 'Original (Padrão)' },
                    { id: 'cover', label: 'Preencher (Cortar)' },
                    { id: '16:9', label: '16:9 (TV)' },
                    { id: '21:9', label: '21:9 (Cinema)' },
                    { id: '4:3', label: '4:3 (Clássico)' },
                  ].map(aspect => (
                    <DropdownMenuItem
                      key={aspect.id}
                      onClick={() => setVideoAspect(aspect.id)}
                      className={`text-white hover:bg-white/10 cursor-pointer text-xs md:text-sm ${videoAspect === aspect.id ? 'bg-primary/20' : ''}`}
                    >
                      {aspect.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>


              {/* Settings Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors pointer-events-auto ${FOCUSABLE_CLASS}`} tabIndex={0}>
                    <Settings className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  container={containerRef.current}
                  className={`bg-black/95 border-white/20 ${isLiteMode ? '' : 'backdrop-blur-xl'} min-w-[150px] md:min-w-[180px]`}
                >
                  {/* Quality */}
                  {qualities.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-[10px] md:text-xs text-gray-400 font-semibold">Qualidade</div>
                      <DropdownMenuItem
                        onClick={() => changeQuality(-1)}
                        className={`text-white hover:bg-white/10 cursor-pointer text-xs md:text-sm ${currentQuality === -1 ? 'bg-primary/20' : ''}`}
                      >
                        Auto
                      </DropdownMenuItem>
                      {qualities.map(q => (
                        <DropdownMenuItem
                          key={q.level}
                          onClick={() => changeQuality(q.level)}
                          className={`text-white hover:bg-white/10 cursor-pointer text-xs md:text-sm ${currentQuality === q.level ? 'bg-primary/20' : ''}`}
                        >
                          {getQualityLabel(q.height)}
                        </DropdownMenuItem>
                      ))}
                      <div className="h-px bg-white/10 my-1" />
                    </>
                  )}

                  {/* Audio Volume Settings */}
                  {!isLiteMode && (
                    <>
                      <div className="px-2 py-1.5 text-[10px] md:text-xs text-gray-400 font-semibold mt-1">Áudio</div>
                      <DropdownMenuItem
                        onClick={(e) => {
                           e.preventDefault();
                           setIsAmplified(!isAmplified);
                        }}
                        className={`text-white hover:bg-white/10 cursor-pointer text-xs md:text-sm ${isAmplified ? 'bg-primary/20' : ''}`}
                      >
                        Amplificador (400%)
                        {isAmplified && <span className="ml-auto text-primary">✓</span>}
                      </DropdownMenuItem>
                      <div className="h-px bg-white/10 my-1" />
                    </>
                  )}

                  <div className="h-px bg-white/10 my-1" />
 
                  {/* Playback Speed Submenu */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="text-white hover:bg-white/10 cursor-pointer text-xs md:text-sm flex items-center gap-2 px-2 py-2">
                      <Gauge className="w-3.5 h-3.5 text-gray-400" />
                      <span>Velocidade</span>
                      <span className="ml-auto text-[10px] text-primary bg-primary/10 px-1.5 rounded">{playbackRate === 1 ? 'Normal' : `${playbackRate.toFixed(2)}x`}</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal container={containerRef.current}>
                      <DropdownMenuSubContent className={`bg-black/95 border-white/20 ${isLiteMode ? '' : 'backdrop-blur-xl'} min-w-[120px] max-h-[300px] overflow-y-auto custom-scrollbar`}>
                        {[0.25, 0.30, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                          <DropdownMenuItem
                            key={rate}
                            onClick={() => changePlaybackRate(rate)}
                            className={`text-white hover:bg-white/10 cursor-pointer text-xs md:text-sm ${playbackRate === rate ? 'bg-primary/20' : ''}`}
                          >
                            {rate === 1 ? 'Normal' : `${rate.toFixed(2)}x`}
                            {playbackRate === rate && <span className="ml-auto text-primary">✓</span>}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mini Player / Picture-in-Picture */}
              <button
                onClick={toggleMiniPlayer}
                className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors pointer-events-auto ${FOCUSABLE_CLASS}`}
                title="Mini Leitor (PiP)"
                tabIndex={0}
              >
                <PictureInPicture className={`w-4 h-4 md:w-5 md:h-5 ${isPiP ? 'text-primary' : 'text-white'}`} />
              </button>

              {/* Fullscreen */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors pointer-events-auto ${FOCUSABLE_CLASS}`}
                tabIndex={0}
              >
                {isFullscreen ? (
                  <Minimize className="w-4 h-4 md:w-5 md:h-5 text-white" />
                ) : (
                  <Maximize className="w-4 h-4 md:w-5 md:h-5 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
