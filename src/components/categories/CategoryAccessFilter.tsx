import { Button } from "@/components/ui/button";
import { Lock, Unlock } from "lucide-react";
import { FOCUSABLE_CLASS } from "@/hooks/useSpatialNavigation";

interface CategoryAccessFilterProps {
    value: 'all' | 'free' | 'premium';
    onChange: (value: 'all' | 'free' | 'premium') => void;
}

export function CategoryAccessFilter({ value, onChange }: CategoryAccessFilterProps) {
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
                onClick={() => onChange('free')}
                className={`h-8 px-4 sm:px-3 rounded text-xs gap-1 whitespace-nowrap ${FOCUSABLE_CLASS} ${value === 'free' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:text-foreground'
                    }`}
                tabIndex={0}
            >
                <Unlock className="w-3 h-3" /> Grátis
            </Button>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange('premium')}
                className={`h-8 px-4 sm:px-3 rounded text-xs gap-1 whitespace-nowrap ${FOCUSABLE_CLASS} ${value === 'premium' ? 'bg-amber-600 text-white' : 'text-muted-foreground hover:text-foreground'
                    }`}
                tabIndex={0}
            >
                <Lock className="w-3 h-3" /> Premium
            </Button>
        </div>
    );
}
