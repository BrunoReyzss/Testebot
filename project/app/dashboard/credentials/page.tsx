'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { EldoradoCredentials, WorkerSession } from '@/lib/types';
import { Key, Link2, Loader as Loader2, Check, TriangleAlert as AlertTriangle, ExternalLink, Server } from 'lucide-react';
import { toast } from 'sonner';

export default function CredentialsPage() {
  const { user } = useAuth();
  const [credentials, setCredentials] = useState<EldoradoCredentials | null>(null);
  const [workerSession, setWorkerSession] = useState<WorkerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactor, setTwoFactor] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: credData } = await supabase
      .from('eldorado_credentials')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    setCredentials(credData as EldoradoCredentials | null);

    if (credData) {
      setEmail((credData as EldoradoCredentials).email);
    }

    const { data: sessionData } = await supabase
      .from('worker_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setWorkerSession(sessionData as WorkerSession | null);

    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleSaveCredentials = async () => {
    if (!user || !email || !password) {
      toast.error('Email e senha sao obrigatorios');
      return;
    }

    setSaving(true);

    if (credentials) {
      const { error } = await supabase
        .from('eldorado_credentials')
        .update({
          email,
          password_encrypted: password,
          two_factor_secret: twoFactor || null,
          login_status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', credentials.id);

      if (error) toast.error('Erro ao atualizar credenciais');
      else toast.success('Credenciais atualizadas');
    } else {
      const { error } = await supabase
        .from('eldorado_credentials')
        .insert({
          user_id: user.id,
          email,
          password_encrypted: password,
          two_factor_secret: twoFactor || null,
        });

      if (error) toast.error('Erro ao salvar credenciais');
      else toast.success('Credenciais salvas');
    }

    setSaving(false);
    load();
  };

  const handleTestCredentials = async () => {
    setTesting(true);
    // The test will be performed by the worker when it starts
    toast.info('O worker vai testar as credenciais automaticamente ao iniciar');
    setTesting(false);
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    success: 'bg-green-500/10 text-green-400 border-green-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    stopped: 'bg-muted text-muted-foreground',
    starting: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    running: 'bg-primary/10 text-primary border-primary/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pendente',
    success: 'Sucesso',
    failed: 'Falhou',
    stopped: 'Parado',
    starting: 'Iniciando',
    running: 'Rodando',
    error: 'Erro',
  };

  return (
    <div className="p-6 space-y-6 lg:p-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Credenciais Eldorado</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure suas credenciais para o worker monitorar suas ordens
        </p>
      </div>

      {/* How it works */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Server className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold mb-1">Como funciona</p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>1. Configure suas credenciais do Eldorado.gg abaixo</p>
                <p>2. Execute o worker em um VPS ou servidor dedicado</p>
                <p>3. O worker vai automaticamente fazer login e monitorar novas ordens</p>
                <p>4. Quando detectar uma ordem de boost, ele responde automaticamente</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credentials form */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Credenciais do Eldorado.gg</CardTitle>
              <CardDescription>Seus dados de login para monitoramento</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email do Eldorado</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="Sua senha do Eldorado"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A senha e armazenada de forma segura no banco de dados
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="2fa">Codigo 2FA (opcional)</Label>
            <Input
              id="2fa"
              type="text"
              placeholder="Segredo do autenticador"
              value={twoFactor}
              onChange={(e) => setTwoFactor(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Se sua conta usa autenticacao de dois fatores, insira o segredo
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveCredentials} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Salvar Credenciais
            </Button>
            <Button variant="outline" onClick={handleTestCredentials} disabled={testing}>
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Testar Conexao
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Worker session status */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Status do Worker</CardTitle>
              <CardDescription>Monitoramento do worker em tempo real</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : workerSession ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="outline" className={cn('text-xs', statusColors[workerSession.status])}>
                  {statusLabels[workerSession.status]}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tipo</span>
                <span className="text-sm font-medium">{workerSession.worker_type}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ultimo Heartbeat</span>
                <span className="text-sm font-medium">
                  {workerSession.last_heartbeat
                    ? new Date(workerSession.last_heartbeat).toLocaleString('pt-BR')
                    : 'N/A'}
                </span>
              </div>
              {workerSession.error_message && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-red-400">Erro</p>
                      <p className="text-xs text-muted-foreground">{workerSession.error_message}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
              <Server className="h-8 w-8 opacity-50" />
              <p className="text-sm">Nenhum worker ativo</p>
              <p className="text-xs text-center max-w-md">
                Configure suas credenciais e inicie o worker em um VPS para comecar o monitoramento
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup instructions */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base">Instrucoes de Deploy</CardTitle>
          <CardDescription>Como rodar o worker em um servidor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm font-medium">Opcao 1: VPS Linux (Debian/Ubuntu)</p>
            <pre className="text-xs bg-secondary/30 p-3 rounded-lg overflow-x-auto border border-border/50">
{`# 1. Clone o repositorio
cd /opt
git clone seu-repo eldorado-bot
cd eldorado-bot/worker

# 2. Instale dependencias
npm install
npx playwright install chromium

# 3. Configure ambiente
cp .env.example .env
# Edite .env com suas credenciais Supabase

# 4. Rode o worker
npm run dev  # Desenvolvimento
npm run build && npm start  # Producao`}
            </pre>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Opcao 2: Docker</p>
            <pre className="text-xs bg-secondary/30 p-3 rounded-lg overflow-x-auto border border-border/50">
{`# Dockerfile incluido no projeto
docker build -t eldorado-worker ./worker
docker run -d \\
  --name eldorado-worker \\
  -e SUPABASE_URL=sua_url \\
  -e SUPABASE_SERVICE_ROLE_KEY=sua_key \\
  eldorado-worker`}
            </pre>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Opcao 3: PM2 (Producao)</p>
            <pre className="text-xs bg-secondary/30 p-3 rounded-lg overflow-x-auto border border-border/50">
{`npm install -g pm2
pm2 start dist/index.js --name eldorado-worker
pm2 save
pm2 startup`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Security note */}
      <Card className="border-yellow-500/20 bg-yellow-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-400 mb-1">Seguranca</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>- Nunca compartilhe suas credenciais Supabase service role key</li>
                <li>- O worker roda em seu servidor, nao nos nossos</li>
                <li>- Use HTTPS para todas as conexoes</li>
                <li>- Configure firewall para permitir apenas conexoes necessarias</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
