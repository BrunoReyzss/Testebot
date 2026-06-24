# Eldorado.gg Worker - Guia de Deploy

## Visao Geral

Este worker monitora automaticamente suas ordens no Eldorado.gg usando browser automation (Playwright). Ele detecta novas ordens de boost e responde automaticamente de acordo com suas configuracoes.

## Requisitos

- Node.js 18+ ou Docker
- Um VPS ou servidor dedicado (recomendado: 2GB RAM, 2 vCPU)
- Conta no Eldorado.gg como vendedor

## Deploy com Docker (Recomendado)

### 1. Build da imagem

```bash
cd worker
docker build -t eldorado-worker .
```

### 2. Execute o container

```bash
docker run -d \
  --name eldorado-worker \
  --restart unless-stopped \
  -e SUPABASE_URL=sua_supabase_url \
  -e SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key \
  -v $(pwd)/state:/app/state \
  eldorado-worker
```

### 3. Verificar logs

```bash
docker logs -f eldorado-worker
```

## Deploy em VPS (Linux)

### 1. Instalar dependencias

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm

# Instalar Node.js 20 (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

### 2. Clonar e instalar

```bash
cd /opt
git clone seu-repositorio eldorado-bot
cd eldorado-bot/worker

npm install
npx playwright install chromium
```

### 3. Configurar ambiente

```bash
cp .env.example .env
nano .env
```

Editar `.env`:
```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
CHECK_INTERVAL_MS=30000
HEADLESS=true
```

### 4. Build e iniciar

```bash
npm run build
npm start
```

### 5. Usar PM2 para gerenciamento

```bash
sudo npm install -g pm2

pm2 start dist/index.js --name eldorado-worker
pm2 save
pm2 startup
```

## Configuracao no Dashboard

1. Acesse o dashboard em seu navegador
2. Va para **Credenciais** no menu lateral
3. Insira seu email e senha do Eldorado.gg
4. Clique em **Salvar Credenciais**
5. Configure filtros, precos e mensagens nas outras paginas
6. Inicie o bot pelo botao **Iniciar Bot**

## Arquitetura

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Worker    │────▶│   Supabase   │────▶│  Dashboard  │
│ (Playwright)│     │   (Database) │     │   (Next.js) │
└─────────────┘     └──────────────┘     └─────────────┘
       │                                         │
       │                                         │
       ▼                                         ▼
┌─────────────┐                          ┌─────────────┐
│  Eldorado   │                          │   Discord   │
│ .gg (site)  │                          │  (webhooks)  │
└─────────────┘                          └─────────────┘
```

## Fluxo de Trabalho

1. **Worker inicia** → faz login no Eldorado.gg
2. **Monitoramento** → verifica novas ordens a cada 30s
3. **Deteccao** → quando encontra ordem de boost
4. **Filtros** → aplica seus filtros configurados
5. **Precificacao** → calcula preco automaticamente
6. **Resposta** → envia mensagem automatica no chat
7. **Notificacao** → envia alerta no Discord

## Seguranca

- Senhas sao armazenadas no Supabase com RLS
- O worker roda em SEU servidor, nao em nuvem compartilhada
- Use HTTPS para todas as comunicacoes
- Configure firewall para permitir apenas portas necessarias
- Use variaveis de ambiente para credenciais

## Troubleshooting

### Worker nao consegue fazer login

- Verifique se as credenciais estao corretas
- Verifique se 2FA esta configurado corretamente
- O Eldorado pode ter mudado a pagina de login - atualize o scraper

### Worker nao detecta ordens

- Verifique se ha ordens pendentes no painel Eldorado
- Verifique os logs do worker
- Verifique se os filtros estao configurados corretamente

### Performance

- Use `HEADLESS=true` para rodar sem interface grafica
- Ajuste `CHECK_INTERVAL_MS` se necessário (padrao: 30s)
- Use Docker para isolamento e gerenciamento de recursos

## Logs

O worker salva todos os eventos na tabela `logs`. Veja no dashboard em **Logs**.
