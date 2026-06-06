/**
 * Projeto de Vida — Exame de Consciência
 * ========================================
 * Reflexão de transição entre ciclos.
 * SUGERIDO, nunca obrigatório. Sempre oferece opção de pular.
 */

import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import projetoVidaMensalApi, { type ExameUpsert } from '@/services/projetoVidaMensal';
import { useTheme } from '@/theme';

const CONTRICAO_TEXT =
  'Emanuel, eu, Teu amigo e Teu servo, reconheço minhas falhas e me arrependo de todo o mal que cometi e do bem que deixei de fazer. Confio no Teu amor misericordioso e me proponho, com a Tua graça, a recomeçar com mais fidelidade no próximo ciclo. Amém.';

const QUESTOES: Array<{
  key: keyof ExameUpsert;
  pergunta: string;
  placeholder: string;
}> = [
  {
    key: 'gracas_recebidas',
    pergunta: 'Quais graças recebi neste mês?',
    placeholder: 'Momentos de graça, dons recebidos, bênçãos percebidas...',
  },
  {
    key: 'infidelidades',
    pergunta: 'Onde percebo minhas infidelidades diante de Deus?',
    placeholder: 'Com mansidão e honestidade, reconheça onde falhou...',
  },
  {
    key: 'dificuldades_espirituais',
    pergunta: 'Quais dificuldades espirituais enfrentei?',
    placeholder: 'Tibieza, distrações, securas na oração...',
  },
  {
    key: 'jesus_abandonado',
    pergunta: 'Onde encontrei Jesus Abandonado neste período?',
    placeholder: 'Nas dores, nos fracassos, nas situações difíceis...',
  },
  {
    key: 'onde_deixei_de_responder',
    pergunta: 'Onde deixei de responder ao chamado de Deus?',
    placeholder: 'Omissões, oportunidades de amor não aproveitadas...',
  },
  {
    key: 'proposito_conversao',
    pergunta: 'Meu propósito de conversão para o próximo ciclo:',
    placeholder: 'Um propósito concreto, nascido desta reflexão...',
  },
];

export default function ExameScreen() {
  const { projetoId } = useLocalSearchParams<{ projetoId: string }>();
  const navigation = useNavigation();
  const { t, r } = useTheme();

  const [state, setState] = useState<ExameUpsert>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePular = () => {
    router.replace('/vida/wizard');
  };

  // Botão "Pular" no header — sempre disponível
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={handlePular}
          style={{ paddingHorizontal: 16, paddingVertical: 8 }}
          accessibilityLabel="Pular exame"
          accessibilityRole="button"
        >
          <Text style={{ fontSize: 14, fontFamily: 'Nunito-SemiBold', color: t.brand.primary }}>
            Pular
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  // Carregar exame existente (para edição)
  useEffect(() => {
    if (!projetoId) { setLoading(false); return; }
    projetoVidaMensalApi.getExame(projetoId)
      .then(exame => {
        if (exame) {
          setState({
            gracas_recebidas: exame.gracas_recebidas,
            infidelidades: exame.infidelidades,
            dificuldades_espirituais: exame.dificuldades_espirituais,
            jesus_abandonado: exame.jesus_abandonado,
            onde_deixei_de_responder: exame.onde_deixei_de_responder,
            proposito_conversao: exame.proposito_conversao,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projetoId]);

  const handleSalvarEContinuar = async () => {
    setSaving(true);
    setError(null);
    try {
      await projetoVidaMensalApi.upsertExame(projetoId, state);
      router.replace('/vida/wizard');
    } catch {
      setError('Erro ao salvar o exame. Tente novamente ou pule por enquanto.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg.screen }]}>
        <ActivityIndicator size="large" color={t.brand.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg.screen }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>

        {/* Abertura contemplativa */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 14, fontFamily: 'Nunito-Italic', color: t.text.secondary, textAlign: 'center', lineHeight: 22 }}>
            Antes de iniciar um novo ciclo, pare por um momento diante de Deus. Responda com sinceridade o que o Senhor iluminar no seu coração. Não é preciso responder a todas as questões.
          </Text>
        </View>

        {/* 6 campos de reflexão */}
        {QUESTOES.map(({ key, pergunta, placeholder }) => (
          <View key={key} style={{
            backgroundColor: t.bg.elevated,
            borderRadius: r.lg,
            padding: 16,
            marginBottom: 14,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.border.subtle,
          }}>
            <Text style={{ fontSize: 15, fontFamily: 'Nunito-SemiBold', color: t.text.primary, lineHeight: 22, marginBottom: 10 }}>
              {pergunta}
            </Text>
            <TextInput
              style={{
                minHeight: 100,
                textAlignVertical: 'top',
                backgroundColor: t.bg.surface,
                borderRadius: r.md,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: t.border.subtle,
                padding: 12,
                fontSize: 15,
                fontFamily: 'Nunito-Regular',
                color: t.text.primary,
              }}
              value={state[key] ?? ''}
              onChangeText={v => setState(s => ({ ...s, [key]: v || null }))}
              multiline
              numberOfLines={4}
              placeholder={placeholder}
              placeholderTextColor={t.text.tertiary}
            />
          </View>
        ))}

        {/* Ato de Contrição */}
        <View style={{
          borderLeftWidth: 3,
          borderLeftColor: t.accent.spiritual,
          backgroundColor: t.bg.spiritual,
          borderRadius: r.md,
          padding: 20,
          marginVertical: 8,
          marginBottom: 24,
        }}>
          <Ionicons
            name={'heart' as IoniconsName}
            size={20}
            color={t.accent.spiritual}
            style={{ marginBottom: 14, alignSelf: 'center' }}
          />
          <Text style={{
            fontSize: 15,
            fontFamily: 'Nunito-Italic',
            color: t.text.spiritual,
            lineHeight: 26,
            textAlign: 'center',
          }}>
            {CONTRICAO_TEXT}
          </Text>
        </View>

        {/* Erro */}
        {error && (
          <View style={{ backgroundColor: t.status.errorBg, borderRadius: r.md, padding: 12, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Nunito-Regular', color: t.status.error }}>{error}</Text>
          </View>
        )}

        {/* Botões de ação */}
        <TouchableOpacity
          style={{ backgroundColor: t.brand.primary, borderRadius: r.lg, padding: 18, alignItems: 'center', marginBottom: 12 }}
          onPress={handleSalvarEContinuar}
          disabled={saving}
          activeOpacity={0.8}
          accessibilityLabel="Salvar exame e continuar para o novo ciclo"
          accessibilityRole="button"
        >
          {saving
            ? <ActivityIndicator color="#ffffff" />
            : <Text style={{ color: '#ffffff', fontSize: 16, fontFamily: 'Nunito-Bold' }}>
                Salvar e iniciar novo ciclo
              </Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={{ borderWidth: 1, borderColor: t.border.default, borderRadius: r.lg, padding: 14, alignItems: 'center' }}
          onPress={handlePular}
          activeOpacity={0.8}
          accessibilityLabel="Pular exame por enquanto"
          accessibilityRole="button"
        >
          <Text style={{ color: t.text.secondary, fontSize: 15, fontFamily: 'Nunito-SemiBold' }}>
            Pular por enquanto
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
