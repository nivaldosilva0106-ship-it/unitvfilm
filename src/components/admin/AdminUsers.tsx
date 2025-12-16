import { useState, useEffect, useMemo } from 'react';
import { getAllUsers, getAccountProfiles } from '@/lib/firebase';
import { UserProfile, Profile } from '@/types/user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Users, Search, ChevronDown, ChevronUp, Shield, Lock, Baby, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export const AdminUsers = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'free' | 'premium'>('all');

    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [userProfiles, setUserProfiles] = useState<Profile[]>([]);
    const [loadingProfiles, setLoadingProfiles] = useState(false);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const data = await getAllUsers();
            // Sort by date desc (newest first) - assuming createdAt string is ISO
            const sorted = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setUsers(sorted);
        } catch (error) {
            console.error("Error loading users", error);
            toast.error("Erro ao carregar usuários");
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = async (userId: string) => {
        if (expandedUserId === userId) {
            setExpandedUserId(null);
            setUserProfiles([]);
        } else {
            setExpandedUserId(userId);
            setLoadingProfiles(true);
            try {
                const profiles = await getAccountProfiles(userId);
                setUserProfiles(profiles);
            } catch (e) {
                toast.error("Erro ao carregar perfis do usuário");
            } finally {
                setLoadingProfiles(false);
            }
        }
    };

    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            const matchesSearch = user.email.toLowerCase().includes(search.toLowerCase()) ||
                (user.id && user.id.toLowerCase().includes(search.toLowerCase()));
            const matchesType = filterType === 'all'
                ? true
                : filterType === 'premium' ? user.isPremium : !user.isPremium;

            return matchesSearch && matchesType;
        });
    }, [users, search, filterType]);

    return (
        <div className="p-6 md:p-10 space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-4 border-b border-border pb-6">
                <div className="p-3 bg-primary/10 rounded-xl">
                    <Users className="w-8 h-8 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                        Gerenciar Usuários
                    </h1>
                    <p className="text-muted-foreground mt-1">Visão geral e gestão de contas e perfis</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por email ou ID..."
                        className="pl-9 bg-input border-border"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex bg-muted p-1 rounded-lg">
                    {(['all', 'free', 'premium'] as const).map(type => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={cn(
                                "px-4 py-2 rounded-md text-sm font-medium transition-all capitalize",
                                filterType === type
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {type === 'all' ? 'Todos' : type}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50 border-b border-white/5">
                            <tr>
                                <th className="p-4 font-medium text-muted-foreground">Usuário / Email</th>
                                <th className="p-4 font-medium text-muted-foreground hidden md:table-cell">ID</th>
                                <th className="p-4 font-medium text-muted-foreground">Status</th>
                                <th className="p-4 font-medium text-muted-foreground hidden md:table-cell">Data Cadastro</th>
                                <th className="p-4 font-medium text-muted-foreground text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Carregando usuários...</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum usuário encontrado.</td></tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <>
                                        <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="p-4">
                                                <div className="font-medium text-white">{user.email}</div>
                                            </td>
                                            <td className="p-4 text-muted-foreground text-xs font-mono hidden md:table-cell">
                                                {user.id}
                                            </td>
                                            <td className="p-4">
                                                <span className={cn(
                                                    "px-2.5 py-0.5 rounded-full text-xs font-medium border",
                                                    user.isPremium
                                                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                                                        : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                                                )}>
                                                    {user.isPremium ? 'PREMIUM' : 'FREE'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-muted-foreground hidden md:table-cell">
                                                {new Date(user.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="p-4 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => toggleExpand(user.id)}
                                                    className="h-8 w-8 p-0"
                                                >
                                                    {expandedUserId === user.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </Button>
                                            </td>
                                        </tr>
                                        {expandedUserId === user.id && (
                                            <tr className="bg-white/[0.02]">
                                                <td colSpan={5} className="p-4 md:p-6 animate-in slide-in-from-top-2">
                                                    <div className="pl-4 md:pl-10 space-y-4 border-l-2 border-primary/20">
                                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                                            Perfis Cadastrados
                                                            {loadingProfiles && <span className="animate-pulse">...</span>}
                                                        </h3>

                                                        {!loadingProfiles && userProfiles.length === 0 && (
                                                            <p className="text-sm text-muted-foreground italic">Nenhum perfil criado nesta conta.</p>
                                                        )}

                                                        <div className="flex flex-wrap gap-4">
                                                            {userProfiles.map(profile => (
                                                                <div key={profile.id} className="flex items-center gap-3 bg-black/40 border border-white/10 p-3 rounded-lg min-w-[200px]">
                                                                    <img src={profile.avatarUrl} className="w-10 h-10 rounded-md object-cover" />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-sm font-medium text-white truncate">{profile.name}</div>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            {profile.isKids && (
                                                                                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 rounded border border-blue-500/20 flex items-center gap-0.5">
                                                                                    <Baby className="w-3 h-3" /> Kids
                                                                                </span>
                                                                            )}
                                                                            {profile.pin && (
                                                                                <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 rounded border border-yellow-500/20 flex items-center gap-0.5">
                                                                                    <Lock className="w-3 h-3" /> PIN
                                                                                </span>
                                                                            )}
                                                                            {!profile.isKids && !profile.pin && (
                                                                                <span className="text-[10px] text-gray-500">Padrão</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t border-border bg-muted/20 text-xs text-muted-foreground flex justify-between">
                    <span>Total de usuários: {users.length}</span>
                    <span>Exibindo: {filteredUsers.length}</span>
                </div>
            </div>
        </div>
    );
};
