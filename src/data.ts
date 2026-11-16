import { Interaction, AuditConfig } from './types';

export const INITIAL_AUDIT_CONFIG: AuditConfig = {
  greetingWeight: 20,
  protocolWeight: 20,
  resolutionWeight: 30,
  toneWeight: 30,
  expectedScript: "Saudação formal identificando a marca, fornecimento do número de protocolo no início da chamada, confirmação de resolução da dúvida antes de encerrar e manutenção de tom profissional sem gírias.",
  criticalDeviations: [
    "Ofensa ou agressividade com o consumidor",
    "Ausência completa de fornecimento de protocolo",
    "Estouro excessivo de tempo de silêncio (acima de 45 segundos)",
    "Derrubada intencional de ligação (procedimento irregular)"
  ]
};

export const INITIAL_INTERACTIONS: Interaction[] = [];

