const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Carregar configuração
const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
  console.log('❌ Arquivo config.json não encontrado!');
  console.log('📋 Copie config.example.json para config.json e configure seus dados.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Estado do bot
let browser = null;
let page = null;
let isLoggedIn = false;
let ordensConhecidas = new Set();

// Banner
console.log('');
console.log('╔════════════════════════════════════════════════╗');
console.log('║     🎮 ELDORADO.GG BOOST BOT - v1.0.0         ║');
console.log('║         Monitoramento Automático               ║');
console.log('╚════════════════════════════════════════════════╝');
console.log('');

// Função para tocar som de notificação
function tocarSom() {
  if (process.platform === 'darwin') {
    // macOS
    require('child_process').exec('afplay /System/Library/Sounds/Glass.aiff');
  } else if (process.platform === 'linux') {
    // Linux
    require('child_process').exec('aplay /usr/share/sounds/alsa/Front_Center.wav 2>/dev/null || beep 2>/dev/null || true');
  } else if (process.platform === 'win32') {
    // Windows
    require('child_process').exec('rundll32 user32.dll,MessageBeep');
  }
}

// Função para enviar notificação Discord
async function notificarDiscord(titulo, descricao, cor = 0x22c55e) {
  if (!config.discord.ativo || !config.discord.webhookUrl) return;

  try {
    await fetch(config.discord.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Eldorado Bot',
        embeds: [{
          title: titulo,
          description: descricao,
          color: cor,
          timestamp: new Date().toISOString(),
          footer: { text: 'Bot rodando localmente' }
        }]
      })
    });
    console.log('  📢 Discord notificado!');
  } catch (e) {
    console.log('  ⚠️ Erro ao notificar Discord:', e.message);
  }
}

// Inicializar browser
async function init() {
  console.log('🚀 Iniciando navegador...');

  browser = await chromium.launch({
    headless: config.configuracoes.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  });

  page = await context.newPage();
  console.log('✅ Navegador iniciado!');
}

// Fazer login no Eldorado
async function login() {
  console.log('');
  console.log('🔑 Fazendo login no Eldorado.gg...');

  try {
    await page.goto('https://www.eldorado.gg/', { waitUntil: 'networkidle' });

    // Verificar se já está logado
    const userMenu = await page.$('[class*="user"], [class*="profile"], [data-test="user-menu"]');
    if (userMenu) {
      const isVisible = await userMenu.isVisible().catch(() => false);
      if (isVisible) {
        console.log('✅ Já está logado!');
        isLoggedIn = true;
        return true;
      }
    }

    // Clicar em login
    console.log('  Procurando botão de login...');
    const loginBtn = await page.waitForSelector('text=Log in, text=Login, button:has-text("Log in")', { timeout: 10000 });
    await loginBtn.click();

    // Preencher email
    console.log('  Preenchendo credenciais...');
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    await page.fill('input[type="email"], input[name="email"]', config.eldorado.email);

    // Preencher senha
    await page.fill('input[type="password"], input[name="password"]', config.eldorado.password);

    // Clicar para logar
    await page.click('button[type="submit"], button:has-text("Log in")');

    // Esperar resultado
    await page.waitForTimeout(5000);

    // Verificar se logou
    const url = page.url();
    if (url.includes('eldorado.gg') && !url.includes('login')) {
      console.log('✅ Login realizado com sucesso!');
      isLoggedIn = true;
      return true;
    }

    // Checar erro
    const errorMsg = await page.$('text=Invalid, text=Incorrect, .error, [class*="error"]');
    if (errorMsg) {
      const errorText = await errorMsg.textContent().catch(() => 'Erro desconhecido');
      console.log('❌ Erro de login:', errorText);
      return false;
    }

    console.log('⚠️ Estado de login incerto. Verifique manualmente.');
    await page.screenshot({ path: 'login-debug.png' });
    console.log('  📷 Screenshot salvo em: login-debug.png');
    return false;

  } catch (e) {
    console.log('❌ Erro durante login:', e.message);
    return false;
  }
}

