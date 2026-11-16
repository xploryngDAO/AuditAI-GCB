/**
 * Utility for high-precision participant detection (Bot/URA/System vs. Agent vs. Customer)
 * Resolves misclassifications where automated IVR/Bot messages or Agent greetings are incorrectly assigned to Customer.
 */

// Normaliza texto para comparação sem acentos e sem emojis
export function normalizeTextForDetection(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^\w\s]/gi, " ")       // Remove caracteres especiais/emojis por espaço
    .replace(/\s+/g, " ")            // Colapsa espaços duplos
    .trim();
}

/**
 * Identifica se uma mensagem pertence ao BOT / URA / SISTEMA
 */
export function isBotOrSystemText(text: string): boolean {
  if (!text) return false;

  const trimUpper = text.trim().toUpperCase();
  if (
    trimUpper.startsWith("BOT:") ||
    trimUpper.startsWith("URA:") ||
    trimUpper.startsWith("SISTEMA:") ||
    trimUpper.startsWith("SYSTEM:") ||
    trimUpper.startsWith("ATENDENTE VIRTUAL:") ||
    trimUpper.startsWith("ASSISTENTE VIRTUAL:") ||
    trimUpper.startsWith("IVA:") ||
    trimUpper.startsWith("[BOT]") ||
    trimUpper.startsWith("[URA]") ||
    trimUpper.startsWith("[SISTEMA]") ||
    text.includes("[Registro da API Genesys Cloud]") ||
    text.includes("[AUTO-CAPTURA RECORRENTE]")
  ) {
    return true;
  }

  const botRegexes = [
    /(digite|informe|selecione|pressione|tecle)\s+(a|o)?\s*(opcao|opção|número|numero|cpf|cnpj|código|codigo|pedido|sua|seu)/i,
    /(escolha|selecione)\s+uma\s+(das\s+)?(opcoes|opções)/i,
    /(transferindo|direcionando|encaminhando)\s+(para|seu|o)?\s*(atendimento|atendente|especialista)?/i,
    /(aguarde|aguarde-nos)\s+(um|enquanto|na|por\s+favor)/i,
    /(assistente|atendente|agente)\s+virtual/i,
    /(pesquisa|avaliação|avalie)\s+(de\s+)?satisfação/i,
    /(seu|o)?\s*protocolo\s+(é|e|de\s+atendimento)/i,
    /(me\s+diz|me\s+diga|descreva)\s+(de\s+forma\s+simples|em\s+poucas\s+palavras)/i,
    /(atendimento|resposta|notificação|mensagem)\s+automática/i,
    /(cliente|atendimento)\s+(transferido|conectado|encerrado|finalizado)/i,
    /(histórico|historico)\s+de\s+(conversa|atendimento)/i,
    /(em\s+breve|um\s+dos\s+nossos|nossos)\s+(especialistas?|atendentes?)\s+(iniciará|iniciara|iniciarao|iniciarão)/i,
    /(iniciará|iniciara)\s+a\s+conversa\s+aqui/i,
    /(poderá|podera)\s+contar\s+o\s+que\s+precisa/i,
    /(nem\s+todas\s+as\s+conversas|conversas)\s+iniciam\s+imediatamente/i,
    /(faremos\s+o\s+possível|faremos\s+o\s+possivel)\s+para\s+iniciar/i,
    /(é|e)\s+só\s+aguardar|(e|é)\s+so\s+aguardar/i,
    /(estou\s+chamando|chamando)\s+(alguém|alguem)\s+para\s+te\s+ajudar/i,
    /(bem-vindo|bem\s+vindo)\s*\(?a?\)?\s+ao\s+atendimento/i,
    /notificação\s+automática|notificacao\s+automatica|mensagem\s+automática|mensagem\s+automatica/i
  ];

  if (botRegexes.some(r => r.test(text))) {
    return true;
  }

  const norm = normalizeTextForDetection(text);

  // Palavras/Frases chave que são 100% exclusivas do BOT / URA / SISTEMA
  const botPhrases = [
    "estou chamando alguem para te ajudar",
    "estou chamando alguem",
    "estou te transferindo",
    "me diz de forma simples qual e sua duvida",
    "me diz de forma simples",
    "me diga de forma simples",
    "qual e a sua duvida",
    "qual e sua duvida",
    "descreva em poucas palavras",
    "descreva de forma simples",
    "qual e o motivo do seu contato",
    "qual o motivo do seu contato",
    "qual e a sua solicitacao",
    "para que eu possa agilizar seu atendimento",
    "para que eu possa agilizar",
    "agilizar seu atendimento",
    "agilizar o atendimento",
    "para agilizar seu atendimento",
    "bem vindo ao atendimento",
    "bem vinda ao atendimento",
    "bem vindo a empresa",
    "bem vinda a empresa",
    "bem vindo ao whatsapp",
    "bem-vindo ao atendimento",
    "bem-vinda ao atendimento",
    "bem-vindo a empresa",
    "atendimento da empresa",
    "atendimento eletronico",
    "atendimento automatico",
    "em breve um dos nossos especialistas",
    "em breve um de nossos especialistas",
    "iniciara a conversa aqui",
    "iniciara a conversa",
    "podera contar o que precisa",
    "nem todas as conversas iniciam imediatamente",
    "faremos o possivel para iniciar",
    "iniciar o mais rapido possivel",
    "e so aguardar",
    "eh so aguardar",
    "assistente virtual",
    "atendente virtual",
    "agente virtual",
    "sou o assistente virtual",
    "sou a assistente virtual",
    "sou o seu assistente virtual",
    "sou a sua assistente virtual",
    "ola sou a iu",
    "ola sou o bot",
    "ola tudo bem sou a",
    "ola tudo bem sou o",
    "resposta automatica",
    "mensagem automatica",
    "notificacao automatica",
    "aguarde enquanto",
    "aguarde um momento",
    "aguarde um instante",
    "aguarde na linha",
    "por favor aguarde",
    "aguarde enquanto localizamos",
    "aguarde enquanto verificamos",
    "transferindo para",
    "vou te transferir",
    "vou direcionar",
    "direcionando seu atendimento",
    "direcionando para",
    "encaminhando para",
    "encaminhando seu atendimento",
    "estamos transferindo",
    "digite seu cpf",
    "digite o cpf",
    "digite seu cnpj",
    "digite o codigo",
    "digite a data",
    "digite o numero do pedido",
    "digite a opcao desejada",
    "digite a opcao",
    "digite 1",
    "digite 2",
    "digite 3",
    "digite 4",
    "digite 5",
    "pressione 1",
    "pressione 2",
    "tecle 1",
    "tecle 2",
    "tecle 0",
    "tecle 9",
    "pressione asterisco",
    "escolha uma das opcoes",
    "escolha uma opcao",
    "selecione a opcao",
    "selecione uma opcao",
    "selecione uma das opcoes",
    "informe seu cpf",
    "informe o cpf",
    "informe o numero",
    "informe o codigo",
    "informe a data",
    "pesquisa de satisfacao",
    "avalie nosso atendimento",
    "sua opiniao e muito important",
    "de 1 a 5",
    "de 0 a 10",
    "seu protocolo e",
    "seu protocolo de atendimento",
    "protocolo de atendimento",
    "anote seu protocolo",
    "protocolo gerado",
    "protocolo gerado pela ura",
    "cliente transferido",
    "cliente conectado",
    "atendimento encerrado",
    "atendimento finalizado",
    "chamada encerrada",
    "sessao expirada",
    "historico de conversa",
    "final do historico",
    "transferencia realizada",
    "menu de opcoes",
    "menu principal",
    "opcao desejada",
    "opcao invalida",
    "cpf invalido",
    "nao entendi o que voce digitou",
    "nao entendi a opcao",
    "nao entendi o que voce disse",
    "nao consegui entender",
    "nenhuma opcao foi selecionada",
    "tempo limite excedido",
    "tempo de resposta esgotado",
    "horario de atendimento",
    "nosso horario de atendimento",
    "nossos atendentes estao ocupados",
    "todos os nossos atendentes",
    "em instantes voce sera atendido",
    "em breves momentos",
    "obrigado por entrar em contato",
    "obrigado por ligar",
    "obrigado por utilizar",
    "este e um canal de atendimento",
    "este e um atendimento automatico",
    "esta chamada esta sendo gravada",
    "esta ligacao esta sendo gravada",
    "esta chamada sera gravada",
    "esta ligacao sera gravada",
    "para sua seguranca essa chamada",
    "para sua seguranca esta ligacao",
    "para sua seguranca esta chamada",
    "gravacao de atendimento",
    "ura receptiva",
    "ura ativa",
    "bot de triagem",
    "assistente virtual",
    "atendente virtual",
    "agente virtual",
    "bot ura",
    "bot:",
    "ura:",
    "sistema:"
  ];

  if (botPhrases.some(phrase => norm.includes(phrase))) {
    return true;
  }

  // Resposta de confirmação curta da URA no fluxo
  if (norm === "certo" || norm === "certo estou" || norm === "certo aguarde") {
    return true;
  }

  return false;
}

