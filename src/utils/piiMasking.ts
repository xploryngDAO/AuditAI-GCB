export interface PiiMaskingResult {
  maskedText: string;
  detectedCount: number;
  categories: string[];
  breakdown: Record<string, number>;
}

// Conjunto de palavras operacionais e comuns em diálogos de SAC/Atendimento que NUNCA fazem parte de um nome próprio
const NON_NAME_DIALOGUE_WORDS = new Set([
  'paguei', 'minha', 'conta', 'mas', 'essa', 'este', 'esta', 'está', 'estou', 'parte', 'do', 'da', 'dos', 'das',
  'cliente', 'consumidor', 'nao', 'não', 'consta', 'no', 'na', 'nos', 'nas', 'pedido', 'aplicativo', 'app',
  'mensagem', 'compro', 'comprei', 'comprar', 'boleto', 'atendimento', 'gostaria', 'favor', 'ajuda', 'dia',
  'tarde', 'noite', 'atendente', 'operador', 'agente', 'gerente', 'supervisor', 'cancelamento', 'cancelar',
  'cartao', 'cartão', 'suporte', 'sistema', 'chave', 'pix', 'senha', 'valor', 'reais', 'dinheiro', 'produto',
  'loja', 'site', 'codigo', 'código', 'saldo', 'extrato', 'duvida', 'dúvida', 'problema', 'erro', 'obrigado',
  'obrigada', 'quero', 'preciso', 'solicito', 'solicitar', 'alterar', 'trocar', 'recebi', 'receber', 'fazer',
  'onde', 'como', 'quando', 'quanto', 'porque', 'por', 'que', 'qual', 'quais', 'sobre', 'com', 'para', 'sem',
  'tudo', 'nada', 'bom', 'boa', 'olá', 'ola', 'oi', 'porfavor', 'urgente', 'reclamacao', 'reclamação', 'protocolo',
  'carnê', 'carne', 'entrega', 'previsão', 'previsao', 'confirmação', 'confirmacao', 'reembolso', 'devolução',
  'devolucao', 'fatura', 'saldo', 'pontos', 'fidelidade', 'endereço', 'endereco', 'agradeço', 'agradeco', 'atenção',
  'atencao', 'retorno', 'prazo', 'mudança', 'mudanca', 'certo', 'sim', 'nao', 'ok', 'certo', 'obrigado'
]);

/**
 * Função auxiliar para mascarar Nome do Cliente (ex: "JOSE SILVA" -> "JOSE S****", "Doce Helena Confeitaria Artesanal | +5521980608496" -> "Doce H***** C********** A******** | +552198****496")
 * Mantém rótulos operacionais ("Cliente", "Consumidor") e falas comuns do atendimento sem alterações.
 */
