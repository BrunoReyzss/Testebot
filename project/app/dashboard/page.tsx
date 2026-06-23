'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/use-settings';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Stats, Log, MonitoredRequest } from '@/lib/types';
import {
  TrendingUp,
  Send,
  CheckCircle2,
  XCircle,
  DollarSign,
  Activity,
  Clock,
  Terminal,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function DashboardPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [recentRequests, setRecentRequests] = useState<MonitoredRequest[]>([]);
  const [chartData, setChartData] = useState<{ time: string; requests: number; offers: number }[]>([]);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [statsRes, logsRes, reqRes] = await Promise.all([
      supabase.from('stats').select('*').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    if (statsRes.data) setStats(statsRes.data as Stats);
    if (logsRes.data) setLogs(logsRes.data as Log[]);
    if (reqRes.data) setRecentRequests(reqRes.data as MonitoredRequest[]);

    // Build chart data from last 24h requests
    const now = new Date();
    const buckets: { time: string; requests: number; offers: number }[] = [];
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      buckets.push({
        time: `${d.getHours().toString().padStart(2, '0')}:00`,
        requests: 0,
        offers: 0,
      });
    }
    const { data: allReq } = await supabase
      .from('requests')
      .select('created_at, status')
      .eq('user_id', user.id)
      .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
    if (allReq) {
      for (const r of allReq as MonitoredRequest[]) {
        const d = new Date(r.created_at);
        const hour = d.getHours();
        const bucket = buckets[23 - (now.getHours() - hour + 24) % 24];
        if (bucket) {
          bucket.requests++;
          if (r.status === 'offer_sent' || r.status === 'accepted') bucket.offers++;
        }
      }
    }
    setChartData(buckets);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscriptions
  useEffect(() => {
    if (!user) return;

    const statsChannel = supabase
      .channel('stats-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stats', filter: `user_id=eq.${user.id}` },
        (payload) => setStats(payload.new as Stats))
      .subscribe();

    const logsChannel = supabase
      .channel('logs-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setLogs((prev) => [payload.new as Log, ...prev].slice(0, 50));
        })
      .subscribe();

    const reqChannel = supabase
      .channel('req-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `user_id=eq.${user.id}` },
        () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(statsChannel);
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(reqChannel);
    };
  }, [user, loadData]);

  const isRunning = settings?.bot_running ?? false;

  const statCards = [
    {
      label: 'Total de Solicitações',
      value: stats?.total_requests ?? 0,
      icon: Activity,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Ofertas Enviadas',
      value: stats?.total_offers_sent ?? 0,
      icon: Send,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Ofertas Aceitas',
      value: stats?.total_accepted ?? 0,
      icon: CheckCircle2,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Receita Total',
      value: `$${(stats?.total_revenue ?? 0).toFixed(2)}`,
      icon: DollarSign,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
    },
  ];

  const logLevelColor: Record<string, string> = {
    info: 'text-blue-400',
    success: 'text-green-400',
    warn: 'text-yellow-400',
    error: 'text-red-400',
  };

  return (
    <div className="p-6 space-y-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral do sistema de automação
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex items-center gap-2 rounded-lg border px-3 py-1.5',
            isRunning ? 'border-primary/30 bg-primary/5' : 'border-border bg-secondary/50'
          )}>
            <div className={cn(
              'h-2 w-2 rounded-full',
              isRunning ? 'bg-primary animate-pulse-dot' : 'bg-muted-foreground'
            )} />
            <span className={cn('text-xs font-semibold', isRunning ? 'text-primary' : 'text-muted-foreground')}>
              {isRunning ? 'Sistema Ativo' : 'Sistema Parado'}
            </span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label} className="border-border/50 bg-card/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold mt-1">{card.value}</p>
                </div>
                <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg', card.bg)}>
                  <card.icon className={cn('h-5 w-5', card.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart + Recent requests */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Atividade nas últimas 24 horas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorOffers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(197 37% 50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(197 37% 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                  <XAxis dataKey="time" stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(215 20% 55%)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(222 47% 8%)',
                      border: '1px solid hsl(217 33% 17%)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area type="monotone" dataKey="requests" stroke="hsl(142 71% 45%)" strokeWidth={2} fill="url(#colorRequests)" />
                  <Area type="monotone" dataKey="offers" stroke="hsl(197 37% 50%)" strokeWidth={2} fill="url(#colorOffers)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Solicitações Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px] pr-4">
              {recentRequests.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Nenhuma solicitação ainda
                </div>
              ) : (
                <div className="space-y-2">
                  {recentRequests.map((req) => (
                    <div key={req.id} className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium truncate">{req.service_type ?? 'N/A'}</span>
                        <StatusBadge status={req.status} />
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{req.description ?? 'Sem descrição'}</p>
                      {req.calculated_price != null && (
                        <p className="text-xs font-semibold text-primary mt-1">${req.calculated_price.toFixed(2)}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Real-time console */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Console em Tempo Real</CardTitle>
            <div className="ml-auto flex items-center gap-1.5">
              <div className={cn('h-2 w-2 rounded-full', isRunning ? 'bg-primary animate-pulse-dot' : 'bg-muted-foreground')} />
              <span className="text-xs text-muted-foreground">{isRunning ? 'Ao vivo' : 'Inativo'}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] overflow-y-auto scrollbar-thin rounded-lg border border-border bg-background/50 p-4 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Aguardando atividade do sistema...
              </div>
            ) : (
              <div className="space-y-1.5">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 animate-slide-in-right">
                    <span className="text-muted-foreground shrink-0">
                      {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                    </span>
                    <span className={cn('shrink-0 font-semibold uppercase', logLevelColor[log.level])}>
                      [{log.level}]
                    </span>
                    <span className="text-muted-foreground shrink-0">[{log.category}]</span>
                    <span className="text-foreground">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    filtered: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    priced: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    offer_sent: 'bg-primary/10 text-primary border-primary/20',
    accepted: 'bg-green-500/10 text-green-400 border-green-500/20',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
    expired: 'bg-muted text-muted-foreground border-border',
  };
  const labels: Record<string, string> = {
    new: 'Nova',
    filtered: 'Filtrada',
    priced: 'Precificada',
    offer_sent: 'Oferta Enviada',
    accepted: 'Aceita',
    rejected: 'Rejeitada',
    expired: 'Expirada',
  };
  return (
    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', styles[status] ?? styles.new)}>
      {labels[status] ?? status}
    </Badge>
  );
}