/**
 * Identifica se uma mensagem pertence ao ATENDENTE / AGENTE / OPERADOR
 */
export function isAgentText(text: string): boolean {
  if (!text) return false;
  const norm = normalizeTextForDetection(text);

  // Se for texto de Bot/Sistema, o Bot tem prioridade
  if (isBotOrSystemText(text)) return false;

  const agentPhrases = [
    "atendimento empresa",
    "atendimento casas b",
    "me chamo",
    "com quem eu falo e como posso ajudar",
    "com quem eu falo",
    "se possivel me informe o numero do pedido",
    "informe o numero do pedido",
    "me informe o numero do pedido",
    "me informe seu cpf",
    "me informe o cpf",
    "por favor me informe",
    "como posso te ajudar hoje",
    "como posso te ajudar",
    "como posso ajudar",
    "em que posso ajudar",
    "em que posso te ajudar",
    "como posso te auxiliar",
    "falo em nome da empresa",
    "sou o atendente",
    "sou a atendente",
    "sou o operador",
    "sou a operadora",
    "meu nome e",
  ];

  // Caso específico "meu nome e ... como posso/em que posso/atendimento"
  if (norm.includes("meu nome e ")) {
    if (
      norm.includes("como posso") ||
      norm.includes("em que posso") ||
      norm.includes("atendimento") ||
      norm.includes("ajudar") ||
      norm.includes("pedido") ||
      norm.includes("auxiliar") ||
      norm.includes("falo")
    ) {
      return true;
    }
  }

  return agentPhrases.some(phrase => norm.includes(phrase));
}

