// lumen_mobile/src/services/projetoVidaMensal.ts
import api from '@/services/api';

// ── Constantes ─────────────────────────────────────────────────────────────

export const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

export const SEMANAS = ['s1','s2','s3','s4','s5'] as const;
export const SEMANA_LABELS: Record<string, string> = {
  s1: 'Semana 1', s2: 'Semana 2', s3: 'Semana 3', s4: 'Semana 4', s5: 'Semana 5',
};

export const DIAS = ['seg','ter','qua','qui','sex','sab','dom'] as const;
export const DIA_LABELS: Record<string, string> = {
  seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta',
  sex: 'Sexta',   sab: 'Sábado', dom: 'Domingo',
};

export const TIPOS_PRATICA = [
  'Santa Missa',
  'Adoração',
  'Terço',
  'Leitura espiritual',
  'Liturgia das Horas',
  'Meditação',
  'Momento de Evangelização Ser Feliz',
  'Outro',
];

// ── Types ──────────────────────────────────────────────────────────────────

export interface CompromissoOut {
  id: string;
  semana: string;
  titulo: string | null;
  dia: string | null;
  horario: string | null;
  obs: string | null;
  ordem: number;
}

export interface PraticaOut {
  id: string;
  dia_semana: string;
  tipo: string;
  horario: string | null;
  duracao: string | null;
  obs: string | null;
  ordem: number;
}

export interface ComunidadeData {
  partilha_acompanhador: string | null;
  encontro_familia: string | null;
  dias_grupo: string | null;
  outros: string | null;
}

export interface CuidadoData {
  consultas: string | null;
  exames: string | null;
  descanso: string | null;
  outros: string | null;
}

export interface RevisaoOut {
  graca: string | null;
  fidelidade: string | null;
  falhas: string | null;
  ordenar: string | null;
  passo: string | null;
  decisao: string | null;
  virtude: string | null;
  conversao: string | null;
  passo_proximo: string | null;
}

export interface ProjetoVidaMensalFull {
  id: string;
  mes: number;
  ano: number;
  tema: string | null;
  intencao: string | null;
  has_pin: boolean;
  concluido: boolean;
  observacoes_mes: string | null;
  comunidade: ComunidadeData | null;
  cuidado: CuidadoData | null;
  compromissos: CompromissoOut[];
  praticas: PraticaOut[];
  revisao: RevisaoOut | null;
  created_at: string;
  updated_at: string;
}

export interface ProjetoVidaMensalSummary {
  id: string;
  mes: number;
  ano: number;
  tema: string | null;
  concluido: boolean;
  has_pin: boolean;
  created_at: string;
}

// ── Input types ────────────────────────────────────────────────────────────

export interface CompromissoIn {
  semana: string;
  titulo: string;
  dia: string;
  horario: string;
  obs: string;
  ordem: number;
}

export interface PraticaIn {
  dia_semana: string;
  tipo: string;
  horario: string;
  duracao: string;
  obs: string;
  ordem: number;
}

export interface CreateProjetoInput {
  mes: number;
  ano: number;
  tema?: string | null;
  intencao?: string | null;
  pin?: string | null;
}

export interface UpdateProjetoInput {
  tema?: string | null;
  intencao?: string | null;
  observacoes_mes?: string | null;
  concluido?: boolean | null;
  comunidade?: Partial<ComunidadeData> | null;
  cuidado?: Partial<CuidadoData> | null;
  compromissos?: CompromissoIn[] | null;
  praticas?: PraticaIn[] | null;
}

export interface RevisaoInput {
  graca?: string | null;
  fidelidade?: string | null;
  falhas?: string | null;
  ordenar?: string | null;
  passo?: string | null;
  decisao?: string | null;
  virtude?: string | null;
  conversao?: string | null;
  passo_proximo?: string | null;
}

// ── API ────────────────────────────────────────────────────────────────────

export const projetoVidaMensalApi = {
  getAtual: () =>
    api.get<ProjetoVidaMensalFull | null>('/projeto-vida-mensal/atual'),

  getHistorico: () =>
    api.get<ProjetoVidaMensalSummary[]>('/projeto-vida-mensal/historico'),

  criar: (data: CreateProjetoInput) =>
    api.post<ProjetoVidaMensalFull>('/projeto-vida-mensal/', data as Record<string, unknown>),

  get: (id: string) =>
    api.get<ProjetoVidaMensalFull>(`/projeto-vida-mensal/${id}`),

  update: (id: string, data: UpdateProjetoInput) =>
    api.put<ProjetoVidaMensalFull>(`/projeto-vida-mensal/${id}`, data as Record<string, unknown>),

  upsertRevisao: (id: string, data: RevisaoInput) =>
    api.put<ProjetoVidaMensalFull>(`/projeto-vida-mensal/${id}/revisao`, data as Record<string, unknown>),

  verificarPin: (id: string, pin: string) =>
    api.post<{ valid: boolean }>(`/projeto-vida-mensal/${id}/pin/verificar`, { pin }),
};

export default projetoVidaMensalApi;
