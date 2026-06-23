'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { DiscordWebhook } from '@/lib/types';
import { Bell, Plus, Pencil, Trash2, Loader2, Send, Check } from 'lucide-react';
import { toast } from 'sonner';

const eventOptions = [
  { value: 'new_request', label: 'Nova Solicitação', description: 'Quando uma nova solicitação é detectada' },
  { value: 'offer_sent', label: 'Oferta Enviada', description: 'Quando uma oferta é enviada automaticamente' },
  { value: 'offer_accepted', label: 'Oferta Aceita', description: 'Quando uma oferta é aceita pelo cliente' },
  { value: 'offer_rejected', label: 'Oferta Rejeitada', description: 'Quando uma oferta é rejeitada' },
];

const emptyWebhook: Partial<DiscordWebhook> = {
  name: '',
  url: '',
  events: ['new_request', 'offer_sent', 'offer_accepted'],
  is_active: true,
};

export default function DiscordPage() {
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<DiscordWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DiscordWebhook | null>(null);
  const [form, setForm] = useState<Partial<DiscordWebhook>>(emptyWebhook);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('discord_webhooks').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setWebhooks(data as DiscordWebhook[] ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(emptyWebhook); setDialogOpen(true); };
  const openEdit = (w: DiscordWebhook) => { setEditing(w); setForm(w); setDialogOpen(true); };

  const save = async () => {
    if (!user || !form.name || !form.url) { toast.error('Nome e URL são obrigatórios'); return; }
    if (!form.url?.startsWith('https://discord.com/api/webhooks/') && !form.url?.startsWith('https://discordapp.com/api/webhooks/')) {
      toast.error('URL de webhook do Discord inválida');
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from('discord_webhooks').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (error) toast.error('Erro ao atualizar'); else toast.success('Webhook atualizado');
    } else {
      const { error } = await supabase.from('discord_webhooks').insert({ ...form, user_id: user.id });
      if (error) toast.error('Erro ao criar webhook'); else toast.success('Webhook criado');
    }
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const remove = async (id: string) => { await supabase.from('discord_webhooks').delete().eq('id', id); toast.success('Webhook excluído'); load(); };
  const toggleActive = async (w: DiscordWebhook) => { await supabase.from('discord_webhooks').update({ is_active: !w.is_active }).eq('id', w.id); load(); };

  const testWebhook = async (w: DiscordWebhook) => {
    setTesting(w.id);
    try {
      const response = await fetch(w.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Eldorado Bot',
          embeds: [{
            title: '🧪 Teste de Webhook',
            description: 'Este é um teste de notificação do Eldorado Bot. Seu webhook está funcionando corretamente!',
            color: 0x22c55e,
            timestamp: new Date().toISOString(),
            footer: { text: 'Eldorado Bot - Sistema de Automação' },
          }],
        }),
      });
      if (response.ok) toast.success('Webhook testado com sucesso! Verifique seu Discord.');
      else toast.error('Falha no teste do webhook');
    } catch {
      toast.error('Erro ao testar webhook');
    }
    setTesting(null);
  };

  const toggleEvent = (event: string) => {
    const events = form.events ?? [];
    setForm({
      ...form,
      events: events.includes(event) ? events.filter(e => e !== event) : [...events, event],
    });
  };

  return (
    <div className="p-6 space-y-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Discord</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure webhooks para receber notificações no Discord
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-2 h-3.5 w-3.5" /> Novo Webhook
        </Button>
      </div>

      {/* Info card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold mb-1">Como configurar webhooks do Discord</p>
              <p className="text-xs text-muted-foreground">
                1. Abra seu servidor Discord → Configurações → Integrações → Webhooks<br />
                2. Crie um novo webhook, escolha o canal e copie a URL<br />
                3. Cole a URL aqui e selecione quais eventos deseja receber
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Webhooks Configurados ({webhooks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            {loading ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : webhooks.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Bell className="h-8 w-8 opacity-50" />
                <p className="text-sm">Nenhum webhook configurado</p>
                <Button variant="outline" size="sm" onClick={openNew}>
                  <Plus className="mr-2 h-3.5 w-3.5" /> Adicionar webhook
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {webhooks.map((w) => (
                  <div key={w.id} className="rounded-lg border border-border/50 bg-secondary/30 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/20">
                          <Bell className="h-4 w-4 text-[#5865F2]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{w.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[300px]">{w.url}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => testWebhook(w)} disabled={testing === w.id}>
                          {testing === w.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          <span className="ml-1 hidden sm:inline">Testar</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(w)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(w.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {w.events.map((ev) => {
                        const opt = eventOptions.find(o => o.value === ev);
                        return (
                          <Badge key={ev} variant="outline" className="text-[10px] bg-[#5865F2]/5 text-[#5865F2] border-[#5865F2]/20">
                            {opt?.label ?? ev}
                          </Badge>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        {w.is_active ? (
                          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                            <Check className="h-2.5 w-2.5 mr-1" /> Ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">Inativo</Badge>
                        )}
                      </div>
                      <Switch checked={w.is_active} onCheckedChange={() => toggleActive(w)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Webhook' : 'Novo Webhook do Discord'}</DialogTitle>
            <DialogDescription>Configure um webhook para receber notificações.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Notificações Gerais" />
            </div>
            <div className="space-y-2">
              <Label>URL do Webhook *</Label>
              <Input value={form.url ?? ''} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://discord.com/api/webhooks/..." />
            </div>
            <div className="space-y-3">
              <Label>Eventos para Notificar</Label>
              <div className="space-y-2">
                {eventOptions.map((opt) => (
                  <div key={opt.value} className="flex items-start gap-3 rounded-lg border border-border/50 bg-secondary/30 p-3">
                    <Checkbox
                      id={`event-${opt.value}`}
                      checked={form.events?.includes(opt.value) ?? false}
                      onCheckedChange={() => toggleEvent(opt.value)}
                    />
                    <div className="grid gap-0.5 leading-none">
                      <Label htmlFor={`event-${opt.value}`} className="text-sm font-medium cursor-pointer">
                        {opt.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active ?? true} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Webhook ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Salvar' : 'Criar Webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
