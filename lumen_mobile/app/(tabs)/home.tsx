/**
 * Home Screen
 * ===========
 * Dashboard principal do usuário — hierarquia de 5 seções.
 */

import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Platform } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import { auth } from '@/config/firebase';
import api from '@/services/api';
import { getVersiculoDoDia } from '@/services/bible';
import { PushPermissionCard } from '@/components/PushPermissionCard';
import { getPushDecision } from '@/services/push';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';
import { radius } from '@/theme/tokens';

type R = typeof radius;

interface Aviso {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  read: boolean;
  created_at: string;
}

export default function HomeScreen() {
  const { t, r } = useTheme();

  const [userName, setUserName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [avisosNaoLidos, setAvisosNaoLidos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [hasRetreatAccess, setHasRetreatAccess] = useState(false);
  const [showPushCard, setShowPushCard] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'denied') return;

    getPushDecision().then((decision: string | null) => {
      if (!decision || decision === 'later') {
        setShowPushCard(true);
      }
    });
  }, []);

  const loadData = async () => {
    try {
      // Aguarda Firebase restaurar a sessão antes de qualquer chamada autenticada
      await auth.authStateReady();

      // Carregar primeiro nome: tenta perfil do backend, fallback para Firebase displayName
      try {
        const profile = await api.get<{ full_name?: string }>('/profile');
        if (profile.full_name) {
          setUserName(profile.full_name.trim().split(' ')[0]);
        } else {
          const firebaseName = auth.currentUser?.displayName;
          if (firebaseName) setUserName(firebaseName.trim().split(' ')[0]);
        }
      } catch {
        // Perfil ainda incompleto — tenta Firebase
        const firebaseName = auth.currentUser?.displayName;
        if (firebaseName) setUserName(firebaseName.trim().split(' ')[0]);
      }

      // Verificar permissões de admin e retiro
      try {
        const permResponse = await api.get<{ has_admin_access: boolean; has_retreat_access: boolean }>('/inbox/permissions');
        setHasAdminAccess(permResponse.has_admin_access || false);
        setHasRetreatAccess(permResponse.has_retreat_access || false);
      } catch {
        setHasAdminAccess(false);
        setHasRetreatAccess(false);
      }

      // Verificar se é coordenador de alguma unidade
      try {
        const memberships = await api.get<{ role: string; status: string }[]>('/org/my/memberships');
        const hasCoord = memberships.some(
          (m) => m.role === 'COORDINATOR' && m.status === 'ACTIVE'
        );
        setIsCoordinator(hasCoord);
      } catch {
        setIsCoordinator(false);
      }

      // Carregar avisos não lidos
      try {
        const response = await api.get<Aviso[]>('/inbox/unread');
        setAvisosNaoLidos(response || []);
      } catch {
        setAvisosNaoLidos([]);
      }
    } catch (error) {
      console.log('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleLogout = async () => {
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
    router.replace('/(auth)/login');
  };

  const handleOpenAviso = (aviso: Aviso) => {
    router.push('/(tabs)/invites');
  };

  const getAvisoIcon = (type: string) => {
    switch (type) {
      case 'urgent':
        return { name: 'alert-circle', color: '#ef4444' };
      case 'warning':
        return { name: 'warning', color: '#f59e0b' };
      case 'success':
        return { name: 'checkmark-circle', color: '#22c55e' };
      default:
        return { name: 'information-circle', color: t.brand.primary };
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Agora';
    if (diffHours < 24) return `Há ${diffHours}h`;
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `Há ${diffDays} dias`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg.screen }}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[t.brand.primary]} />
      }
    >
      {/* ── 1. HERO DE ACOLHIMENTO ─────────────────────────── */}
      <HeroSection userName={userName} t={t} r={r} loading={loading} />

      {/* Push permission (web only) */}
      {Platform.OS === 'web' && showPushCard && (
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <PushPermissionCard onDismiss={() => setShowPushCard(false)} />
        </View>
      )}

      {/* ── 2. ÁREA DE ATENÇÃO ─────────────────────────────── */}
      <AttentionSection
        avisosNaoLidos={avisosNaoLidos}
        t={t}
        r={r}
        onOpenAviso={handleOpenAviso}
        formatDate={formatDate}
        getAvisoIcon={getAvisoIcon}
        loading={loading}
      />

      {/* ── 3. VIDA COMUNITÁRIA ────────────────────────────── */}
      <CommunitySection t={t} r={r} />

      {/* ── 4. ÁREA DE SERVIÇO ────────────────────────────── */}
      {(hasAdminAccess || isCoordinator || hasRetreatAccess) && (
        <ServiceSection
          hasAdminAccess={hasAdminAccess}
          isCoordinator={isCoordinator}
          hasRetreatAccess={hasRetreatAccess}
          t={t}
          r={r}
        />
      )}

      {/* ── 5. RODAPÉ ESPIRITUAL ───────────────────────────── */}
      <SpiritualFooter t={t} />

      <TouchableOpacity
        style={{ alignSelf: 'center', marginTop: 24, padding: 12 }}
        onPress={handleLogout}
        accessibilityLabel="Sair da conta"
      >
        <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.tertiary }}>
          Sair da conta
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ──────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────

