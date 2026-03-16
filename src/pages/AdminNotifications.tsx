import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    createNotification,
    createGlobalNotification,
    getAllUsers,
    NotificationItem,
    GlobalNotification
} from "@/lib/firebase";
import { Megaphone, Send, Users, Globe, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDatabase, ref, onValue } from "firebase/database";

export default function AdminNotifications() {
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const [targetType, setTargetType] = useState<"all" | "user">("all");
    const [selectedUser, setSelectedUser] = useState("");
    const [users, setUsers] = useState<{ id: string, email: string }[]>([]);
    const [sending, setSending] = useState(false);

    // History
    const [history, setHistory] = useState<GlobalNotification[]>([]);

    useEffect(() => {
        getAllUsers().then(list => setUsers(list.map(u => ({ id: u.id, email: u.email }))));

        const db = getDatabase();
        const unsub = onValue(ref(db, 'globalNotifications'), snapshot => {
            const data = snapshot.val() || {};
            const list = Object.values(data) as GlobalNotification[];
            setHistory(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        });
        return () => unsub();
    }, []);

    const handleSend = async () => {
        if (!title || !message) {
            toast.error("Preencha título e mensagem");
            return;
        }

        setSending(true);
        try {
            if (targetType === "all") {
                await createGlobalNotification({
                    type: "system",
                    title,
                    message,
                });
                toast.success("Notificação global enviada!");
            } else {
                if (!selectedUser) {
                    toast.error("Selecione um usuário");
                    setSending(false);
                    return;
                }
                await createNotification(selectedUser, {
                    type: "admin_message",
                    title,
                    message,
                });
                toast.success("Notificação enviada para o usuário!");
            }
            setTitle("");
            setMessage("");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao enviar notificação");
        } finally {
            setSending(false);
        }
    };

    return (
        <AdminLayout title="Gerenciar Notificações">
            <div className="space-y-6 animate-in fade-in duration-500">
                <Tabs defaultValue="send" className="w-full">
                    <TabsList className="bg-zinc-900 border-zinc-800 w-full flex-wrap h-auto p-1">
                        <TabsTrigger value="send" className="flex-1">Enviar Notificação</TabsTrigger>
                        <TabsTrigger value="history" className="flex-1">Histórico Global</TabsTrigger>
                    </TabsList>

                    <TabsContent value="send" className="mt-6">
                        <Card className="bg-zinc-900 border-zinc-800 max-w-2xl">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Megaphone className="w-5 h-5 text-primary" /> Nova Notificação
                                </CardTitle>
                                <CardDescription>Envie mensagens para todos os usuários ou para uma conta específica.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Destinatário</Label>
                                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                                        <Button
                                            variant={targetType === 'all' ? 'default' : 'outline'}
                                            onClick={() => setTargetType('all')}
                                            className="flex-1 justify-start sm:justify-center"
                                        >
                                            <Globe className="w-4 h-4 mr-2" /> Todos (Global)
                                        </Button>
                                        <Button
                                            variant={targetType === 'user' ? 'default' : 'outline'}
                                            onClick={() => setTargetType('user')}
                                            className="flex-1 justify-start sm:justify-center"
                                        >
                                            <Users className="w-4 h-4 mr-2" /> Usuário Específico
                                        </Button>
                                    </div>
                                </div>

                                {targetType === 'user' && (
                                    <div className="space-y-2 animate-in slide-in-from-top-2">
                                        <Label>Selecionar Usuário</Label>
                                        <Select value={selectedUser} onValueChange={setSelectedUser}>
                                            <SelectTrigger className="bg-black/50 border-white/10">
                                                <SelectValue placeholder="Busque por email..." />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[200px]">
                                                {users.map(u => (
                                                    <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label>Título</Label>
                                    <Input
                                        placeholder="Ex: Atualização do Sistema"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        className="bg-black/50 border-white/10"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Mensagem</Label>
                                    <Textarea
                                        placeholder="Digite sua mensagem aqui..."
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                        className="bg-black/50 border-white/10 min-h-[100px]"
                                    />
                                </div>

                                <Button
                                    onClick={handleSend}
                                    disabled={sending}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                                >
                                    {sending ? "Enviando..." : (
                                        <>
                                            <Send className="w-4 h-4 mr-2" /> Enviar Notificação
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="history" className="mt-6">
                        <Card className="bg-zinc-900 border-zinc-800">
                            <CardHeader>
                                <CardTitle>Histórico de Notificações Globais</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {history.length === 0 ? (
                                        <p className="text-gray-500 text-sm">Nenhuma notificação global enviada.</p>
                                    ) : history.map(item => (
                                        <div key={item.id} className="p-4 bg-black/30 rounded-lg border border-white/5 flex gap-4">
                                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                                <Megaphone className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white text-sm">{item.title}</h4>
                                                <p className="text-gray-400 text-sm mt-1">{item.message}</p>
                                                <span className="text-xs text-gray-600 mt-2 block">
                                                    {new Date(item.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </AdminLayout>
    );
}
