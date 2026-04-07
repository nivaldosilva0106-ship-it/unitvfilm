import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Settings, SkipBack, SkipForward, Loader2, Captions, CaptionsOff,
  PictureInPicture
} from "lucide-react";
import Hls from "hls.js";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  watermarkSize
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pipWindowRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPiP, setIsPiP] = useState(false);

  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(muted);
  const [isFullscreenInternal, setIsFullscreenInternal] = useState(false);
  
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
  const [isAmplified, setIsAmplified] = useState(true); // Enabled by default to boost low volume content like TikToks

  // Detect stream type
  const isHLS = url.includes('.m3u8') || url.includes('m3u8') || url.toLowerCase().includes('.txt') || url.includes('typezero.top');
  const isGoogleDrive = url.includes('googleapis.com/drive') || url.includes('drive.google.com');

  // Transform Google Drive URL if needed
  const getVideoUrl = useCallback(() => {
    if (isGoogleDrive) {
      // Extract file ID
      const match = url.match(/files\/([a-zA-Z0-9_-]+)/);
      if (match) {
        try {
          const urlObj = new URL(url);
          const params = new URLSearchParams(urlObj.search);

          // Force alt=media if not present
          if (!params.has('alt')) {
            params.set('alt', 'media');
          }

          // Return constructed URL with ALL original params (including key)
          return `https://www.googleapis.com/drive/v3/files/${match[1]}?${params.toString()}`;
        } catch (e) {
          console.error("Error parsing Google Drive URL:", e);
          // Fallback to simple construction if URL parsing fails
          return `https://www.googleapis.com/drive/v3/files/${match[1]}?alt=media`;
        }
      }
    }
    return url;
  }, [url, isGoogleDrive]);

  // Initialize HLS or native video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

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
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
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
  }, [url, isHLS, autoPlay, getVideoUrl]);

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
    } else {
      video.pause();
    }
  }, [active, autoPlay]);

  // Create AudioContext only ONCE on first play to bypass browser autoplay rules
  useEffect(() => {
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
          
          // Initial sync
          if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = isMuted || volume === 0 ? 0 : (isAmplified ? volume * 4.0 : volume);
          }
        }
      } catch (err) {
        console.warn("AudioContext failed (CORS or unsupported):", err);
      }
    };

    video.addEventListener('play', initAudioContext, { once: true });
  }, []);

  // Sync volume with native video AND Web Audio API
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    // Fallback: update native element volume
    video.volume = volume;
    video.muted = isMuted;

    // Update Web Audio API if active
    if (gainNodeRef.current) {
       if (isMuted || volume === 0) {
           gainNodeRef.current.gain.value = 0;
       } else {
           gainNodeRef.current.gain.value = isAmplified ? volume * 4.0 : volume;
       }
    }
  }, [volume, isMuted, isAmplified]);

  useEffect(() => {
    const handleFSChange = () => {
      if (!onToggleFullscreen) {
        setIsFullscreenInternal(!!document.fullscreenElement);
      }
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, [onToggleFullscreen]);



  // Hide controls on inactivity
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

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
      } else {
        await document.exitFullscreen();
        setIsFullscreenInternal(false);
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

  const toggleMiniPlayer = async () => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    // Check if the experimental Document Picture-in-Picture API is available
    // and if we are not already in PiP.
    // This API allows us to move an entire HTML element into an always-on-top window.
    if ("documentPictureInPicture" in window && !isPiP) {
      try {
        const pipOptions = {
          width: container.clientWidth || 640,
          height: container.clientHeight || 360,
        };

        // @ts-ignore
        const pipWindow = await window.documentPictureInPicture.requestWindow(pipOptions);
        pipWindowRef.current = pipWindow;

        // Move the player container into the PiP window.
        pipWindow.document.body.append(container);
        setIsPiP(true);

        // Copy styles from the main window into the PiP window's document.
        [...document.styleSheets].forEach((styleSheet) => {
          try {
            if (styleSheet.cssRules) {
              const newStyle = pipWindow.document.createElement("style");
              [...styleSheet.cssRules].forEach((rule) => {
                newStyle.appendChild(pipWindow.document.createTextNode(rule.cssText));
              });
              pipWindow.document.head.appendChild(newStyle);
            } else if (styleSheet.href) {
              const newLink = pipWindow.document.createElement("link");
              newLink.rel = "stylesheet";
              newLink.href = styleSheet.href;
              pipWindow.document.head.appendChild(newLink);
            }
          } catch (e) {
            // Some cross-origin stylesheets might throw. Fallback by creating a link.
            if (styleSheet.href) {
                const newLink = pipWindow.document.createElement("link");
                newLink.rel = "stylesheet";
                newLink.href = styleSheet.href;
                pipWindow.document.head.appendChild(newLink);
            }
          }
        });

        // Ensure background is correct
        pipWindow.document.body.style.backgroundColor = "black";
        pipWindow.document.body.style.margin = "0";
        pipWindow.document.body.style.overflow = "hidden";

        // Returning from PiP: When the PiP window is closed by the user,
        // move the container back to the main document.
        pipWindow.addEventListener("pagehide", () => {
          const originalParent = document.getElementById("video-player-container-root");
          if (originalParent) {
            originalParent.append(container);
          }
          setIsPiP(false);
          pipWindowRef.current = null;
        });

      } catch (err) {
        console.error("Document PiP failed, falling back to Video PiP:", err);
        try {
           if (video.requestPictureInPicture) await video.requestPictureInPicture();
        } catch (e) { console.error("Native PiP fallback failed:", e); }
      }
    } else if (document.pictureInPictureElement) {
       // Exit native PiP
       await document.exitPictureInPicture();
    } else if (isPiP && pipWindowRef.current) {
       // Exit Document PiP
       pipWindowRef.current.close();
    } else if (video.requestPictureInPicture) {
       // Fallback to native Video PiP if Document PiP isn't supported or active.
       await video.requestPictureInPicture();
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

  return (
    <div
      id="video-player-container-root"
      ref={containerRef}
      className={`relative w-full h-full bg-black group ${isPiP ? 'fixed inset-0 z-[9999]' : ''}`}
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
        className="w-full h-full object-cover"
        playsInline
        crossOrigin="anonymous"
        muted={isMuted}
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
      {showPlayFlash && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-16 h-16 md:w-24 md:h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center animate-ping-once">
            <Play className="w-8 h-8 md:w-12 md:h-12 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Center Play Button (when paused) */}
      {!isPlaying && !isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <button
            onClick={togglePlay}
            className="w-14 h-14 md:w-20 md:h-20 bg-primary/90 hover:bg-primary rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-2xl"
          >
            <Play className="w-6 h-6 md:w-10 md:h-10 text-white fill-white ml-1" />
          </button>
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 z-30 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
      >
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

        {/* Title */}
        {title && (
          <div className="absolute top-4 left-4 right-4">
            <h2 className="text-white font-bold text-sm md:text-lg drop-shadow-lg line-clamp-1">{title}</h2>
          </div>
        )}

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
                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
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
                    className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                  >
                    <SkipBack className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </button>

                  <button
                    onClick={() => skip(10)}
                    className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                  >
                    <SkipForward className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </button>
                </>
              )}

              {/* Volume — always visible */}
              <div className="flex items-center gap-1 md:gap-2">
                <button
                  onClick={toggleMute}
                  className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
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


              {/* Settings Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors">
                    <Settings className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-black/95 border-white/20 backdrop-blur-xl min-w-[150px] md:min-w-[180px]"
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
                  <div className="px-2 py-1.5 text-[10px] md:text-xs text-gray-400 font-semibold mt-1">Áudio</div>
                  <DropdownMenuItem
                    onClick={(e) => {
                       e.preventDefault(); // keep dropdown open when toggling
                       setIsAmplified(!isAmplified);
                    }}
                    className={`text-white hover:bg-white/10 cursor-pointer text-xs md:text-sm ${isAmplified ? 'bg-primary/20' : ''}`}
                  >
                    Amplificador (400%)
                    {isAmplified && <span className="ml-auto text-primary">✓</span>}
                  </DropdownMenuItem>
                  <div className="h-px bg-white/10 my-1" />

                  {/* Playback Speed */}
                  <div className="px-2 py-1.5 text-[10px] md:text-xs text-gray-400 font-semibold">Velocidade</div>
                  {[0.25, 0.30, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                    <DropdownMenuItem
                      key={rate}
                      onClick={() => changePlaybackRate(rate)}
                      className={`text-white hover:bg-white/10 cursor-pointer text-xs md:text-sm ${playbackRate === rate ? 'bg-primary/20' : ''}`}
                    >
                      {rate === 1 ? 'Normal' : `${rate.toFixed(2)}x`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
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
