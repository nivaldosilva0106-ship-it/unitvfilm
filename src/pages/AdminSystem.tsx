import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getAllUsers, getAllContents, getPlans, getAllAds, firebaseConfig } from "@/lib/firebase";
import { Shield, Server, Database, Activity, HardDrive } from "lucide-react";

export default function AdminSystem() {
    const [stats, setStats] = useState({ users: 0, content: 0, plans: 0, ads: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([getAllUsers(), getAllContents(), getPlans(), getAllAds()])
            .then(([users, contents, plans, ads]) => {
                setStats({
                    users: users.length,
                    content: contents.length,
                    plans: plans.length,
                    ads: ads.length
                });
            })
            .catch(err => console.error("Erro ao carregar stats", err))
            .finally(() => setLoading(false));
    }, []);

    return (
        <AdminLayout title="Sistema e Credenciais">
            <div className="space-y-8 animate-in fade-in duration-500">

                {/* Stats Section */}
                <div>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-primary" /> Visão Geral do Sistema
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="bg-zinc-900/50 border-zinc-800">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-gray-400">Total Usuários</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-white">{stats.users}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-zinc-900/50 border-zinc-800">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-gray-400">Conteúdos</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-white">{stats.content}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-zinc-900/50 border-zinc-800">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-gray-400">Planos Ativos</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-white">{stats.plans}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-zinc-900/50 border-zinc-800">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-gray-400">Anúncios</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-white">{stats.ads}</div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Firebase Credentials Section */}
                <div>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Database className="w-5 h-5 text-primary" /> Credenciais do Servidor (Firebase)
                    </h2>
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle>Configuração Atual</CardTitle>
                            <CardDescription>
                                Estas são as credenciais que a aplicação está utilizando para conectar ao banco de dados e autenticação.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>API Key</Label>
                                    <div className="flex gap-2">
                                        <Input value={firebaseConfig.apiKey} readOnly className="bg-black/50 font-mono text-xs" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Project ID</Label>
                                    <Input value={firebaseConfig.projectId} readOnly className="bg-black/50 font-mono text-xs" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Auth Domain</Label>
                                    <Input value={`${firebaseConfig.projectId}.firebaseapp.com`} readOnly className="bg-black/50 font-mono text-xs" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Storage Bucket</Label>
                                    <Input value={`${firebaseConfig.projectId}.appspot.com`} readOnly className="bg-black/50 font-mono text-xs" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label>Database URL</Label>
                                    <Input value={firebaseConfig.databaseURL} readOnly className="bg-black/50 font-mono text-xs" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label>App ID</Label>
                                    <Input value={firebaseConfig.appId} readOnly className="bg-black/50 font-mono text-xs" />
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3">
                                <Shield className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <h4 className="font-medium text-yellow-500 text-sm">Atenção</h4>
                                    <p className="text-xs text-muted-foreground">
                                        Estas credenciais são definidas no código-fonte (`src/lib/firebase.ts`) durante a compilação do site.
                                        Para alterar o servidor conectado, você deve editar o arquivo e fazer o deploy novamente.
                                        Não é possível alterar a conexão do banco de dados em tempo de execução por motivos de segurança e arquitetura.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AdminLayout>
    );
}
