import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAllContents } from "@/lib/firebase";
import { Header } from "@/components/Header";
import { Content } from "@/types/content";
import { Play, Pause, Volume2, VolumeX, Maximize, SkipForward, Info } from "lucide-react";
import { getAllContent } from "@/lib/tmdb"; // Fallback or utility if needed, but getAllContents is better
import { Button } from "@/components/ui/button";

export default function NostalgiaTube() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [contents, setContents] = useState<Content[]>([]);
    const [currentContent, setCurrentContent] = useState<Content | null>(null);
    const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    // Custom Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        const fetchContent = async () => {
            setLoading(true);
            try {
                const all = await getAllContents();
                const nostalgiaItems = all.filter(c => c.category === 'nostalgia');
                setContents(nostalgiaItems);

                if (id) {
                    const found = nostalgiaItems.find(c => c.id === id);
                    if (found) {
                        setCurrentContent(found);
                        setCurrentEpisodeIndex(0); // Default to first episode
                    }
                } else if (nostalgiaItems.length > 0) {
                    // Default to first item if no ID
                    setCurrentContent(nostalgiaItems[0]);
                    navigate(\`/nostalgia/\${nostalgiaItems[0].id}\`, { replace: true });
        }
      } catch (error) {
        console.error("Error fetching nostalgia content:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [id, navigate]);


  // Helper to extract YouTube ID
  const getYoutubeId = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const currentEpisode = currentContent?.episodes?.[currentEpisodeIndex];
  const videoUrl = currentEpisode?.url || currentContent?.video_url;
  const youtubeId = getYoutubeId(videoUrl);

  if (loading) {
      return (
          <div className="min-h-screen bg-[#141414] text-white">
              <Header />
              <div className="flex items-center justify-center h-[calc(100vh-80px)]">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
              </div>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white font-sans">
      <Header />
      
      <main className="pt-20 pb-10 container mx-auto px-4">
        
        {/* Player Section */}
        <div className="relative w-full max-w-5xl mx-auto bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10 aspect-video group">
             {youtubeId ? (
                 <div className="absolute inset-0 pointer-events-none">
                     <iframe
                        className="w-full h-full pointer-events-auto"
                        src={\`https://www.youtube.com/embed/\${youtubeId}?autoplay=0&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3\`}
                        title="Nostalgia Player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                     ></iframe>
                     {/* Overlay to block default YT interactions if needed or adding custom overlay controls */}
                 </div>
             ) : (
                 <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                     <p className="text-gray-500">Selecione um vídeo para assistir</p>
                 </div>
             )}

             {/* Custom Controls Overlay - Visual Only as controlling iframe is limited without API */}
             <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-4 pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-4 w-full">
                    {/* These controls are decorative/placeholders unless we hook up full YT IFrame API. 
                        For "functional internal icons", we need the YT Player API ref. 
                        For now, I'll add the visual structure. */}
                    <Button size="icon" variant="ghost" className="text-white hover:bg-white/20">
                        <Play className="w-6 h-6 fill-current" />
                    </Button>
                    
                    <div className="flex-1">
                        <div className="h-1 bg-white/30 rounded-full overflow-hidden">
                            <div className="h-full w-1/3 bg-primary"></div>
                        </div>
                    </div>

                    <Button size="icon" variant="ghost" className="text-white hover:bg-white/20">
                        <Volume2 className="w-6 h-6" />
                    </Button>
                     <Button size="icon" variant="ghost" className="text-white hover:bg-white/20">
                        <Maximize className="w-6 h-6" />
                    </Button>
                </div>
             </div>
        </div>

        {/* Info Section */}
        {currentContent && (
             <div className="max-w-5xl mx-auto mt-6 p-6 bg-[#1a1a1a] rounded-xl border border-white/5">
                <h1 className="text-2xl md:text-3xl font-bold mb-2 text-primary">{currentContent.title}</h1>
                {currentEpisode && (
                    <h2 className="text-xl text-gray-300 mb-4">{currentEpisode.title}</h2>
                )}
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-4">
                    {currentContent.year && <span>{currentContent.year}</span>}
                    {currentContent.duration && <span>{currentContent.duration}</span>}
                    {currentContent.genre && currentContent.genre.map((g, i) => (
                        <span key={i} className="px-2 py-0.5 bg-white/10 rounded-full text-xs">{g}</span>
                    ))}
                </div>

                <p className="text-gray-300 leading-relaxed mb-6">
                    {currentContent.description}
                </p>

                {currentContent.episodes && currentContent.episodes.length > 1 && (
                     <div className="space-y-2">
                         <h3 className="font-semibold text-white mb-2">Episódios</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                             {currentContent.episodes.map((ep, idx) => (
                                 <button 
                                    key={idx}
                                    onClick={() => setCurrentEpisodeIndex(idx)}
                                    className={\`text-left p-3 rounded-lg border transition-all flex items-center gap-3 \${
                                        currentEpisodeIndex === idx 
                                        ? 'bg-primary/20 border-primary text-primary' 
                                        : 'bg-zinc-900 border-zinc-800 text-gray-400 hover:bg-zinc-800'
                                    }\`}
                                 >
                                    <span className="text-xs font-mono opacity-50">{idx + 1}</span>
                                    <span className="truncate flex-1">{ep.title || \`Episódio \${idx + 1}\`}</span>
                                    {currentEpisodeIndex === idx && <Play className="w-3 h-3 fill-current" />}
                                 </button>
                             ))}
                         </div>
                     </div>
                )}
             </div>
        )}

        {/* "Nostalgia" Section - Playlist/Other Posts */}
        <div className="mt-12 max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <span className="text-primary">NOSTALGIA</span>
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                {contents.filter(c => c.id !== currentContent?.id).map((item) => (
                    <div 
                        key={item.id} 
                        className="group relative cursor-pointer"
                        onClick={() => {
                            navigate(\`/nostalgia/\${item.id}\`);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                    >
                        <div className="aspect-[2/3] rounded-lg overflow-hidden border border-white/5 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-primary/20">
                            <img 
                                src={item.thumbnail_url} 
                                alt={item.title} 
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Play className="w-12 h-12 text-white fill-current drop-shadow-lg scale-0 group-hover:scale-100 transition-transform duration-300 delay-75" />
                            </div>
                        </div>
                        <h3 className="mt-3 text-sm font-medium leading-tight text-white group-hover:text-primary transition-colors line-clamp-2">
                            {item.title}
                        </h3>
                    </div>
                ))}
            </div>
        </div>

      </main>
    </div>
  );
}
