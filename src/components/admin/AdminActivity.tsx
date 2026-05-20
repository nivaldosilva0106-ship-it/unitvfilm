import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAllUsers, getActivityLogs } from "@/lib/firebase";
import { Activity, Users, MonitorPlay, Eye, Clock, CalendarDays, BarChart2, Radio, User, TrendingUp } from "lucide-react";

export function AdminActivity() {
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'realtime' | 'history'>('realtime');

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        const [usersData, logsData] = await Promise.all([
          getAllUsers(),
          getActivityLogs()
        ]);
        if (isMounted) {
          setUsers(usersData);
          setLogs(logsData);
        }
      } catch (err) {
        console.error("Error fetching activity data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    const interval = setInterval(fetchData, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const onlineUsers = users.filter(u => u.lastSeen && u.lastSeen >= fiveMinutesAgo);

  const currentlyWatching = onlineUsers
    .filter(u => u.currentWatchingTitle)
    .reduce((acc, curr) => {
      acc[curr.currentWatchingTitle] = (acc[curr.currentWatchingTitle] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const topWatching = Object.entries(currentlyWatching)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const getStatsForPeriod = (days: number) => {
    const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const periodLogs = logs.filter(log => log.createdAt >= periodStart || log.created_at >= periodStart);
    
    const pageViews = periodLogs.reduce((acc, log) => {
      const page = log.pageName || log.page_name || 'Desconhecido';
      acc[page] = (acc[page] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(pageViews)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  };

  const todayStats = getStatsForPeriod(1);
  const weekStats = getStatsForPeriod(7);
  const monthStats = getStatsForPeriod(30);
  const yearStats = getStatsForPeriod(365);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white/50 space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Activity className="w-6 h-6 text-primary animate-pulse" />
          </div>
        </div>
        <p className="text-sm font-medium tracking-wide animate-pulse">A CARREGAR DADOS DE ATIVIDADE...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-black/60 to-[#1a1a2e]/80 border border-white/5 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
          <Activity className="w-64 h-64 text-primary" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wider uppercase mb-2">
              <Radio className="w-3.5 h-3.5 animate-pulse" /> Monitorização
            </div>
            <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 tracking-tight">
              Painel de Atividades
            </h2>
            <p className="text-white/50 max-w-xl text-sm leading-relaxed">
              Acompanhe em tempo real quem está online, o que está a ser assistido e analise os padrões de tráfego históricos da plataforma.
            </p>
          </div>
          
          <div className="flex bg-black/40 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-inner">
            <button 
              onClick={() => setActiveTab('realtime')}
              className={`relative flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-300 ${activeTab === 'realtime' ? 'bg-primary text-black shadow-lg shadow-primary/20 scale-[1.02]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
            >
              <Activity className="w-4 h-4" /> Tempo Real
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`relative flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-300 ${activeTab === 'history' ? 'bg-primary text-black shadow-lg shadow-primary/20 scale-[1.02]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
            >
              <TrendingUp className="w-4 h-4" /> Histórico
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'realtime' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="xl:col-span-2 space-y-6">
            <Card className="bg-black/40 backdrop-blur-xl border-white/10 shadow-2xl overflow-hidden rounded-2xl group">
              <CardHeader className="bg-gradient-to-b from-white/[0.03] to-transparent border-b border-white/5 pb-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative flex items-center justify-center w-10 h-10 bg-green-500/10 rounded-xl border border-green-500/20">
                      <div className="absolute inset-0 rounded-xl bg-green-500/20 animate-ping opacity-20" />
                      <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.6)]" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-white tracking-wide">Usuários Online</CardTitle>
                      <CardDescription className="text-white/40 mt-1">Ativos nos últimos 5 minutos</CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 px-3 py-1">
                    <Users className="w-3.5 h-3.5 mr-1.5" /> {onlineUsers.length} Ativos
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {onlineUsers.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center justify-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                      <Users className="w-8 h-8 text-white/20" />
                    </div>
                    <p className="text-white/40 font-medium">Nenhum utilizador ativo neste exato momento.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto custom-scrollbar">
                    {onlineUsers.map(u => (
                      <div key={u.id} className="p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between hover:bg-white/[0.02] transition-colors duration-300">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                            <img 
                              src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`} 
                              alt={u.displayName} 
                              className="relative w-12 h-12 rounded-full object-cover border border-white/10 shadow-lg"
                            />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-[#111] rounded-full" />
                          </div>
                          <div>
                            <p className="font-semibold text-white/90 flex items-center gap-2">
                              {u.displayName || "Usuário Anônimo"}
                            </p>
                            <p className="text-sm text-white/40 mt-0.5 font-medium">{u.email || "Sem email"}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-start sm:items-end w-full sm:w-auto mt-2 sm:mt-0 gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-white/5 text-white/60 border border-white/10">
                              {u.deviceType || "Desconhecido"}
                            </span>
                            <Badge className="bg-primary/10 text-primary border-primary/20 font-medium">
                              {u.currentPage || "Navegando..."}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-white/30 font-medium uppercase tracking-wider flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Visto às {new Date(u.lastSeen).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-6">
            <Card className="bg-black/40 backdrop-blur-xl border-white/10 shadow-2xl rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-b from-white/[0.03] to-transparent border-b border-white/5 pb-5">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <MonitorPlay className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-white tracking-wide">A Assistir</CardTitle>
                    <CardDescription className="text-white/40 mt-1">Títulos mais populares agora</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {topWatching.length === 0 ? (
                  <div className="py-16 text-center flex flex-col items-center">
                    <MonitorPlay className="w-12 h-12 text-white/10 mb-3" />
                    <p className="text-white/40 text-sm">Ninguém está a assistir conteúdos de momento.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {topWatching.map(([title, count], i) => (
                      <div key={title} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`flex items-center justify-center w-6 h-6 rounded bg-white/5 text-xs font-bold ${i === 0 ? 'text-primary' : 'text-white/40'}`}>
                            {i + 1}
                          </div>
                          <p className="text-white/80 font-medium text-sm truncate max-w-[180px]" title={title}>{title}</p>
                        </div>
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-none shrink-0 font-bold">
                          <Eye className="w-3.5 h-3.5 mr-1.5" /> {count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {[
            { title: "Hoje", data: todayStats, icon: Clock, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
            { title: "Esta Semana", data: weekStats, icon: CalendarDays, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
            { title: "Este Mês", data: monthStats, icon: BarChart2, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
            { title: "Este Ano", data: yearStats, icon: Activity, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" }
          ].map((period, idx) => (
            <Card key={idx} className="bg-black/40 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden rounded-2xl hover:-translate-y-1 transition-transform duration-300">
              <CardHeader className="bg-gradient-to-b from-white/[0.02] to-transparent border-b border-white/5 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white/90 text-lg font-bold">{period.title}</CardTitle>
                    <CardDescription className="text-white/40 mt-1">Páginas mais visitadas</CardDescription>
                  </div>
                  <div className={`${period.bg} ${period.border} border p-2.5 rounded-xl ${period.color}`}>
                    <period.icon className="w-5 h-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {period.data.length === 0 ? (
                  <div className="p-10 text-center text-white/30 text-sm font-medium">
                    Sem dados registados.
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {period.data.map(([page, views], i) => {
                      const maxViews = period.data[0][1];
                      const percentage = Math.round((views / maxViews) * 100);
                      return (
                        <div key={page} className="p-4 hover:bg-white/[0.02] transition-colors">
                          <div className="flex justify-between items-center mb-2.5">
                            <span className="text-sm font-medium text-white/80 truncate mr-4" title={page}>{page}</span>
                            <Badge variant="outline" className="text-[10px] font-bold text-white/50 border-white/10 bg-white/5">
                              {views} views
                            </Badge>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-1.5 rounded-full transition-all duration-1000 bg-gradient-to-r ${
                                i === 0 ? 'from-primary to-blue-500' : 'from-white/20 to-white/40'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
