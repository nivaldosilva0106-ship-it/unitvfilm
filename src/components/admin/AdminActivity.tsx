import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAllUsers, getActivityLogs } from "@/lib/firebase";
import { Activity, Users, MonitorPlay, Eye, Clock, CalendarDays, BarChart2 } from "lucide-react";

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

    // Auto-refresh every 30 seconds for realtime feel
    const interval = setInterval(fetchData, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Real-time calculation (active in last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const onlineUsers = users.filter(u => u.lastSeen && u.lastSeen >= fiveMinutesAgo);

  // Group current watching
  const currentlyWatching = onlineUsers
    .filter(u => u.currentWatchingTitle)
    .reduce((acc, curr) => {
      acc[curr.currentWatchingTitle] = (acc[curr.currentWatchingTitle] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const topWatching = Object.entries(currentlyWatching)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Historical calculation
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
      <div className="flex items-center justify-center p-12 text-white/50">
        <Activity className="w-8 h-8 animate-spin mr-3 text-primary" />
        Carregando dados de atividade...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Atividades</h2>
          <p className="text-white/60">Monitorização em tempo real e relatórios históricos de utilização.</p>
        </div>
        <div className="flex bg-white/5 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('realtime')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'realtime' ? 'bg-primary text-black' : 'text-white/70 hover:text-white'}`}
          >
            Tempo Real
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'history' ? 'bg-primary text-black' : 'text-white/70 hover:text-white'}`}
          >
            Histórico
          </button>
        </div>
      </div>

      {activeTab === 'realtime' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-[#111] border-white/10 shadow-xl overflow-hidden">
              <CardHeader className="bg-white/5 border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-green-500/20 p-2 rounded-full">
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                  </div>
                  <CardTitle className="text-white flex items-center gap-2">
                    Usuários Online
                    <Badge variant="outline" className="bg-white/5 border-white/10 text-white ml-2">
                      {onlineUsers.length} Ativos
                    </Badge>
                  </CardTitle>
                </div>
                <CardDescription className="text-white/50">Ativos nos últimos 5 minutos</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {onlineUsers.length === 0 ? (
                  <div className="p-12 text-center text-white/50 flex flex-col items-center">
                    <Users className="w-12 h-12 mb-4 opacity-20" />
                    <p>Nenhum utilizador ativo no momento.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
                    {onlineUsers.map(u => (
                      <div key={u.id} className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <img 
                            src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`} 
                            alt={u.displayName} 
                            className="w-10 h-10 rounded-full object-cover bg-white/10"
                          />
                          <div>
                            <p className="font-medium text-white flex items-center gap-2">
                              {u.displayName || "Usuário Anônimo"}
                              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm bg-white/10 text-white/70">
                                {u.deviceType || "Desconhecido"}
                              </span>
                            </p>
                            <p className="text-sm text-white/50 mt-1">{u.email || "Sem email"}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-start sm:items-end w-full sm:w-auto mt-2 sm:mt-0">
                          <Badge className="bg-primary/20 text-primary border-primary/20 mb-1">
                            {u.currentPage || "Navegando..."}
                          </Badge>
                          <span className="text-xs text-white/40">
                            Última ação: {new Date(u.lastSeen).toLocaleTimeString()}
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
            <Card className="bg-[#111] border-white/10 shadow-xl">
              <CardHeader className="bg-white/5 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/20 p-2 rounded-full text-blue-500">
                    <MonitorPlay className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-white">Assistidos Agora</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {topWatching.length === 0 ? (
                  <p className="text-white/50 text-center py-6 text-sm">Ninguém está a assistir conteúdos de momento.</p>
                ) : (
                  <div className="space-y-4">
                    {topWatching.map(([title, count], i) => (
                      <div key={title} className="flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <span className="text-white/40 font-mono font-bold text-sm">{i + 1}</span>
                          <p className="text-white/90 text-sm truncate max-w-[180px]" title={title}>{title}</p>
                        </div>
                        <Badge variant="secondary" className="bg-white/10 text-white shrink-0">
                          <Eye className="w-3 h-3 mr-1" /> {count}
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
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "Hoje", data: todayStats, icon: Clock, color: "text-blue-500", bg: "bg-blue-500/20" },
              { title: "Esta Semana", data: weekStats, icon: CalendarDays, color: "text-green-500", bg: "bg-green-500/20" },
              { title: "Este Mês", data: monthStats, icon: BarChart2, color: "text-purple-500", bg: "bg-purple-500/20" },
              { title: "Este Ano", data: yearStats, icon: Activity, color: "text-primary", bg: "bg-primary/20" }
            ].map((period, idx) => (
              <Card key={idx} className="bg-[#111] border-white/10 shadow-xl overflow-hidden">
                <CardHeader className="bg-white/5 border-b border-white/5 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-lg">{period.title}</CardTitle>
                    <div className={`${period.bg} p-2 rounded-full ${period.color}`}>
                      <period.icon className="w-4 h-4" />
                    </div>
                  </div>
                  <CardDescription className="text-white/50">Páginas mais visitadas</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {period.data.length === 0 ? (
                    <div className="p-8 text-center text-white/40 text-sm">
                      Sem dados registados.
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {period.data.map(([page, views], i) => {
                        const maxViews = period.data[0][1];
                        const percentage = Math.round((views / maxViews) * 100);
                        return (
                          <div key={page} className="p-4">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium text-white/90 truncate mr-4" title={page}>{page}</span>
                              <span className="text-xs font-bold text-white/50 bg-white/5 px-2 py-0.5 rounded">{views} views</span>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-1.5">
                              <div 
                                className="bg-primary h-1.5 rounded-full transition-all duration-1000"
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
        </div>
      )}
    </div>
  );
}