export function maskCustomerName(fullName: string): string {
  if (!fullName || typeof fullName !== 'string') return fullName || '';
  const trimmed = fullName.trim();
  if (!trimmed) return '';

  // Preserva marcadores institucionais e operacionais
  if (
    /^cliente\s*(receptivo|ativo|geral)?$/i.test(trimmed) ||
    /^consumidor\s*(casas\s*bahia)?$/i.test(trimmed) ||
    /^não\s+identificado$/i.test(trimmed) ||
    /^não\s+informado$/i.test(trimmed) ||
    /^desconhecido$/i.test(trimmed) ||
    /^atendente\b/i.test(trimmed) ||
    /^operador\b/i.test(trimmed) ||
    /^agente\b/i.test(trimmed) ||
    /^bot\b/i.test(trimmed) ||
    /^ura\b/i.test(trimmed)
  ) {
    return trimmed;
  }

  // Trata presença de divisor pipe "|", ex: "Doce Helena Confeitaria Artesanal | +5521980608496"
  if (trimmed.includes('|')) {
    const parts = trimmed.split('|');
    const maskedParts = parts.map(p => {
      const pTrim = p.trim();
      if (/^\+?\d[\d\s\(\)\-]{7,}/.test(pTrim) || /^\+?\d+$/.test(pTrim.replace(/[^\d]/g, ''))) {
        return maskPII(pTrim).maskedText;
      }
      return maskCustomerName(pTrim);
    });
    return maskedParts.join(' | ');
  }

  // Trata nome com telefone entre parênteses, ex: "Mariana Lopes ((11) 98765-4321)" ou "Mariana Lopes (11987654321)"
  const phoneMatch = trimmed.match(/^(.*?)\s*\((.*?)\)$/);
  if (phoneMatch) {
    const mainPart = phoneMatch[1].trim();
    const subPart = phoneMatch[2].trim();
    const maskedMain = maskCustomerName(mainPart);
    const maskedSub = maskPII(subPart).maskedText;
    return `${maskedMain} (${maskedSub})`;
  }

  // Limpa telefones residuais colados no final do nome se houver
  const trailingPhoneMatch = trimmed.match(/^(.*?)\s+(\+?55[\d\s\(\)\-]{8,})$/);
  if (trailingPhoneMatch) {
    const mainPart = trailingPhoneMatch[1].trim();
    const phonePart = trailingPhoneMatch[2].trim();
    const maskedMain = maskCustomerName(mainPart);
    const maskedPhone = maskPII(phonePart).maskedText;
    return `${maskedMain} ${maskedPhone}`;
  }

  // Trava de segurança: se a string contiver palavras/verbos de conversa de SAC
  // NÃO é nome. Partículas de nome (da/de/do/das/dos/e) NÃO invalidam o nome —
  // sem isso, nomes muito comuns como "Maria da Silva" passavam sem máscara.
  const NAME_STRUCTURE_WORDS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
  const lowerWords = trimmed.toLowerCase().split(/\s+/);
  if (lowerWords.some(w => NON_NAME_DIALOGUE_WORDS.has(w) && !NAME_STRUCTURE_WORDS.has(w))) {
    return trimmed; // Contém verbos/substantivos do atendimento — preserva sem alterar
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    if (parts[0].length <= 2) return parts[0];
    return parts[0].substring(0, 2) + '***';
  }

  const firstName = parts[0];
  const maskedRest = parts.slice(1).map(p => {
    if (p.length <= 1) return p;
    if (/^(da|de|do|das|dos|e|v\.?)$/i.test(p)) {
      return p.charAt(0) + '*';
    }
    return p.charAt(0) + '*'.repeat(Math.max(1, p.length - 1));
  }).join(' ');

  return `${firstName} ${maskedRest}`;
}

/**
 * Validação dos dígitos verificadores de CPF/CNPJ. Usada para mascarar números
 * soltos (sem rótulo e sem pontuação) sem corromper protocolos e pedidos.
 */
