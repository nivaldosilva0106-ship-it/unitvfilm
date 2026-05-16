import { Button } from "@/components/ui/button";
import { Film, MonitorPlay, Tv, PlayCircle } from "lucide-react";
import { FOCUSABLE_CLASS } from "@/hooks/useSpatialNavigation";

interface CategoryTypeFilterProps {
    value: 'all' | 'movie' | 'series' | 'tv' | 'nostalgia';
    onChange: (value: 'all' | 'movie' | 'series' | 'tv' | 'nostalgia') => void;
}

export function CategoryTypeFilter({ value, onChange }: CategoryTypeFilterProps) {
    return (
        <div className="flex bg-card/50 rounded-lg p-1 border border-border w-full sm:w-auto overflow-x-auto scrollbar-hide">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange('all')}
                className={`h-8 px-4 sm:px-3 rounded text-xs whitespace-nowrap ${FOCUSABLE_CLASS} ${value === 'all' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                tabIndex={0}
            >
                Todos
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange('movie')}
                className={`h-8 px-4 sm:px-3 rounded text-xs gap-1 whitespace-nowrap ${FOCUSABLE_CLASS} ${value === 'movie' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                tabIndex={0}
            >
                <Film className="w-3 h-3" /> Filmes
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange('series')}
                className={`h-8 px-4 sm:px-3 rounded text-xs gap-1 whitespace-nowrap ${FOCUSABLE_CLASS} ${value === 'series' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                tabIndex={0}
            >
                <Tv className="w-3 h-3" /> Séries
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange('tv')}
                className={`h-8 px-4 sm:px-3 rounded text-xs gap-1 whitespace-nowrap ${FOCUSABLE_CLASS} ${value === 'tv' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                tabIndex={0}
            >
                <MonitorPlay className="w-3 h-3" /> TV
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange('nostalgia')}
                className={`h-8 px-4 sm:px-3 rounded text-xs gap-1 whitespace-nowrap ${FOCUSABLE_CLASS} ${value === 'nostalgia' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                tabIndex={0}
            >
                <PlayCircle className="w-3 h-3" /> Nostalgia
            </Button>
        </div>
    );
}
