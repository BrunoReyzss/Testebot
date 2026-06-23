'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Log, LogLevel, LogCategory } from '@/lib/types';
import { ScrollText, Search, RefreshCw, Trash2, Loader2, Terminal } from 'lucide-react';
import { toast } from 'sonner';

const levelColors: Record<LogLevel, string> = {
  info: 'text-blue-400',
  success: 'text-green-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

const levelBg: Record<LogLevel, string> = {
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  warn: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const categoryColors: Record<LogCategory, string> = {
  monitor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  pricing: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  automation: 'bg-primary/10 text-primary border-primary/20',
  discord: 'bg-[#5865F2]/10 text-[#5865F2] border-[#5865F2]/20',
  system: 'bg-muted text-muted-foreground border-border',
};

export default function LogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from('logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (levelFilter !== 'all') query = query.eq('level', levelFilter);
    if (categoryFilter !== 'all') query = query.eq('category', categoryFilter);
    if (search) query = query.ilike('message', `%${search}%`);

    const { data } = await query;
    setLogs(data as Log[] ?? []);
    setLoading(false);
  }, [user, levelFilter, categoryFilter, search]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('logs-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setLogs((prev) => [payload.new as Log, ...prev].slice(0, 200));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const clearLogs = async () => {
    if (!user) return;
    const { error } = await supabase.from('logs').delete().eq('user_id', user.id);
    if (error) toast.error('Erro ao limpar logs');
    else { toast.success('Logs limpos'); setLogs([]); }
  };

  return (
    <div className="p-6 space-y-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Logs do Sistema</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Histórico completo de atividades e eventos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-3.5 w-3.5', loading && 'animate-spin')} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={clearLogs} className="text-destructive">
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Limpar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar nos logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Nível" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os níveis</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="warn">Aviso</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[170px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                <SelectItem value="monitor">Monitoramento</SelectItem>
                <SelectItem value="pricing">Precificação</SelectItem>
                <SelectItem value="automation">Automação</SelectItem>
                <SelectItem value="discord">Discord</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs table */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">{logs.length} registros</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            {loading ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : logs.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                <ScrollText className="h-8 w-8 opacity-50" />
                <p className="text-sm">Nenhum log encontrado</p>
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 rounded-lg border border-border/30 bg-secondary/20 p-3 hover:bg-secondary/40 transition-colors">
                    <span className="text-[11px] text-muted-foreground shrink-0 font-mono pt-0.5">
                      {new Date(log.created_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' })}
                    </span>
                    <Badge variant="outline" className={cn('text-[10px] shrink-0', levelBg[log.level])}>
                      {log.level.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className={cn('text-[10px] shrink-0', categoryColors[log.category])}>
                      {log.category}
                    </Badge>
                    <span className="text-sm flex-1">{log.message}</span>
                    {log.details && (
                      <details className="shrink-0">
                        <summary className="cursor-pointer text-[10px] text-muted-foreground hover:text-foreground">detalhes</summary>
                        <pre className="mt-1 text-[10px] text-muted-foreground bg-background/50 p-2 rounded border border-border/50 max-w-xs overflow-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
