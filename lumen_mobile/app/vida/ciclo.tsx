/**
 * Projeto de Vida — Visualização do Ciclo
 * =========================================
 * Exibe todos os dados do ciclo mensal em seções.
 */

import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import projetoVidaMensalApi, {
  MESES, SEMANAS, SEMANA_LABELS, DIAS, DIA_LABELS,
  type ProjetoVidaMensalFull,
  type EventoItem,
  type OutroItemComunidade,
  type CuidadoEventoItem,
  type OutroItemCuidado,
} from '@/services/projetoVidaMensal';

const colors = {
  primary: '#1A859B', primaryLight: '#E8F4F7',
  white: '#ffffff', gray: '#6b7280',
  lightGray: '#f3f4f6', dark: '#171717', border: '#e5e7eb',
};

export default function CicloScreen() {
  const { projetoId } = useLocalSearchParams<{ projetoId: string }>();
  const [projeto, setProjeto] = useState<ProjetoVidaMensalFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const data = await projetoVidaMensalApi.get(projetoId);
      setProjeto(data);
    } catch {
      setError('Erro ao carregar o ciclo. Tente novamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projetoId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#dc2626', fontSize: 15, textAlign: 'center', padding: 24 }}>{error}</Text>
      </View>
    );
  }
  if (!projeto) return null;

  const mesLabel = MESES[projeto.mes - 1];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} colors={[colors.primary]} />}
    >
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.headerMonth}>{mesLabel} {projeto.ano}</Text>
        {projeto.concluido && <View style={styles.badge}><Text style={styles.badgeText}>Ciclo concluído</Text></View>}
      </View>

      {/* Comunidade */}
      <Section title="Comunidade" icon={'people-outline' as IoniconsName}>
        {projeto.comunidade ? (
          <>
            <EventoList
              label="Partilha com acompanhador"
              items={projeto.comunidade.partilha_acompanhador}
            />
            <EventoList
              label="Encontro com família"
              items={projeto.comunidade.encontro_familia}
            />
            <EventoList
              label="Dias de grupo"
              items={projeto.comunidade.dias_grupo}
            />
            <OutroComunidadeList items={projeto.comunidade.outros} />
            {(projeto.comunidade.partilha_acompanhador.length === 0 &&
              projeto.comunidade.encontro_familia.length === 0 &&
              projeto.comunidade.dias_grupo.length === 0 &&
              projeto.comunidade.outros.length === 0) && (
              <Text style={styles.empty}>Não preenchido</Text>
            )}
          </>
        ) : <Text style={styles.empty}>Não preenchido</Text>}
      </Section>

      {/* Cuidado */}
      <Section title="Cuidado Pessoal" icon={'heart-outline' as IoniconsName}>
        {projeto.cuidado ? (
          <>
            <CuidadoList label="Consultas" items={projeto.cuidado.consultas} />
            <CuidadoList label="Exames" items={projeto.cuidado.exames} />
            <CuidadoList label="Descanso e lazer" items={projeto.cuidado.descanso} />
            <OutroCuidadoList items={projeto.cuidado.outros} />
            {(projeto.cuidado.consultas.length === 0 &&
              projeto.cuidado.exames.length === 0 &&
              projeto.cuidado.descanso.length === 0 &&
              projeto.cuidado.outros.length === 0) && (
              <Text style={styles.empty}>Não preenchido</Text>
            )}
          </>
        ) : <Text style={styles.empty}>Não preenchido</Text>}
      </Section>

      {/* Compromissos semanais */}
      <Section title="Compromissos" icon={'list-outline' as IoniconsName}>
        {SEMANAS.filter(s => projeto.compromissos.some(c => c.semana === s)).length === 0
          ? <Text style={styles.empty}>Nenhum compromisso cadastrado</Text>
          : SEMANAS.map(s => {
              const items = projeto.compromissos.filter(c => c.semana === s);
              if (items.length === 0) return null;
              return (
                <View key={s} style={{ marginBottom: 12 }}>
                  <Text style={styles.subheading}>{SEMANA_LABELS[s]}</Text>
                  {items.map((c, i) => (
                    <View key={i} style={styles.listItem}>
                      <Text style={styles.listItemTitle}>{c.titulo || '—'}</Text>
                      {c.dia || c.horario ? (
                        <Text style={styles.listItemMeta}>{[c.dia, c.horario].filter(Boolean).join(' · ')}</Text>
                      ) : null}
                      {c.obs ? <Text style={styles.listItemObs}>{c.obs}</Text> : null}
                    </View>
                  ))}
                </View>
              );
            })}
      </Section>

      {/* Oração diária */}
      <Section title="Oração Diária" icon={'sunny-outline' as IoniconsName}>
        {DIAS.filter(d => projeto.praticas.some(p => p.dia_semana === d)).length === 0
          ? <Text style={styles.empty}>Nenhuma prática cadastrada</Text>
          : DIAS.map(d => {
              const items = projeto.praticas.filter(p => p.dia_semana === d);
              if (items.length === 0) return null;
              return (
                <View key={d} style={{ marginBottom: 12 }}>
                  <Text style={styles.subheading}>{DIA_LABELS[d]}</Text>
                  {items.map((p, i) => (
                    <View key={i} style={styles.listItem}>
                      <Text style={styles.listItemTitle}>{p.tipo}</Text>
                      {p.horario || p.duracao ? (
                        <Text style={styles.listItemMeta}>{[p.horario, p.duracao].filter(Boolean).join(' · ')}</Text>
                      ) : null}
                      {p.obs ? <Text style={styles.listItemObs}>{p.obs}</Text> : null}
                    </View>
                  ))}
                </View>
              );
            })}
      </Section>

      {/* Revisão (se existir) */}
      {projeto.revisao && (
        <Section title="Revisão do Ciclo" icon={'checkmark-circle-outline' as IoniconsName}>
          <TextField
            label="Prática espiritual que quero melhorar"
            value={projeto.revisao.pratica_melhorar}
          />
          <TextField
            label="Táticas de vigilância"
            value={projeto.revisao.taticas_vigilancia}
          />
          <TextField
            label="Rotina de evangelização"
            value={projeto.revisao.rotina_evangelizacao}
          />
          <TextField
            label="Outra área de atenção"
            value={projeto.revisao.outra_area_atencao}
          />
          {(!projeto.revisao.pratica_melhorar &&
            !projeto.revisao.taticas_vigilancia &&
            !projeto.revisao.rotina_evangelizacao &&
            !projeto.revisao.outra_area_atencao) && (
            <Text style={styles.empty}>Revisão não preenchida</Text>
          )}
        </Section>
      )}

      {/* Ações */}
      {!projeto.concluido && (
        <TouchableOpacity
          style={styles.revisaoBtn}
          onPress={() => router.push({ pathname: '/vida/revisao', params: { projetoId } })}
          activeOpacity={0.8}
        >
          <Ionicons name={'checkmark-circle-outline' as IoniconsName} size={20} color={colors.white} />
          <Text style={styles.revisaoBtnText}>Iniciar Revisão Mensal</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ── Sub-componentes ─────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: IoniconsName; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function TextField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function EventoList({ label, items }: { label: string; items: EventoItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={styles.subSection}>
      <Text style={styles.subheading}>{label}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.listItem}>
          {item.data || item.horario ? (
            <Text style={styles.listItemMeta}>
              {[item.data, item.horario].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {item.local ? <Text style={styles.listItemTitle}>{item.local}</Text> : null}
          {item.observacoes ? <Text style={styles.listItemObs}>{item.observacoes}</Text> : null}
          {!item.data && !item.horario && !item.local && !item.observacoes && (
            <Text style={styles.listItemObs}>—</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function OutroComunidadeList({ items }: { items: OutroItemComunidade[] }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={styles.subSection}>
      <Text style={styles.subheading}>Outros compromissos</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.listItem}>
          {item.titulo ? <Text style={styles.listItemTitle}>{item.titulo}</Text> : null}
          {item.data || item.horario ? (
            <Text style={styles.listItemMeta}>
              {[item.data, item.horario].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {item.local ? <Text style={styles.listItemMeta}>{item.local}</Text> : null}
          {item.descricao ? <Text style={styles.listItemObs}>{item.descricao}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function CuidadoList({ label, items }: { label: string; items: CuidadoEventoItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={styles.subSection}>
      <Text style={styles.subheading}>{label}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.listItem}>
          {item.data || item.horario ? (
            <Text style={styles.listItemMeta}>
              {[item.data, item.horario].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {item.local ? <Text style={styles.listItemTitle}>{item.local}</Text> : null}
          {item.descricao ? <Text style={styles.listItemObs}>{item.descricao}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function OutroCuidadoList({ items }: { items: OutroItemCuidado[] }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={styles.subSection}>
      <Text style={styles.subheading}>Outros cuidados</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.listItem}>
          {item.titulo ? <Text style={styles.listItemTitle}>{item.titulo}</Text> : null}
          {item.data || item.horario ? (
            <Text style={styles.listItemMeta}>
              {[item.data, item.horario].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {item.local ? <Text style={styles.listItemMeta}>{item.local}</Text> : null}
          {item.descricao ? <Text style={styles.listItemObs}>{item.descricao}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: colors.primary, borderRadius: 16, padding: 22, marginBottom: 20, gap: 6 },
  headerMonth: { fontSize: 22, fontWeight: '700', color: colors.white },
  badge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 },
  badgeText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  section: { backgroundColor: colors.white, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.dark },
  subSection: { marginBottom: 12 },
  subheading: { fontSize: 13, fontWeight: '600', color: colors.primary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, color: colors.gray, marginBottom: 2 },
  fieldValue: { fontSize: 14, color: colors.dark, lineHeight: 20 },
  empty: { fontSize: 14, color: colors.gray, fontStyle: 'italic' },
  listItem: { backgroundColor: colors.lightGray, borderRadius: 8, padding: 10, marginBottom: 6 },
  listItemTitle: { fontSize: 14, fontWeight: '600', color: colors.dark },
  listItemMeta: { fontSize: 12, color: colors.gray, marginTop: 2 },
  listItemObs: { fontSize: 13, color: colors.dark, marginTop: 4, lineHeight: 18 },
  revisaoBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8 },
  revisaoBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
