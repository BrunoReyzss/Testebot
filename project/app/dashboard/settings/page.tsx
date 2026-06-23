'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/use-settings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Zap, Clock, Send, MessageSquare, Bell, Key, User, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const { settings, saveSettings, toggleBot } = useSettings();
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Local form state
  const [monitorInterval, setMonitorInterval] = useState(settings?.monitor_interval_ms ?? 5000);
  const [autoOffer, setAutoOffer] = useState(settings?.auto_offer ?? true);
  const [autoMessage, setAutoMessage] = useState(settings?.auto_message ?? true);
  const [autoDiscord, setAutoDiscord] = useState(settings?.auto_discord ?? true);
  const [apiKey, setApiKey] = useState(settings?.eldorado_api_key ?? '');
  const [eldoradoUsername, setEldoradoUsername] = useState(settings?.eldorado_username ?? '');

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings({
        monitor_interval_ms: monitorInterval,
        auto_offer: autoOffer,
        auto_message: autoMessage,
        auto_discord: autoDiscord,
        eldorado_api_key: apiKey || null,
        eldorado_username: eldoradoUsername || null,
      });
      toast.success('Configurações salvas');
    } catch {
      toast.error('Erro ao salvar configurações');
    }
    setSaving(false);
  };

  const handleToggleBot = async () => {
    setToggling(true);
    await toggleBot();
    setToggling(false);
  };

  const isRunning = settings?.bot_running ?? false;

  return (
    <div className="p-6 space-y-6 lg:p-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie as preferências do sistema de automação
        </p>
      </div>

      {/* Bot control */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Controle do Bot</CardTitle>
              <CardDescription>Inicie ou pare o sistema de automação</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/30 p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isRunning ? 'bg-primary/10' : 'bg-muted'}`}>
                <div className={`h-3 w-3 rounded-full ${isRunning ? 'bg-primary animate-pulse-dot' : 'bg-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-sm font-semibold">Status: {isRunning ? 'Ativo' : 'Parado'}</p>
                <p className="text-xs text-muted-foreground">
                  {isRunning ? 'O bot está monitorando e processando solicitações' : 'O bot não está em execução'}
                </p>
              </div>
            </div>
            <Button
              onClick={handleToggleBot}
              disabled={toggling}
              className={isRunning ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {toggling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isRunning ? null : <Zap className="mr-2 h-4 w-4" />}
              {isRunning ? 'Parar Bot' : 'Iniciar Bot'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Automation settings */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base">Automação</CardTitle>
          <CardDescription>Configure o comportamento automático do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label>Intervalo de Monitoramento (ms)</Label>
                <p className="text-xs text-muted-foreground">Frequência de verificação de novas solicitações</p>
              </div>
            </div>
            <Input
              type="number"
              min="1000"
              step="500"
              value={monitorInterval}
              onChange={(e) => setMonitorInterval(Number(e.target.value))}
              className="w-32"
            />
          </div>
          <Separator />
          <ToggleRow
            icon={Send}
            label="Ofertas Automáticas"
            description="Enviar ofertas automaticamente quando uma solicitação passar nos filtros"
            checked={autoOffer}
            onCheckedChange={setAutoOffer}
          />
          <Separator />
          <ToggleRow
            icon={MessageSquare}
            label="Mensagens Automáticas"
            description="Enviar mensagem personalizada junto com cada oferta"
            checked={autoMessage}
            onCheckedChange={setAutoMessage}
          />
          <Separator />
          <ToggleRow
            icon={Bell}
            label="Notificações Discord"
            description="Enviar notificações para webhooks do Discord configurados"
            checked={autoDiscord}
            onCheckedChange={setAutoDiscord}
          />
        </CardContent>
      </Card>

      {/* Eldorado credentials */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base">Credenciais do Eldorado.gg</CardTitle>
          <CardDescription>Configure o acesso à plataforma Eldorado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> Usuário do Eldorado</Label>
            <Input
              value={eldoradoUsername}
              onChange={(e) => setEldoradoUsername(e.target.value)}
              placeholder="seu_usuario"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Key className="h-3.5 w-3.5" /> API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sua_api_key_do_eldorado"
            />
            <p className="text-xs text-muted-foreground">
              A API key é armazenada com segurança e usada apenas para monitoramento.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Account info */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base">Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Usuário</span>
            <span className="text-sm font-medium">{profile?.username ?? 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">ID</span>
            <Badge variant="outline" className="text-[10px] font-mono">{user?.id.slice(0, 8)}...</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Warning */}
      <Card className="border-yellow-500/20 bg-yellow-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-400 mb-1">Importante</p>
              <p className="text-xs text-muted-foreground">
                O bot precisa estar rodando em um PC ou VPS ligado 24/7 para funcionar continuamente.
                Mantenha esta aba do dashboard aberta ou configure um servidor para execução em background.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div>
          <Label>{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