/**
 * Identifica se uma mensagem pertence ao CLIENTE / CONSUMIDOR
 */
export function isCustomerText(text: string): boolean {
  if (!text) return false;

  // Se for Bot ou Agente, não é cliente
  if (isBotOrSystemText(text) || isAgentText(text)) return false;

  const norm = normalizeTextForDetection(text);

  const customerPhrases = [
    "codigo de barras da fatura",
    "codigo de barras da minha fatura",
    "gostaria do codigo de barras",
    "paguei minha conta",
    "quero saber o valor",
    "quero cancelar",
    "nao recebi meu pedido",
    "meu pedido nao chegou",
    "meu nome e "
  ];

  return customerPhrases.some(phrase => norm.includes(phrase));
}

export type ParticipantRole = 'bot' | 'agent' | 'customer' | 'unknown';

/**
 * Classifica de forma inteligente o participante baseado no conteúdo da mensagem,
 * prevenindo erros de atribuição onde o Bot ou Agente é rotulado como Cliente.
 */
export function determineParticipantRole(
  text: string,
  rawRoleOrHeader?: string
): ParticipantRole {
  const normHeader = normalizeTextForDetection(rawRoleOrHeader || "");

  // 1. CHECAGEM DE CONTEÚDO (Alta Prioridade - Sobrescreve cabeçalhos inconsistentes de API/Planilha)
  if (isBotOrSystemText(text)) {
    return 'bot';
  }

  if (isAgentText(text)) {
    return 'agent';
  }

  // 2. CHECAGEM DE CABEÇALHO / ROLE EMBUTIDO
  if (
    normHeader.includes("bot") ||
    normHeader.includes("ura") ||
    normHeader.includes("sistema") ||
    normHeader.includes("system") ||
    normHeader.includes("virtual") ||
    normHeader.includes("iva")
  ) {
    return 'bot';
  }

  if (
    normHeader.includes("atendente") ||
    normHeader.includes("operador") ||
    normHeader.includes("agente") ||
    normHeader.includes("interno")
  ) {
    return 'agent';
  }

  if (
    normHeader.includes("cliente") ||
    normHeader.includes("consumidor") ||
    normHeader.includes("user") ||
    normHeader.includes("externo")
  ) {
    // Se o cabeçalho diz cliente, mas o conteúdo é claramente do cliente ou neutro
    return 'customer';
  }

  // 3. SEGUNDA CHECAGEM DE CONTEÚDO (Frases típicas de cliente)
  if (isCustomerText(text)) {
    return 'customer';
  }

  return 'unknown';
}
