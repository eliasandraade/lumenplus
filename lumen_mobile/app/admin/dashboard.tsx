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
  /** Campos novos da Fase 1 são opcionais para tolerar payload antigo na janela de deploy. */
  id?: string;
  name: string;
  sector_name?: string | null;
  member_count: number;
}

interface DashboardData {
  users: {
    total: number;
    complete_profiles: number;
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
    people_active?: number;
    by_unit_type: UnitTypeCount[];
  };
  invites: {
    total: number;
    accepted: number;
    pending: number;
    declined: number;
    expired?: number;
    cancelled?: number;
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
  const completePct = Math.round((data.users.complete_profiles / totalUsers) * 100);

  // Faixas etárias: % sobre quem informou; "Não informado" vira linha separada
  const informedAges = data.age_ranges.filter((r) => r.range !== 'Não informado');
  const unknownAges = data.age_ranges.find((r) => r.range === 'Não informado');
  const totalAgeInformed = informedAges.reduce((s, r) => s + r.count, 0) || 1;

  // Bases explícitas dos catálogos ("de N que informaram")
  const lifeStateTotal = data.profile_breakdown.by_life_state.reduce((s, r) => s + r.count, 0);
  const vocRealityTotal = data.profile_breakdown.by_vocational_reality.reduce(
    (s, r) => s + r.count,
    0
  );
  const maritalTotal = data.profile_breakdown.by_marital_status.reduce((s, r) => s + r.count, 0);

  // Acompanhamento: com + sem = quem informou (denominador explícito)
  const acompYes = data.profile_breakdown.with_vocational_accompaniment;
  const acompTotal = acompYes + data.profile_breakdown.without_vocational_accompaniment;
  const acompPct = acompTotal > 0 ? Math.round((acompYes / acompTotal) * 100) : 0;

  // Campos novos da Fase 1 — defaults defensivos p/ payload antigo
  const peopleActive = data.memberships.people_active ?? 0;
  const invExpired = data.invites.expired ?? 0;
  const invCancelled = data.invites.cancelled ?? 0;

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
          <Text style={styles.headerSubtitle}>Panorama da comunidade</Text>
        </View>

        {/* ---- Membros ---- */}
        <SectionHeader title="Membros" styles={styles} />
        <View style={styles.grid2}>
          <MetricCard
            label="Membros ativos"
            value={data.users.total}
            color={ADMIN_COLOR}
            styles={styles}
          />
          <MetricCard
            label={`Cadastros completos (${completePct}%)`}
            value={`${data.users.complete_profiles} de ${data.users.total}`}
            color={t.status.success}
            styles={styles}
          />
          <MetricCard label="Novos (7 dias)" value={data.users.new_last_7d} styles={styles} />
          <MetricCard label="Novos (30 dias)" value={data.users.new_last_30d} styles={styles} />
        </View>

        {/* ---- Faixas Etárias ---- */}
        <SectionHeader title="Faixas Etárias" styles={styles} />
        <View style={styles.card}>
          {informedAges.map((r) => (
            <BarRow
              key={r.range}
              label={r.range}
              count={r.count}
              total={totalAgeInformed}
              styles={styles}
            />
          ))}
          {unknownAges && unknownAges.count > 0 && (
            <View style={styles.labelRow}>
              <Text style={styles.labelText}>Não informado</Text>
              <Text style={styles.labelCount}>{unknownAges.count}</Text>
            </View>
          )}
          <Text style={styles.baseNote}>
            Percentuais sobre {totalAgeInformed} membro{totalAgeInformed !== 1 ? 's' : ''} que
            informaram a data de nascimento.
          </Text>
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
            <>
              {data.profile_breakdown.by_life_state.map((item) => {
                const pct = Math.round((item.count / (lifeStateTotal || 1)) * 100);
                return (
                  <View key={item.label} style={styles.labelRow}>
                    <Text style={styles.labelText}>{item.label}</Text>
                    <Text style={styles.labelCount}>
                      {item.count} de {lifeStateTotal} ({pct}%)
                    </Text>
                  </View>
                );
              })}
              <Text style={styles.baseNote}>
                de {lifeStateTotal} membro{lifeStateTotal !== 1 ? 's' : ''} que informaram
              </Text>
            </>
          )}
        </View>
        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.subSectionTitle}>Realidade Vocacional</Text>
          {data.profile_breakdown.by_vocational_reality.length === 0 ? (
            <Text style={styles.emptyText}>Sem dados</Text>
          ) : (
            <>
              {data.profile_breakdown.by_vocational_reality.map((item) => {
                const pct = Math.round((item.count / (vocRealityTotal || 1)) * 100);
                return (
                  <View key={item.label} style={styles.labelRow}>
                    <Text style={styles.labelText}>{item.label}</Text>
                    <Text style={styles.labelCount}>
                      {item.count} de {vocRealityTotal} ({pct}%)
                    </Text>
                  </View>
                );
              })}
              <Text style={styles.baseNote}>
                de {vocRealityTotal} membro{vocRealityTotal !== 1 ? 's' : ''} que informaram
              </Text>
            </>
          )}
        </View>
        <View style={[styles.card, { marginTop: 8 }]}>
          <Text style={styles.subSectionTitle}>Estado Civil</Text>
          {data.profile_breakdown.by_marital_status.length === 0 ? (
            <Text style={styles.emptyText}>Sem dados</Text>
          ) : (
            <>
              {data.profile_breakdown.by_marital_status.map((item) => {
                const pct = Math.round((item.count / (maritalTotal || 1)) * 100);
                return (
                  <View key={item.label} style={styles.labelRow}>
                    <Text style={styles.labelText}>{item.label}</Text>
                    <Text style={styles.labelCount}>
                      {item.count} de {maritalTotal} ({pct}%)
                    </Text>
                  </View>
                );
              })}
              <Text style={styles.baseNote}>
                de {maritalTotal} membro{maritalTotal !== 1 ? 's' : ''} que informaram
              </Text>
            </>
          )}
        </View>

        {/* ---- Acompanhamento e interesse ---- */}
        <SectionHeader title="Acompanhamento e interesse" styles={styles} />
        <View style={styles.grid3}>
          <View style={styles.engCard}>
            <Ionicons name="person-outline" size={22} color={t.brand.primary} />
            <Text style={styles.engValue}>
              {acompYes} de {acompTotal}
            </Text>
            <Text style={styles.engLabel}>
              Com acompanhamento vocacional ({acompPct}%)
            </Text>
          </View>
          <View style={styles.engCard}>
            <Ionicons name="star-outline" size={22} color={t.status.warning} />
            <Text style={styles.engValue}>
              {data.profile_breakdown.interested_in_ministry} de {data.users.total}
            </Text>
            <Text style={styles.engLabel}>
              Interesse em ministério (
              {Math.round((data.profile_breakdown.interested_in_ministry / totalUsers) * 100)}%)
            </Text>
          </View>
          <View style={styles.engCard}>
            <Ionicons name="globe-outline" size={22} color={t.status.success} />
            <Text style={styles.engValue}>
              {data.profile_breakdown.from_mission} de {data.users.total}
            </Text>
            <Text style={styles.engLabel}>
              Membros vindos de missão (
              {Math.round((data.profile_breakdown.from_mission / totalUsers) * 100)}%)
            </Text>
          </View>
        </View>

        {/* ---- Vínculos e participação ---- */}
        <SectionHeader title="Vínculos e participação" styles={styles} />
        <View style={styles.card}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Pessoas participando</Text>
            <Text style={styles.totalValue}>{peopleActive}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Vínculos ativos</Text>
            <Text style={styles.totalValue}>{data.memberships.total_active}</Text>
          </View>
          {data.memberships.by_unit_type.map((item) => (
            <BarRow
              key={item.type}
              label={item.type === 'MISSAO' ? 'Comunidades de Missão' : item.label}
              count={item.count}
              total={data.memberships.total_active || 1}
              styles={styles}
            />
          ))}
          <Text style={styles.baseNote}>
            Vínculos por tipo de unidade da estrutura. Uma pessoa pode servir em mais de uma
            comunidade — por isso os vínculos podem superar as pessoas.
          </Text>
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
            <View style={styles.inviteItem}>
              <Text style={styles.inviteValue}>{invExpired}</Text>
              <Text style={styles.inviteLabel}>Expirados</Text>
            </View>
            <View style={styles.inviteItem}>
              <Text style={styles.inviteValue}>{invCancelled}</Text>
              <Text style={styles.inviteLabel}>Cancelados</Text>
            </View>
          </View>
          <View style={styles.acceptanceRow}>
            <Text style={styles.acceptanceLabel}>
              Convites aceitos (entre os respondidos): {data.invites.acceptance_rate}%
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

        {/* ---- Ministérios com mais membros ---- */}
        <SectionHeader title="Ministérios com mais membros" styles={styles} />
        <View style={styles.card}>
          {data.top_ministries.length === 0 ? (
            <Text style={styles.emptyText}>Sem dados</Text>
          ) : (
            <>
              {data.top_ministries.map((item, i) => (
                <RankedRow
                  key={item.id ?? `${item.name}-${i}`}
                  rank={i + 1}
                  label={item.sector_name ? `${item.name} · ${item.sector_name}` : item.name}
                  count={item.member_count}
                  styles={styles}
                />
              ))}
              <Text style={styles.baseNote}>Contagem de pessoas (não de vínculos).</Text>
            </>
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
    flexWrap: 'wrap',
    marginBottom: 16,
    rowGap: 12,
  },
  inviteItem: {
    alignItems: 'center',
    width: '33%',
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
  // Nota de base/método sob os cards ("X de Y que informaram")
  baseNote: {
    fontSize: 11,
    color: t.text.secondary,
    fontStyle: 'italic',
    marginTop: 8,
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
