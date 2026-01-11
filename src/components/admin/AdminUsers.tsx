import { useState, useEffect, useMemo } from 'react';
import { getAllUsers, getAccountProfiles, updateUserProfile, deleteUserProfile, getAllAdmins, setUserAsAdmin, removeUserAdmin } from '@/lib/firebase';
import { UserProfile, Profile } from '@/types/user';
import {
    Users,
    Search,
    Filter,
    ChevronDown,
    ChevronUp,
    Crown,
    User as UserIcon,
    Trash2,
    Mail,
    Calendar,
    Settings,
    Baby,
    Lock,
    Save,
    Shield,
    ShieldOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export const AdminUsers = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'premium' | 'free'>('all');
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [userProfiles, setUserProfiles] = useState<Profile[]>([]);
    const [loadingProfiles, setLoadingProfiles] = useState(false);

    // New state for profile limit editing
    const [savingLimit, setSavingLimit] = useState(false);
    const [limitOverride, setLimitOverride] = useState<string>('');
    
    // Admin management state
    const [adminUserIds, setAdminUserIds] = useState<string[]>([]);
    const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);

    useEffect(() => {
        loadUsers();
        loadAdmins();
    }, []);

    const loadUsers = async () => {
        try {
            const data = await getAllUsers();
            // Filter guests
            setUsers(data.filter(u => u.email !== 'convidado@unitvfilm.com'));
        } catch (e) {
            toast.error("Erro ao carregar usuários");
        } finally {
            setLoading(false);
        }
    };

    const loadAdmins = async () => {
        try {
            const admins = await getAllAdmins();
            setAdminUserIds(admins);
        } catch (e) {
            console.error('Error loading admins:', e);
        }
    };

    const handleToggleAdmin = async (userId: string, userEmail: string, isCurrentlyAdmin: boolean) => {
        // Prevent removing the original admin
        if (userEmail === 'www.nivaldo.com.ao@gmail.com' && isCurrentlyAdmin) {
            toast.error("Não é possível remover o admin original");
            return;
        }

        setTogglingAdmin(userId);
        try {
            if (isCurrentlyAdmin) {
                await removeUserAdmin(userId);
                toast.success(`${userEmail} removido como admin`);
            } else {
                await setUserAsAdmin(userId, userEmail);
                // Set unlimited profiles and premium for admin
                await updateUserProfile(userId, {
                    isPremium: true,
                    subscriptionTier: 'vip',
                    profilesLimitOverride: 999,
                    subscriptionExpiresAt: null // Never expires
                });
                toast.success(`${userEmail} agora é admin com acesso VIP ilimitado`);
            }
            await loadAdmins();
            await loadUsers();
        } catch (e) {
            toast.error("Erro ao alterar status de admin");
        } finally {
            setTogglingAdmin(null);
        }
    };

    const isUserAdminLocal = (userId: string) => adminUserIds.includes(userId);

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

                const user = users.find(u => u.id === userId);
                if (user) {
                    setLimitOverride(user.profilesLimitOverride?.toString() || '');
                }
            } catch (e) {
                toast.error("Erro ao carregar perfis do usuário");
            } finally {
                setLoadingProfiles(false);
            }
        }
    };

    const handleDeleteUser = async (userId: string, userEmail: string) => {
        if (window.confirm(`Tem certeza que deseja EXCLUIR o usuário ${userEmail}? Esta ação removerá todos os dados e perfis associados.`)) {
            try {
                await deleteUserProfile(userId);
                toast.success("Usuário removido com sucesso");
                loadUsers();
            } catch (e) {
                toast.error("Erro ao remover usuário");
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

    // Statistics calculator
    const stats = useMemo(() => {
        const total = users.length;
        const premium = users.filter(u => u.isPremium).length;
        return { total, premium, free: total - premium };
    }, [users]);

    return (
        <div className="p-4 sm:p-6 md:p-10 space-y-6 sm:space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-4 border-b border-border pb-6">
                <div className="p-3 bg-primary/10 rounded-xl">
                    <Users className="w-8 h-8 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Gerenciar Usuários</h1>
                    <p className="text-muted-foreground mt-1">Visualize e administre as contas de usuários registrados.</p>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/5 border border-white/10 p-5 rounded-2xl hover:bg-white/[0.08] transition-colors">
                    <div className="text-muted-foreground text-sm font-medium mb-1">Usuários Ativos</div>
                    <div className="text-3xl font-bold text-white">{stats.total}</div>
                </div>
                <div className="bg-primary/10 border border-primary/20 p-5 rounded-2xl">
                    <div className="text-primary/80 text-sm font-medium mb-1">Assinantes Premium</div>
                    <div className="text-3xl font-bold text-primary flex items-center gap-2">
                        {stats.premium}
                        <Crown className="w-6 h-6" />
                    </div>
                </div>
                <div className="bg-white/5 border border-white/10 p-5 rounded-2xl">
                    <div className="text-muted-foreground text-sm font-medium mb-1">Membros Grátis</div>
                    <div className="text-3xl font-bold text-white">{stats.free}</div>
                </div>
                {/* Guest counter card */}
                <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl">
                    <div className="text-amber-500/80 text-sm font-medium mb-1">Total de Visitantes</div>
                    <div className="text-3xl font-bold text-amber-500">
                        {users.length > 0 ? 'Carregando...' : '---'}
                        {/* We don't have direct access to all guest profiles easily without a query, 
                            but we can show a placeholder or perform a specific query if needed. 
                            For now, let's focus on registered users. */}
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="flex flex-col md:flex-row gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por e-mail ou ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 bg-black/40 border-white/10 focus:border-primary/50 transition-all"
                    />
                </div>
                <div className="flex gap-2">
                    <Select value={filterType} onValueChange={(val: any) => setFilterType(val)}>
                        <SelectTrigger className="w-[180px] bg-black/40 border-white/10">
                            <Filter className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Filtrar por tipo" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/10">
                            <SelectItem value="all">Todos os tipos</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                            <SelectItem value="free">Grátis</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={loadUsers} className="border-white/10 hover:bg-white/5">
                        Atualizar Lista
                    </Button>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/10 text-muted-foreground text-xs uppercase tracking-widest font-semibold">
                                <th className="px-4 sm:px-6 py-4">Usuário</th>
                                <th className="px-4 sm:px-6 py-4">Status</th>
                                <th className="px-6 py-4 hidden md:table-cell">Criado em</th>
                                <th className="px-6 py-4 hidden lg:table-cell">ID</th>
                                <th className="px-4 sm:px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                            <p className="text-muted-foreground">Carregando usuários...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                        Nenhum usuário encontrado com os filtros atuais.
                                    </td>
                                </tr>
                            ) : filteredUsers.map((user) => (
                                <>
                                    <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-4 sm:px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2.5 rounded-lg transition-colors hidden sm:block ${isUserAdminLocal(user.id) ? 'bg-amber-500/20' : 'bg-zinc-800 group-hover:bg-zinc-700'}`}>
                                                    {isUserAdminLocal(user.id) ? (
                                                        <Shield className="w-4 h-4 text-amber-400" />
                                                    ) : (
                                                        <Mail className="w-4 h-4 text-muted-foreground" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-white break-all sm:break-normal">{user.email}</span>
                                                        {isUserAdminLocal(user.id) && (
                                                            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 font-semibold">ADMIN</span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground">{user.name || 'Sem nome'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4">
                                            {isUserAdminLocal(user.id) ? (
                                                <div className="flex items-center gap-1.5 text-amber-400">
                                                    <Shield className="w-4 h-4" />
                                                    <span className="text-xs font-semibold uppercase tracking-wider">Admin VIP</span>
                                                </div>
                                            ) : user.isPremium ? (
                                                <div className="flex items-center gap-1.5 text-primary">
                                                    <Crown className="w-4 h-4" />
                                                    <span className="text-xs font-semibold uppercase tracking-wider">Premium</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <div className="w-2 h-2 rounded-full bg-zinc-600" />
                                                    <span className="text-xs font-medium uppercase tracking-wider">Membro Grátis</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 hidden md:table-cell">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span className="text-sm">
                                                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '---'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 hidden lg:table-cell">
                                            <code className="text-[11px] bg-black/40 px-2 py-1 rounded border border-white/5 text-muted-foreground">
                                                {user.id}
                                            </code>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleToggleAdmin(user.id, user.email, isUserAdminLocal(user.id))}
                                                    disabled={togglingAdmin === user.id || (user.email === 'www.nivaldo.com.ao@gmail.com' && isUserAdminLocal(user.id))}
                                                    className={`h-8 px-2 ${isUserAdminLocal(user.id) ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10' : 'text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10'}`}
                                                    title={isUserAdminLocal(user.id) ? 'Remover admin' : 'Tornar admin'}
                                                >
                                                    {togglingAdmin === user.id ? (
                                                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                    ) : isUserAdminLocal(user.id) ? (
                                                        <ShieldOff className="w-4 h-4" />
                                                    ) : (
                                                        <Shield className="w-4 h-4" />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => toggleExpand(user.id)}
                                                    className="h-8 px-2 text-muted-foreground hover:text-white"
                                                >
                                                    {expandedUserId === user.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteUser(user.id, user.email)}
                                                    disabled={user.email === 'www.nivaldo.com.ao@gmail.com'}
                                                    className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-30"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedUserId === user.id && (
                                        <tr className="bg-white/[0.02]">
                                            <td colSpan={5} className="p-4 md:p-6 animate-in slide-in-from-top-2">
                                                <div className="pl-4 md:pl-10 space-y-6 border-l-2 border-primary/20">

                                                    {/* Profiles Section */}
                                                    <div className="space-y-4">
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
                                                                    <img src={profile.avatar || profile.avatarUrl || '/placeholder-user.jpg'} className="w-10 h-10 rounded-md object-cover" />
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

                                                    {/* Account Summary */}
                                                    <div className="space-y-4">
                                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                                            Status da Conta
                                                        </h3>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <div className="bg-white/5 border border-white/10 p-4 rounded-lg space-y-2">
                                                                <div className="text-xs text-muted-foreground">Plano Atual</div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-semibold text-white">{user.planId?.toUpperCase() || 'FREE'}</span>
                                                                    {user.isPremium ? (
                                                                        <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded border border-green-500/20">PREMIUM</span>
                                                                    ) : (
                                                                        <span className="text-[10px] bg-gray-500/20 text-gray-400 px-1.5 py-0.5 rounded border border-gray-500/20">GRÁTIS</span>
                                                                    )}
                                                                </div>
                                                                {user.subscriptionExpiresAt && (
                                                                    <div className="text-[10px] text-muted-foreground">
                                                                        Expira em: {new Date(user.subscriptionExpiresAt).toLocaleDateString()}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="bg-white/5 border border-white/10 p-4 rounded-lg space-y-2">
                                                                <div className="text-xs text-muted-foreground">Limite de Perfis</div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-semibold text-white">
                                                                        {user.profilesLimitOverride !== undefined && user.profilesLimitOverride !== null
                                                                            ? user.profilesLimitOverride
                                                                            : 'Padrão do Plano'}
                                                                    </span>
                                                                    {(user.profilesLimitOverride !== undefined && user.profilesLimitOverride !== null) && (
                                                                        <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20">OVERRIDE ATIVO</span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[10px] text-muted-foreground">
                                                                    Atualmente {userProfiles.length} perfis criados
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Account Settings Section */}
                                                    <div className="pt-4 border-t border-white/5 space-y-4">
                                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                                            <Settings className="w-4 h-4" />
                                                            Configurações da Conta
                                                        </h3>

                                                        <div className="flex items-end gap-4 bg-black/40 border border-white/5 p-4 rounded-lg max-w-md">
                                                            <div className="flex-1 space-y-2">
                                                                <label className="text-xs text-muted-foreground">Limite de Perfis (Opcional)</label>
                                                                <Input
                                                                    type="number"
                                                                    placeholder="Padrão do plano"
                                                                    value={limitOverride}
                                                                    onChange={(e) => setLimitOverride(e.target.value)}
                                                                    className="h-9 bg-black/40 border-white/10"
                                                                />
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                disabled={savingLimit}
                                                                onClick={async () => {
                                                                    setSavingLimit(true);
                                                                    try {
                                                                        const val = limitOverride === '' ? null : parseInt(limitOverride);
                                                                        await updateUserProfile(user.id, {
                                                                            profilesLimitOverride: val
                                                                        });
                                                                        toast.success("Limite de perfis atualizado");
                                                                        loadUsers();
                                                                    } catch (error) {
                                                                        toast.error("Erro ao atualizar limite");
                                                                    } finally {
                                                                        setSavingLimit(false);
                                                                    }
                                                                }}
                                                            >
                                                                {savingLimit ? '...' : <Save className="w-4 h-4 mr-2" />}
                                                                {savingLimit ? 'Salvando' : 'Salvar'}
                                                            </Button>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground italic">
                                                            Deixe em branco para usar o limite padrão do plano do usuário.
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
