'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { MonitoredRequest, RequestStatus } from '@/lib/types';
import { Radar, Search, RefreshCw, Filter, Clock, DollarSign, MapPin, Tag } from 'lucide-react';

export default function MonitoringPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MonitoredRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReq, setSelectedReq] = useState<MonitoredRequest | null>(null);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from('requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (search) query = query.or(`description.ilike.%${search}%,service_type.ilike.%${search}%,region.ilike.%${search}%`);

    const { data } = await query;
    setRequests(data as MonitoredRequest[] ?? []);
    setLoading(false);
  }, [user, statusFilter, search]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('monitor-req')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `user_id=eq.${user.id}` },
        () => loadRequests())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadRequests]);

  const statusColors: Record<RequestStatus, string> = {
    new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    filtered: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    priced: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    offer_sent: 'bg-primary/10 text-primary border-primary/20',
    accepted: 'bg-green-500/10 text-green-400 border-green-500/20',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
    expired: 'bg-muted text-muted-foreground border-border',
  };

  const statusLabels: Record<RequestStatus, string> = {
    new: 'Nova',
    filtered: 'Filtrada',
    priced: 'Precificada',
    offer_sent: 'Oferta Enviada',
    accepted: 'Aceita',
    rejected: 'Rejeitada',
    expired: 'Expirada',
  };

  return (
    <div className="p-6 space-y-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Monitoramento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Solicitações detectadas em tempo real
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadRequests} disabled={loading}>
          <RefreshCw className={cn('mr-2 h-3.5 w-3.5', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {/* Filters bar */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição, serviço ou região..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="mr-2 h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="new">Novas</SelectItem>
                <SelectItem value="filtered">Filtradas</SelectItem>
                <SelectItem value="priced">Precificadas</SelectItem>
                <SelectItem value="offer_sent">Oferta Enviada</SelectItem>
                <SelectItem value="accepted">Aceitas</SelectItem>
                <SelectItem value="rejected">Rejeitadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Request list */}
        <Card className="lg:col-span-2 border-border/50 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Radar className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">
                Solicitações ({requests.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              {loading ? (
                <div className="flex h-40 items-center justify-center text-muted-foreground">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                </div>
              ) : requests.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Radar className="h-8 w-8 opacity-50" />
                  <p className="text-sm">Nenhuma solicitação encontrada</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      onClick={() => setSelectedReq(req)}
                      className={cn(
                        'cursor-pointer rounded-lg border p-3 transition-colors',
                        selectedReq?.id === req.id
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-border/50 bg-secondary/30 hover:bg-secondary/50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn('text-[10px]', statusColors[req.status])}>
                            {statusLabels[req.status]}
                          </Badge>
                          {req.priority === 1 && (
                            <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">
                              Alta
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(req.detected_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm font-medium mb-1">{req.service_type ?? 'Serviço não identificado'}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{req.description ?? 'Sem descrição'}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                        {req.region && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {req.region}
                          </span>
                        )}
                        {req.category && (
                          <span className="flex items-center gap-1">
                            <Tag className="h-3 w-3" /> {req.category}
                          </span>
                        )}
                        {req.budget != null && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" /> {req.budget}
                          </span>
                        )}
                        {req.calculated_price != null && (
                          <span className="flex items-center gap-1 text-primary font-semibold">
                            <DollarSign className="h-3 w-3" /> {req.calculated_price.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detail panel */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detalhes da Solicitação</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedReq ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge variant="outline" className={statusColors[selectedReq.status]}>
                    {statusLabels[selectedReq.status]}
                  </Badge>
                </div>
                <DetailRow label="Serviço" value={selectedReq.service_type} />
                <DetailRow label="Região" value={selectedReq.region} />
                <DetailRow label="Categoria" value={selectedReq.category} />
                <DetailRow label="Orçamento" value={selectedReq.budget != null ? `$${selectedReq.budget}` : null} />
                <DetailRow label="Preço Calculado" value={selectedReq.calculated_price != null ? `$${selectedReq.calculated_price.toFixed(2)}` : null} highlight />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                  <p className="text-sm bg-secondary/30 rounded-lg p-3 border border-border/50">{selectedReq.description ?? 'N/A'}</p>
                </div>
                {selectedReq.offer_message && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Mensagem da Oferta</p>
                    <p className="text-sm bg-primary/5 rounded-lg p-3 border border-primary/20">{selectedReq.offer_message}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
                  <Clock className="h-3 w-3" />
                  Detectada: {new Date(selectedReq.detected_at).toLocaleString('pt-BR')}
                </div>
                {selectedReq.offer_sent_at && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Oferta enviada: {new Date(selectedReq.offer_sent_at).toLocaleString('pt-BR')}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs">
                  {selectedReq.discord_notified ? (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Discord notificado</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground">Discord pendente</Badge>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-60 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Radar className="h-8 w-8 opacity-50" />
                <p className="text-sm">Selecione uma solicitação para ver detalhes</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string | null; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-medium', highlight && 'text-primary')}>{value ?? 'N/A'}</span>
    </div>
  );
}
