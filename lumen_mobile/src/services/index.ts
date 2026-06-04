/**
 * API Services
 * =============
 * Funções de chamada à API organizadas por domínio.
 *
 * Endpoints ativos no backend (main.py):
 *   auth_router   → /auth/*
 *   profile_router → /profile/*
 *   org_router    → /org/*
 *   inbox_router  → /inbox/*
 *   verify_router → /verify/*
 */

import api from './api';
import {
  User,
  Profile,
  ProfileUpdateRequest,
  EmergencyContact,
  EmergencyContactRequest,
  Catalog,
  LatestLegal,
  AcceptLegalRequest,
  AcceptLegalResponse,
  OrgTree,
  Membership,
  Invite,
  InviteResponse,
  InboxMessage,
  InboxListResponse,
  InboxSendRequest,
  InboxSendResponse,
  InboxPreviewResponse,
  SendScopesResponse,
  StartVerificationRequest,
  StartVerificationResponse,
  ConfirmVerificationRequest,
  ConfirmVerificationResponse,
  HealthResponse,
} from '@/types';

// =============================================================================
// HEALTH
// =============================================================================
export const healthService = {
  check: () => api.get<HealthResponse>('/health'),
};

// =============================================================================
// AUTH
// =============================================================================
export const authService = {
  /**
   * Retorna dados do usuário autenticado (provisiona no backend se necessário).
   * Endpoint: GET /auth/me
   */
  getMe: () => api.get<User>('/auth/me'),

  /**
   * Logout: encerra sessão (Firebase ou dev token).
   */
  logout: async (): Promise<void> => {
    await api.clearToken();
  },
};

// =============================================================================
// PROFILE
// =============================================================================
export const profileService = {
  getCatalogs: () => api.get<Catalog[]>('/profile/catalogs'),

  getProfile: () => api.get<Profile>('/profile'),

  updateProfile: (data: ProfileUpdateRequest) =>
    api.put<Profile>('/profile', data),

  addEmergencyContact: (data: EmergencyContactRequest) =>
    api.post<EmergencyContact>('/profile/emergency-contact', data),

  /** Lista setores disponíveis para interesse em ministério. */
  getSectors: () => api.get<{ id: string; name: string }[]>('/profile/sectors'),

  /** Lista missões disponíveis (filhas do setor Missões). */
  getMissions: () => api.get<{ id: string; name: string }[]>('/profile/missions'),

  /** Confirma atualização semestral dos dados (carimba last_profile_confirmed_at). */
  confirmProfile: () => api.post<{ confirmed: boolean }>('/profile/me/confirm', {}),
};

// =============================================================================
// LEGAL
// =============================================================================
export const legalService = {
  getLatest: () => api.get<LatestLegal>('/legal/latest'),

  accept: (data: AcceptLegalRequest) =>
    api.post<AcceptLegalResponse>('/legal/accept', data),
};

// =============================================================================
// ORGANIZATION
// =============================================================================

/** Item de ministério retornado por GET /org/ministries. */
export interface MinistryItem {
  id: string;
  name: string;
  slug: string;
}

export const orgService = {
  /**
   * Retorna árvore organizacional.
   * Endpoint correto: GET /org/tree (não /org-units/tree)
   */
  getTree: () => api.get<OrgTree>('/org/tree'),

  /** Lista memberships ativos do usuário autenticado. */
  getMyMemberships: () => api.get<Membership[]>('/org/my/memberships'),

  /**
   * Lista ministérios ativos disponíveis para seleção no perfil.
   * Endpoint: GET /org/ministries
   */
  getMinistries: () => api.get<{ ministries: MinistryItem[] }>('/org/ministries'),
};

// =============================================================================
// INVITES
// =============================================================================
export const inviteService = {
  /**
   * Lista convites pendentes do usuário autenticado.
   * Nota: convites pendentes também são retornados em /auth/me → pending_invites.
   */
  getMyInvites: () => api.get<Invite[]>('/org/my/invites'),

  /** Aceita um convite (torna o usuário membro ativo da unidade). */
  accept: (inviteId: string) =>
    api.post<InviteResponse>(`/org/invites/${inviteId}/accept`, {}),

  /** Rejeita um convite. */
  reject: (inviteId: string) =>
    api.post<InviteResponse>(`/org/invites/${inviteId}/reject`, {}),
};

