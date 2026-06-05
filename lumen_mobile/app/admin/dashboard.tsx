/**
 * Admin Dashboard Screen
 * ======================
 * Métricas de governança — usuários, perfis, memberships, convites.
 * Acesso: ADMIN, DEV, ANALISTA.
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';
import { useAuthStore } from '@/stores';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';

// -------------------------------------------------------------------------
// Admin-specific constant (not in the token system)
// -------------------------------------------------------------------------
const ADMIN_COLOR = '#7c3aed';

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------
interface AgeRange {
  range: string;
  count: number;
}

interface LabelCount {
  label: string;
  count: number;
}

interface GeoItem {
  city?: string;
  state?: string;
  count: number;
}

interface UnitTypeCount {
  type: string;
  label: string;
  count: number;
}

interface TopMinistry {
  name: string;
  member_count: number;
}

interface DashboardData {
  users: {
    total: number;
    complete_profiles: number;
    incomplete_profiles: number;
    new_last_7d: number;
    new_last_30d: number;
  };
  age_ranges: AgeRange[];
  geography: {
    by_city: GeoItem[];
    by_state: GeoItem[];
  };
  profile_breakdown: {
    by_life_state: LabelCount[];
    by_marital_status: LabelCount[];
    by_vocational_reality: LabelCount[];
    with_vocational_accompaniment: number;
    without_vocational_accompaniment: number;
    interested_in_ministry: number;
    from_mission: number;
  };
  memberships: {
    total_active: number;
    by_unit_type: UnitTypeCount[];
  };
  invites: {
    total: number;
    accepted: number;
    pending: number;
    declined: number;
    acceptance_rate: number;
  };
  top_ministries: TopMinistry[];
}

// -------------------------------------------------------------------------
// Helper sub-component types
// -------------------------------------------------------------------------
type Styles = ReturnType<typeof makeStyles>;

// -------------------------------------------------------------------------
// Helper components
// -------------------------------------------------------------------------

function SectionHeader({ title, styles }: { title: string; styles: Styles }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function MetricCard({
  label,
  value,
  color,
  styles,
}: {
  label: string;
  value: number | string;
  color?: string;
  styles: Styles;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function BarRow({
  label,
  count,
  total,
  styles,
}: {
  label: string;
  count: number;
  total: number;
  styles: Styles;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.barCount}>
        {count} ({pct}%)
      </Text>
    </View>
  );
}

function RankedRow({
  rank,
  label,
  count,
  styles,
}: {
  rank: number;
  label: string;
  count: number;
  styles: Styles;
}) {
  return (
    <View style={styles.rankedRow}>
      <Text style={styles.rankedIndex}>{rank}</Text>
      <Text style={styles.rankedLabel}>{label}</Text>
      <Text style={styles.rankedCount}>{count}</Text>
    </View>
  );
}

// -------------------------------------------------------------------------
// Main screen
// -------------------------------------------------------------------------

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { t } = useTheme();
  const styles = makeStyles(t);

  const fetchData = async () => {
    try {
      setError(null);
      const result = await api.get<DashboardData>('/admin/dashboard');
      setData(result);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail?.message ||
        err?.message ||
        'Erro ao carregar dados do dashboard';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Dashboard',
            headerStyle: { backgroundColor: ADMIN_COLOR },
            headerTintColor: t.text.inverse,
          }}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ADMIN_COLOR} />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </>
    );
  }

  // --- Error ---
  if (error || !data) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Dashboard',
            headerStyle: { backgroundColor: ADMIN_COLOR },
            headerTintColor: t.text.inverse,
          }}
        />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={t.status.error} />
          <Text style={styles.errorTitle}>Erro ao carregar</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              setLoading(true);
              fetchData();
            }}
          >
            <Text style={styles.backBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const totalUsers = data.users.total || 1; // avoid div/0 in bars
  const totalAgeCount =
    data.age_ranges.reduce((s, r) => s + r.count, 0) || 1;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Dashboard',
          headerStyle: { backgroundColor: ADMIN_COLOR },
          headerTintColor: t.text.inverse,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[ADMIN_COLOR]}
            tintColor={ADMIN_COLOR}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="bar-chart" size={32} color={t.text.inverse} />
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>Visão geral do aplicativo</Text>
        </View>

        {/* ---- Usuários ---- */}
        <SectionHeader title="Usuários" styles={styles} />
        <View style={styles.grid2}>
          <MetricCard label="Total" value={data.users.total} color={ADMIN_COLOR} styles={styles} />
          <MetricCard
            label="Perfis Completos"
            value={data.users.complete_profiles}
            color={t.status.success}
            styles={styles}
          />
          <MetricCard label="Novos (7d)" value={data.users.new_last_7d} styles={styles} />
          <MetricCard label="Novos (30d)" value={data.users.new_last_30d} styles={styles} />
        </View>

        {/* ---- Faixas Etárias ---- */}
        <SectionHeader title="Faixas Etárias" styles={styles} />
        <View style={styles.card}>
          {data.age_ranges.map((r) => (
            <BarRow
              key={r.range}
              label={r.range}
              count={r.count}
              total={totalAgeCount}
              styles={styles}
            />
          ))}
        </View>

        {/* ---- Geografia ---- */}
        <SectionHeader title="Geografia" styles={styles} />
        <View style={styles.card}>
          <Text style={styles.subSectionTitle}>Por Cidade</Text>
          {data.geography.by_city.length === 0 ? (
            <Text style={styles.emptyText}>Sem dados</Text>
          ) : (
            data.geography.by_city.map((item, i) => (
              <RankedRow
                key={item.city}
                rank={i + 1}
                label={item.city ?? '-'}
                count={item.count}
                styles={styles}
              />
            ))
          )}
        </View>
        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.subSectionTitle}>Por Estado</Text>
          {data.geography.by_state.length === 0 ? (
            <Text style={styles.emptyText}>Sem dados</Text>
          ) : (
            data.geography.by_state.map((item, i) => (
              <RankedRow
                key={item.state}
                rank={i + 1}
                label={item.state ?? '-'}
                count={item.count}
                styles={styles}
              />
            ))
          )}
        </View>

        {/* ---- Perfil Vocacional ---- */}
        <SectionHeader title="Perfil Vocacional" styles={styles} />
        <View style={styles.card}>
          <Text style={styles.subSectionTitle}>Estado de Vida</Text>
          {data.profile_breakdown.by_life_state.length === 0 ? (
            <Text style={styles.emptyText}>Sem dados</Text>
          ) : (
            data.profile_breakdown.by_life_state.map((item) => {
              const total = data.profile_breakdown.by_life_state.reduce(
                (s, r) => s + r.count,
                0
              ) || 1;
              const pct = Math.round((item.count / total) * 100);
              return (
                <View key={item.label} style={styles.labelRow}>
                  <Text style={styles.labelText}>{item.label}</Text>
                  <Text style={styles.labelCount}>
                    {item.count} ({pct}%)
                  </Text>
                </View>
              );
            })
          )}
        </View>
        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.subSectionTitle}>Realidade Vocacional</Text>
          {data.profile_breakdown.by_vocational_reality.length === 0 ? (
            <Text style={styles.emptyText}>Sem dados</Text>
          ) : (
            data.profile_breakdown.by_vocational_reality.map((item) => {
              const total = data.profile_breakdown.by_vocational_reality.reduce(
                (s, r) => s + r.count,
                0
              ) || 1;
              const pct = Math.round((item.count / total) * 100);
              return (
                <View key={item.label} style={styles.labelRow}>
                  <Text style={styles.labelText}>{item.label}</Text>
                  <Text style={styles.labelCount}>
                    {item.count} ({pct}%)
                  </Text>
                </View>
              );
            })
          )}
        </View>
        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.subSectionTitle}>Estado Civil</Text>
          {data.profile_breakdown.by_marital_status.length === 0 ? (
            <Text style={styles.emptyText}>Sem dados</Text>
          ) : (
            data.profile_breakdown.by_marital_status.map((item) => {
              const total = data.profile_breakdown.by_marital_status.reduce(
                (s, r) => s + r.count,
                0
              ) || 1;
              const pct = Math.round((item.count / total) * 100);
              return (
                <View key={item.label} style={styles.labelRow}>
                  <Text style={styles.labelText}>{item.label}</Text>
                  <Text style={styles.labelCount}>
                    {item.count} ({pct}%)
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* ---- Engajamento ---- */}
        <SectionHeader title="Engajamento" styles={styles} />
        <View style={styles.grid3}>
          <View style={styles.engCard}>
            <Ionicons name="person-outline" size={22} color={t.brand.primary} />
            <Text style={styles.engValue}>
              {data.profile_breakdown.with_vocational_accompaniment}
            </Text>
            <Text style={styles.engLabel}>Com Acomp. Vocacional</Text>
          </View>
          <View style={styles.engCard}>
            <Ionicons name="star-outline" size={22} color={t.status.warning} />
            <Text style={styles.engValue}>
              {data.profile_breakdown.interested_in_ministry}
            </Text>
            <Text style={styles.engLabel}>Interesse em Ministério</Text>
          </View>
          <View style={styles.engCard}>
            <Ionicons name="globe-outline" size={22} color={t.status.success} />
            <Text style={styles.engValue}>
              {data.profile_breakdown.from_mission}
            </Text>
            <Text style={styles.engLabel}>De Missão</Text>
          </View>
        </View>

        {/* ---- Memberships ---- */}
        <SectionHeader title="Memberships" styles={styles} />
        <View style={styles.card}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Ativos</Text>
            <Text style={styles.totalValue}>{data.memberships.total_active}</Text>
          </View>
          {data.memberships.by_unit_type.map((item) => (
            <BarRow
              key={item.type}
              label={item.label}
              count={item.count}
              total={data.memberships.total_active || 1}
              styles={styles}
            />
          ))}
        </View>

        {/* ---- Convites ---- */}
        <SectionHeader title="Convites" styles={styles} />
        <View style={styles.card}>
          <View style={styles.inviteGrid}>
            <View style={styles.inviteItem}>
              <Text style={styles.inviteValue}>{data.invites.total}</Text>
              <Text style={styles.inviteLabel}>Total</Text>
            </View>
            <View style={styles.inviteItem}>
              <Text style={[styles.inviteValue, { color: t.status.success }]}>
                {data.invites.accepted}
              </Text>
              <Text style={styles.inviteLabel}>Aceitos</Text>
            </View>
            <View style={styles.inviteItem}>
              <Text style={[styles.inviteValue, { color: t.status.warning }]}>
                {data.invites.pending}
              </Text>
              <Text style={styles.inviteLabel}>Pendentes</Text>
            </View>
            <View style={styles.inviteItem}>
              <Text style={[styles.inviteValue, { color: t.status.error }]}>
                {data.invites.declined}
              </Text>
              <Text style={styles.inviteLabel}>Recusados</Text>
            </View>
          </View>
          <View style={styles.acceptanceRow}>
            <Text style={styles.acceptanceLabel}>
              Taxa de aceitação: {data.invites.acceptance_rate}%
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.min(data.invites.acceptance_rate, 100)}%`,
                    backgroundColor: t.status.success,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* ---- Top Ministérios ---- */}
        <SectionHeader title="Top Ministérios" styles={styles} />
        <View style={styles.card}>
          {data.top_ministries.length === 0 ? (
            <Text style={styles.emptyText}>Sem dados</Text>
          ) : (
            data.top_ministries.map((item, i) => (
              <RankedRow
                key={item.name}
                rank={i + 1}
                label={item.name}
                count={item.member_count}
                styles={styles}
              />
            ))
          )}
        </View>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

// -------------------------------------------------------------------------
// Styles
// -------------------------------------------------------------------------
const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg.elevated,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: t.bg.elevated,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: t.text.secondary,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: t.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: t.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: ADMIN_COLOR,
  },
  backBtnText: {
    color: ADMIN_COLOR,
    fontSize: 15,
    fontWeight: '600',
  },
  // Header
  header: {
    backgroundColor: ADMIN_COLOR,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: t.text.inverse,
    marginTop: 10,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  // Sections
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: t.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: t.text.secondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Cards
  card: {
    backgroundColor: t.bg.screen,
    borderRadius: 12,
    padding: 16,
  },
  // 2-column grid for metric cards
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    backgroundColor: t.bg.screen,
    borderRadius: 12,
    padding: 16,
    width: '48%',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '800',
    color: t.text.primary,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: t.text.secondary,
    textAlign: 'center',
  },
  // Bar rows
  barRow: {
    marginBottom: 10,
  },
  barLabel: {
    fontSize: 13,
    color: t.text.primary,
    marginBottom: 4,
  },
  barTrack: {
    height: 8,
    backgroundColor: t.border.subtle,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 2,
  },
  barFill: {
    height: 8,
    backgroundColor: ADMIN_COLOR,
    borderRadius: 4,
  },
  barCount: {
    fontSize: 11,
    color: t.text.secondary,
  },
  // Ranked list rows
  rankedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: t.border.subtle,
  },
  rankedIndex: {
    width: 24,
    fontSize: 13,
    fontWeight: '700',
    color: ADMIN_COLOR,
  },
  rankedLabel: {
    flex: 1,
    fontSize: 13,
    color: t.text.primary,
  },
  rankedCount: {
    fontSize: 13,
    fontWeight: '600',
    color: t.text.secondary,
  },
  // Label + count rows (catalog breakdown)
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: t.border.subtle,
  },
  labelText: {
    flex: 1,
    fontSize: 13,
    color: t.text.primary,
  },
  labelCount: {
    fontSize: 13,
    color: t.text.secondary,
    fontWeight: '500',
  },
  // Engagement 3-column grid
  grid3: {
    flexDirection: 'row',
    gap: 8,
  },
  engCard: {
    flex: 1,
    backgroundColor: t.bg.screen,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  engValue: {
    fontSize: 22,
    fontWeight: '800',
    color: t.text.primary,
    marginVertical: 6,
  },
  engLabel: {
    fontSize: 11,
    color: t.text.secondary,
    textAlign: 'center',
  },
  // Totals
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.border.subtle,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: t.text.primary,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: ADMIN_COLOR,
  },
  // Invites
  inviteGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  inviteItem: {
    alignItems: 'center',
  },
  inviteValue: {
    fontSize: 22,
    fontWeight: '800',
    color: t.text.primary,
    marginBottom: 2,
  },
  inviteLabel: {
    fontSize: 11,
    color: t.text.secondary,
  },
  acceptanceRow: {
    gap: 6,
  },
  acceptanceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: t.text.primary,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: t.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  // Back button
  backButton: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: ADMIN_COLOR,
    alignItems: 'center',
  },
  backButtonText: {
    color: ADMIN_COLOR,
    fontSize: 16,
    fontWeight: '600',
  },
});
