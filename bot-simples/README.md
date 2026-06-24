# 🎮 Eldorado Bot Simples

Bot **local** para monitorar ordens de boost no Eldorado.gg. Sem login, sem nuvem, só você usando no seu PC.

## ⚡ Instalação Rápida

```bash
# 1. Entre na pasta
cd bot-simples

# 2. Instale as dependências
npm install

# 3. Instale o navegador do Playwright
npx playwright install chromium

# 4. Configure
cp config.example.json config.json
# Edite config.json com seu email/senha do Eldorado

# 5. Rode!
npm start
```

## 📋 Configuração (config.json)

```json
{
  "eldorado": {
    "email": "seu@email.com",      ← Seu email do Eldorado
    "password": "suasenha"         ← Sua senha
  },
  "filtros": {
    "palavrasChave": ["boost", "rank"],     ← Só aceita ordens com essas palavras
    "palavrasExcluir": ["cheap", "barato"], ← Ignora ordens com essas palavras
    "orcamentoMinimo": 10                   ← Ignora ordens abaixo de $10
  },
  "respostaAutomatica": {
    "ativo": true,                          ← true = responde automaticamente
    "mensagem": "Olá! Faço por ${preco}"    ← Mensagem que será enviada
  },
  "discord": {
    "ativo": true,
    "webhookUrl": "https://discord.com/api/webhooks/..."  ← Notificações no Discord
  },
  "configuracoes": {
    "intervaloSegundos": 30,    ← Verifica a cada 30 segundos
    "precoBase": 20,            ← Preço mínimo
    "markup": 50,               ← Margem de lucro % (50% = dobra o preço)
    "headless": false           ← false = mostra navegador, true = escondido
  }
}
```

## 🎯 Como Funciona

1. Bot abre o navegador e faz login no Eldorado
2. Vai até sua página de ordens
3. A cada 30 segundos, verifica se tem ordem nova
4. Se encontrar ordem de boost que passe nos filtros:
   - Calcula o preço automaticamente
   - Envia mensagem no chat
   - Notifica no Discord (se ativado)
   - Toca som de alerta

## 💰 Exemplo de Uso

**Ordem detectada:**
- Jogo: Valorant
- Descrição: "Boost de Gold para Diamond"
- Valor do cliente: $30

**Bot responde:**
- Calcula preço: $30 × 1.5 = $45
- Envia: "Olá! Faço por $45. Entrega em 2-3 dias..."

**Seu lucro:** $45 - $20 (se você fizer) = **$25 por ordem**

## ⚙️ Opções

### Mostrar/esconder navegador
```json
"headless": false   // Mostra navegador (útil para ver o que acontece)
"headless": true    // Esconde navegador (rodando em background)
```

### Ajustar preço
```json
"precoBase": 20,    // Se não tiver valor do cliente, usa $20
"markup": 50         // Adiciona 50% no preço
```

### Só monitorar, não responder
```json
"respostaAutomatica": { "ativo": false }
```

## 🐛 Troubleshooting

### "Não encontra ordens"
- Coloque `"headless": false` no config
- Veja se a página de ordens carregou
- Screenshots são salvos automaticamente: `ordens-debug.png`

### "Erro de login"
- Verifique email/senha
- Conta precisa estar verificada no Eldorado
- Se tiver 2FA, vai precisar digitar manualmente

### "Browser não abre"
```bash
# No Linux, pode precisar de dependências
npx playwright install-deps chromium
```

## ⚠️ AVISOS IMPORTANTES

1. **Risco de ban**: O Eldorado pode banir contas que usam automação
   - Use uma conta separada para testes
   - Não responda 100% das ordens automaticamente
   - Mantenha intervalos de 30s+

2. **Use com sabedoria**:
   - Comece com `"respostaAutomatica.ativo": false`
   - Só ative resposta automática depois que tudo estiver funcionando
   - Monitore os logs primeiro!

## 📞 Dúvidas?

- Logs aparecem no terminal
- Screenshots são salvos como `.png` quando há erro
- Verifique o arquivo `config.json` se algo não funcionar
