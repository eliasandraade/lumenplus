/**
 * Amanhã com o Emanuel
 * =====================
 * Preparação espiritual do dia seguinte.
 * Os dados vivem no plano_diario do semanal ativo (merge parcial por dia).
 */

import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Switch,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import projetoVidaMensalApi, { type PlanoDiarioItem } from '@/services/projetoVidaMensal';
import { useTheme } from '@/theme';

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const;
const DIA_LABELS: Record<string, string> = {
  dom: 'Domingo', seg: 'Segunda', ter: 'Terça', qua: 'Quarta',
  qui: 'Quinta', sex: 'Sexta', sab: 'Sábado',
};
const DIA_SHORT: Record<string, string> = {
  dom: 'Dom', seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb',
};

function getDiaSeguinte(): string {
  return DIAS_SEMANA[(new Date().getDay() + 1) % 7];
}

function formatarDataAmanha(): string {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  return amanha.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
}

export default function DiarioScreen() {
  const { semanalId } = useLocalSearchParams<{ semanalId?: string }>();
  const { t, r } = useTheme();

  const [diaAtivo, setDiaAtivo] = useState<string>(getDiaSeguinte());
  const [diaData, setDiaData] = useState<PlanoDiarioItem>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar plano_diario quando semanalId muda ou diaAtivo muda
  useEffect(() => {
    if (!semanalId) return;
    setLoading(true);
    projetoVidaMensalApi.getSemanal(semanalId)
      .then(semanal => {
        const plano = semanal.plano_diario as Record<string, PlanoDiarioItem> | null;
        setDiaData(plano?.[diaAtivo] ?? {});
      })
      .catch(() => setDiaData({}))
      .finally(() => setLoading(false));
  }, [semanalId, diaAtivo]);

  const handleSave = async () => {
    if (!semanalId) return;
    setSaving(true);
    setError(null);
    try {
      await projetoVidaMensalApi.updateSemanal(semanalId, {
        plano_diario: { [diaAtivo]: diaData },
      });
      router.back();
    } catch {
      setError('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<PlanoDiarioItem>) => setDiaData(d => ({ ...d, ...patch }));

  if (!semanalId) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg.screen, padding: 24 }]}>
        <Ionicons name={'calendar-outline' as IoniconsName} size={32} color={t.text.tertiary} />
        <Text style={{ fontSize: 15, fontFamily: 'Nunito-Regular', color: t.text.secondary, textAlign: 'center', lineHeight: 22, marginTop: 12 }}>
          Para usar "Amanhã com o Emanuel", primeiro crie o Projeto Semanal desta semana.
        </Text>
        <TouchableOpacity
          style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: t.brand.primary, borderRadius: r.lg }}
          onPress={() => router.back()}
        >
          <Text style={{ color: '#ffffff', fontFamily: 'Nunito-Bold', fontSize: 14 }}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const inputStyle = {
    backgroundColor: t.bg.surface,
    borderRadius: r.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.border.subtle,
    padding: 12,
    fontSize: 15,
    fontFamily: 'Nunito-Regular' as const,
    color: t.text.primary,
    minHeight: 48,
    marginBottom: 12,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg.screen }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Cabeçalho */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: t.bg.elevated, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border.subtle }}>
        <Text style={{ fontSize: 20, fontFamily: 'Nunito-ExtraBold', color: t.text.primary, marginBottom: 2 }}>
          Amanhã com o Emanuel
        </Text>
        <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.tertiary }}>
          {DIA_LABELS[diaAtivo]}, {formatarDataAmanha()}
        </Text>
        {/* Chips de navegação entre dias */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {DIAS_SEMANA.map(dia => (
              <TouchableOpacity
                key={dia}
                style={{
                  paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16,
                  borderWidth: 1,
                  borderColor: dia === diaAtivo ? t.brand.primary : t.border.default,
                  backgroundColor: dia === diaAtivo ? t.brand.primaryDim : t.bg.surface,
                }}
                onPress={() => setDiaAtivo(dia)}
              >
                <Text style={{
                  fontSize: 12, fontFamily: dia === diaAtivo ? 'Nunito-Bold' : 'Nunito-Regular',
                  color: dia === diaAtivo ? t.brand.primary : t.text.secondary,
                }}>
                  {DIA_SHORT[dia]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {loading ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={t.brand.primary} />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>

          {/* Propósito */}
          <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Propósito do dia
          </Text>
          <TextInput
            style={[inputStyle, { minHeight: 72, textAlignVertical: 'top' }]}
            value={diaData.proposito ?? ''}
            onChangeText={v => update({ proposito: v || null })}
            multiline numberOfLines={3}
            placeholder="Uma intenção ou propósito para amanhã..."
            placeholderTextColor={t.text.tertiary}
          />

          {/* Missa */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 15, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>Missa</Text>
            <Switch
              value={!!diaData.missa}
              onValueChange={v => update({ missa: v || null })}
              trackColor={{ false: t.border.default, true: t.brand.primary }}
              thumbColor="#ffffff"
            />
          </View>
          {diaData.missa && (
            <TextInput
              style={inputStyle}
              value={diaData.horario_missa ?? ''}
              onChangeText={v => update({ horario_missa: v || null })}
              placeholder="Horário da Missa (ex.: 07:00)"
              placeholderTextColor={t.text.tertiary}
            />
          )}

          {/* Oração da manhã */}
          <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Oração da manhã
          </Text>
          <TextInput
            style={inputStyle}
            value={diaData.oracao_manha ?? ''}
            onChangeText={v => update({ oracao_manha: v || null })}
            placeholder="Como planejo iniciar o dia com Deus..."
            placeholderTextColor={t.text.tertiary}
          />

          {/* Lectio Divina */}
          <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Lectio Divina
          </Text>
          <TextInput
            style={inputStyle}
            value={diaData.lectio ?? ''}
            onChangeText={v => update({ lectio: v || null })}
            placeholder="Intenção ou trecho para a Lectio..."
            placeholderTextColor={t.text.tertiary}
          />

          {/* Terço */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 15, fontFamily: 'Nunito-SemiBold', color: t.text.primary }}>Terço</Text>
            <Switch
              value={!!diaData.terco}
              onValueChange={v => update({ terco: v || null })}
              trackColor={{ false: t.border.default, true: t.brand.primary }}
              thumbColor="#ffffff"
            />
          </View>

          {/* Leitura Espiritual */}
          <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Leitura Espiritual
          </Text>
          <TextInput
            style={inputStyle}
            value={diaData.leitura_espiritual ?? ''}
            onChangeText={v => update({ leitura_espiritual: v || null })}
            placeholder="Obra ou trecho para amanhã..."
            placeholderTextColor={t.text.tertiary}
          />

          {/* Evangelização */}
          <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            Evangelização
          </Text>
          <TextInput
            style={inputStyle}
            value={diaData.evangelizacao ?? ''}
            onChangeText={v => update({ evangelizacao: v || null })}
            placeholder="Como pretendo estar presente para evangelizar amanhã..."
            placeholderTextColor={t.text.tertiary}
          />

          {/* Erro */}
          {error && (
            <View style={{ backgroundColor: t.status.errorBg, borderRadius: r.md, padding: 12, marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: t.status.error, fontFamily: 'Nunito-Regular' }}>{error}</Text>
            </View>
          )}

          {/* Salvar */}
          <TouchableOpacity
            style={{ backgroundColor: t.brand.primary, borderRadius: r.lg, padding: 18, alignItems: 'center' }}
            onPress={handleSave} disabled={saving} activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color="#ffffff" />
              : <Text style={{ color: '#ffffff', fontSize: 16, fontFamily: 'Nunito-Bold' }}>Salvar planejamento</Text>
            }
          </TouchableOpacity>

        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
