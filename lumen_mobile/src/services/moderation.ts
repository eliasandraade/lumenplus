/**
 * Moderação de conteúdo (UGC)
 * ===========================
 * Denúncia e bloqueio — exigidos por Apple Guideline 1.2 e pela política de
 * conteúdo gerado por usuário do Google Play.
 */

import { api } from './api';

export type ReportTargetType = 'POST' | 'REPLY' | 'USER';

export type ReportReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'HATE_SPEECH'
  | 'SEXUAL_CONTENT'
  | 'VIOLENCE'
  | 'MISINFORMATION'
  | 'OFF_TOPIC'
  | 'OTHER';

/** Rótulos em pt-BR, na ordem em que aparecem para o usuário. */
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'SPAM', label: 'Spam ou propaganda' },
  { value: 'HARASSMENT', label: 'Assédio ou ofensa pessoal' },
  { value: 'HATE_SPEECH', label: 'Discurso de ódio' },
  { value: 'SEXUAL_CONTENT', label: 'Conteúdo sexual' },
  { value: 'VIOLENCE', label: 'Violência' },
  { value: 'MISINFORMATION', label: 'Informação falsa' },
  { value: 'OFF_TOPIC', label: 'Fora do propósito do canal' },
  { value: 'OTHER', label: 'Outro motivo' },
];

export interface BlockedUser {
  user_id: string;
  name: string | null;
  created_at: string;
}

export interface ContentReport {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
  org_unit_id: string | null;
  reason: ReportReason;
  details: string | null;
  status: string;
  content_snapshot: string | null;
  reporter_name: string | null;
  created_at: string;
  reviewed_at: string | null;
  resolution_note: string | null;
}

export const moderationService = {
  /** Denuncia um post, uma resposta ou um usuário. Idempotente no backend. */
  report: (
    targetType: ReportTargetType,
    targetId: string,
    reason: ReportReason,
    details?: string
  ) =>
    api.post<{ id: string }>('/moderation/reports', {
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details || null,
    }),

  /** Bloqueia um usuário. O conteúdo dele deixa de aparecer (e o seu, para ele). */
  block: (userId: string) =>
    api.post<{ blocked: boolean; already: boolean }>('/moderation/blocks', {
      user_id: userId,
    }),

  unblock: (userId: string) => api.delete<void>(`/moderation/blocks/${userId}`),

  listBlocked: () =>
    api.get<{ total: number; blocks: BlockedUser[] }>('/moderation/blocks'),

  /** Fila de moderação — só coordenador da unidade ou admin. */
  listReports: (status?: string) =>
    api.get<{ total: number; reports: ContentReport[] }>(
      `/moderation/reports${status ? `?status=${status}` : ''}`
    ),

  resolveReport: (
    reportId: string,
    status: string,
    opts?: { removeContent?: boolean; note?: string }
  ) =>
    api.patch<{ id: string; status: string }>(`/moderation/reports/${reportId}`, {
      status,
      remove_content: opts?.removeContent ?? false,
      resolution_note: opts?.note ?? null,
    }),
};

export default moderationService;
