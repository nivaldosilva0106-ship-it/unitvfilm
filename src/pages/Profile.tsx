import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User, Mail, Crown, LogOut, Settings, Plus, Lock,
  Edit2, Trash2, Shield, Globe, Bell, Smartphone, Camera, Check
} from "lucide-react";
import { toast } from "sonner";
import { SUBSCRIPTION_BENEFITS } from "@/types/payment";
import { getAccountProfiles, getAvatars, createAccountProfile, updateAccountProfile, deleteAccountProfile } from "@/lib/firebase";
import { Profile as UserProfileType, Avatar } from "@/types/user";
import { cn } from "@/lib/utils";

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile: accountProfile, currentProfile, logout, selectProfile } = useAuth();

  // State
  const [profiles, setProfiles] = useState<UserProfileType[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfileType | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form State
  const [formName, setFormName] = useState("");
  const [formAvatar, setFormAvatar] = useState("");
  const [formIsKids, setFormIsKids] = useState(false);
  const [formPin, setFormPin] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // System Avatars
  const [systemAvatars, setSystemAvatars] = useState<Avatar[]>([]);

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      navigate("/login");
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      const [profilesData, avatarsData] = await Promise.all([
        getAccountProfiles(user.uid),
        getAvatars()
      ]);
      setProfiles(profilesData);
      setSystemAvatars(avatarsData);
    } catch (error) {
      console.error("Error loading profile data", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoadingProfiles(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logout realizado com sucesso!");
      navigate("/login");
    } catch (error) {
      toast.error("Erro ao fazer logout");
    }
  };

  const openEditModal = (p: UserProfileType | null) => {
    if (p) {
      setEditingProfile(p);
      setFormName(p.name);
      setFormAvatar(p.avatarUrl);
      setFormIsKids(p.isKids);
      setFormPin(p.pin || "");
      setIsAddingNew(false);
    } else {
      // Adding new
      setEditingProfile(null);
      setFormName("");
      setFormAvatar(systemAvatars[0]?.url || "");
      setFormIsKids(false);
      setFormPin("");
      setIsAddingNew(true);
    }
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!formName.trim()) { toast.error("Nome é obrigatório"); return; }

    setFormLoading(true);
    try {
      const data = {
        name: formName,
        avatarUrl: formAvatar,
        isKids: formIsKids,
        pin: formPin.trim() || undefined
      };

      if (isAddingNew) {
        await createAccountProfile(user.uid, data);
        toast.success("Perfil criado!");
      } else if (editingProfile) {
        await updateAccountProfile(user.uid, editingProfile.id, data);
        toast.success("Perfil atualizado!");

        // If editing current profile, update context logic? 
        // Context might need refresh or page reload. 
        // For now, simpler to just reload profiles list.
        if (currentProfile?.id === editingProfile.id) {
          // Update local currentProfile if needed or let user switch
          // We will just reload data. The header might stay stale until refresh?
          // Ideally AuthContext should expose a way to refresh.
          // Or we can manually re-select.
          const updated = { ...editingProfile, ...data };
          selectProfile(updated);
        }
      }
      setShowEditModal(false);
      loadData();
    } catch (e) {
      toast.error("Erro ao salvar perfil");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!editingProfile || !user) return;
    if (confirm(`Excluir perfil ${editingProfile.name}?`)) {
      setFormLoading(true);
      try {
        await deleteAccountProfile(user.uid, editingProfile.id);
        toast.success("Perfil removido");
        setShowEditModal(false);
        loadData();
        if (currentProfile?.id === editingProfile.id) {
          // Force switch or logout?
          // Navigate to selection
          navigate("/profiles");
        }
      } catch (e) {
        toast.error("Erro ao remover");
      } finally {
        setFormLoading(false);
      }
    }
  };

  if (!user || !accountProfile) return null;

  return (
    <div className="min-h-screen bg-[#141414] text-white font-sans">
      <Header />

      <div className="container mx-auto px-4 py-24 max-w-6xl animate-in fade-in duration-500">

        {/* Cabeçalho do Perfil Ativo */}
        <div className="mb-12 flex flex-col md:flex-row items-center md:items-start gap-8 border-b border-zinc-800 pb-10">
          <div className="relative group">
            <img
              src={currentProfile?.avatarUrl || "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"}
              alt="Avatar"
              className="w-32 h-32 md:w-40 md:h-40 rounded shadow-2xl object-cover ring-4 ring-transparent group-hover:ring-primary/50 transition-all"
            />
            <button
              onClick={() => openEditModal(currentProfile)}
              className="absolute bottom-2 right-2 bg-black/80 p-2 rounded-full border border-white/20 hover:bg-primary hover:text-white transition-colors"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 text-center md:text-left space-y-4">
            <div>
              <h1 className="text-3xl md:text-5xl font-bold mb-2">{currentProfile?.name || "Usuário"}</h1>
              <div className="flex items-center justify-center md:justify-start gap-3">
                <Badge variant="outline" className="border-green-500/50 text-green-400 bg-green-500/10 uppercase tracking-wider text-xs px-2 py-0.5">
                  {accountProfile.isPremium ? "Premium" : "Free"}
                </Badge>
                {currentProfile?.isKids && (
                  <Badge variant="outline" className="border-blue-500/50 text-blue-400 bg-blue-500/10 uppercase tracking-wider text-xs px-2 py-0.5">Kids</Badge>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
              <Button onClick={() => openEditModal(currentProfile)} variant="outline" className="border-white/20 hover:bg-white/10 text-white gap-2">
                <Edit2 className="w-4 h-4" /> Editar Perfil
              </Button>
              <Button onClick={() => navigate("/profiles")} variant="outline" className="border-white/20 hover:bg-white/10 text-white gap-2">
                <User className="w-4 h-4" /> Trocar de Perfil
              </Button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-[300px_1fr] gap-12">

          {/* Coluna Esquerda: Info da Conta */}
          <div className="space-y-8">
            <div className="bg-[#1f1f1f] rounded-xl p-6 border border-zinc-800 space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-200">
                <Settings className="w-5 h-5 text-primary" /> Dados da Conta
              </h2>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-zinc-800 p-2 rounded-lg"><Mail className="w-4 h-4 text-gray-400" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 uppercase">Email</p>
                    <p className="text-sm font-medium truncate">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-zinc-800 p-2 rounded-lg"><Crown className="w-4 h-4 text-gray-400" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 uppercase">Plano</p>
                    <p className="text-sm font-medium">{accountProfile.isPremium ? "Premium 4K" : "Básico com Anúncios"}</p>
                    {accountProfile.subscriptionExpiresAt && (
                      <p className="text-[10px] text-gray-500">Expira em: {new Date(accountProfile.subscriptionExpiresAt).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              </div>

              <Button
                onClick={() => navigate("/payment")}
                className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border-none"
              >
                Gerenciar Plano
              </Button>
            </div>

            <Button
              onClick={handleLogout}
              variant="destructive"
              className="w-full justify-start pl-6 gap-3 bg-red-950/30 text-red-500 hover:bg-red-900/50 hover:text-red-400 border border-red-900/30"
            >
              <LogOut className="w-4 h-4" /> Sair da Conta
            </Button>
          </div>

          {/* Coluna Direita: Dashboard */}
          <div className="space-y-10">

            {/* Perfis */}
            <section className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2">Perfis desta conta</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {profiles.map(p => (
                  <div key={p.id} className="relative group bg-[#1f1f1f] rounded-lg overflow-hidden border border-transparent hover:border-zinc-600 transition-all p-3 text-center cursor-default">
                    <img src={p.avatarUrl} className="w-20 h-20 mx-auto rounded mb-3 object-cover group-hover:scale-105 transition-transform" />
                    <div className="font-medium text-sm truncate px-1">{p.name}</div>
                    {p.isKids && <div className="text-[10px] text-blue-400 mt-1">Kids</div>}

                    {/* Overlay Actions */}
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity p-2">
                      <Button size="sm" variant="secondary" className="h-8 w-full text-xs" onClick={() => openEditModal(p)}>Editar</Button>
                      {p.pin && <div className="flex items-center gap-1 text-[10px] text-yellow-500"><Lock className="w-3 h-3" /> PIN Ativo</div>}
                    </div>
                  </div>
                ))}

                {profiles.length < 5 && (
                  <button onClick={() => openEditModal(null)} className="flex flex-col items-center justify-center bg-[#1f1f1f] border border-dashed border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors p-3 min-h-[140px]">
                    <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center mb-2">
                      <Plus className="w-6 h-6 text-gray-400" />
                    </div>
                    <span className="text-sm text-gray-400 font-medium">Adicionar</span>
                  </button>
                )}
              </div>
            </section>

            {/* Grid de Configurações */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Segurança */}
              <section className="bg-[#1f1f1f] p-6 rounded-xl border border-zinc-800 space-y-4">
                <h3 className="flex items-center gap-2 font-semibold text-gray-200">
                  <Shield className="w-5 h-5 text-primary" /> Segurança
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                    <div className="text-sm">
                      <p className="font-medium">Senha</p>
                      <p className="text-xs text-gray-500">Alterar senha da conta</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 text-xs border-zinc-700 hover:bg-zinc-800">Alterar</Button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                    <div className="text-sm">
                      <p className="font-medium">2FA</p>
                      <p className="text-xs text-gray-500">Autenticação em 2 etapas</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 text-xs border-zinc-700 hover:bg-zinc-800">Ativar</Button>
                  </div>
                </div>
              </section>

              {/* Preferências */}
              <section className="bg-[#1f1f1f] p-6 rounded-xl border border-zinc-800 space-y-4">
                <h3 className="flex items-center gap-2 font-semibold text-gray-200">
                  <Globe className="w-5 h-5 text-primary" /> Preferências
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                    <div className="text-sm">
                      <p className="font-medium">Idioma</p>
                      <p className="text-xs text-gray-500">Português (BR)</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 text-xs hover:bg-zinc-800">Editar</Button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                    <div className="text-sm">
                      <p className="font-medium">Conteúdo Adulto</p>
                      <p className="text-xs text-gray-500">Bloqueado para perfis Kids</p>
                    </div>
                    <div className="h-4 w-4 bg-green-500 rounded-full"></div>
                  </div>
                </div>
              </section>
            </div>

          </div>
        </div>

      </div>

      {/* Edit Profile Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-[#141414] border-zinc-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isAddingNew ? "Adicionar Perfil" : "Editar Perfil"}</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-[auto_1fr] gap-8 py-6">
            <div className="space-y-4">
              <img src={formAvatar || "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"} className="w-32 h-32 rounded shadow-lg object-cover mx-auto" />
              <div className="h-32 overflow-y-auto grid grid-cols-3 gap-2 p-1 custom-scrollbar">
                {systemAvatars.map(av => (
                  <img
                    key={av.id}
                    src={av.url}
                    onClick={() => setFormAvatar(av.url)}
                    className={cn("w-full aspect-square rounded cursor-pointer border-2 hover:border-white transition-all", formAvatar === av.url ? "border-primary" : "border-transparent")}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Nome do Perfil</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} className="bg-zinc-900 border-zinc-800" placeholder="Nome" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={formIsKids} onChange={e => setFormIsKids(e.target.checked)} className="w-5 h-5 bg-zinc-800 border-none rounded accent-primary" id="kids-edit" />
                <Label htmlFor="kids-edit">Perfil Infantil</Label>
              </div>
              <div className="space-y-2 pt-4 border-t border-zinc-800">
                <Label>PIN de Bloqueio (4 dígitos)</Label>
                <Input
                  value={formPin}
                  onChange={e => {
                    if (e.target.value.length <= 4 && /^\d*$/.test(e.target.value)) setFormPin(e.target.value);
                  }}
                  className="bg-zinc-900 border-zinc-800 w-32 tracking-widest text-center"
                  placeholder="----"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {!isAddingNew && (
              <Button variant="ghost" onClick={handleDeleteProfile} className="text-red-500 hover:bg-red-950 hover:text-red-400 mr-auto">Excluir Perfil</Button>
            )}
            <Button variant="outline" onClick={() => setShowEditModal(false)} className="border-zinc-700 hover:bg-zinc-800 text-gray-300">Cancelar</Button>
            <Button onClick={handleSaveProfile} disabled={formLoading} className="bg-white text-black hover:bg-gray-200">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
