import { MarqueeContentRow } from "@/components/MarqueeContentRow";
import { Content } from "@/types/content";

interface CategoryGenreSectionProps {
    filteredContent: Content[];
    genres: string[];
    onPlayContent: (content: Content) => void;
    onInfoContent: (content: Content) => void;
    onDetailsContent: (content: Content) => void;
    onDownloadContent: (content: Content) => void;
}

export function CategoryGenreSection({
    filteredContent,
    genres,
    onPlayContent,
    onInfoContent,
    onDetailsContent,
    onDownloadContent,
}: CategoryGenreSectionProps) {
    // Determine all available genres from content + predefined list
    const dynamicGenres = new Set<string>(genres);
    filteredContent.forEach(c => {
        if (c.genre && Array.isArray(c.genre)) {
            c.genre.forEach(g => dynamicGenres.add(g));
        }
    });
    const sortedGenres = Array.from(dynamicGenres).sort();

    // Prioritize predefined genres order, then append others
    const finalGenres = [...genres];
    sortedGenres.forEach(g => {
        if (!finalGenres.includes(g)) finalGenres.push(g);
    });

    // Render genre rows
    const genreRows = finalGenres.map(genre => {
        const genreContents = filteredContent.filter(c => {
            // Check structured genre tag first
            if (c.genre && Array.isArray(c.genre) && c.genre.some(g => g.toLowerCase() === genre.toLowerCase())) {
                return true;
            }
            // Fallback to text search
            return c.description?.toLowerCase().includes(genre.toLowerCase()) ||
                c.title.toLowerCase().includes(genre.toLowerCase());
        });

        if (genreContents.length === 0) return null;

        return (
            <MarqueeContentRow
                key={genre}
                title={genre}
                contents={genreContents}
                onPlayContent={onPlayContent}
                onInfoContent={onInfoContent}
                onDetailsContent={onDetailsContent}
                onDownloadContent={onDownloadContent}
            />
        );
    });

    // Find uncategorized content
    const uncategorized = filteredContent.filter(c => {
        const hasGenreTag = c.genre && c.genre.length > 0;
        if (hasGenreTag) return false;

        // If no tags, did it match any keyword?
        const matchesKeyword = genres.some(g =>
            c.description?.toLowerCase().includes(g.toLowerCase()) ||
            c.title.toLowerCase().includes(g.toLowerCase())
        );
        return !matchesKeyword;
    });

    return (
        <div className="space-y-4">
            {genreRows}

            {uncategorized.length > 0 && (
                <MarqueeContentRow
                    key="outros"
                    title="Outros"
                    contents={uncategorized}
                    onPlayContent={onPlayContent}
                    onInfoContent={onInfoContent}
                    onDownloadContent={onDownloadContent}
                />
            )}
        </div>
    );
}
