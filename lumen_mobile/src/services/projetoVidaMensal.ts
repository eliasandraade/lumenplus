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

// ── Tipos de itens estruturados ────────────────────────────────────────────

export interface EventoItem {
  data: string | null;
  horario: string | null;
  local: string | null;
  observacoes: string | null;
}

export interface OutroItemComunidade {
  titulo: string | null;
  descricao: string | null;
  local: string | null;
  data: string | null;
  horario: string | null;
}

export interface CuidadoEventoItem {
  data: string | null;
  horario: string | null;
  local: string | null;
  descricao: string | null;
}

export interface OutroItemCuidado {
  titulo: string | null;
  descricao: string | null;
  local: string | null;
  data: string | null;
  horario: string | null;
}

export interface EvangelizacaoAcaoItem {
  descricao: string | null;
  como: string | null;
  duracao_min: number | null;
}

// ── Types principais ───────────────────────────────────────────────────────

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
  partilha_acompanhador: EventoItem[];
  encontro_familia: EventoItem[];
  dias_grupo: EventoItem[];
  outros: OutroItemComunidade[];
}

export interface CuidadoData {
  consultas: CuidadoEventoItem[];
  exames: CuidadoEventoItem[];
  descanso: CuidadoEventoItem[];
  outros: OutroItemCuidado[];
}

export interface RevisaoOut {
  pratica_melhorar: string | null;
  taticas_vigilancia: string | null;
  rotina_evangelizacao: string | null;
  outra_area_atencao: string | null;
}

export interface ProjetoVidaMensalFull {
  id: string;
  mes: number;
  ano: number;
  has_pin: boolean;
  concluido: boolean;
  observacoes_mes: string | null;
  comunidade: ComunidadeData | null;
  cuidado: CuidadoData | null;
  compromissos: CompromissoOut[];
  praticas: PraticaOut[];
  revisao: RevisaoOut | null;
  has_new_structure: boolean;
  areas: AreaMensalOut[];
  reflexao_evangelizacao: string | null;
  evangelizacao_acoes?: EvangelizacaoAcaoItem[] | null;
  created_at: string;
  updated_at: string;
}

export interface ProjetoVidaMensalSummary {
  id: string;
  mes: number;
  ano: number;
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
  pin?: string | null;
  intencao?: string | null;
}

export interface CompromissoAreaItem {
  descricao: string | null;
  data: string | null;
  horario: string | null;
  local: string | null;
  obs: string | null;
}

export interface AreaMensalIn {
  tipo_area: string;
  objetivo: string | null;
  compromissos: CompromissoAreaItem[];
  observacoes: string | null;
}

export interface AreaMensalOut extends AreaMensalIn {
  id: string;
}

export interface UpdateProjetoInput {
  observacoes_mes?: string | null;
  concluido?: boolean | null;
  comunidade?: ComunidadeData | null;
  cuidado?: CuidadoData | null;
  compromissos?: CompromissoIn[] | null;
  praticas?: PraticaIn[] | null;
  areas?: AreaMensalIn[] | null;
  reflexao_evangelizacao?: string | null;
  evangelizacao_acoes?: EvangelizacaoAcaoItem[] | null;
}

export interface RevisaoInput {
  pratica_melhorar?: string | null;
  taticas_vigilancia?: string | null;
  rotina_evangelizacao?: string | null;
  outra_area_atencao?: string | null;
}

export interface ProjetoVidaSemanasCreate {
  numero_semana: number;
  dever_estado?: object | null;
  vida_interior?: object | null;
  evangelizacao_disposicao?: string | null;
  evangelizacao_momentos?: Array<{ descricao: string }>;
  plano_diario?: Record<string, object>;
  observacoes?: string | null;
}

export interface ProjetoVidaSemanasOut {
  id: string;
  numero_semana: number;
  dever_estado?: object | null;
  vida_interior?: object | null;
  evangelizacao_disposicao?: string | null;
  evangelizacao_momentos?: Array<{ descricao: string }>;
  plano_diario?: Record<string, object> | null;
  observacoes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjetoVidaSemanasSummary {
  id: string;
  numero_semana: number;
  created_at: string;
}

export interface ContextoVocacionalOut {
  vocational_reality_code: string | null;
  life_state_code: string | null;
  perfil_incompleto: boolean;
  nome: string;
}

export interface ExameOut {
  id: string;
  gracas_recebidas: string | null;
  infidelidades: string | null;
  dificuldades_espirituais: string | null;
  jesus_abandonado: string | null;
  onde_deixei_de_responder: string | null;
  proposito_conversao: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExameUpsert {
  gracas_recebidas?: string | null;
  infidelidades?: string | null;
  dificuldades_espirituais?: string | null;
  jesus_abandonado?: string | null;
  onde_deixei_de_responder?: string | null;
  proposito_conversao?: string | null;
}

export interface IntercessaoOut {
  id: string;
  intencoes_pessoais: string | null;
  intencoes_comunitarias: string | null;
  oferecimento: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntercessaoUpsert {
  intencoes_pessoais?: string | null;
  intencoes_comunitarias?: string | null;
  oferecimento?: string | null;
}

export interface PlanoDiarioItem {
  proposito?: string | null;
  missa?: boolean | null;
  horario_missa?: string | null;
  oracao_manha?: string | null;
  lectio?: string | null;
  terco?: boolean | null;
  leitura_espiritual?: string | null;
  evangelizacao?: string | null;
  compromissos?: string[] | null;
}

// ── API ────────────────────────────────────────────────────────────────────

export const projetoVidaMensalApi = {
  getAtual: (mes?: number, ano?: number) => {
    const params = mes && ano ? `?mes=${mes}&ano=${ano}` : '';
    return api.get<ProjetoVidaMensalFull | null>(`/projeto-vida-mensal/atual${params}`);
  },

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

  getContextoVocacional: () =>
    api.get<ContextoVocacionalOut>('/projeto-vida-mensal/contexto-vocacional'),

  getExame: (id: string) =>
    api.get<ExameOut | null>(`/projeto-vida-mensal/${id}/exame`),

  upsertExame: (id: string, data: ExameUpsert) =>
    api.put<ExameOut>(`/projeto-vida-mensal/${id}/exame`, data as Record<string, unknown>),

  upsertIntercessao: (id: string, data: IntercessaoUpsert) =>
    api.put<IntercessaoOut>(`/projeto-vida-mensal/${id}/intercessao`, data as Record<string, unknown>),

  listSemanas: (projetoId: string) =>
    api.get<ProjetoVidaSemanasSummary[]>(`/projeto-vida-mensal/${projetoId}/semanal`),

  createSemanal: (projetoId: string, data: ProjetoVidaSemanasCreate) =>
    api.post<ProjetoVidaSemanasOut>(`/projeto-vida-mensal/${projetoId}/semanal`, data as Record<string, unknown>),

  getSemanal: (id: string) =>
    api.get<ProjetoVidaSemanasOut>(`/projeto-vida-semanal/${id}`),

  updateSemanal: (id: string, data: Partial<ProjetoVidaSemanasCreate>) =>
    api.put<ProjetoVidaSemanasOut>(`/projeto-vida-semanal/${id}`, data as Record<string, unknown>),
};

export default projetoVidaMensalApi;