// ── 1. Hero ───────────────────────────────────────────────────
function HeroSection({
  userName,
  t,
  r,
  loading,
}: {
  userName: string;
  t: SemanticTokens;
  r: R;
  loading: boolean;
}) {
  const v = getVersiculoDoDia();

  return (
    <View
      style={{
        backgroundColor: t.bg.elevated,
        paddingHorizontal: 20,
        paddingTop: 28,
        paddingBottom: 24,
        borderBottomLeftRadius: r.xl,
        borderBottomRightRadius: r.xl,
        marginBottom: 8,
        ...t.shadow.sm,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontFamily: 'Nunito-Regular',
          color: t.text.tertiary,
          marginBottom: 2,
        }}
      >
        Bem-vindo de volta
      </Text>
      <Text
        style={{
          fontSize: 26,
          fontFamily: 'Nunito-ExtraBold',
          color: t.text.primary,
          marginBottom: 16,
        }}
      >
        {loading ? 'Carregando...' : `Olá, ${userName || 'Usuário'}!`}
      </Text>

      {v.texto ? (
        <View
          style={{
            backgroundColor: t.bg.surface,
            borderRadius: r.md,
            padding: 14,
            borderLeftWidth: 3,
            borderLeftColor: t.accent.spiritual,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginBottom: 8,
            }}
          >
            <Ionicons name="book-outline" size={13} color={t.accent.spiritual} />
            <Text
              style={{
                fontSize: 10,
                fontFamily: 'Nunito-Bold',
                color: t.accent.spiritual,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Versículo do Dia
            </Text>
          </View>
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Nunito-Italic',
              color: t.text.spiritual,
              lineHeight: 22,
            }}
          >
            "{v.texto}"
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Nunito-SemiBold',
              color: t.text.tertiary,
              marginTop: 6,
            }}
          >
            {v.referencia}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ── 2. Área de Atenção ────────────────────────────────────────
function AttentionSection({
  avisosNaoLidos,
  t,
  r,
  onOpenAviso,
  formatDate,
  getAvisoIcon,
  loading,
}: {
  avisosNaoLidos: Aviso[];
  t: SemanticTokens;
  r: R;
  onOpenAviso: (a: Aviso) => void;
  formatDate: (d: string) => string;
  getAvisoIcon: (type: string) => { name: string; color: string };
  loading: boolean;
}) {
  if (loading) return null;

  if (avisosNaoLidos.length === 0) {
    return (
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, marginBottom: 4 }}>
        <View
          style={{
            backgroundColor: t.bg.elevated,
            borderRadius: r.lg,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            ...t.shadow.sm,
          }}
        >
          <Ionicons name="checkmark-done-circle" size={32} color={t.status.success} />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Nunito-SemiBold',
                color: t.text.primary,
              }}
            >
              Tudo em dia!
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Nunito-Regular',
                color: t.text.secondary,
                marginTop: 2,
              }}
            >
              Nenhum aviso pendente.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 4 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
          marginTop: 16,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontFamily: 'Nunito-Bold',
            color: t.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          Atenção
        </Text>
        <View
          style={{
            backgroundColor: t.status.error,
            borderRadius: r.full,
            minWidth: 20,
            height: 20,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 5,
          }}
        >
          <Text
            style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: '#ffffff' }}
          >
            {avisosNaoLidos.length}
          </Text>
        </View>
      </View>

      {avisosNaoLidos.slice(0, 5).map((aviso) => {
        const icon = getAvisoIcon(aviso.type);
        return (
          <TouchableOpacity
            key={aviso.id}
            onPress={() => onOpenAviso(aviso)}
            activeOpacity={0.75}
            accessibilityLabel={`Aviso: ${aviso.title}`}
            style={{
              backgroundColor: t.bg.elevated,
              borderRadius: r.lg,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginBottom: 8,
              ...t.shadow.sm,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: `${icon.color}18`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={icon.name as IoniconsName} size={22} color={icon.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Nunito-SemiBold',
                  color: t.text.primary,
                }}
                numberOfLines={1}
              >
                {aviso.title}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Nunito-Regular',
                  color: t.text.secondary,
                  marginTop: 2,
                }}
                numberOfLines={2}
              >
                {aviso.message}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: 'Nunito-Regular',
                  color: t.text.tertiary,
                  marginTop: 4,
                }}
              >
                {formatDate(aviso.created_at)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={t.text.tertiary} />
          </TouchableOpacity>
        );
      })}

      {avisosNaoLidos.length > 5 && (
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/invites')}
          style={{ alignItems: 'center', paddingVertical: 10 }}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Nunito-SemiBold',
              color: t.brand.primary,
            }}
          >
            Ver todos os avisos ({avisosNaoLidos.length})
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── 3. Vida Comunitária ───────────────────────────────────────
function CommunitySection({ t, r }: { t: SemanticTokens; r: R }) {
  const items: {
    label: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    route: string;
    color: string;
  }[] = [
    {
      label: 'Projeto de Vida',
      icon: 'compass-outline',
      route: '/vida',
      color: t.brand.primary,
    },
    {
      label: 'Retiros',
      icon: 'earth-outline',
      route: '/retreats',
      color: t.brand.coord,
    },
    {
      label: 'Comunidade',
      icon: 'people-outline',
      route: '/(tabs)/community',
      color: t.brand.secondary,
    },
    {
      label: 'Inbox',
      icon: 'mail-outline',
      route: '/(tabs)/invites',
      color: t.brand.admin,
    },
  ];

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 20, marginBottom: 4 }}>
      <Text
        style={{
          fontSize: 13,
          fontFamily: 'Nunito-Bold',
          color: t.text.secondary,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 12,
        }}
      >
        Vida Comunitária
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.label}
            onPress={() => router.push(item.route as any)}
            accessibilityLabel={item.label}
            style={{
              flex: 1,
              minWidth: '44%',
              backgroundColor: t.bg.elevated,
              borderRadius: r.lg,
              padding: 16,
              alignItems: 'center',
              gap: 8,
              ...t.shadow.sm,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: `${item.color}18`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <Text
              style={{
                fontSize: 13,
                fontFamily: 'Nunito-SemiBold',
                color: t.text.primary,
                textAlign: 'center',
              }}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── 4. Área de Serviço ────────────────────────────────────────
function ServiceSection({
  hasAdminAccess,
  isCoordinator,
  hasRetreatAccess,
  t,
  r,
}: {
  hasAdminAccess: boolean;
  isCoordinator: boolean;
  hasRetreatAccess: boolean;
  t: SemanticTokens;
  r: R;
}) {
  const items = (
    [
      hasAdminAccess && {
        label: 'Administração',
        subtitle: 'Entidades, membros e comunicações',
        icon: 'shield-checkmark-outline' as const,
        color: t.brand.admin,
        route: '/admin',
      },
      isCoordinator &&
        !hasAdminAccess && {
          label: 'Minha Coordenação',
          subtitle: 'Membros e convites da unidade',
          icon: 'ribbon-outline' as const,
          color: t.brand.coord,
          route: '/coordinator',
        },
      hasRetreatAccess &&
        !hasAdminAccess && {
          label: 'Ministério de Retiro',
          subtitle: 'Retiros, equipes e inscrições',
          icon: 'compass-outline' as const,
          color: '#b45309',
          route: '/coordinator',
        },
    ] as const
  ).filter(Boolean) as {
    label: string;
    subtitle: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    color: string;
    route: string;
  }[];

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 20, marginBottom: 4 }}>
      <Text
        style={{
          fontSize: 13,
          fontFamily: 'Nunito-Bold',
          color: t.text.tertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: 12,
        }}
      >
        Área de Serviço
      </Text>
      {items.map((item) => (
        <TouchableOpacity
          key={item.label}
          onPress={() => router.push(item.route as any)}
          accessibilityLabel={item.label}
          style={{
            backgroundColor: t.bg.elevated,
            borderRadius: r.lg,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: `${item.color}30`,
            ...t.shadow.sm,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: `${item.color}18`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={item.icon} size={20} color={item.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 14,
                fontFamily: 'Nunito-SemiBold',
                color: item.color,
              }}
            >
              {item.label}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Nunito-Regular',
                color: t.text.secondary,
                marginTop: 2,
              }}
            >
              {item.subtitle}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={item.color} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── 5. Rodapé Espiritual ──────────────────────────────────────
function SpiritualFooter({ t }: { t: SemanticTokens }) {
  return (
    <View
      style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 32 }}
    >
      <View
        style={{
          width: 32,
          height: 1,
          backgroundColor: t.border.subtle,
          marginBottom: 16,
        }}
      />
      <Text
        style={{
          fontSize: 12,
          fontFamily: 'Nunito-Italic',
          color: t.text.tertiary,
          textAlign: 'center',
          lineHeight: 20,
        }}
      >
        Obra Lumen · Formação e Missão
      </Text>
    </View>
  );
}
