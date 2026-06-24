# 🚀 Guia Rápido - Começando a Lucrar com Eldorado Bot

## O que você precisa

1. **Uma conta de vendedor no Eldorado.gg** (verificada)
2. **Um VPS ou servidor dedicado** (pode ser DigitalOcean, Vultr, AWS, etc)
   - Mínimo: 2GB RAM, 2 vCPU
   - Custo: ~$10-20/mês
3. **Credenciais do Supabase** (já configurado no projeto)

---

## Passo 1: Acesse o Dashboard

O dashboard já está rodando! Acesse pelo navegador e:

1. **Crie uma conta** (email + senha)
2. Vá em **Credenciais** no menu lateral
3. Coloque seu **email e senha do Eldorado.gg**
4. Clique em **Salvar Credenciais**

---

## Passo 2: Configure Filtros

Vá em **Automação > Filtros** e crie filtros para:

- **Tipo de serviço**: Boost
- **Região**: BR (ou sua preferência)
- **Orçamento mínimo**: $20 (por exemplo)
- **Palavras-chave**: "boost", "ranked", "diamond"

---

## Passo 3: Configure Preços

Vá em **Precificação** e crie uma regra:

- **Nome**: Boost Padrão
- **Serviço**: Boost
- **Região**: BR
- **Preço base**: $15
- **Multiplicador**: 1.0
- **Markup**: 50% (sua margem de lucro)

---

## Passo 4: Configure Mensagem

Vá em **Automação > Mensagens** e crie:

```
Olá! 👋 Posso fazer o {service} por ${price}.
Tempo de entrega: 2-3 dias.
100% seguro e confidencial.
```

---

## Passo 5: Configure Discord (Opcional)

Vá em **Discord** e adicione um webhook para receber notificações quando:
- Nova ordem chegar
- Ordem for aceita

---

## Passo 6: Deploy do Worker (OBRIGATÓRIO)

### Opção A: VPS Linux (DigitalOcean, Vultr, AWS)

```bash
# 1. Conecte no seu VPS via SSH
ssh root@seu-vps-ip

# 2. Instale Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Clone o projeto
git clone seu-repositorio eldorado-bot
cd eldorado-bot/worker

# 4. Instale dependências
npm install
npx playwright install chromium

# 5. Configure o .env
cp .env.example .env
nano .env
```

No `.env`, coloque:
```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-chave-aqui
CHECK_INTERVAL_MS=30000
HEADLESS=true
```

```bash
# 6. Build e rode
npm run build
npm start
```

### Opção B: Docker (Mais fácil)

```bash
# 1. No seu VPS com Docker instalado
docker build -t eldorado-worker ./worker

# 2. Execute
docker run -d \
  --name eldorado-worker \
  --restart unless-stopped \
  -e SUPABASE_URL=https://seu-projeto.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=sua-chave-aqui \
  -v $(pwd)/state:/app/state \
  eldorado-worker

# 3. Verifique logs
docker logs -f eldorado-worker
```

### Opção C: PM2 (Produção recomendada)

```bash
# 1. Instale PM2 globalmente
sudo npm install -g pm2

# 2. Inicie o worker
cd eldorado-bot/worker
npm run build
pm2 start dist/index.js --name eldorado-worker

# 3. Configure para iniciar automaticamente
pm2 save
pm2 startup
```

---

## Passo 7: Inicie o Bot

1. Volte ao Dashboard
2. No menu lateral, clique em **Iniciar Bot**
3. O worker vai:
   - Fazer login no Eldorado
   - Monitorar novas ordens a cada 30 segundos
   - Responder automaticamente com seu preço

---

## 💰 Como Você Ganha Dinheiro

1. **Worker detecta** nova ordem de boost
2. **Filtro aplica**: se matches seus critérios
3. **Preço calculado** automaticamente
4. **Mensagem enviada** no chat do Eldorado
5. **Cliente aceita** → Você ganha!

**Exemplo de lucro:**
- Ordem detectada: Boost Gold → Diamond
- Seu preço calculado: $45
- Custo real: ~$20 se você mesmo fizer ou $15 se tiver equipe
- **Lucro: $25-30 por ordem**

---

## ⚠️ IMPORTANTE

### Risco de detecção
O Eldorado.gg pode bloquear contas que usam automação. Para minimizar:

1. **Use contas separadas**:
   - Uma conta para o bot
   - Outra para suas vendas manuais

2. **Intervalos aleatórios**:
   - O worker já tem delay de 30s entre verificações
   - Responda algumas ordens manualmente

3. **Mensagens naturais**:
   - Use mensagens variadas
   - Não seja robótico

### Alternativa mais segura

Se quiser **100% seguro**:
1. Use o worker apenas para **notificações Discord**
2. Responda manualmente às ordens
3. Desligue `auto_offer` nas configurações

---

## 📊 Monitore seus Resultados

No Dashboard veja:
- **Total de solicitações** detectadas
- **Ofertas enviadas** automaticamente
- **Receita total** estimada
- **Logs em tempo real**

---

## 🆘 Problemas Comuns

### "Worker não faz login"
- Verifique email/senha no Dashboard → Credenciais
- Veja se há 2FA no Eldorado
- Tente logar manualmente no navegador do VPS

### "Não detecta ordens"
- Verifique se há ordens pendentes no Eldorado
- Confira se filtros estão corretos
- Veja logs do worker: `docker logs eldorado-worker`

### "Mensagem não é enviada"
- O chat do Eldorado pode ter mudado
- Atualize o scraper em `worker/src/eldorado-scraper.ts`

---

## 📞 Suporte

- **Logs**: Dashboard → Logs
- **Worker**: `docker logs -f eldorado-worker`
- **Banco de dados**: Supabase Dashboard

---

## Próximos Passos

1. ✅ Configure suas credenciais no Dashboard
2. ✅ Crie filtros e preços
3. ✅ Faça deploy do worker em um VPS
4. ✅ Inicie o bot e comece a lucrar!