// Ir para página de ordens
async function irParaOrdens() {
  console.log('');
  console.log('📦 Acessando página de ordens...');

  try {
    await page.goto('https://www.eldorado.gg/my-orders/sales', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    console.log('✅ Página de ordens carregada!');
    return true;
  } catch (e) {
    console.log('❌ Erro ao acessar ordens:', e.message);
    return false;
  }
}

// Extrair ordens da página
async function extrairOrdens() {
  console.log('');
  console.log('🔍 Procurando novas ordens...');

  const ordens = [];

  try {
    // Esperar carregar
    await page.waitForSelector('[class*="order"], [class*="Order"], table, tr', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Tentar capturar JSON se existir
    const pageContent = await page.content();

    // Procurar elementos de ordem
    const orderElements = await page.$$('tr, [class*="order"], [class*="Order"]');
    console.log(`  📊 Encontrados ${orderElements.length} elementos`);

    for (const el of orderElements) {
      try {
        const text = await el.textContent();
        if (!text || text.length < 20) continue;

        // Verificar se é boosting
        const isBoost = text.toLowerCase().includes('boost') ||
                        text.toLowerCase().includes('rank') ||
                        text.toLowerCase().includes('elo');

        if (!isBoost) continue;

        // Extrair ID
        const idMatch = text.match(/([A-Z0-9]{6,}[-][A-Z0-9]{4,})/i) ||
                        text.match(/Order[:#\s]*([A-Z0-9]+)/i);
        const orderId = idMatch?.[1] || `ORD-${Date.now()}`;

        // Verificar se é nova
        if (ordensConhecidas.has(orderId)) continue;

        // Extrair valor
        const priceMatch = text.match(/\$([\d,.]+)/);
        const valor = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;

        // Extrair jogo
        const gameMatch = text.match(/(Valorant|League of Legends|LoL|CS2|CS:GO|Overwatch|Apex|Rust|Fortnite)/i);
        const jogo = gameMatch?.[1] || 'Desconhecido';

        // Extrair статус
        const statusMatch = text.match(/pending|new|processing|active/i);
        const status = statusMatch?.[0]?.toLowerCase() || 'pending';

        // Só adicionar se está pendente
        if (status === 'pending' || status === 'new' || status.includes('process')) {
          ordens.push({
            id: orderId,
            jogo,
            valor,
            descricao: text.slice(0, 200),
            status
          });

          // Adicionar aos conhecidos
          ordensConhecidas.add(orderId);
        }

      } catch (e) {
        continue;
      }
    }

    console.log(`  ✅ ${ordens.length} novas ordens de boost encontradas!`);
    return ordens;

  } catch (e) {
    console.log('❌ Erro ao extrair ordens:', e.message);

    // Salvar screenshot para debug
    await page.screenshot({ path: 'ordens-debug.png', fullPage: true });
    console.log('  📷 Screenshot salvo em: ordens-debug.png');
    return [];
  }
}

// Verificar filtros
function passarFiltros(ordem) {
  const filtros = config.filtros;
  const desc = (ordem.descricao || '').toLowerCase();

  // Verificar palavras-chave
  if (filtros.palavrasChave && filtros.palavrasChave.length > 0) {
    const temPalavra = filtros.palavrasChave.some(p => desc.includes(p.toLowerCase()));
    if (!temPalavra) return false;
  }

  // Verificar palavras excluídas
  if (filtros.palavrasExcluir && filtros.palavrasExcluir.length > 0) {
    const temExcluida = filtros.palavrasExcluir.some(p => desc.includes(p.toLowerCase()));
    if (temExcluida) return false;
  }

  // Verificar orçamento
  if (filtros.orcamentoMinimo && ordem.valor && ordem.valor < filtros.orcamentoMinimo) {
    return false;
  }

  return true;
}

// Calcular preço
function calcularPreco(ordem) {
  const base = config.configuracoes.precoBase || 20;
  const markup = config.configuracoes.markup || 50;

  // Se tem valor do cliente, usar como base
  const valorBase = ordem.valor || base;
  const preco = valorBase * (1 + markup / 100);

  return preco.toFixed(2);
}

// Responder ordem
async function responderOrdem(ordem) {
  console.log('');
  console.log('💬 Respondendo ordem:', ordem.id);

  if (!config.respostaAutomatica.ativo) {
    console.log('  ⚠️ Resposta automática desativada');
    return false;
  }

  try {
    // Procurar botão/link da ordem
    const orderLink = await page.$(`a[href*="${ordem.id}"], a:has-text("${ordem.id}")`);
    if (orderLink) {
      await orderLink.click();
      await page.waitForTimeout(2000);
    }

    // Procular campo de chat
    const chatInput = await page.$('textarea, input[type="text"], [class*="chat-input"]');
    if (!chatInput) {
      console.log('  ❌ Campo de chat não encontrado');
      return false;
    }

    // Calcular preço
    const preco = calcularPreco(ordem);

    // Preparar mensagem
    let mensagem = config.respostaAutomatica.mensagem.replace('${preco}', `$${preco}`);
    mensagem = mensagem.replace('{preco}', `$${preco}`);

    // Enviar mensagem
    await chatInput.fill(mensagem);
    await page.waitForTimeout(500);

    // Clicar enviar
    const sendBtn = await page.$('button:has-text("Send"), button:has-text("Enviar"), button[type="submit"]');
    if (sendBtn) {
      await sendBtn.click();
      console.log('  ✅ Mensagem enviada!');
      console.log('  💰 Preço ofertado: $' + preco);

      // Notificar Discord
      await notificarDiscord(
        '💰 Nova Ordem Respondida!',
        `**Jogo:** ${ordem.jogo}\n**Valor cliente:** $${ordem.valor || 'N/D'}\n**Seu preço:** $${preco}`,
        0x3b82f6
      );

      // Som de notificação
      if (config.configuracoes.somNotificacao) {
        tocarSom();
      }

      return true;
    }

    console.log('  ❌ Botão enviar não encontrado');
    return false;

  } catch (e) {
    console.log('  ❌ Erro ao responder:', e.message);
    return false;
  }
}

// Loop principal
async function loop() {
  console.log('');
  console.log('🔄 Iniciando loop de monitoramento...');
  console.log(`  ⏱️  Intervalo: ${config.configuracoes.intervaloSegundos}s`);
  console.log('');

  let ciclo = 0;

  while (true) {
    ciclo++;
    console.log('');
    console.log(`═══════════ CICLO ${ciclo} ═══════════`);
    console.log(`🕐 ${new Date().toLocaleString('pt-BR')}`);

    // Verificar ordens
    const ordens = await extrairOrdens();

    if (ordens.length > 0) {
      for (const ordem of ordens) {
        console.log('');
        console.log(`🎯 NOVA ORDEM: ${ordem.id}`);
        console.log(`  🎮 Jogo: ${ordem.jogo}`);
        console.log(`  💵 Valor: ${ordem.valor ? '$' + ordem.valor : 'N/D'}`);
        console.log(`  📝 Descrição: ${ordem.descricao?.slice(0, 100)}...`);

        // Verificar filtros
        if (passarFiltros(ordem)) {
          console.log('  ✅ Passou nos filtros!');
          await responderOrdem(ordem);
        } else {
          console.log('  ❌ Não passou nos filtros');
        }
      }
    } else {
      console.log('  😴 Nenhuma ordem nova...');
    }

    // Aguardar próximo ciclo
    console.log('');
    console.log(`⏳ Aguardando ${config.configuracoes.intervaloSegundos}s...`);
    await page.waitForTimeout(config.configuracoes.intervaloSegundos * 1000);
  }
}

// Função principal
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('Pressione Ctrl+C a qualquer momento para parar');
  console.log('═══════════════════════════════════════════════════');

  try {
    // Iniciar
    await init();

    // Login
    const logado = await login();
    if (!logado) {
      console.log('');
      console.log('❌ Não foi possível fazer login. Verifique suas credenciais.');
      console.log('💡 Dica: Abra com headless: false para ver o que está acontecendo.');
      await browser.close();
      process.exit(1);
    }

    // Ir para ordens
    await irParaOrdens();

    // Loop
    await loop();

  } catch (e) {
    console.log('');
    console.log('❌ Erro fatal:', e.message);
    console.log(e.stack);

    // Salvar screenshot
    if (page) {
      await page.screenshot({ path: 'erro-fatal.png' });
      console.log('📷 Screenshot salvo em: erro-fatal.png');
    }

    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
}

// Capturar Ctrl+C
process.on('SIGINT', async () => {
  console.log('');
  console.log('👋 Encerrando bot...');
  if (browser) {
    await browser.close();
  }
  console.log('✅ Bot encerrado com sucesso!');
  process.exit(0);
});

// Iniciar
main();