export function isValidCpfDigits(value: string): boolean {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const digitAt = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(digits[i]) * (length + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return digitAt(9) === Number(digits[9]) && digitAt(10) === Number(digits[10]);
}

export function isValidCnpjDigits(value: string): boolean {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const digitAt = (length: number): number => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(digits[i]) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  return digitAt(12) === Number(digits[12]) && digitAt(13) === Number(digits[13]);
}

/**
 * Motor de Anonimização PII de Alta Precisão (LGPD & Segurança)
 * Aplica máscaras direcionadas em CPF, CNPJ, Cartões, Emails, Telefones, RGs, Datas de Nascimento, CEPs, Chaves e Nomes de Clientes.
 * Protege Protocolos e Pedidos (ex: CB123456, 20260724912) para impedir falso mascaramento.
 */
export function maskPII(text: string): PiiMaskingResult {
  if (!text || typeof text !== 'string') {
    return {
      maskedText: text || '',
      detectedCount: 0,
      categories: [],
      breakdown: { cpf: 0, cnpj: 0, email: 0, phone: 0, card: 0, rg: 0, secrets: 0, name: 0, birthDate: 0, cep: 0, address: 0, bank: 0 }
    };
  }

  let masked = text;
  const breakdown: Record<string, number> = {
    cpf: 0,
    cnpj: 0,
    email: 0,
    phone: 0,
    card: 0,
    rg: 0,
    secrets: 0,
    name: 0,
    birthDate: 0,
    cep: 0,
    address: 0,
    bank: 0
  };

  // PASSO 0: Proteção temporária de marcadores operacionais (Protocolos, Pedidos e Timestamps)
  // Evita que números de protocolo ou etiquetas do atendimento sejam corrompidos
  const protectedTokens: string[] = [];
  const protectToken = (matchStr: string): string => {
    const idx = protectedTokens.length;
    protectedTokens.push(matchStr);
    return `___PROT_TOKEN_${idx}___`;
  };

  // Protege marcadores de protocolo/pedido explícitos
  const protocolRegex = /\b(protocolo|pedido|chamado|comprovante|atendimento|código|boleto|rastreio|id)\s*[:=]?\s*([0-9a-zA-Z]{6,20})\b/gi;
  masked = masked.replace(protocolRegex, (full) => protectToken(full));

  // Protege timestamps no formato [00:15], [14:09:39], [2026-08-03 10:14:02] ou Turno #4
  const timestampHeaderRegex = /\[\d{1,2}:\d{2}(?::\d{2})?\]|\[\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}:\d{2}\]|\bTurno\s*#\d+\b/gi;
  masked = masked.replace(timestampHeaderRegex, (full) => protectToken(full));

  // 1. CPF (Flexível para formatos 025.988 657 23, 123.456.789-00, 123 456 789 00 ou CPF 12345678900)
  const cpfFormattedRegex = /(?:\bCPF\s*[:=]?)?\b(\d{3})[\s\.-]+(\d{3})[\s\.-]+(\d{3})[\s\.-]+(\d{2})\b/gi;
  masked = masked.replace(cpfFormattedRegex, (fullMatch, p1, p2, p3, p4) => {
    breakdown.cpf++;
    const hasCpfPrefix = /^CPF/i.test(fullMatch.trim());
    return `${hasCpfPrefix ? 'CPF ' : ''}${p1}.***.***-${p4}`;
  });

  const cpfContextualRegex = /\b(cpf|doc|documento|cadastro)\s*(?:[:=]|é|e|eh)?\s*(\d{3})[\s\.-]?(\d{3})[\s\.-]?(\d{3})[\s\.-]?(\d{2})\b/gi;
  masked = masked.replace(cpfContextualRegex, (full, label, p1, p2, p3, p4) => {
    breakdown.cpf++;
    return `${label}: ${p1}.***.***-${p4}`;
  });

  // 2. CNPJ (00.000.000/0000-00 -> 00.***.***/0001-00)
  const cnpjRegex = /\b(\d{2})[\s\.-]?(\d{3})[\s\.-]?(\d{3})[\s\/\.-]?(\d{4})[\s\.-]?(\d{2})\b/g;
  masked = masked.replace(cnpjRegex, (_, p1, _p2, _p3, p4, p5) => {
    breakdown.cnpj++;
    return `${p1}.***.***/${p4}-${p5}`;
  });

  // 3. Cartões de Crédito (ex: 4532 1234 5678 9012 -> 4532 **** **** 9012)
  const cardFormattedRegex = /\b(\d{4})[\s.-](\d{4})[\s.-](\d{4})[\s.-](\d{4})\b/g;
  masked = masked.replace(cardFormattedRegex, (_, p1, p2, p3, p4) => {
    breakdown.card++;
    return `${p1} **** **** ${p4}`;
  });

  // 3.1 CPF e CNPJ SEM formatação (apenas dígitos), validando os dígitos
  // verificadores para não mascarar protocolos/pedidos por engano.
  masked = masked.replace(/\b\d{14}\b/g, (full) => {
    if (!isValidCnpjDigits(full)) return full;
    breakdown.cnpj++;
    return `${full.slice(0, 2)}.***.***/${full.slice(6, 10)}-${full.slice(12)}`;
  });
  masked = masked.replace(/\b\d{11}\b/g, (full) => {
    if (!isValidCpfDigits(full)) return full;
    breakdown.cpf++;
    return `${full.slice(0, 3)}.***.***-${full.slice(9)}`;
  });

  const cardContextualRegex = /\b(cartão|cartao|credit card|card)\s*[:=]?\s*(\d{4})[\s-]?\d{8}[\s-]?(\d{4})\b/gi;
  masked = masked.replace(cardContextualRegex, (full, label, p1, p2) => {
    breakdown.card++;
    return `${label}: ${p1} **** **** ${p2}`;
  });

  // 4. E-mails (ex: joao.silva@empresa.com -> jo****@empresa.com)
  const emailRegex = /\b([A-Za-z0-9._%+-]{1,20})@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
  masked = masked.replace(emailRegex, (_, local, domain) => {
    breakdown.email++;
    let maskedLocal = local;
    if (local.length <= 2) {
      maskedLocal = local.charAt(0) + '*';
    } else {
      maskedLocal = local.substring(0, 2) + '*'.repeat(Math.min(local.length - 2, 4));
    }
    return `${maskedLocal}@${domain}`;
  });

  // 5. Telefones Válidos no Brasil (com DDD entre 11 e 99 e 8 ou 9 dígitos, ex: +5521980608496)
  const phoneFormattedRegex = /(?:^|[^\d\w])(?:\+?55\s?)?\(?([1-9]{2})\)?[\s-]?(9?\d{4})[\s-]?(\d{4})\b/g;
  masked = masked.replace(phoneFormattedRegex, (fullMatch, ddd, firstPart, lastFour) => {
    const numDdd = parseInt(ddd, 10);
    if (numDdd >= 11 && numDdd <= 99) {
      breakdown.phone++;
      const prefix = fullMatch.startsWith(' ') || fullMatch.startsWith('\n') ? fullMatch.charAt(0) : '';
      const firstDigit = firstPart.charAt(0);
      return `${prefix}(${ddd}) ${firstDigit}****-${lastFour}`;
    }
    return fullMatch;
  });

  // 6. RGs (ex: 12.345.678-9 -> 12.***.***-9)
  const rgRegex = /\b(\d{2})\.\d{3}\.\d{3}-([0-9xX])\b/g;
  masked = masked.replace(rgRegex, (_, p1, p2) => {
    breakdown.rg++;
    return `${p1}.***.***-${p2}`;
  });

  // 7. Data de Nascimento (ex: "data de nascimento: 15/04/1988")
  const birthDateRegex = /\b(data\s+de\s+nascimento|dt\.?\s*nasc\.?|nascido\s+em|nascida\s+em|nasci\s+em|nasceu\s+em|nascimento)\s*[:=]?\s*(\d{2})[\/\.-](\d{2})[\/\.-](\d{4})\b/gi;
  masked = masked.replace(birthDateRegex, (full, label, dd, mm, yyyy) => {
    breakdown.birthDate++;
    return `${label}: ${dd}/${mm}/****`;
  });

  // 8. CEP (ex: CEP 01234-567)
  const cepRegex = /\b(cep)\s*[:=]?\s*(\d{5})[-.]?(\d{3})\b/gi;
  masked = masked.replace(cepRegex, (full, label, p1, p2) => {
    breakdown.cep++;
    return `${label}: ${p1}-***`;
  });

  // 9. Senhas / PINs / CVVs / Chave PIX explícitas
  const secretsRegex = /\b(senha|pin|cvv|cvc|codigo de seguranca|código de segurança|chave pix)\s*(?:[:=]|é|e|eh)?\s*([0-9a-zA-Z@#$]{3,20})\b/gi;
  masked = masked.replace(secretsRegex, (fullMatch, label, secretVal) => {
    breakdown.secrets++;
    const stars = '*'.repeat(Math.min(secretVal.length, 6));
    return `${label}: ${stars}`;
  });

  // 9.1 Endereço residencial/comercial (logradouro + complemento)
  const addressRegex = /\b((?:rua|avenida|av\.?|alameda|travessa|estrada|rodovia|praça|praca)\s+)([^,;\n.]{3,90})/gi;
  masked = masked.replace(addressRegex, (_full, prefix) => {
    breakdown.address++;
    return `${prefix}*** (endereço mascarado)`;
  });

  // 9.2 Dados bancários explícitos (agência/conta/banco + número)
  const bankRegex = /\b(ag[êe]ncia|conta(?:\s+corrente|\s+poupan[çc]a)?|banco)\s*(?:n[úu]mero|n[ºo°])?\s*[:=]?\s*([0-9][0-9.\-\s]{3,24})/gi;
  masked = masked.replace(bankRegex, (_full, label) => {
    breakdown.bank++;
    return `${label}: ****`;
  });

  // 10. Mascaramento Estrito de Nomes em Tags e Linhas do Chat
  // Nomes em tags [CLIENTE - Graciete Miguel Da Silva Barbosa] ou [CX - Doce Helena ...]
  const bracketedCustomerTag = /\[\s*(CLIENTE|CONSUMIDOR|USER|CX|Consumidor\s+Casas\s+Bahia|Cliente\s+Receptivo)\s*[-:]\s*([^\]\n]+)\]/gi;
  masked = masked.replace(bracketedCustomerTag, (fullMatch, role, name) => {
    const cleanName = name.trim();
    const maskedN = maskCustomerName(cleanName);
    if (maskedN !== cleanName) {
      breakdown.name++;
      return `[${role.toUpperCase()} - ${maskedN}]`;
    }
    return fullMatch;
  });

  // Nomes sem colchetes no início de linha: CLIENTE - Mariana Lopes:
  const lineCustomerTag = /^(CLIENTE|CONSUMIDOR|USER|CX)\s*[-:]\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{1,15}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{1,15}){1,4})\s*:/gim;
  masked = masked.replace(lineCustomerTag, (fullMatch, role, name) => {
    const cleanName = name.trim();
    const maskedN = maskCustomerName(cleanName);
    if (maskedN !== cleanName) {
      breakdown.name++;
      return `${role.toUpperCase()} - ${maskedN}:`;
    }
    return fullMatch;
  });

  // Linhas no formato "Cliente: João Silva" (sem colchetes/pontuação de turno)
  const colonCustomerLine = /^(CLIENTE|CONSUMIDOR|USER|CX)\s*:\s*(.+)$/gim;
  masked = masked.replace(colonCustomerLine, (fullMatch, role, value) => {
    const cleanValue = String(value).trim();
    const maskedV = maskCustomerName(cleanValue);
    if (maskedV !== cleanValue) {
      breakdown.name++;
      return `${role.toUpperCase()}: ${maskedV}`;
    }
    return fullMatch;
  });

  // "em nome de X", "falei com X", "atendido por X" — nomes próprios citados
  const inNameOfRegex = /\b(em\s+nome\s+de|falei\s+com|falar\s+com|atendido\s+por|atendida\s+por)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{1,15}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{1,15}){0,4})/gi;
  masked = masked.replace(inNameOfRegex, (fullMatch, intro, rawName) => {
    const maskedN = maskCustomerName(rawName);
    if (maskedN !== rawName) {
      breakdown.name++;
      return `${intro} ${maskedN}`;
    }
    return fullMatch;
  });

  // Mascaramento de falas introdutórias explícitas ("Meu nome é Graciete Miguel Da Silva Barbosa")
  const spokenNameRegex = /\b(meu\s+nome\s+é|meu\s+nome\s+e|me\s+chamo|falo\s+com\s+a\s+sra\.|falo\s+com\s+o\s+sr\.)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{1,15}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{1,15}){1,4})\b/gi;
  masked = masked.replace(spokenNameRegex, (fullMatch, intro, rawName) => {
    const maskedN = maskCustomerName(rawName);
    if (maskedN !== rawName) {
      breakdown.name++;
      return `${intro} ${maskedN}`;
    }
    return fullMatch;
  });

  // Mascaramento de saudações direcionadas com nome (ex: "Graciete, bom dia!", "Olá Graciete")
  const greetingNameRegex = /\b(olá|ola|oi|bom\s+dia|boa\s+tarde|boa\s+noite|sr\.|sra\.)\b\s*,?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,15})\b/gi;
  masked = masked.replace(greetingNameRegex, (fullMatch, greeting, name) => {
    if (!NON_NAME_DIALOGUE_WORDS.has(name.toLowerCase())) {
      breakdown.name++;
      const maskedSingleName = name.charAt(0) + '*'.repeat(Math.max(1, name.length - 1));
      return `${greeting}, ${maskedSingleName}`;
    }
    return fullMatch;
  });

  const nameGreetingRegex = /\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,15})\s*,\s*(bom\s+dia|boa\s+tarde|boa\s+noite|olá|ola|oi)\b/gi;
  masked = masked.replace(nameGreetingRegex, (fullMatch, name, greeting) => {
    if (!NON_NAME_DIALOGUE_WORDS.has(name.toLowerCase())) {
      breakdown.name++;
      const maskedSingleName = name.charAt(0) + '*'.repeat(Math.max(1, name.length - 1));
      return `${maskedSingleName}, ${greeting}`;
    }
    return fullMatch;
  });

  // Mascaramento de mensagens de chat que são Nomes Próprios isolados (ex: "Graciete Miguel Da Silva Barbosa")
  const textLines = masked.split('\n');
  const processedLines = textLines.map(line => {
    const trimmedLine = line.trim();
    if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõçA-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{3,80}$/.test(trimmedLine)) {
      const words = trimmedLine.split(/\s+/);
      if (words.length >= 2 && words.length <= 6) {
        const hasDialogueWord = words.some(w => NON_NAME_DIALOGUE_WORDS.has(w.toLowerCase()));
        if (!hasDialogueWord) {
          const maskedNameLine = maskCustomerName(trimmedLine);
          if (maskedNameLine !== trimmedLine) {
            breakdown.name++;
            return maskedNameLine;
          }
        }
      }
    }
    return line;
  });
  masked = processedLines.join('\n');

  // RESTAURAÇÃO DOS TOKENS PROTEGIDOS (Protocolos, Timestamps, etc.)
  protectedTokens.forEach((tokenVal, idx) => {
    masked = masked.replace(`___PROT_TOKEN_${idx}___`, tokenVal);
  });

  const categories = Object.keys(breakdown).filter(k => breakdown[k] > 0);
  const detectedCount = Object.values(breakdown).reduce((acc, curr) => acc + curr, 0);

  return {
    maskedText: masked,
    detectedCount,
    categories,
    breakdown
  };
}