// =============================================================================
// MEMBERSHIP
// =============================================================================
export const membershipService = {
  /**
   * Lista memberships do usuário autenticado.
   * Endpoint correto: GET /org/my/memberships (não /org-memberships/my)
   * Nota: memberships ativas também são retornadas em /auth/me → memberships.
   */
  getMyMemberships: () => api.get<Membership[]>('/org/my/memberships'),
};

// =============================================================================
// INBOX — avisos e comunicações
// =============================================================================
export const inboxService = {
  /**
   * Lista todas as mensagens do inbox (lidas + não lidas).
   * Retorna InboxListResponse: { messages, total, unread_count }
   */
  getInbox: (params?: { include_read?: boolean; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.include_read !== undefined) query.set('include_read', String(params.include_read));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const qs = query.toString();
    return api.get<InboxListResponse>(`/inbox${qs ? `?${qs}` : ''}`);
  },

  /** Lista apenas mensagens não lidas (máx: limit, default 10). */
  getUnread: (limit?: number) => {
    const qs = limit !== undefined ? `?limit=${limit}` : '';
    return api.get<InboxMessage[]>(`/inbox/unread${qs}`);
  },

  /**
   * Marca uma mensagem como lida (idempotente).
   * Usar aviso.id (InboxRecipient.id), não aviso.message_id.
   */
  markAsRead: (recipientId: string) =>
    api.patch<{ success: boolean }>(`/inbox/${recipientId}/read`),

  /** Marca todas as mensagens como lidas. */
  markAllAsRead: () =>
    api.patch<{ success: boolean; count: number }>('/inbox/read-all'),

  /** Retorna opções de filtros de perfil para segmentação. */
  getFilterOptions: <T = unknown>() =>
    api.get<T>('/inbox/send/filters'),

  /**
   * Retorna os escopos de envio disponíveis para o usuário:
   * - can_send_to_all: true se tem CAN_SEND_INBOX
   * - scopes: lista de OrgUnits onde é coordenador
   * Lança 403 se o usuário não tem nenhuma permissão de envio.
   */
  getSendableScopes: () =>
    api.get<SendScopesResponse>('/inbox/send/scopes'),

  /** Retorna permissões do usuário atual. */
  getMyPermissions: () =>
    api.get<{ permissions: string[]; has_admin_access: boolean }>('/inbox/permissions'),

  /** Preview: quantos usuários receberão o aviso com os filtros informados. */
  previewSend: (data: {
    send_to_all: boolean;
    scope_org_unit_id?: string | null;
    filters?: InboxSendRequest['filters'];
  }) =>
    api.post<InboxPreviewResponse>('/inbox/send/preview', data),

  /** Envia um aviso. Requer permissão CAN_SEND_INBOX ou ser coordenador. */
  send: (data: InboxSendRequest) =>
    api.post<InboxSendResponse>('/inbox/send', data),

  /** Lista avisos enviados pelo usuário (requer CAN_SEND_INBOX ou ser coordenador). */
  getSent: (limit?: number) => {
    const qs = limit !== undefined ? `?limit=${limit}` : '';
    return api.get<{ messages: unknown[] }>(`/inbox/sent${qs}`);
  },

  getPendingApprovals: () =>
    api.get<{ messages: import('@/types').PendingApproval[]; total: number }>('/inbox/approval/pending'),

  approveMessage: (messageId: string, note?: string) =>
    api.post<{ success: boolean; recipient_count: number }>(
      `/inbox/approval/${messageId}/approve`,
      { note: note ?? null },
    ),

  rejectMessage: (messageId: string, note?: string) =>
    api.post<{ success: boolean }>(
      `/inbox/approval/${messageId}/reject`,
      { note: note ?? null },
    ),

  getMessageAudit: (messageId: string) =>
    api.get<{ message_id: string; entries: import('@/types').AuditEntry[] }>(
      `/inbox/${messageId}/audit`,
    ),
};

