import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trash2, MessageCircle, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { addComment, getComments, deleteComment, getUserProfile } from "@/lib/firebase";
import type { Comment } from "@/types/comment";

interface CommentsSectionProps {
    contentId: string;
}

export const CommentsSection = ({ contentId }: CommentsSectionProps) => {
    const { user, currentProfile } = useAuth(); // getUserProfile is now imported directly
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Pagination state (simple client-side for now, as requested "simple")
    const [visibleCount, setVisibleCount] = useState(10);

    useEffect(() => {
        loadComments();
    }, [contentId]);

    const loadComments = async () => {
        try {
            const data = await getComments(contentId);
            setComments(data);
        } catch (error) {
            console.error("Erro ao carregar comentários:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!user) {
            toast.error("Você precisa estar logado para comentar.");
            return;
        }
        if (!newComment.trim()) return;

        if (newComment.length > 500) {
            toast.error("O comentário não pode exceder 500 caracteres.");
            return;
        }

        setSubmitting(true);
        try {
            // Fetch full user profile wrapper if needed, but we pass currentProfile (sub-profile) or fallbacks
            // Note: addComment helper expects UserProfile, but we might have a sub-profile.
            // We need to ensure we pass the right data. 
            // The helper I wrote uses 'accountProfile' as optional 4th arg. 
            // We need to pass the main 'user' object (which is User from firebase/auth) enriched as UserProfile?
            // Actually, useAuth 'user' is Firebase User. 'userProfile' state in useAuth?
            // Let's assume we can pass the raw data needed.

            // We need to fetch the main user profile to pass to addComment if we don't have it handy in context
            // But acts mostly on 'user.uid'.
            const fullUserProfile = await getUserProfile(user.uid);

            if (fullUserProfile) {
                const added = await addComment(contentId, newComment, fullUserProfile, currentProfile);
                setComments([added, ...comments]);
                setNewComment("");
                toast.success("Comentário publicado!");
            }

        } catch (error) {
            toast.error("Erro ao publicar comentário.");
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (commentId: string) => {
        try {
            await deleteComment(contentId, commentId);
            setComments(comments.filter(c => c.id !== commentId));
            toast.success("Comentário removido.");
        } catch (error) {
            toast.error("Erro ao remover comentário.");
        }
    };

    const visibleComments = comments.slice(0, visibleCount);

    return (
        <div className="mt-12 max-w-4xl">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <MessageCircle className="w-6 h-6" /> Comentários <span className="text-sm font-normal text-gray-400">({comments.length})</span>
            </h3>

            {/* Input Section */}
            <div className="bg-white/5 rounded-xl p-6 mb-8 border border-white/10">
                {user ? (
                    <div className="flex gap-4">
                        <Avatar className="w-10 h-10 border border-white/10">
                            <AvatarImage src={currentProfile?.avatar || currentProfile?.avatarUrl || user.photoURL || undefined} />
                            <AvatarFallback>{(currentProfile?.name?.[0] || user.email?.[0] || 'U').toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-3">
                            <Textarea
                                placeholder="Escreva um comentário sobre este conteúdo..."
                                className="bg-black/20 border-white/10 text-white min-h-[100px] focus:border-primary/50 placeholder:text-gray-500"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                maxLength={500}
                            />
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">{newComment.length}/500</span>
                                <Button
                                    onClick={handleAddComment}
                                    disabled={submitting || !newComment.trim()}
                                    className="bg-primary hover:bg-primary/90 text-white"
                                    size="sm"
                                >
                                    {submitting ? 'Publicando...' : <><Send className="w-4 h-4 mr-2" /> Publicar</>}
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <p className="text-gray-400 mb-2">Faça login para participar da discussão.</p>
                        {/* Logic to redirect to login could be added here */}
                    </div>
                )}
            </div>

            {/* Comments List */}
            <div className="space-y-4">
                {loading ? (
                    <p className="text-gray-500">Carregando comentários...</p>
                ) : comments.length > 0 ? (
                    <>
                        {visibleComments.map((comment) => (
                            <div key={comment.id} className="group flex gap-4 p-4 rounded-lg bg-black/20 border border-white/5 hover:border-white/10 transition-colors">
                                <Avatar className="w-10 h-10 border border-white/10">
                                    <AvatarImage src={comment.userAvatar} />
                                    <AvatarFallback>{comment.userName.substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <span className="font-semibold text-white mr-2">{comment.userName}</span>
                                            <span className="text-xs text-gray-500">
                                                {formatDistanceToNow(comment.timestamp, { addSuffix: true, locale: ptBR })}
                                            </span>
                                        </div>
                                        {user && user.uid === comment.userId && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleDelete(comment.id)}
                                                title="Apagar comentário"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{comment.text}</p>
                                </div>
                            </div>
                        ))}

                        {comments.length > visibleCount && (
                            <div className="text-center pt-4">
                                <Button variant="outline" onClick={() => setVisibleCount(prev => prev + 10)} className="border-white/10 text-gray-300 hover:bg-white/5">
                                    Carregar mais comentários
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-8 bg-white/5 rounded-lg border border-white/5 border-dashed">
                        <MessageCircle className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                        <p className="text-gray-400">Seja o primeiro a comentar!</p>
                    </div>
                )}
            </div>
        </div>
    );
};
