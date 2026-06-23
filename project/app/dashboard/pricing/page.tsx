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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { PricingRule } from '@/lib/types';
import { DollarSign, Plus, Pencil, Trash2, Calculator, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const emptyRule: Partial<PricingRule> = {
  name: '',
  service_type: 'all',
  region: 'all',
  category: 'all',
  base_price: 0,
  multiplier: 1.0,
  markup_percent: 0,
  min_price: 0,
  max_price: 999999,
  is_active: true,
  priority: 0,
};

export default function PricingPage() {
  const { user } = useAuth();
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [form, setForm] = useState<Partial<PricingRule>>(emptyRule);
  const [saving, setSaving] = useState(false);

  const loadRules = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('pricing_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('priority', { ascending: false });
    setRules(data as PricingRule[] ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadRules(); }, [loadRules]);

  const openNew = () => {
    setEditingRule(null);
    setForm(emptyRule);
    setDialogOpen(true);
  };

  const openEdit = (rule: PricingRule) => {
    setEditingRule(rule);
    setForm(rule);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!user || !form.name) {
      toast.error('Nome é obrigatório');
      return;
    }
    setSaving(true);
    if (editingRule) {
      const { error } = await supabase
        .from('pricing_rules')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', editingRule.id);
      if (error) toast.error('Erro ao atualizar regra');
      else toast.success('Regra atualizada');
    } else {
      const { error } = await supabase
        .from('pricing_rules')
        .insert({ ...form, user_id: user.id });
      if (error) toast.error('Erro ao criar regra');
      else toast.success('Regra criada');
    }
    setSaving(false);
    setDialogOpen(false);
    loadRules();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('pricing_rules').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir');
    else { toast.success('Regra excluída'); loadRules(); }
  };

  const toggleActive = async (rule: PricingRule) => {
    await supabase
      .from('pricing_rules')
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id);
    loadRules();
  };

  // Price preview calculator
  const previewPrice = (base: number, mult: number, markup: number, min: number, max: number) => {
    const price = base * mult * (1 + markup / 100);
    return Math.max(min, Math.min(max, price));
  };

  const preview = previewPrice(
    Number(form.base_price) || 0,
    Number(form.multiplier) || 1,
    Number(form.markup_percent) || 0,
    Number(form.min_price) || 0,
    Number(form.max_price) || 999999
  );

  return (
    <div className="p-6 space-y-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Precificação</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure regras de cálculo de preços automáticos
          </p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="mr-2 h-3.5 w-3.5" />
          Nova Regra
        </Button>
      </div>

      {/* Formula explanation */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Calculator className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold mb-1">Fórmula de Cálculo</p>
              <p className="text-xs text-muted-foreground">
                <code className="text-primary">preço = (base × multiplicador) × (1 + markup%)</code>
                <br />
                O resultado é limitado entre <code className="text-primary">preço mínimo</code> e{' '}
                <code className="text-primary">preço máximo</code>. Regras com maior prioridade são avaliadas primeiro.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules list */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Regras de Precificação ({rules.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : rules.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                <DollarSign className="h-8 w-8 opacity-50" />
                <p className="text-sm">Nenhuma regra configurada</p>
                <Button variant="outline" size="sm" onClick={openNew}>
                  <Plus className="mr-2 h-3.5 w-3.5" /> Criar primeira regra
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {rules.map((rule) => (
                  <div key={rule.id} className="rounded-lg border border-border/50 bg-secondary/30 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{rule.name}</span>
                        {rule.is_active ? (
                          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">Ativa</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">Inativa</Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">Prioridade: {rule.priority}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(rule.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <div>
                        <span className="text-muted-foreground">Serviço:</span>{' '}
                        <span className="font-medium">{rule.service_type}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Região:</span>{' '}
                        <span className="font-medium">{rule.region}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Categoria:</span>{' '}
                        <span className="font-medium">{rule.category}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Base:</span>{' '}
                        <span className="font-medium text-primary">${rule.base_price}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Multiplicador:</span>{' '}
                        <span className="font-medium">{rule.multiplier}x</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Markup:</span>{' '}
                        <span className="font-medium">{rule.markup_percent}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Mín:</span>{' '}
                        <span className="font-medium">${rule.min_price}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Máx:</span>{' '}
                        <span className="font-medium">${rule.max_price}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                      <div className="text-xs">
                        <span className="text-muted-foreground">Preço estimado: </span>
                        <span className="font-bold text-primary">
                          ${previewPrice(rule.base_price, rule.multiplier, rule.markup_percent, rule.min_price, rule.max_price).toFixed(2)}
                        </span>
                      </div>
                      <Switch checked={rule.is_active} onCheckedChange={() => toggleActive(rule)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Dialog for create/edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Editar Regra' : 'Nova Regra de Precificação'}</DialogTitle>
            <DialogDescription>
              Configure como o preço será calculado para solicitações que correspondam a esta regra.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Regra *</Label>
              <Input id="name" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Boost Ranqueado BR" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Tipo de Serviço</Label>
                <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
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
                <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="BR">Brasil</SelectItem>
                    <SelectItem value="NA">América do Norte</SelectItem>
                    <SelectItem value="EU">Europa</SelectItem>
                    <SelectItem value="AS">Ásia</SelectItem>
                    <SelectItem value="OCE">Oceania</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="ranked">Ranqueada</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="tournament">Torneio</SelectItem>
                    <SelectItem value="placement">Placement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Preço Base ($)</Label>
                <Input type="number" step="0.01" value={form.base_price ?? 0} onChange={(e) => setForm({ ...form, base_price: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Multiplicador</Label>
                <Input type="number" step="0.1" value={form.multiplier ?? 1} onChange={(e) => setForm({ ...form, multiplier: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Markup (%)</Label>
                <Input type="number" step="0.1" value={form.markup_percent ?? 0} onChange={(e) => setForm({ ...form, markup_percent: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Input type="number" value={form.priority ?? 0} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Preço Mínimo ($)</Label>
                <Input type="number" step="0.01" value={form.min_price ?? 0} onChange={(e) => setForm({ ...form, min_price: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Preço Máximo ($)</Label>
                <Input type="number" step="0.01" value={form.max_price ?? 999999} onChange={(e) => setForm({ ...form, max_price: Number(e.target.value) })} />
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Preço Calculado (preview):</span>
                <span className="text-lg font-bold text-primary">${preview.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active ?? true} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Regra ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingRule ? 'Salvar' : 'Criar Regra'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
