// lumen_mobile/src/services/channel.ts
import api, { DEV_TOKEN_KEY, getDevToken } from './api';
import { auth, IS_DEV_AUTH } from '@/config/firebase';

export type ChannelPostMode = 'COORDINATOR_ONLY' | 'ALL_MEMBERS';

export interface ChannelReply {
  id: string;
  post_id: string;
  author_user_id: string;
  author_name: string;
  body: string;
  edited_at: string | null;
  created_at: string;
  is_deleted: boolean;
}

export interface ChannelPost {
  id: string;
  org_unit_id: string;
  author_user_id: string;
  author_name: string;
  title: string;
  body: string;
  is_pinned: boolean;
  is_institutional_highlight: boolean;
  reply_count: number;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface ChannelPostDetail extends ChannelPost {
  replies: ChannelReply[];
}

export interface ChannelPostList {
  posts: ChannelPost[];
  total: number;
}

export interface ChannelSettings {
  org_unit_id: string;
  channel_post_mode: ChannelPostMode;
  can_post: boolean;
  can_moderate: boolean;
}

// Helper para DELETE com body (api.delete não suporta body)
// Reutiliza o mesmo mecanismo de token que api.ts
async function deleteWithBody<T>(url: string, body: Record<string, unknown>): Promise<T> {
  let token: string | null = null;

  if (IS_DEV_AUTH) {
    token = await getDevToken();
  } else {
    try {
      await auth.authStateReady();
      token = (await auth.currentUser?.getIdToken()) ?? null;
    } catch {
      token = null;
    }
  }

  const API_BASE_URL = api.baseUrl;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw { response: { status: response.status, data: error } };
  }
  return response.json();
}

export const channelService = {
  getSettings: (orgUnitId: string) =>
    api.get<ChannelSettings>(`/channel/${orgUnitId}/settings`),

  listPosts: (orgUnitId: string, offset = 0, limit = 30) =>
    api.get<ChannelPostList>(`/channel/${orgUnitId}/posts?offset=${offset}&limit=${limit}`),

  getPost: (orgUnitId: string, postId: string) =>
    api.get<ChannelPostDetail>(`/channel/${orgUnitId}/posts/${postId}`),

  createPost: (orgUnitId: string, title: string, body: string) =>
    api.post<ChannelPost>(`/channel/${orgUnitId}/posts`, { title, body }),

  editPost: (orgUnitId: string, postId: string, title?: string, body?: string) =>
    api.patch<ChannelPost>(`/channel/${orgUnitId}/posts/${postId}`, { title, body }),

  deletePost: (orgUnitId: string, postId: string, reason: string) =>
    deleteWithBody<{ status: string }>(`/channel/${orgUnitId}/posts/${postId}`, { reason }),

  togglePin: (orgUnitId: string, postId: string) =>
    api.patch<ChannelPost>(`/channel/${orgUnitId}/posts/${postId}/pin`, {}),

  toggleHighlight: (orgUnitId: string, postId: string) =>
    api.patch<ChannelPost>(`/channel/${orgUnitId}/posts/${postId}/highlight`, {}),

  createReply: (orgUnitId: string, postId: string, body: string) =>
    api.post<ChannelReply>(`/channel/${orgUnitId}/posts/${postId}/replies`, { body }),

  editReply: (orgUnitId: string, postId: string, replyId: string, body: string) =>
    api.patch<ChannelReply>(
      `/channel/${orgUnitId}/posts/${postId}/replies/${replyId}`,
      { body }
    ),

  deleteReply: (orgUnitId: string, postId: string, replyId: string, reason: string) =>
    deleteWithBody<{ status: string }>(
      `/channel/${orgUnitId}/posts/${postId}/replies/${replyId}`,
      { reason }
    ),
};