// =============================================================================
// ORG ADMIN — criação e gestão de entidades
// =============================================================================
export const orgAdminService = {
  /** Cria unidade raiz (CONSELHO_GERAL). Requer papel DEV ou ADMIN. */
  createRootUnit: (data: { name: string; description?: string }) =>
    api.post('/org/root-unit', data as Record<string, unknown>),

  /** Cria unidade filha de um parent. Requer ser coordenador do parent. */
  createChildUnit: (
    parentId: string,
    data: { name: string; description?: string; group_type?: string }
  ) => api.post(`/org/units/${parentId}/children`, data as Record<string, unknown>),

  /** Lista membros de uma unidade. */
  getMembers: (orgUnitId: string) =>
    api.get(`/org/units/${orgUnitId}/members`),

  /** Busca usuários para convidar. */
  searchUsers: (orgUnitId: string, q: string) =>
    api.get(`/org/units/${orgUnitId}/search-users?q=${encodeURIComponent(q)}`),

  /** Envia convite para um usuário. */
  sendInvite: (orgUnitId: string, data: { user_id: string; role?: string; message?: string }) =>
    api.post(`/org/units/${orgUnitId}/invites`, data as Record<string, unknown>),

  /** Lista convites pendentes de uma unidade. */
  getPendingInvites: (orgUnitId: string) =>
    api.get(`/org/units/${orgUnitId}/invites/pending`),

  /** Remove membro de uma unidade. */
  removeMember: (orgUnitId: string, memberUserId: string) =>
    api.delete(`/org/units/${orgUnitId}/members/${memberUserId}`),

  /** Edita nome e/ou descrição de uma unidade. */
  updateUnit: (unitId: string, data: { name?: string; description?: string }) =>
    api.patch(`/org/units/${unitId}`, data as Record<string, unknown>),

  /** Atualiza o cargo (role) de um membro: COORDINATOR ou MEMBER. */
  updateMemberRole: (orgUnitId: string, memberUserId: string, role: 'COORDINATOR' | 'MEMBER') =>
    api.put<{ message: string; user_id: string; new_role: string }>(
      `/org/units/${orgUnitId}/members/${memberUserId}/role?role=${encodeURIComponent(role)}`
    ),
};

// =============================================================================
// ADMIN USERS — gestão de usuários
// =============================================================================

export interface ListUsersParams {
  search?: string;
  limit?: number;
  offset?: number;
  cidade?: string;
  estado?: string;
  realidade_vocacional?: string;
  ministerio_id?: string;
  estado_civil?: string;
  profile_status?: string;
}

export const adminUserService = {
  /** Lista usuários com busca. Requer DEV, ADMIN ou SECRETARY. */
  listUsers: async (params: ListUsersParams = {}): Promise<{ users: AdminUserItem[]; total: number }> => {
    const query = new URLSearchParams();
    if (params.search)               query.set('search', params.search);
    if (params.limit != null)        query.set('limit', String(params.limit));
    if (params.offset != null)       query.set('offset', String(params.offset));
    if (params.cidade)               query.set('cidade', params.cidade);
    if (params.estado)               query.set('estado', params.estado);
    if (params.realidade_vocacional) query.set('realidade_vocacional', params.realidade_vocacional);
    if (params.ministerio_id)        query.set('ministerio_id', params.ministerio_id);
    if (params.estado_civil)         query.set('estado_civil', params.estado_civil);
    if (params.profile_status)       query.set('profile_status', params.profile_status);
    const qs = query.toString();
    return api.get<{ users: AdminUserItem[]; total: number }>(
      `/admin/users${qs ? `?${qs}` : ''}`
    );
  },

  /** Edita nome e/ou roles globais de um usuário. Requer DEV ou ADMIN. */
  updateUser: (userId: string, data: { full_name?: string; global_roles?: string[] }) =>
    api.patch<AdminUserItem>(`/admin/users/${userId}`, data as Record<string, unknown>),

  /**
   * Concede ou revoga o cargo AVISOS de um usuário.
   * Requer DEV, ADMIN ou ser coordenador do Conselho Geral.
   */
  toggleAvisos: (userId: string, grant: boolean) =>
    api.post<AdminUserItem>(`/admin/users/${userId}/toggle-avisos`, { grant }),
};

