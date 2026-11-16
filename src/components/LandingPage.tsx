import React, { useState, useEffect, useRef } from 'react';
import Lenis from 'lenis';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Bot, 
  BarChart3, 
  Building2, 
  ShieldCheck, 
  Zap, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  SlidersHorizontal, 
  FileText, 
  Lock, 
  ChevronDown, 
  ChevronUp, 
  PhoneCall, 
  MessageSquare, 
  RefreshCw,
  LogIn,
  Layers,
  Activity,
  Check,
  Headphones,
  Sliders,
  CheckSquare,
  Play,
  Pause,
  Volume2,
  AlertTriangle,
  Clock,
  Search,
  Users,
  Award,
  Database,
  Terminal,
  Server,
  ArrowUpRight,
  HelpCircle,
  Cpu,
  Sparkle,
  Menu,
  X,
  Shield,
  TrendingUp,
  Workflow
} from 'lucide-react';

interface LandingPageProps {
  onOpenLogin: () => void;
}

export default function LandingPage({ onOpenLogin }: LandingPageProps) {
  // Navigation active state
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [faqSearchQuery, setFaqSearchQuery] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [activeMegaMenu, setActiveMegaMenu] = useState<'recursos' | 'setores' | null>(null);
  
  // Interactive Simulator State
  const [selectedDemoScenario, setSelectedDemoScenario] = useState<number>(0);
  const [demoScrollProgress, setDemoScrollProgress] = useState<number>(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(18);
  const [piiViewMode, setPiiViewMode] = useState<'masked' | 'raw'>('masked');
  const [activeIndustryTab, setActiveIndustryTab] = useState<'varejo' | 'banco' | 'saude' | 'telecom'>('varejo');

  const demoSectionRef = useRef<HTMLDivElement>(null);

  // Interactive ROI Calculator State
  const [monthlyCalls, setMonthlyCalls] = useState<number>(120000);
  const [humanMonitors, setHumanMonitors] = useState<number>(8);
  const [averageCallDurationMin, setAverageCallDurationMin] = useState<number>(6);

  // Demo Contact Modal State
  const [isDemoModalOpen, setIsDemoModalOpen] = useState<boolean>(false);
  const [demoSubmitted, setDemoSubmitted] = useState<boolean>(false);
  const [demoFormData, setDemoFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    volume: '50k-200k',
    channel: 'ambos'
  });

  // Calculate ROI metrics dynamically
  const manualCoverageCalls = Math.round(monthlyCalls * 0.02); // 2% human sample
  const manualHoursSpent = Math.round(manualCoverageCalls * 0.33); // ~20 min per call with audit
  const manualCostEstimate = humanMonitors * 5800; // ~R$ 5.8k per monitor loaded salary & overhead
  const auditaQaCostEstimate = Math.round(monthlyCalls * 0.075); // ~R$ 0.075/call
  const monthlySavings = Math.max(0, manualCostEstimate - auditaQaCostEstimate);
  const annualSavings = monthlySavings * 12;
  const hoursSavedPerMonth = manualHoursSpent;

  const [featureCategory, setFeatureCategory] = useState<'all' | 'ia' | 'bpo' | 'lgpd' | 'integracao'>('all');

  const demoScenarios = [
    {
      id: 0,
      title: "Voz: SAC - Troca Imediata & Avaria de Transporte",
      channel: "audio",
      bpo: "BPO Sul Operações",
      agent: "Lucas Andrade",
      customer: "Mariana Costa",
      duration: "03:42",
      tma: "222s",
      sentimentScore: "+0.84",
      sentimentLabel: "Altamente Positivo",
      fcr: "Sim (Resolvido no 1º Contato)",
      transcript: [
        { time: "00:00", speaker: "Lucas Andrade (Atendente)", role: "agent", text: "Central de Atendimento ao Cliente, bom dia! Meu nome é Lucas Andrade, com quem tenho o prazer de falar?" },
        { time: "00:06", speaker: "Mariana Costa (Cliente)", role: "customer", text: "Olá Lucas, bom dia. Comprei uma Smart TV 55'' pelo aplicativo e quando a transportadora entregou ontem, o painel estava trincado. Preciso trocar urgentemente." },
        { time: "00:18", speaker: "Lucas Andrade (Atendente)", role: "agent", text: "Compreendo perfeitamente sua frustração e peço sinceras desculpas pelo ocorrido, Sra. Mariana. Fique tranquila que vou resolver agora mesmo. Para confirmar seu cadastro, me informe seu CPF e o número do pedido?" },
        { time: "00:30", speaker: "Mariana Costa (Cliente)", role: "customer", text: "Meu CPF é [CPF_MASCARADO] e o número do pedido é 9810294." },
        { time: "00:38", speaker: "Lucas Andrade (Atendente)", role: "agent", text: "Perfeito, cadastro validado! Já emiti a autorização de coleta domiciliar prioritária sem qualquer custo. A transportadora recolherá em até 2 dias úteis e um novo aparelho já foi faturado. Anote seu protocolo oficial: 20269812401." },
        { time: "00:54", speaker: "Mariana Costa (Cliente)", role: "customer", text: "Nossa, que atendimento rápido e eficiente! Muito obrigada pela atenção, Lucas!" },
        { time: "01:00", speaker: "Lucas Andrade (Atendente)", role: "agent", text: "Nós que agradecemos sua preferência. O protocolo foi enviado via SMS e e-mail. Tenha um excelente dia!" }
      ],
      result: {
        score: 100,
        status: "completed",
        criticalFail: false,
        sentiment: "Positivo / Empático",
        scriptAdherence: 100,
        regulationCompliance: "100% Conforme Decreto SAC 11.034",
        scorecardItems: [
          { name: "Saudação e Identificação Institucional", points: 15, max: 15, status: "ok", detail: "Apresentou nome e central no início." },
          { name: "Validação Cadastral & Segurança LGPD", points: 15, max: 15, status: "ok", detail: "Confirmou CPF e pedido sem expor dados." },
          { name: "Empatia & Escuta Ativa", points: 20, max: 20, status: "ok", detail: "Acolheu a queixa e tranquilizou o cliente." },
          { name: "Resolução Efetiva no 1º Contato (FCR)", points: 30, max: 30, status: "ok", detail: "Coleta e reenvio gerados de imediato." },
          { name: "Fornecimento de Protocolo Regulatório", points: 20, max: 20, status: "ok", detail: "Protocolo 20269812401 verbalizado e registrado." }
        ],
        summary: "Atendimento de padrão ouro. Execução impecável das diretrizes de hospitalidade, celeridade na solução logística e cumprimento integral do Decreto do SAC."
      }
    },
    {
      id: 1,
      title: "Chat: Negociação de Débito - Isenção de Encargos",
      channel: "chat",
      bpo: "BPO Nexus Cobrança",
      agent: "Fernanda Lima",
      customer: "Carlos Eduardo",
      duration: "04:15",
      tma: "255s",
      sentimentScore: "+0.62",
      sentimentLabel: "Positivo / Conciliador",
      fcr: "Sim (Acordo Concluído)",
      transcript: [
        { time: "10:15", speaker: "Fernanda Lima (Agente)", role: "agent", text: "Olá Carlos! Sou a Fernanda da assessoria financeira. Como posso ajudar você a regularizar sua fatura hoje?" },
        { time: "10:18", speaker: "Carlos Eduardo (Cliente)", role: "customer", text: "Quero quitar minha parcela em atraso, mas o valor com juros ficou pesado. Tem alguma proposta para pagamento à vista no Pix?" },
        { time: "10:22", speaker: "Fernanda Lima (Agente)", role: "agent", text: "Para consultar as condições exclusivas liberadas para o seu CPF, confirme sua data de nascimento, por favor." },
        { time: "10:27", speaker: "Carlos Eduardo (Cliente)", role: "customer", text: "Nasci em 14/05/1988 e o CPF é [CPF_MASCARADO]." },
        { time: "10:33", speaker: "Fernanda Lima (Agente)", role: "agent", text: "Consultei nosso sistema e obtive aprovação para desconto integral de juros e multa. O valor cai de R$ 520,00 para R$ 320,00 para liquidação hoje via Pix. Posso gerar o código?" },
        { time: "10:39", speaker: "Carlos Eduardo (Cliente)", role: "customer", text: "Perfeito! Pode gerar o Pix agora." },
        { time: "10:43", speaker: "Fernanda Lima (Agente)", role: "agent", text: "Código Copia e Cola enviado! Segue seu protocolo de acordo registrado: 20267710294. A baixa ocorrerá em até 1 hora útil." }
      ],
      result: {
        score: 95,
        status: "completed",
        criticalFail: false,
        sentiment: "Positivo / Assertivo",
        scriptAdherence: 95,
        regulationCompliance: "Conforme Diretrizes de Cobrança Ética",
        scorecardItems: [
          { name: "Abertura Humanizada no Canal Digital", points: 15, max: 15, status: "ok", detail: "Abordagem cordial e sem tom coercitivo." },
          { name: "Autenticação em Dois Fatores Cadastrais", points: 15, max: 15, status: "ok", detail: "Validou CPF e data de nascimento." },
          { name: "Negociação dentro dos Limites de Alçada", points: 25, max: 25, status: "ok", detail: "Desconto dentro da esteira aprovada." },
          { name: "Clareza nos Meios e Prazos de Liquidação", points: 20, max: 20, status: "ok", detail: "Informou prazo de baixa via Pix." },
          { name: "Registro e Confirmação de Protocolo", points: 20, max: 25, status: "warning", detail: "Não reforçou canal de autoatendimento para futuros comprovantes." }
        ],
        summary: "Negociação exemplar de recuperação de crédito. Condução ética, foco em acordo amigável e formalização com código de protocolo imediato."
      }
    },
    {
      id: 2,
      title: "Voz: Falha Crítica Zera-Nota - Recusa de Protocolo & Desligamento",
      channel: "audio",
      bpo: "BPO Operacional Alpha",
      agent: "Operador ID #4092",
      customer: "Roberto Silva",
      duration: "01:10",
      tma: "70s",
      sentimentScore: "-0.95",
      sentimentLabel: "Extremamente Negativo",
      fcr: "Não (Deserção da Operação)",
      transcript: [
        { time: "14:02", speaker: "Operador ID #4092", role: "agent", text: "Alô, fala logo. O que você precisa?" },
        { time: "14:05", speaker: "Roberto Silva (Cliente)", role: "customer", text: "É a quarta vez que ligo esta semana! O técnico não compareceu para o reparo da minha internet e se não resolverem hoje eu vou acionar o Procon e meu advogado!" },
        { time: "14:14", speaker: "Operador ID #4092", role: "agent", text: "O senhor pode reclamar onde quiser, não tenho nada a ver com o técnico que faltou. Problema é da rua." },
        { time: "14:21", speaker: "Roberto Silva (Cliente)", role: "customer", text: "Que absurdo! Me passe seu nome completo e o número de protocolo desta chamada agora!" },
        { time: "14:27", speaker: "Operador ID #4092", role: "agent", text: "Não vou passar nada. Procure seus direitos. [DESLIGAMENTO ABRUPTO DA LIGAÇÃO PELO ATENDENTE]" }
      ],
      result: {
        score: 0,
        status: "critical_fail",
        criticalFail: true,
        sentiment: "Hostil / Agressivo",
        scriptAdherence: 0,
        regulationCompliance: "0% - Infração Gravíssima (Decreto SAC)",
        scorecardItems: [
          { name: "Saudação Padronizada", points: 0, max: 15, status: "fail", detail: "FALHA CRÍTICA: Ausência total de identificação." },
          { name: "Acolhimento da Demanda", points: 0, max: 20, status: "fail", detail: "FALHA CRÍTICA: Desdém e hostilidade explícita." },
          { name: "Fornecimento de Protocolo", points: 0, max: 25, status: "fail", detail: "FALHA ZERA-NOTA: Recusa categórica de protocolo." },
          { name: "Tratativa de Risco Jurídico / Procon", points: 0, max: 20, status: "fail", detail: "FALHA CRÍTICA: Não houve transbordo para supervisão." },
          { name: "Encerramento Regular", points: 0, max: 20, status: "fail", detail: "FALHA ZERA-NOTA: Desligamento abrupto na cara do cliente." }
        ],
        summary: "AUDITORIA ZERADA AUTOMATICAMENTE (FALHA ZERA-NOTA). Foram violados 4 preceitos do Código de Defesa do Consumidor e Decreto do SAC. Alerta de risco disparado instantaneamente para a gerência de qualidade do BPO."
      }
    }
  ];

  // Lenis Smooth Momentum Scroll Engine
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.5,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  // Sticky Scroll Handler: calculates scroll progress & scenario switching
  useEffect(() => {
    let animFrame: number;

    const updateDemoScroll = () => {
      if (!demoSectionRef.current) return;
      const rect = demoSectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const totalScrollable = rect.height - windowHeight;
      if (totalScrollable <= 0) return;

      const scrolled = -rect.top;
      if (scrolled >= -150 && scrolled <= totalScrollable + 150) {
        const progress = Math.min(1, Math.max(0, scrolled / totalScrollable));
        setDemoScrollProgress(Math.round(progress * 100));

        let targetScenario = 0;
        if (progress < 0.35) {
          targetScenario = 0;
        } else if (progress < 0.70) {
          targetScenario = 1;
        } else {
          targetScenario = 2;
        }

        setSelectedDemoScenario(targetScenario);
      }
    };

    const handleScroll = () => {
      cancelAnimationFrame(animFrame);
      animFrame = requestAnimationFrame(updateDemoScroll);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    updateDemoScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animFrame);
    };
  }, []);

  const faqs = [
    {
      q: "Como o AuditaQA se conecta com nossa infraestrutura de telefonia e mensageria?",
      a: "O AuditaQA possui arquitetura agnóstica com integração nativa pré-homologada para Genesys Cloud, Avaya Aura, Cisco Contact Center, Asterisk/FreePBX, Zendesk Talk/Support, Salesforce Service Cloud, Blip e WhatsApp Business API. Ele consome diretamente fluxos de áudio estéreo (Diarized .wav/.mp3), metadados via Webhooks em tempo real e arquivos via buckets AWS S3, Google Cloud Storage ou Azure Blob Storage."
    },
    {
      q: "Qual a diferença prática entre a auditoria por IA e a amostragem humana de 2%?",
      a: "Na amostragem manual legada, 98% dos atendimentos permanecem como uma 'caixa-preta': desvios de conduta, ameaças de Procon e quebras de script passam despercebidos por semanas. Com o AuditaQA, 100% dos contatos são transcritos e avaliados em menos de 3 segundos, gerando relatórios de calibração imparciais, detecção instantânea de faltas zera-nota e identificação cirúrgica de necessidades de reciclagem e treinamento."
    },
    {
      q: "Como é garantido o isolamento de dados e sigilo entre diferentes BPOs parceiros?",
      a: "A plataforma opera em arquitetura Multi-Tenant com controle de acesso baseado em funções (RBAC). Cada fornecedor de BPO ou parceiro terceiro possui sua própria partição lógica e só consegue visualizar as métricas, gravações e operadores da sua própria equipe. A empresa contratante (Master) possui o cockpit consolidado comparando SLA, aderência e curva de conformidade entre todos os parceiros em tempo real."
    },
    {
      q: "Como funciona a conformidade com a LGPD e o tratamento de dados sensíveis (PII)?",
      a: "O AuditaQA executa um pipeline de sanitização cognitiva em memória (In-Memory PII Stripping). Antes que qualquer áudio transcrito seja indexado no banco de dados ou avaliado pelos modelos de inteligência, números de CPF, números de cartões de crédito (PAN/CVV), senhas faladas e dados médicos são substituídos por tokens criptográficos irreversíveis. Nenhuma informação pessoal confidencial é exposta em logs abertos."
    },
    {
      q: "É possível configurar nossas próprias regras de negócio, pesos e formulários de monitoria?",
      a: "Sim, de forma 100% visual e sem necessidade de código. No módulo de Metodologia, sua equipe de Qualidade pode criar formulários personalizados para cada operação (SAC, Retenção, Cobrança, Vendas, Suporte N2), definir pesos ponderados por bloco, configurar termos obrigatórios, palavras proibidas e cadastrar regras de Falha Crítica Zera-Nota imediata."
    },
    {
      q: "Qual o prazo médio de implementação do AuditaQA em uma operação corporativa?",
      a: "Graças aos nossos conectores pré-construídos e esteira de calibração automática de formulários, o piloto assistido entra em funcionamento em 5 a 10 dias úteis, operando em paralelo com a monitoria humana para aferição do índice de concordância (Calibração R² > 94%)."
    }
  ];

  const filteredFaqs = faqs.filter(f => 
    f.q.toLowerCase().includes(faqSearchQuery.toLowerCase()) || 
    f.a.toLowerCase().includes(faqSearchQuery.toLowerCase())
  );

  const currentScenario = demoScenarios[selectedDemoScenario];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-600 selection:text-white flex flex-col antialiased">
      
      {/* 1. REFINED MINIMALIST HEADER */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Brand Identity */}
          <div 
            className="flex items-center gap-2.5 group cursor-pointer select-none" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs group-hover:bg-indigo-700 transition-colors">
              <Bot className="w-4 h-4" />
            </div>
            <span className="text-base font-bold text-slate-900 tracking-tight">
              Audita<span className="text-indigo-600 font-extrabold">QA</span>
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-slate-600">
            <a href="#demo" className="hover:text-indigo-600 transition-colors py-1">
              Simulador
            </a>
            <a href="#recursos" className="hover:text-indigo-600 transition-colors py-1">
              Recursos
            </a>
            <a href="#calculadora" className="hover:text-indigo-600 transition-colors py-1">
              Calculadora ROI
            </a>
            <a href="#seguranca" className="hover:text-indigo-600 transition-colors py-1">
              Segurança & LGPD
            </a>
            <a href="#comparativo" className="hover:text-indigo-600 transition-colors py-1">
              Amostragem vs IA
            </a>
            <a href="#faq" className="hover:text-indigo-600 transition-colors py-1">
              FAQ
            </a>
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="text-xs font-medium text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-lg hover:bg-slate-100/80 transition-colors cursor-pointer"
            >
              Solicitar Demo
            </button>
            <button
              onClick={onOpenLogin}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all shadow-2xs hover:shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Acessar Sistema</span>
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="md:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-xl px-4 py-4 space-y-3"
            >
              <div className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                <a
                  href="#demo"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                >
                  Simulador
                </a>
                <a
                  href="#recursos"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                >
                  Recursos
                </a>
                <a
                  href="#calculadora"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                >
                  Calculadora ROI
                </a>
                <a
                  href="#seguranca"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                >
                  Segurança & LGPD
                </a>
                <a
                  href="#comparativo"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                >
                  Amostragem vs IA
                </a>
                <a
                  href="#faq"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2 rounded-lg hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                >
                  FAQ
                </a>
              </div>

              <div className="pt-3 border-t border-slate-200/80 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setIsDemoModalOpen(true);
                  }}
                  className="w-full text-center text-xs font-semibold py-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Solicitar Demo
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenLogin();
                  }}
                  className="w-full text-center text-xs font-semibold py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Acessar Sistema</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* 2. HERO SECTION COM ATMOSFERA ELEGANTE E TRUST BADGES */}
      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden bg-gradient-to-b from-white via-indigo-50/25 to-slate-50 border-b border-slate-200/80">
        
        {/* Soft atmospheric gradient accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-r from-indigo-100/50 via-purple-100/40 to-blue-100/50 rounded-full blur-[110px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          
          {/* Live Operational Ticker Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white border border-slate-200/90 text-slate-700 text-xs font-semibold mb-6 shadow-2xs">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-indigo-700 font-bold">148.920 chamadas</span>
            <span className="text-slate-400">auditadas com IA nas últimas 24h</span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto leading-[1.14]">
            Auditoria Contínua de <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-900">100% dos Atendimentos</span> com Inteligência Artificial
          </h1>

          {/* Subtitle */}
          <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed font-normal">
            Elimine a fragilidade da amostragem manual de 2%. O AuditaQA transcreve, analisa e pontua cada áudio e chat em segundos com farol de risco imediato, conformidade com o Decreto do SAC e calibração multi-BPO.
          </p>

          {/* Hero CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={onOpenLogin}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm px-8 py-3.5 rounded-xl shadow-md hover:shadow-indigo-200 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Acessar Plataforma AuditaQA</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('demo');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 border border-slate-300/90 font-bold text-xs sm:text-sm px-6 py-3.5 rounded-xl shadow-2xs hover:border-slate-400 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Activity className="w-4 h-4 text-indigo-600" />
              <span>Experimentar Simulador Interativo</span>
            </button>
          </div>

          {/* Stats Bar */}
          <div className="mt-12 max-w-5xl mx-auto bg-white/90 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-xs grid grid-cols-2 lg:grid-cols-4 gap-4 text-center divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80">
            <div className="p-2">
              <div className="text-2xl sm:text-3xl font-black text-indigo-600 font-mono">100%</div>
              <div className="text-xs text-slate-600 font-medium mt-1">Cobertura em Voz e Chat</div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">50x mais que o método manual</div>
            </div>
            <div className="p-2 pt-4 sm:pt-2">
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">&lt; 2.4s</div>
              <div className="text-xs text-slate-600 font-medium mt-1">Tempo Médio de Auditoria</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Speech & Text Analytics</div>
            </div>
            <div className="p-2 pt-4 sm:pt-2">
              <div className="text-2xl sm:text-3xl font-black text-indigo-600 font-mono">0%</div>
              <div className="text-xs text-slate-600 font-medium mt-1">Viés & Subjetividade</div>
              <div className="text-[11px] text-indigo-600 font-semibold mt-0.5">Régua calibrada e auditável</div>
            </div>
            <div className="p-2 pt-4 sm:pt-2">
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">85%</div>
              <div className="text-xs text-slate-600 font-medium mt-1">Redução de Custos de QA</div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">Payback em menos de 60 dias</div>
            </div>
          </div>

          {/* Supported Omnichannel Platforms Banner */}
          <div className="mt-12 pt-8 border-t border-slate-200/70">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-4">
              Integração Homologada com as Maiores Plataformas de Contact Center
            </p>
            <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-10 text-slate-500 text-xs font-semibold opacity-85">
              <span className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                <Server className="w-4 h-4 text-indigo-500" /> Genesys Cloud
              </span>
              <span className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                <PhoneCall className="w-4 h-4 text-indigo-500" /> Avaya Aura
              </span>
              <span className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                <MessageSquare className="w-4 h-4 text-indigo-500" /> Zendesk Suite
              </span>
              <span className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                <Database className="w-4 h-4 text-indigo-500" /> Salesforce Service Cloud
              </span>
              <span className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                <Cpu className="w-4 h-4 text-indigo-500" /> AWS S3 / Connect
              </span>
              <span className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                <Lock className="w-4 h-4 text-indigo-500" /> WhatsApp Enterprise API
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* 3. SIMULADOR INTERATIVO STICKY COM ÁUDIO PLAYER & ANÁLISE DE IA */}
      <section id="demo" ref={demoSectionRef} className="relative bg-slate-50 border-b border-slate-200 min-h-[230vh] lg:min-h-[260vh]">
        
        <div className="sticky top-12 sm:top-16 py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-3.5 py-1 rounded-full shadow-2xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulador Operacional em Tempo Real</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-2">
              Veja a IA Avaliando Atendimentos Reais
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm max-w-xl mx-auto mt-1">
              Role a página para navegar dinamicamente entre os 3 cenários ou selecione diretamente abaixo.
            </p>

            {/* Scroll Progress Indicator */}
            <div className="mt-3.5 max-w-md mx-auto">
              <div className="flex items-center justify-between text-xs text-slate-500 font-mono mb-1 px-1">
                <span>Progresso da Demonstração</span>
                <span className="text-indigo-700 font-bold">{demoScrollProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden border border-slate-300/80 p-0.5">
                <div 
                  className="bg-gradient-to-r from-indigo-600 to-indigo-800 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.max(6, demoScrollProgress))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Coluna Esquerda: Cenários e Transcrição */}
            <div className="lg:col-span-6 space-y-3.5 text-left">
              
              {/* Scenario Tab Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {demoScenarios.map((sc, idx) => {
                  const isSel = selectedDemoScenario === idx;
                  return (
                    <button
                      key={sc.id}
                      onClick={() => setSelectedDemoScenario(idx)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSel
                          ? 'bg-white border-indigo-600 ring-2 ring-indigo-100 shadow-xs'
                          : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          sc.channel === 'audio' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {sc.channel === 'audio' ? 'Voz' : 'Chat'}
                        </span>
                        <span className={`text-[10px] font-bold ${
                          sc.result.criticalFail ? 'text-rose-600' : 'text-emerald-600'
                        }`}>
                          {sc.result.score} pts
                        </span>
                      </div>
                      <div className={`text-xs font-bold truncate ${isSel ? 'text-indigo-950' : 'text-slate-800'}`}>
                        {idx === 0 ? "1. Troca SAC" : idx === 1 ? "2. Acordo Cobrança" : "3. Falha Crítica"}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Call Details Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between text-xs shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${
                    currentScenario.channel === 'audio' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {currentScenario.channel === 'audio' ? <PhoneCall className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{currentScenario.title}</div>
                    <div className="text-[11px] text-slate-500">Operador: <strong>{currentScenario.agent}</strong> • {currentScenario.bpo}</div>
                  </div>
                </div>
                <div className="text-right font-mono text-[11px] text-slate-500">
                  <div>Duração: {currentScenario.duration}</div>
                  <div className="text-indigo-600 font-bold">TMA: {currentScenario.tma}</div>
                </div>
              </div>

              {/* Audio Waveform Mockup (for Audio channel) */}
              {currentScenario.channel === 'audio' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between mb-2 text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Headphones className="w-3.5 h-3.5 text-indigo-600" />
                      Reprodução Estéreo com Diarização de Canais
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">Canal L: Agente | Canal R: Cliente</span>
                  </div>
                  
                  {/* Waveform Visualization Bars */}
                  <div className="flex items-center gap-1 h-8 bg-slate-50 p-2 rounded-xl border border-slate-200 overflow-hidden">
                    {Array.from({ length: 44 }).map((_, i) => {
                      const heights = [30, 45, 75, 20, 90, 60, 40, 85, 95, 30, 65, 80, 45, 90, 35, 70, 85, 40, 60, 75, 90, 20, 50, 80, 65, 45, 95, 35, 70, 85, 40, 60, 75, 90, 30, 55, 70, 85, 40, 60, 75, 90, 30, 45];
                      const isPast = (i / 44) <= 0.45;
                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-full transition-all ${
                            isPast ? 'bg-indigo-600' : 'bg-slate-300'
                          }`}
                          style={{ height: `${heights[i % heights.length]}%` }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Transcript Box */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Diálogo Transcrito e Indexado</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 font-mono bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                    STA 100% Sincronizado
                  </span>
                </div>
                
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={selectedDemoScenario}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2.5 max-h-44 sm:max-h-52 overflow-y-auto custom-scrollbar text-xs leading-relaxed pr-1"
                  >
                    {currentScenario.transcript.map((line, idx) => {
                      const isAgent = line.role === 'agent';
                      const isCritical = currentScenario.result.criticalFail && isAgent;
                      return (
                        <div 
                          key={idx}
                          className={`p-2.5 rounded-xl border ${
                            isCritical
                              ? 'bg-rose-50/90 border-rose-200 text-rose-900'
                              : isAgent
                              ? 'bg-indigo-50/40 border-indigo-100 text-slate-800'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                            <span className={`font-bold ${isCritical ? 'text-rose-700' : isAgent ? 'text-indigo-700' : 'text-slate-600'}`}>
                              {line.speaker}
                            </span>
                            <span className="text-slate-400">[{line.time}]</span>
                          </div>
                          <p className="text-[11px] leading-relaxed">
                            {line.text}
                          </p>
                        </div>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </div>

            </div>

            {/* Coluna Direita: Resultado da Auditoria com Scorecard */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 text-left shadow-xs flex flex-col justify-between min-h-[490px]">
              
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wide block">Auditoria Cognitiva do Atendimento</span>
                      <span className="text-[10px] text-slate-400 font-mono">ID Chamada: #AUD-{108420 + currentScenario.id}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${
                    currentScenario.result.criticalFail 
                      ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse' 
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {currentScenario.result.criticalFail ? '⚠️ Falha Zera-Nota' : '✓ Aprovado no Compliance'}
                  </span>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedDemoScenario}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-4"
                  >
                    {/* Score Bar */}
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Nota Final</span>
                        <div className={`text-2xl font-black mt-0.5 font-mono ${
                          currentScenario.result.criticalFail ? 'text-rose-600' : 'text-emerald-600'
                        }`}>
                          {currentScenario.result.score} <span className="text-xs font-normal text-slate-400">/ 100</span>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Sentimento Geral</span>
                        <div className="text-xs font-bold text-slate-800 mt-1 truncate">{currentScenario.result.sentiment}</div>
                        <span className="text-[10px] font-mono text-slate-400">{currentScenario.sentimentScore}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Script Adherence</span>
                        <div className="text-xs font-bold text-indigo-700 mt-1">{currentScenario.result.scriptAdherence}%</div>
                        <span className="text-[10px] font-mono text-slate-400">{currentScenario.result.regulationCompliance.split(' ')[0]}</span>
                      </div>
                    </div>

                    {/* Criteria Evaluated Table */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                        <span>Critérios da Matriz de Qualidade</span>
                        <span>Pontuação</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5 text-xs max-h-36 overflow-y-auto custom-scrollbar">
                        {currentScenario.result.scorecardItems.map((item, i) => (
                          <div 
                            key={i} 
                            className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white border border-slate-200/80"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="shrink-0 text-xs">
                                {item.status === 'ok' ? '✅' : item.status === 'warning' ? '⚠️' : '❌'}
                              </span>
                              <div className="truncate">
                                <div className="font-semibold text-slate-800 truncate text-[11px]">{item.name}</div>
                                <div className="text-[10px] text-slate-500 truncate">{item.detail}</div>
                              </div>
                            </div>
                            <span className={`text-[11px] font-mono font-bold shrink-0 ${
                              item.status === 'fail' ? 'text-rose-600' : 'text-slate-800'
                            }`}>
                              {item.points}/{item.max}p
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Summary Box */}
                    <div className={`p-3 rounded-xl border-l-4 text-xs leading-relaxed ${
                      currentScenario.result.criticalFail 
                        ? 'bg-rose-50 border border-rose-200 border-l-rose-600 text-rose-900' 
                        : 'bg-indigo-50/70 border border-indigo-200 border-l-indigo-600 text-slate-800'
                    }`}>
                      <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5 text-slate-600">
                        Parecer do Motor de Auditoria:
                      </span>
                      <p>{currentScenario.result.summary}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Bottom Guidance Bar */}
              <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-xs">
                <div className="text-indigo-700 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                  <span>Cenário {selectedDemoScenario + 1} de 3 ativo</span>
                </div>
                <button 
                  onClick={onOpenLogin} 
                  className="text-indigo-600 font-bold hover:text-indigo-800 cursor-pointer flex items-center gap-1"
                >
                  <span>Abrir no Painel Completo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 4. PILARES & BENTO GRID DE RECURSOS (DESIGN ASSIMÉTRICO DE ALTO PADRÃO) */}
      <section id="recursos" className="py-20 bg-white border-b border-slate-200 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-3.5 py-1 rounded-full shadow-2xs">
              Pilares da Plataforma
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-3">
              Engenharia Cognitiva para o Novo Contact Center
            </h2>
            <p className="text-slate-600 text-sm sm:text-base max-w-2xl mx-auto mt-2">
              Elimine gargalos operacionais com uma infraestrutura construída especificamente para suportar dezenas de milhões de atendimentos mensais.
            </p>

            {/* Filter Buttons */}
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => setFeatureCategory('all')}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  featureCategory === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos os Módulos
              </button>
              <button
                onClick={() => setFeatureCategory('ia')}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  featureCategory === 'ia' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>IA & Regras Zera-Nota</span>
              </button>
              <button
                onClick={() => setFeatureCategory('bpo')}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  featureCategory === 'bpo' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Multi-BPO & Calibração</span>
              </button>
              <button
                onClick={() => setFeatureCategory('lgpd')}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  featureCategory === 'lgpd' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>LGPD & Sanitização PII</span>
              </button>
            </div>
          </div>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            
            {/* Bento Card 1 (Large - Motor de Transcrição & Diarização) */}
            <div className="md:col-span-2 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 border border-slate-200 rounded-3xl p-7 hover:border-indigo-300 hover:shadow-md transition-all group relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-mono font-bold bg-indigo-100/80 text-indigo-800 px-2.5 py-1 rounded-lg">
                  100% Coverage Engine
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">
                Auditoria Massiva em Áudio e Texto Sem Amostragem
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-5 max-w-xl">
                O AuditaQA ingere streams de voz com diarização avançada por canal estéreo, separando a fala do operador e do cliente, detectando silêncios excessivos, sobreposições de voz e aderência integral a scripts obrigatórios.
              </p>
              
              {/* Feature Micro Visual */}
              <div className="grid grid-cols-3 gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 text-xs">
                <div className="p-2 bg-slate-50 rounded-xl">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Taxa de Acurácia</div>
                  <div className="text-base font-bold text-indigo-600 font-mono">98.7%</div>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Latência Média</div>
                  <div className="text-base font-bold text-emerald-600 font-mono">&lt; 2.4s</div>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Diarização Estéreo</div>
                  <div className="text-base font-bold text-slate-800 font-mono">2 Canais</div>
                </div>
              </div>
            </div>

            {/* Bento Card 2 (Falha Zera-Nota em Tempo Real) */}
            <div className="bg-gradient-to-br from-rose-50/40 via-white to-slate-50 border border-slate-200 rounded-3xl p-7 hover:border-rose-300 hover:shadow-md transition-all group">
              <div className="w-12 h-12 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-rose-700 transition-colors">
                Detecção Instantânea de Falhas Zera-Nota
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-4">
                Identifique instantaneamente recusas de protocolo, agressividade verbal, ameaças de Procon e quedas propositais de ligação com disparos automáticos para a supervisão.
              </p>
              <div className="bg-white p-3 rounded-xl border border-rose-200/80 text-[11px] text-rose-800 font-semibold space-y-1">
                <div>⚡ Alerta imediato para o supervisor</div>
                <div>⚡ Notificação de risco ao BPO parceiro</div>
              </div>
            </div>

            {/* Bento Card 3 (Cockpit Multi-BPO) */}
            <div className="bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 border border-slate-200 rounded-3xl p-7 hover:border-emerald-300 hover:shadow-md transition-all group">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-emerald-700 transition-colors">
                Gestão e Calibração Multi-BPO
              </h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-4">
                Compare o desempenho de múltiplos fornecedores de atendimento em uma mesma régua, eliminando a disparidade de notas e calibrando a qualidade de toda a operação.
              </p>
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-[11px] text-slate-700 space-y-1">
                <div className="flex justify-between font-mono"><span>BPO Atento / Vector:</span> <span className="font-bold text-emerald-700">96.4%</span></div>
                <div className="flex justify-between font-mono"><span>BPO Teleperformance:</span> <span className="font-bold text-emerald-700">94.8%</span></div>
              </div>
            </div>

            {/* Bento Card 4 (Large - Copiloto DataChat & Analytics) */}
            <div className="md:col-span-2 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white border border-indigo-800 rounded-3xl p-7 shadow-lg relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center text-indigo-300">
                    <Bot className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-indigo-500/30 text-indigo-200 px-3 py-1 rounded-full border border-indigo-400/30">
                    Copiloto Cognitivo DataChat
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Consulte Toda a Base de Atendimentos em Linguagem Natural
                </h3>
                <p className="text-indigo-200 text-xs sm:text-sm leading-relaxed mb-5 max-w-xl">
                  Pergunte diretamente à inteligência sobre motivos de reclamações recorrentes, falhas de produtos recém-lançados ou quais operadores precisam de reciclagem no script de cancelamento.
                </p>

                {/* Mockup Chat Bubble */}
                <div className="bg-white/10 backdrop-blur-md border border-white/15 p-3.5 rounded-2xl space-y-2 text-xs">
                  <div className="text-indigo-300 font-mono text-[11px]">👤 Pergunta do Gestor: "Quais são os 3 principais motivos de quebra de script no BPO Sul?"</div>
                  <div className="text-white font-medium bg-indigo-800/60 p-2.5 rounded-xl border border-indigo-700">
                    🤖 <strong>AuditaQA IA:</strong> "Nos últimos 7 dias, foram identificadas 48 quebras: 1) Omissão de protocolo antes da transferência (52%), 2) Não confirmação de dados de segurança (31%) e 3) Uso de gírias durante a tratativa (17%)."
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 5. CALCULADORA DE ROI & IMPACTO FINANCEIRO INTERATIVO */}
      <section id="calculadora" className="py-20 bg-slate-50 border-b border-slate-200 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-1 rounded-full shadow-2xs">
              Simulador de Retorno sobre Investimento
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-3">
              Calcule o Impacto Financeiro na sua Operação
            </h2>
            <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto mt-2">
              Ajuste os parâmetros abaixo com o volume mensal e veja a economia direta em comparação com a monitoria humana manual.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-9 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-xs">
            
            {/* Coluna Sliders */}
            <div className="lg:col-span-6 space-y-6 text-left">
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Volume Mensal de Atendimentos:
                  </label>
                  <span className="text-xs font-bold font-mono text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200">
                    {monthlyCalls.toLocaleString('pt-BR')} chamadas
                  </span>
                </div>
                <input 
                  type="range" 
                  min="20000" 
                  max="1000000" 
                  step="10000"
                  value={monthlyCalls}
                  onChange={(e) => setMonthlyCalls(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
                  <span>20k</span>
                  <span>500k</span>
                  <span>1 Milhão+</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Monitores de Qualidade Dedicados (Equipe Atual):
                  </label>
                  <span className="text-xs font-bold font-mono text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200">
                    {humanMonitors} monitores
                  </span>
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="40" 
                  step="1"
                  value={humanMonitors}
                  onChange={(e) => setHumanMonitors(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
                  <span>2 monitores</span>
                  <span>20 monitores</span>
                  <span>40 monitores</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs text-slate-600">
                <div className="flex justify-between items-center">
                  <span>Amostragem manual (~2% das chamadas):</span>
                  <span className="font-bold text-slate-800">{manualCoverageCalls.toLocaleString('pt-BR')} ligações/mês</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="font-semibold text-slate-800">Cobertura com AuditaQA:</span>
                  <span className="font-bold text-emerald-700">100% ({monthlyCalls.toLocaleString('pt-BR')} ligações/mês)</span>
                </div>
              </div>

            </div>

            {/* Coluna Output Financeiro */}
            <div className="lg:col-span-6 bg-gradient-to-br from-indigo-50 via-slate-50 to-white border border-indigo-200 p-6 sm:p-8 rounded-2xl space-y-5 text-left shadow-xs">
              <div>
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-emerald-600 fill-emerald-600/20" />
                  Economia Estimada por Mês:
                </span>
                <div className="text-3xl sm:text-4xl font-black text-emerald-600 font-mono">
                  R$ {monthlySavings.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} <span className="text-sm font-normal text-slate-500">/ mês</span>
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Projeção anual de economia: <strong className="text-emerald-700 font-bold">R$ {annualSavings.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} / ano</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-indigo-100">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Horas Poupadas/Mês</span>
                  <div className="text-xl font-bold text-indigo-700 mt-0.5 font-mono">{hoursSavedPerMonth.toLocaleString('pt-BR')}h</div>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Multiplicador Cobertura</span>
                  <div className="text-xl font-bold text-emerald-700 mt-0.5 font-mono">50x maior</div>
                </div>
              </div>

              <button
                onClick={() => setIsDemoModalOpen(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm py-3.5 rounded-xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                <span>Solicitar Proposta Customizada para sua Operação</span>
              </button>

            </div>

          </div>

        </div>
      </section>

      {/* 6. GOVERNANÇA, SEGURANÇA E MOTOR DE SANITIZAÇÃO LGPD */}
      <section id="seguranca" className="py-20 bg-white border-b border-slate-200 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div className="lg:col-span-6 space-y-5 text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-1 rounded-full shadow-2xs">
                Segurança Corporativa & LGPD
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 leading-tight">
                Sanitização PII em Memória com Blindagem de Dados
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                Dados pessoais como CPF, números de cartão de crédito e senhas são mascarados <strong className="text-emerald-700 font-bold">em memória antes de qualquer indexação ou processamento pelos modelos de IA</strong>.
              </p>

              <div className="space-y-3 pt-1">
                <div className="flex items-start gap-3.5 bg-slate-50 border border-slate-200 p-3.5 rounded-2xl hover:border-emerald-300 transition-all">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Anonimização Cognitiva de PII</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Substituição preventiva por tokens irreversíveis em milissegundos.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 bg-slate-50 border border-slate-200 p-3.5 rounded-2xl hover:border-indigo-300 transition-all">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Isolamento Estrito Multi-Tenant & RBAC</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Cada BPO parceiro visualiza apenas e estritamente suas próprias métricas.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 bg-slate-50 border border-slate-200 p-3.5 rounded-2xl hover:border-amber-300 transition-all">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Trilha de Auditoria Imutável (Audit Trail)</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Histórico rastreável de todas as notas, contestações e edições de regras.</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Demonstrador Interativo PII Antes/Depois */}
            <div className="lg:col-span-6 bg-slate-50 border border-slate-200 rounded-3xl p-6 text-left space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Demonstrador do Motor de Anonimização PII</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 font-bold">
                  LGPD COMPLIANT
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-rose-700 font-bold">🔴 Entrada Bruta do Atendimento (Voz/Chat):</span>
                    <span className="text-[10px] text-slate-400">Canal de Ingestão</span>
                  </div>
                  <div className="bg-white border border-rose-200 p-3.5 rounded-xl text-slate-700 leading-relaxed text-[11px]">
                    "Cliente: Meu CPF é <span className="bg-rose-100 text-rose-800 px-1 py-0.5 rounded font-bold">123.456.789-00</span> e o cartão para débito é <span className="bg-rose-100 text-rose-800 px-1 py-0.5 rounded font-bold">4532 1092 8472 9012</span>, código <span className="bg-rose-100 text-rose-800 px-1 py-0.5 rounded font-bold">492</span>."
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-emerald-700 font-bold">🟢 Diálogo Sanitizado (Enviado para Auditoria e IA):</span>
                    <span className="text-[10px] text-emerald-600 font-bold font-mono">Em Memória (0 ms)</span>
                  </div>
                  <div className="bg-white border border-emerald-300 p-3.5 rounded-xl text-emerald-950 font-bold leading-relaxed text-[11px]">
                    "Cliente: Meu CPF é <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">[CPF_MASCARADO]</span> e o cartão para débito é <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">[CARTAO_MASCARADO]</span>, código <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">[CVV_MASCARADO]</span>."
                  </div>
                </div>
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 border-l-4 border-l-indigo-600 font-medium">
                🔒 Nenhuma credencial confidencial de clientes é salva em texto aberto nos bancos de dados da plataforma.
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 7. TABELA COMPARATIVA DETALHADA: AMOSTRAGEM MANUAL VS AUDITAQA */}
      <section id="comparativo" className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900">
              Amostragem Manual vs. AuditaQA
            </h2>
            <p className="text-slate-600 text-sm mt-2">
              Entenda por que as principais operações de Contact Center e BPOs migram da monitoria artesanal para a inteligência contínua.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="grid grid-cols-12 bg-slate-100/90 p-4 border-b border-slate-200 text-xs font-bold text-slate-700">
              <div className="col-span-4">Dimensão de Análise</div>
              <div className="col-span-4 text-rose-700 flex items-center gap-1.5">
                <XCircle className="w-4 h-4" />
                <span>Amostragem Manual (2%)</span>
              </div>
              <div className="col-span-4 text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>AuditaQA com IA (100%)</span>
              </div>
            </div>

            <div className="divide-y divide-slate-100 text-xs text-left">
              
              <div className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-4 font-bold text-slate-800">Cobertura de Atendimentos</div>
                <div className="col-span-4 text-slate-500">2% a 5% dos chamados sorteados</div>
                <div className="col-span-4 text-emerald-700 font-bold">100% de todo áudio e chat</div>
              </div>

              <div className="grid grid-cols-12 p-4 items-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="col-span-4 font-bold text-slate-800">Tempo de Auditoria / Chamada</div>
                <div className="col-span-4 text-slate-500">20 a 30 minutos por monitor</div>
                <div className="col-span-4 text-emerald-700 font-bold">&lt; 3 segundos instantâneos</div>
              </div>

              <div className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-4 font-bold text-slate-800">Detecção de Falhas Zera-Nota</div>
                <div className="col-span-4 text-slate-500">Depende da sorte da amostragem</div>
                <div className="col-span-4 text-emerald-700 font-bold">100% Notificadas em tempo real</div>
              </div>

              <div className="grid grid-cols-12 p-4 items-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="col-span-4 font-bold text-slate-800">Imparcialidade e Viés</div>
                <div className="col-span-4 text-slate-500">Variação subjetiva entre monitores</div>
                <div className="col-span-4 text-emerald-700 font-bold">Régua padronizada e imutável</div>
              </div>

              <div className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                <div className="col-span-4 font-bold text-slate-800">Custo Médio / Avaliação</div>
                <div className="col-span-4 text-slate-500">~ R$ 8,50 por auditoria humana</div>
                <div className="col-span-4 text-emerald-700 font-bold font-mono">~ R$ 0,075 por atendimento</div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* 8. FAQ ACCORDION COM BUSCA RÁPIDA */}
      <section id="faq" className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900">
              Perguntas Frequentes
            </h2>
            <p className="text-slate-600 text-sm mt-2">
              Respostas claras sobre integração técnica, segurança de dados e implantação do AuditaQA.
            </p>

            {/* Quick Search Input */}
            <div className="mt-6 max-w-md mx-auto relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                value={faqSearchQuery}
                onChange={(e) => setFaqSearchQuery(e.target.value)}
                placeholder="Buscar dúvida (ex: LGPD, Genesys, BPO, prazos)..." 
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-3 text-left">
            {filteredFaqs.map((faq, idx) => (
              <div 
                key={idx}
                className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-all"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between text-xs sm:text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  <span className="pr-4">{faq.q}</span>
                  {activeFaq === idx ? (
                    <ChevronUp className="w-4 h-4 text-indigo-600 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>
                {activeFaq === idx && (
                  <div className="px-4 pb-4 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-200/80 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 9. CTA BANNER EXECUTIVO */}
      <section className="py-16 bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 text-center relative overflow-hidden text-white">
        <div className="max-w-3xl mx-auto px-4 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-indigo-100 text-xs font-semibold mb-4">
            <Sparkle className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span>Pronto para Inovar em Qualidade Operacional?</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            Transforme o QA da sua Operação Hoje Mesmo
          </h2>
          <p className="mt-3 text-sm text-indigo-100 max-w-lg mx-auto leading-relaxed">
            Acesse o sistema com as credenciais operacionais e explore os módulos completos de auditoria, calibração e análise preditiva.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onOpenLogin}
              className="w-full sm:w-auto bg-white text-indigo-900 hover:bg-slate-50 font-black text-xs sm:text-sm px-8 py-3.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
            >
              <LogIn className="w-4 h-4 text-indigo-600" />
              <span>Acessar Portal de Login</span>
            </button>
            <button
              onClick={() => setIsDemoModalOpen(true)}
              className="w-full sm:w-auto bg-indigo-800/60 hover:bg-indigo-800 text-white border border-indigo-400/40 font-bold text-xs sm:text-sm px-6 py-3.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>Solicitar Demonstração VIP</span>
            </button>
          </div>
        </div>
      </section>

      {/* 10. FOOTER ELEGANTE E DISCRETO */}
      <footer className="bg-slate-100 border-t border-slate-200 py-8 text-slate-600 text-xs mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold font-mono text-[10px]">
              QA
            </div>
            <span className="font-bold text-slate-800">AUDITAQA • Plataforma de Qualidade e Compliance Cognitivo</span>
          </div>
          <div className="flex items-center gap-6 text-slate-500">
            <span>© 2026 AuditaQA. Todos os direitos reservados.</span>
            <button 
              onClick={onOpenLogin} 
              className="text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer transition-colors"
            >
              Login Operacional →
            </button>
          </div>
        </div>
      </footer>

      {/* MODAL DE SOLICITAÇÃO DE DEMO VIP */}
      {isDemoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-left">
            
            <button
              onClick={() => {
                setIsDemoModalOpen(false);
                setDemoSubmitted(false);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl bg-slate-100 transition-colors cursor-pointer"
            >
              ✕
            </button>

            {!demoSubmitted ? (
              <div>
                <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                  <span>Demonstração Enterprise Personalizada</span>
                </div>

                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Agendar Sessão com Especialistas</h3>
                <p className="text-xs text-slate-500 mt-1">Preencha seus dados corporativos para testar o AuditaQA com áudios e chats da sua própria operação.</p>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    setDemoSubmitted(true);
                  }}
                  className="mt-5 space-y-3.5"
                >
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Nome Completo</label>
                    <input 
                      type="text" 
                      required 
                      value={demoFormData.name}
                      onChange={(e) => setDemoFormData({...demoFormData, name: e.target.value})}
                      placeholder="Ex: Carlos Mendes" 
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">E-mail Corporativo</label>
                    <input 
                      type="email" 
                      required 
                      value={demoFormData.email}
                      onChange={(e) => setDemoFormData({...demoFormData, email: e.target.value})}
                      placeholder="carlos@empresa.com.br" 
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Empresa / BPO</label>
                      <input 
                        type="text" 
                        required 
                        value={demoFormData.company}
                        onChange={(e) => setDemoFormData({...demoFormData, company: e.target.value})}
                        placeholder="Nome da Empresa" 
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Telefone / WhatsApp</label>
                      <input 
                        type="text" 
                        required 
                        value={demoFormData.phone}
                        onChange={(e) => setDemoFormData({...demoFormData, phone: e.target.value})}
                        placeholder="(11) 99999-0000" 
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Volume Estimado Mensal</label>
                    <select 
                      value={demoFormData.volume}
                      onChange={(e) => setDemoFormData({...demoFormData, volume: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none cursor-pointer"
                    >
                      <option value="10k-50k">Até 50.000 chamadas/mês</option>
                      <option value="50k-200k">50.000 a 200.000 chamadas/mês</option>
                      <option value="200k-1m">200.000 a 1.000.000 chamadas/mês</option>
                      <option value="1m+">Acima de 1 milhão chamadas/mês</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-sm cursor-pointer mt-2"
                  >
                    Confirmar Solicitação de Demonstração
                  </button>
                </form>
              </div>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Solicitação Recebida com Sucesso!</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Agradecemos seu interesse, <strong>{demoFormData.name}</strong>. Nossa equipe entrará em contato via e-mail (<em>{demoFormData.email}</em>) em até 2 horas úteis.
                </p>
                <button
                  onClick={() => {
                    setIsDemoModalOpen(false);
                    setDemoSubmitted(false);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-6 py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
