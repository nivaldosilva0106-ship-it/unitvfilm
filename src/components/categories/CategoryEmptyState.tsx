interface CategoryEmptyStateProps {
    message?: string;
}

export function CategoryEmptyState({ message = "Nenhum conteúdo encontrado com esses filtros." }: CategoryEmptyStateProps) {
    return (
        <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">{message}</p>
        </div>
    );
}