export interface AdminUserItem {
  id: string;
  name: string | null;
  email: string | null;
  photo_url: string | null;
  profile_status: string;
  global_roles: string[];
  created_at: string;
}

// =============================================================================
// VERIFICATION
// =============================================================================
export const verificationService = {
  startPhone: (data: StartVerificationRequest) =>
    api.post<StartVerificationResponse>('/verify/phone/start', data),

  confirmPhone: (data: ConfirmVerificationRequest) =>
    api.post<ConfirmVerificationResponse>('/verify/phone/confirm', data),

  startEmail: (email: string) =>
    api.post<{ verification_id: string; expires_at: string; debug_token?: string }>(
      '/verify/email/start',
      { email }
    ),

  confirmEmail: (token: string) =>
    api.post<{ verified: boolean; message: string }>(
      '/verify/email/confirm',
      { token }
    ),
};

export interface FilterOptions {
  cidades: string[];
  estados: string[];
  realidades_vocacionais: { code: string; label: string }[];
  estados_civis: { code: string; label: string }[];
  profile_status: { code: string; label: string }[];
}

export const adminFilterService = {
  getOptions: async (): Promise<FilterOptions> => {
    return api.get<FilterOptions>('/admin/users/filter-options');
  },
};

// =============================================================================
// ADMIN USER PROFILE — perfil completo de usuário
// =============================================================================

export interface UserFullProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  city: string | null;
  state: string | null;
  instagram: string | null;
  cpf: string | null;
  rg: string | null;
  profile_status: string;
  global_roles: string[];
  created_at: string;
  audit_entries: Array<{
    id: string;
    action: string;
    actor_user_id: string | null;
    extra_data: Record<string, any> | null;
    created_at: string;
  }>;
}

export const adminUserProfileService = {
  getFullProfile: async (userId: string): Promise<UserFullProfile> => {
    return api.get<UserFullProfile>(`/admin/users/${userId}/profile`);
  },
};

// =============================================================================
// ADMIN EXPORT — exportação de usuários com aprovação
// =============================================================================

export interface ExportRequest {
  id: string;
  requested_by: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'GENERATED' | 'EXPIRED';
  fields_requested: string[];
  has_sensitive: boolean;
  approved_by: string | null;
  approved_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export const adminExportService = {
  /**
   * Solicita exportação.
   * - Sem dados sensíveis: retorna Blob CSV diretamente para download imediato.
   * - Com dados sensíveis: retorna { id, status: 'PENDING', message }.
   */
  requestExport: async (
    fields: string[],
    filters: Record<string, string> = {},
  ): Promise<{ blob?: Blob; filename?: string; id?: string; status: string; message?: string }> => {
    const token = await api.getToken?.();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const resp = await fetch(`${api.baseUrl}/admin/export/request`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fields, filters }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw { response: { data: err } };
    }

    const contentType = resp.headers.get('content-type') ?? '';
    if (contentType.includes('text/csv')) {
      // Exportação imediata — retorna o CSV como Blob
      const blob = await resp.blob();
      const disposition = resp.headers.get('content-disposition') ?? '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? 'exportacao.csv';
      return { blob, filename, status: 'GENERATED' };
    }

    // Exportação pendente de aprovação
    return resp.json();
  },

  /** URL de download de uma exportação aprovada (abre no browser). */
  getDownloadUrl: (id: string): string => `${api.baseUrl}/admin/export/${id}/download`,

  listRequests: async (): Promise<ExportRequest[]> => {
    return api.get('/admin/export/requests');
  },
  approve: async (id: string): Promise<ExportRequest> => {
    return api.post(`/admin/export/${id}/approve`);
  },
  reject: async (id: string): Promise<ExportRequest> => {
    return api.post(`/admin/export/${id}/reject`);
  },
};

// Export all services
export default {
  health: healthService,
  auth: authService,
  profile: profileService,
  legal: legalService,
  org: orgService,
  orgAdmin: orgAdminService,
  adminUser: adminUserService,
  invite: inviteService,
  membership: membershipService,
  inbox: inboxService,
  verification: verificationService,
};
