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
  type AreaMensalOut,
} from '@/services/projetoVidaMensal';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';
import { radius } from '@/theme/tokens';

type RadiusTokens = typeof radius;

export default function CicloScreen() {
  const { projetoId } = useLocalSearchParams<{ projetoId: string }>();
  const [projeto, setProjeto] = useState<ProjetoVidaMensalFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { t, r } = useTheme();

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
    return (
      <View style={[styles.center, { backgroundColor: t.bg.screen }]}>
        <ActivityIndicator size="large" color={t.brand.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.bg.screen }}>
        <Ionicons name={'alert-circle' as IoniconsName} size={24} color={t.status.error} />
        <Text style={{ color: t.status.error, fontSize: 15, textAlign: 'center', padding: 24, fontFamily: 'Nunito-Regular' }}>
          {error}
        </Text>
      </View>
    );
  }
  if (!projeto) return null;

  const mesLabel = MESES[projeto.mes - 1];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg.screen }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(true); }}
          colors={[t.brand.primary]}
        />
      }
    >
      {/* Cabeçalho */}
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
        <Text style={{ fontSize: 24, fontFamily: 'Nunito-ExtraBold', color: t.text.primary }}>
          {mesLabel} {projeto.ano}
        </Text>
        {projeto.concluido && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Ionicons name={'checkmark-circle' as IoniconsName} size={16} color={t.status.success} />
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-SemiBold', color: t.status.success }}>
              Ciclo concluído
            </Text>
          </View>
        )}
      </View>

      {/* Intenção do ciclo */}
      {projeto.intencao && (
        <View style={{
          marginHorizontal: 20,
          marginBottom: 16,
          backgroundColor: t.bg.spiritual,
          borderLeftWidth: 3,
          borderLeftColor: t.accent.spiritual,
          borderRadius: r.md,
          padding: 16,
        }}>
          <Text style={{ fontSize: 11, fontFamily: 'Nunito-Bold', color: t.accent.spiritual, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
            Intenção do ciclo
          </Text>
          <Text style={{ fontSize: 15, fontFamily: 'Nunito-Italic', color: t.text.spiritual, lineHeight: 22 }}>
            {projeto.intencao}
          </Text>
        </View>
      )}

      {projeto.has_new_structure ? (
        <>
          {/* 5 áreas estruturadas */}
          {(projeto.areas ?? []).map(area => (
            <AreaSection key={area.tipo_area} area={area} t={t} r={r} />
          ))}

          {/* Reflexão sobre Evangelização */}
          {projeto.reflexao_evangelizacao && (
            <Section title="Evangelização Ser Feliz" icon={'globe-outline' as IoniconsName} color={'#f97316'} t={t} r={r}>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-Regular', color: t.text.primary, lineHeight: 22 }}>
                {projeto.reflexao_evangelizacao}
              </Text>
            </Section>
          )}

          {/* Revisão (se existir) */}
          {projeto.revisao && (
            <RevisaoSection revisao={projeto.revisao} t={t} r={r} />
          )}
        </>
      ) : (
        <>
      {/* Comunidade */}
      <Section title="Comunidade" icon={'people-outline' as IoniconsName} color={t.brand.primary} t={t} r={r}>
        {projeto.comunidade ? (
          <>
            <EventoList
              label="Partilha com acompanhador"
              items={projeto.comunidade.partilha_acompanhador}
              t={t}
            />
            <EventoList
              label="Encontro com família"
              items={projeto.comunidade.encontro_familia}
              t={t}
            />
            <EventoList
              label="Dias de grupo"
              items={projeto.comunidade.dias_grupo}
              t={t}
            />
            <OutroComunidadeList items={projeto.comunidade.outros} t={t} />
            {(projeto.comunidade.partilha_acompanhador.length === 0 &&
              projeto.comunidade.encontro_familia.length === 0 &&
              projeto.comunidade.dias_grupo.length === 0 &&
              projeto.comunidade.outros.length === 0) && (
              <Text style={{ fontSize: 13, fontFamily: 'Nunito-Italic', color: t.text.tertiary }}>
                Ainda não preenchido neste ciclo.
              </Text>
            )}
          </>
        ) : (
          <Text style={{ fontSize: 13, fontFamily: 'Nunito-Italic', color: t.text.tertiary }}>
            Ainda não preenchido neste ciclo.
          </Text>
        )}
      </Section>

      {/* Cuidado */}
      <Section title="Cuidado Pessoal" icon={'heart-outline' as IoniconsName} color={t.status.success} t={t} r={r}>
        {projeto.cuidado ? (
          <>
            <CuidadoList label="Consultas" items={projeto.cuidado.consultas} t={t} />
            <CuidadoList label="Exames" items={projeto.cuidado.exames} t={t} />
            <CuidadoList label="Descanso e lazer" items={projeto.cuidado.descanso} t={t} />
            <OutroCuidadoList items={projeto.cuidado.outros} t={t} />
            {(projeto.cuidado.consultas.length === 0 &&
              projeto.cuidado.exames.length === 0 &&
              projeto.cuidado.descanso.length === 0 &&
              projeto.cuidado.outros.length === 0) && (
              <Text style={{ fontSize: 13, fontFamily: 'Nunito-Italic', color: t.text.tertiary }}>
                Ainda não preenchido neste ciclo.
              </Text>
            )}
          </>
        ) : (
          <Text style={{ fontSize: 13, fontFamily: 'Nunito-Italic', color: t.text.tertiary }}>
            Ainda não preenchido neste ciclo.
          </Text>
        )}
      </Section>

      {/* Compromissos semanais */}
      <Section title="Compromissos" icon={'list-outline' as IoniconsName} color={t.accent.spiritual} t={t} r={r}>
        {SEMANAS.filter(s => projeto.compromissos.some(c => c.semana === s)).length === 0
          ? (
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Italic', color: t.text.tertiary }}>
              Ainda não preenchido neste ciclo.
            </Text>
          )
          : SEMANAS.map(s => {
              const items = projeto.compromissos.filter(c => c.semana === s);
              if (items.length === 0) return null;
              return (
                <View key={s} style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Nunito-SemiBold', color: t.brand.primary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {SEMANA_LABELS[s]}
                  </Text>
                  {items.map((c, i) => (
                    <View key={i} style={{ backgroundColor: t.bg.surface, borderRadius: 8, padding: 10, marginBottom: 6 }}>
                      <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>{c.titulo || '—'}</Text>
                      {c.dia || c.horario ? (
                        <Text style={{ fontSize: 12, fontFamily: 'Nunito-Regular', color: t.text.secondary, marginTop: 2 }}>
                          {[c.dia, c.horario].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                      {c.obs ? (
                        <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.primary, marginTop: 4, lineHeight: 18 }}>
                          {c.obs}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              );
            })}
      </Section>

      {/* Oração diária */}
      <Section title="Oração Diária" icon={'sunny-outline' as IoniconsName} color={t.accent.spiritual} t={t} r={r}>
        {DIAS.filter(d => projeto.praticas.some(p => p.dia_semana === d)).length === 0
          ? (
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Italic', color: t.text.tertiary }}>
              Ainda não preenchido neste ciclo.
            </Text>
          )
          : DIAS.map(d => {
              const items = projeto.praticas.filter(p => p.dia_semana === d);
              if (items.length === 0) return null;
              return (
                <View key={d} style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Nunito-SemiBold', color: t.brand.primary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {DIA_LABELS[d]}
                  </Text>
                  {items.map((p, i) => (
                    <View key={i} style={{ backgroundColor: t.bg.surface, borderRadius: 8, padding: 10, marginBottom: 6 }}>
                      <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>{p.tipo}</Text>
                      {p.horario || p.duracao ? (
                        <Text style={{ fontSize: 12, fontFamily: 'Nunito-Regular', color: t.text.secondary, marginTop: 2 }}>
                          {[p.horario, p.duracao].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                      {p.obs ? (
                        <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.primary, marginTop: 4, lineHeight: 18 }}>
                          {p.obs}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              );
            })}
      </Section>

      {/* Revisão (se existir) */}
      {projeto.revisao && (
        <Section title="Revisão do Ciclo" icon={'checkmark-circle-outline' as IoniconsName} color={t.brand.primary} t={t} r={r}>
          <TextField
            label="Prática espiritual que quero melhorar"
            value={projeto.revisao.pratica_melhorar}
            t={t}
          />
          <TextField
            label="Táticas de vigilância"
            value={projeto.revisao.taticas_vigilancia}
            t={t}
          />
          <TextField
            label="Rotina de evangelização"
            value={projeto.revisao.rotina_evangelizacao}
            t={t}
          />
          <TextField
            label="Outra área de atenção"
            value={projeto.revisao.outra_area_atencao}
            t={t}
          />
          {(!projeto.revisao.pratica_melhorar &&
            !projeto.revisao.taticas_vigilancia &&
            !projeto.revisao.rotina_evangelizacao &&
            !projeto.revisao.outra_area_atencao) && (
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Italic', color: t.text.tertiary }}>
              Ainda não preenchido neste ciclo.
            </Text>
          )}
        </Section>
      )}

        </>
      )}

      {/* Acesso ao Projeto Semanal */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
        <TouchableOpacity
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: 16, borderRadius: r.xl,
            backgroundColor: t.brand.primaryDim, borderWidth: 1.5, borderColor: t.brand.primary,
          }}
          onPress={() => router.push({
            pathname: '/vida/semanal',
            params: {
              projetoId,
              reflexaoEvangelizacao: projeto?.reflexao_evangelizacao ?? '',
            },
          })}
          activeOpacity={0.8}
          accessibilityLabel="Abrir Projeto Semanal"
          accessibilityRole="button"
        >
          <Ionicons name={'calendar-outline' as IoniconsName} size={18} color={t.brand.primary} />
          <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: t.brand.primary }}>
            Projeto Semanal
          </Text>
          <Ionicons name={'chevron-forward' as IoniconsName} size={16} color={t.brand.primary} />
        </TouchableOpacity>
      </View>

      {/* Ações */}
      {!projeto.concluido && (
        <TouchableOpacity
          style={{
            backgroundColor: t.brand.primary,
            borderRadius: r.lg,
            padding: 16,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            marginTop: 8,
            marginHorizontal: 16,
          }}
          onPress={() => router.push({ pathname: '/vida/revisao', params: { projetoId } })}
          activeOpacity={0.8}
        >
          <Ionicons name={'checkmark-circle-outline' as IoniconsName} size={20} color="#ffffff" />
          <Text style={{ color: '#ffffff', fontSize: 15, fontFamily: 'Nunito-Bold' }}>Iniciar Revisão Mensal</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ── Sub-componentes ─────────────────────────────────────────────────────────

const AREA_LABELS: Record<string, string> = {
  FAMILIA_VOCACIONAL:    'Família Vocacional',
  MINISTERIO_BOM_PASTOR: 'Ministério Bom Pastor',
  GRUPO_FORMATIVO:       'Grupo Formativo',
  SAUDE_LAZER:           'Saúde, Descanso e Lazer',
  FAMILIA_ORIGEM:        'Família de Origem',
};

const AREA_ICONS: Record<string, IoniconsName> = {
  FAMILIA_VOCACIONAL:    'people-outline',
  MINISTERIO_BOM_PASTOR: 'hand-right-outline',
  GRUPO_FORMATIVO:       'school-outline',
  SAUDE_LAZER:           'heart-outline',
  FAMILIA_ORIGEM:        'home-outline',
};

function AreaSection({
  area, t, r,
}: {
  area: AreaMensalOut;
  t: SemanticTokens;
  r: RadiusTokens;
}) {
  const label = AREA_LABELS[area.tipo_area] ?? area.tipo_area;
  const icon = (AREA_ICONS[area.tipo_area] ?? 'list-outline') as IoniconsName;
  const hasContent = area.objetivo || (area.compromissos && area.compromissos.length > 0) || area.observacoes;

  return (
    <Section title={label} icon={icon} color={t.brand.primary} t={t} r={r}>
      {hasContent ? (
        <>
          {area.objetivo && (
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                Objetivo
              </Text>
              <Text style={{ fontSize: 14, fontFamily: 'Nunito-Regular', color: t.text.primary, lineHeight: 20 }}>
                {area.objetivo}
              </Text>
            </View>
          )}
          {area.compromissos && area.compromissos.length > 0 && (
            <View style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
                Compromissos
              </Text>
              {area.compromissos.map((c, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <Ionicons name={'ellipse' as IoniconsName} size={6} color={t.brand.primary} style={{ marginTop: 7 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: 'Nunito-Regular', color: t.text.primary, lineHeight: 20 }}>
                      {c.descricao}
                    </Text>
                    {(c.data || c.horario || c.local) && (
                      <Text style={{ fontSize: 12, fontFamily: 'Nunito-Regular', color: t.text.tertiary, marginTop: 2 }}>
                        {[c.data, c.horario, c.local].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
          {area.observacoes && (
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Italic', color: t.text.secondary, lineHeight: 20 }}>
              {area.observacoes}
            </Text>
          )}
        </>
      ) : (
        <Text style={{ fontSize: 13, fontFamily: 'Nunito-Italic', color: t.text.tertiary }}>
          Ainda não preenchido neste ciclo.
        </Text>
      )}
    </Section>
  );
}

function RevisaoSection({
  revisao, t, r,
}: {
  revisao: NonNullable<ProjetoVidaMensalFull['revisao']>;
  t: SemanticTokens;
  r: RadiusTokens;
}) {
  const campos = [
    { label: 'Prática a melhorar', valor: revisao.pratica_melhorar },
    { label: 'Táticas de vigilância', valor: revisao.taticas_vigilancia },
    { label: 'Rotina de evangelização', valor: revisao.rotina_evangelizacao },
    { label: 'Outra área de atenção', valor: revisao.outra_area_atencao },
  ].filter(c => c.valor);

  if (campos.length === 0) return null;

  return (
    <Section title="Revisão Mensal" icon={'checkmark-circle-outline' as IoniconsName} color={t.status.success} t={t} r={r}>
      {campos.map(({ label, valor }) => (
        <View key={label} style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 12, fontFamily: 'Nunito-Bold', color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
            {label}
          </Text>
          <Text style={{ fontSize: 14, fontFamily: 'Nunito-Regular', color: t.text.primary, lineHeight: 20 }}>
            {valor}
          </Text>
        </View>
      ))}
    </Section>
  );
}

function Section({ title, icon, children, color, t, r }: {
  title: string;
  icon: IoniconsName;
  children: React.ReactNode;
  color: string;
  t: SemanticTokens;
  r: RadiusTokens;
}) {
  return (
    <View style={{
      backgroundColor: t.bg.elevated,
      borderRadius: r.lg,
      marginHorizontal: 16,
      marginBottom: 12,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border.subtle,
      ...t.shadow.sm,
    }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: t.border.subtle,
      }}>
        <View style={{
          width: 32, height: 32, borderRadius: 8,
          backgroundColor: `${color}18`,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: t.text.primary, flex: 1 }}>
          {title}
        </Text>
      </View>
      <View style={{ padding: 16 }}>
        {children}
      </View>
    </View>
  );
}

function TextField({ label, value, t }: { label: string; value?: string | null; t: SemanticTokens }) {
  if (!value) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, fontFamily: 'Nunito-SemiBold', color: t.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, fontFamily: 'Nunito-Regular', color: t.text.primary, lineHeight: 22 }}>
        {value}
      </Text>
    </View>
  );
}

function EventoList({ label, items, t }: { label: string; items: EventoItem[]; t: SemanticTokens }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontFamily: 'Nunito-SemiBold', color: t.text.secondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
      {items.map((item, i) => (
        <View key={i} style={{ backgroundColor: t.bg.surface, borderRadius: 8, padding: 10, marginBottom: 6 }}>
          {item.data || item.horario ? (
            <Text style={{ fontSize: 12, fontFamily: 'Nunito-Regular', color: t.text.secondary, marginTop: 2 }}>
              {[item.data, item.horario].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {item.local ? (
            <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>{item.local}</Text>
          ) : null}
          {item.observacoes ? (
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.primary, marginTop: 4, lineHeight: 18 }}>
              {item.observacoes}
            </Text>
          ) : null}
          {!item.data && !item.horario && !item.local && !item.observacoes && (
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.tertiary }}>—</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function OutroComunidadeList({ items, t }: { items: OutroItemComunidade[]; t: SemanticTokens }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontFamily: 'Nunito-SemiBold', color: t.text.secondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Outros compromissos
      </Text>
      {items.map((item, i) => (
        <View key={i} style={{ backgroundColor: t.bg.surface, borderRadius: 8, padding: 10, marginBottom: 6 }}>
          {item.titulo ? <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>{item.titulo}</Text> : null}
          {item.data || item.horario ? (
            <Text style={{ fontSize: 12, fontFamily: 'Nunito-Regular', color: t.text.secondary, marginTop: 2 }}>
              {[item.data, item.horario].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {item.local ? (
            <Text style={{ fontSize: 12, fontFamily: 'Nunito-Regular', color: t.text.secondary, marginTop: 2 }}>{item.local}</Text>
          ) : null}
          {item.descricao ? (
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.primary, marginTop: 4, lineHeight: 18 }}>{item.descricao}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function CuidadoList({ label, items, t }: { label: string; items: CuidadoEventoItem[]; t: SemanticTokens }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontFamily: 'Nunito-SemiBold', color: t.text.secondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
      {items.map((item, i) => (
        <View key={i} style={{ backgroundColor: t.bg.surface, borderRadius: 8, padding: 10, marginBottom: 6 }}>
          {item.data || item.horario ? (
            <Text style={{ fontSize: 12, fontFamily: 'Nunito-Regular', color: t.text.secondary, marginTop: 2 }}>
              {[item.data, item.horario].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {item.local ? (
            <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>{item.local}</Text>
          ) : null}
          {item.descricao ? (
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.primary, marginTop: 4, lineHeight: 18 }}>{item.descricao}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function OutroCuidadoList({ items, t }: { items: OutroItemCuidado[]; t: SemanticTokens }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontFamily: 'Nunito-SemiBold', color: t.text.secondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Outros cuidados
      </Text>
      {items.map((item, i) => (
        <View key={i} style={{ backgroundColor: t.bg.surface, borderRadius: 8, padding: 10, marginBottom: 6 }}>
          {item.titulo ? <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>{item.titulo}</Text> : null}
          {item.data || item.horario ? (
            <Text style={{ fontSize: 12, fontFamily: 'Nunito-Regular', color: t.text.secondary, marginTop: 2 }}>
              {[item.data, item.horario].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {item.local ? (
            <Text style={{ fontSize: 12, fontFamily: 'Nunito-Regular', color: t.text.secondary, marginTop: 2 }}>{item.local}</Text>
          ) : null}
          {item.descricao ? (
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.primary, marginTop: 4, lineHeight: 18 }}>{item.descricao}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
