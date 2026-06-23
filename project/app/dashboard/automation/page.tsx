'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Filter, Message } from '@/lib/types';
import { Bot, Plus, Pencil, Trash2, Filter as FilterIcon, MessageSquare, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';

// ===== Filters Section =====

const emptyFilter: Partial<Filter> = {
  name: '',
  service_type: null,
  region: null,
  category: null,
  min_budget: null,
  max_budget: null,
  keywords: [],
  excluded_keywords: [],
  priority: 2,
  is_active: true,
};

const priorityLabels: Record<number, string> = { 1: 'Alta', 2: 'Média', 3: 'Baixa' };
const priorityColors: Record<number, string> = {
  1: 'bg-red-500/10 text-red-400 border-red-500/20',
  2: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  3: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export default function AutomationPage() {
  return (
    <div className="p-6 space-y-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Automação</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure filtros de monitoramento e mensagens automáticas
        </p>
      </div>

      <Tabs defaultValue="filters">
        <TabsList>
          <TabsTrigger value="filters">
            <FilterIcon className="mr-2 h-3.5 w-3.5" /> Filtros
          </TabsTrigger>
          <TabsTrigger value="messages">
            <MessageSquare className="mr-2 h-3.5 w-3.5" /> Mensagens
          </TabsTrigger>
        </TabsList>

        <TabsContent value="filters">
          <FiltersSection />
        </TabsContent>
        <TabsContent value="messages">
          <MessagesSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FiltersSection() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<Filter[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Filter | null>(null);
  const [form, setForm] = useState<Partial<Filter>>(emptyFilter);
  const [keywordsText, setKeywordsText] = useState('');
  const [excludedText, setExcludedText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('filters')
      .select('*')
      .eq('user_id', user.id)
      .order('priority', { ascending: true });
    setFilters(data as Filter[] ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyFilter);
    setKeywordsText('');
    setExcludedText('');
    setDialogOpen(true);
  };

  const openEdit = (f: Filter) => {
    setEditing(f);
    setForm(f);
    setKeywordsText(f.keywords.join(', '));
    setExcludedText(f.excluded_keywords.join(', '));
    setDialogOpen(true);
  };

  const save = async () => {
    if (!user || !form.name) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    const keywords = keywordsText.split(',').map(s => s.trim()).filter(Boolean);
    const excluded_keywords = excludedText.split(',').map(s => s.trim()).filter(Boolean);
    const payload = { ...form, keywords, excluded_keywords };

    if (editing) {
      const { error } = await supabase.from('filters').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (error) toast.error('Erro ao atualizar'); else toast.success('Filtro atualizado');
    } else {
      const { error } = await supabase.from('filters').insert({ ...payload, user_id: user.id });
      if (error) toast.error('Erro ao criar filtro'); else toast.success('Filtro criado');
    }
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from('filters').delete().eq('id', id);
    toast.success('Filtro excluído');
    load();
  };

  const toggleActive = async (f: Filter) => {
    await supabase.from('filters').update({ is_active: !f.is_active }).eq('id', f.id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Filtros determinam quais solicitações o bot processa automaticamente.
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-2 h-3.5 w-3.5" /> Novo Filtro
        </Button>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-4">
          <ScrollArea className="h-[500px] pr-4">
            {loading ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filters.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                <FilterIcon className="h-8 w-8 opacity-50" />
                <p className="text-sm">Nenhum filtro configurado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filters.map((f) => (
                  <div key={f.id} className="rounded-lg border border-border/50 bg-secondary/30 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{f.name}</span>
                        <Badge variant="outline" className={cn('text-[10px]', priorityColors[f.priority])}>
                          {priorityLabels[f.priority]}
                        </Badge>
                        {f.is_active ? (
                          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">Ativo</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">Inativo</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(f)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(f.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-4">
                      {f.service_type && <div><span className="text-muted-foreground">Serviço:</span> <span className="font-medium">{f.service_type}</span></div>}
                      {f.region && <div><span className="text-muted-foreground">Região:</span> <span className="font-medium">{f.region}</span></div>}
                      {f.category && <div><span className="text-muted-foreground">Categoria:</span> <span className="font-medium">{f.category}</span></div>}
                      {f.min_budget != null && <div><span className="text-muted-foreground">Mín:</span> <span className="font-medium">${f.min_budget}</span></div>}
                      {f.max_budget != null && <div><span className="text-muted-foreground">Máx:</span> <span className="font-medium">${f.max_budget}</span></div>}
                    </div>
                    {f.keywords.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {f.keywords.map((k, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">{k}</Badge>
                        ))}
                      </div>
                    )}
                    {f.excluded_keywords.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {f.excluded_keywords.map((k, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] bg-destructive/5 text-destructive border-destructive/20">~{k}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                      <Switch checked={f.is_active} onCheckedChange={() => toggleActive(f)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Filtro' : 'Novo Filtro'}</DialogTitle>
            <DialogDescription>Defina critérios para filtrar solicitações automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Filtro *</Label>
              <Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Boost BR Alta Prioridade" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-2">
                <Label>Serviço</Label>
                <Select value={form.service_type ?? 'all'} onValueChange={(v) => setForm({ ...form, service_type: v === 'all' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="boost">Boost</SelectItem>
                    <SelectItem value="coaching">Coaching</SelectItem>
                    <SelectItem value="leveling">Leveling</SelectItem>
                    <SelectItem value="account">Conta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Região</Label>
                <Select value={form.region ?? 'all'} onValueChange={(v) => setForm({ ...form, region: v === 'all' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="BR">Brasil</SelectItem>
                    <SelectItem value="NA">NA</SelectItem>
                    <SelectItem value="EU">EU</SelectItem>
                    <SelectItem value="AS">Ásia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.category ?? 'all'} onValueChange={(v) => setForm({ ...form, category: v === 'all' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="ranked">Ranqueada</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="placement">Placement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={String(form.priority ?? 2)} onValueChange={(v) => setForm({ ...form, priority: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Alta</SelectItem>
                    <SelectItem value="2">Média</SelectItem>
                    <SelectItem value="3">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Orçamento Mínimo ($)</Label>
                <Input type="number" step="0.01" value={form.min_budget ?? ''} onChange={(e) => setForm({ ...form, min_budget: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div className="space-y-2">
                <Label>Orçamento Máximo ($)</Label>
                <Input type="number" step="0.01" value={form.max_budget ?? ''} onChange={(e) => setForm({ ...form, max_budget: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Palavras-chave (separadas por vírgula)</Label>
              <Input value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} placeholder="boost, ranked, diamond" />
            </div>
            <div className="space-y-2">
              <Label>Palavras Excluídas (separadas por vírgula)</Label>
              <Input value={excludedText} onChange={(e) => setExcludedText(e.target.value)} placeholder="cheap, low budget" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active ?? true} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Filtro ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Salvar' : 'Criar Filtro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessagesSection() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Message | null>(null);
  const [form, setForm] = useState<Partial<Message>>({ name: '', template: '', service_type: null, is_active: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('messages').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setMessages(data as Message[] ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm({ name: '', template: '', service_type: null, is_active: true }); setDialogOpen(true); };
  const openEdit = (m: Message) => { setEditing(m); setForm(m); setDialogOpen(true); };

  const save = async () => {
    if (!user || !form.name || !form.template) { toast.error('Nome e template são obrigatórios'); return; }
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from('messages').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (error) toast.error('Erro'); else toast.success('Mensagem atualizada');
    } else {
      const { error } = await supabase.from('messages').insert({ ...form, user_id: user.id });
      if (error) toast.error('Erro'); else toast.success('Mensagem criada');
    }
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const remove = async (id: string) => { await supabase.from('messages').delete().eq('id', id); toast.success('Excluída'); load(); };
  const toggleActive = async (m: Message) => { await supabase.from('messages').update({ is_active: !m.is_active }).eq('id', m.id); load(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mensagens enviadas automaticamente com cada oferta. Use placeholders como{' '}
          <code className="text-primary">{'{service}'}</code>,{' '}
          <code className="text-primary">{'{price}'}</code>,{' '}
          <code className="text-primary">{'{region}'}</code>.
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-2 h-3.5 w-3.5" /> Nova Mensagem
        </Button>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-4">
          <ScrollArea className="h-[500px] pr-4">
            {loading ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : messages.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                <MessageSquare className="h-8 w-8 opacity-50" />
                <p className="text-sm">Nenhuma mensagem configurada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((m) => (
                  <div key={m.id} className="rounded-lg border border-border/50 bg-secondary/30 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{m.name}</span>
                        {m.service_type && <Badge variant="outline" className="text-[10px]">{m.service_type}</Badge>}
                        {m.is_active ? (
                          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">Ativa</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">Inativa</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground bg-background/50 rounded p-2 border border-border/50 whitespace-pre-wrap">{m.template}</p>
                    <div className="flex items-center justify-end mt-3 pt-3 border-t border-border/50">
                      <Switch checked={m.is_active} onCheckedChange={() => toggleActive(m)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Mensagem' : 'Nova Mensagem'}</DialogTitle>
            <DialogDescription>Template enviado automaticamente com cada oferta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Mensagem Padrão Boost" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Serviço (opcional)</Label>
              <Select value={form.service_type ?? 'all'} onValueChange={(v) => setForm({ ...form, service_type: v === 'all' ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="boost">Boost</SelectItem>
                  <SelectItem value="coaching">Coaching</SelectItem>
                  <SelectItem value="leveling">Leveling</SelectItem>
                  <SelectItem value="account">Conta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Template da Mensagem *</Label>
              <Textarea
                rows={6}
                value={form.template ?? ''}
                onChange={(e) => setForm({ ...form, template: e.target.value })}
                placeholder={'Olá! Posso fazer o {service} na região {region} por ${price}. Entrega rápida e segura!'}
              />
              <p className="text-xs text-muted-foreground">
                Placeholders disponíveis: {'{service}'}, {'{price}'}, {'{region}'}, {'{category}'}, {'{description}'}, {'{budget}'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active ?? true} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Mensagem ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Salvar' : 'Criar Mensagem'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
