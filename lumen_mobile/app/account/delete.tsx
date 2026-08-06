/**
 * Excluir Conta
 * =============
 * Gate OBRIGATÓRIO das lojas: um app que permite criar conta precisa oferecer,
 * DENTRO do app, um caminho para excluir a conta (não apenas desativar).
 *  - Apple App Store Review Guideline 5.1.1(v)
 *  - Google Play — política de exclusão de dados da conta
 *
 * Requisitos atendidos aqui:
 *  - informa as consequências ANTES de confirmar;
 *  - diz o que é apagado e o que é retido por obrigação legal (LGPD);
 *  - exige confirmação explícita digitada (não é um toque acidental);
 *  - permite cancelar a qualquer momento antes de confirmar;
 *  - chama DELETE /auth/me e encerra a sessão local + Firebase.
 */

import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { api } from '@/services/api';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';
import { showAlert } from '@/utils/alerts';

// Palavra que o usuário precisa digitar para confirmar. Em pt-BR, sem acento
// para não depender de teclado com acentuação.
const CONFIRM_WORD = 'EXCLUIR';

export default function DeleteAccountScreen() {
  const { t } = useTheme();
  const s = styles(t);
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canConfirm = confirmText.trim().toUpperCase() === CONFIRM_WORD && !submitting;

  const handleDelete = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      // Backend: anonimiza o usuário, remove perfil/preferências/vínculos e
      // mantém apenas o que a lei exige (consentimentos e trilha de auditoria).
      await api.delete('/auth/me');

      // Encerra a sessão local — o token não deve sobreviver à exclusão.
      try {
        await signOut(auth);
      } catch {
        // Se o signOut do Firebase falhar, a conta no backend já foi excluída;
        // seguimos para o login mesmo assim.
      }

      showAlert(
        'Conta excluída',
        'Sua conta foi excluída. Sentiremos sua falta — você pode criar uma nova conta quando quiser.'
      );
      router.replace('/(auth)/login');
    } catch (e) {
      showAlert(
        'Não foi possível excluir',
        'Houve um erro ao excluir sua conta. Verifique sua conexão e tente novamente. ' +
          'Se o problema continuar, fale com o suporte.'
      );
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Voltar sem excluir a conta"
        >
          <Ionicons name="arrow-back" size={24} color={t.text.primary} />
        </TouchableOpacity>
        <Text style={s.title} accessibilityRole="header">Excluir minha conta</Text>
      </View>

      <View style={s.warnCard}>
        <Ionicons name="warning-outline" size={22} color={t.status.error} />
        <Text style={s.warnText}>
          Esta ação é permanente e não pode ser desfeita.
        </Text>
      </View>

      <Text style={s.sectionTitle}>O que será excluído</Text>
      <View style={s.card}>
        {[
          'Seus dados pessoais de perfil (nome, CPF, RG, data de nascimento, telefone e endereço)',
          'Sua foto de perfil',
          'Suas preferências e configurações',
          'Seus vínculos com ministérios e comunidades',
          'Seus contatos de emergência',
          'Suas inscrições e o acesso ao aplicativo',
        ].map((item) => (
          <View key={item} style={s.row}>
            <Ionicons name="close-circle" size={18} color={t.status.error} />
            <Text style={s.rowText}>{item}</Text>
          </View>
        ))}
      </View>

      <Text style={s.sectionTitle}>O que precisamos manter (e por quê)</Text>
      <View style={s.card}>
        <Text style={s.legalText}>
          Por obrigação legal, alguns registros são mantidos de forma
          desvinculada da sua identidade:
        </Text>
        {[
          'Registro de aceite dos Termos e da Política de Privacidade — prova legal de consentimento',
          'Trilha de auditoria de segurança — exigida para rastreabilidade',
        ].map((item) => (
          <View key={item} style={s.row}>
            <Ionicons name="lock-closed-outline" size={18} color={t.text.secondary} />
            <Text style={s.rowText}>{item}</Text>
          </View>
        ))}
        <Text style={s.legalText}>
          Esses registros deixam de estar associados aos seus dados pessoais. Para
          detalhes sobre prazos de retenção, consulte a Política de Privacidade.
        </Text>
      </View>

      <Text style={s.sectionTitle}>Confirmação</Text>
      <View style={s.card}>
        <Text style={s.rowText}>
          Para confirmar, digite <Text style={s.bold}>{CONFIRM_WORD}</Text> no campo abaixo.
        </Text>
        <TextInput
          style={s.input}
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder={CONFIRM_WORD}
          placeholderTextColor={t.text.secondary}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!submitting}
          accessibilityLabel={`Digite ${CONFIRM_WORD} para confirmar a exclusão da conta`}
        />
      </View>

      <TouchableOpacity
        style={[s.deleteBtn, !canConfirm && s.deleteBtnDisabled]}
        onPress={handleDelete}
        disabled={!canConfirm}
        accessibilityRole="button"
        accessibilityLabel="Excluir minha conta permanentemente"
        accessibilityState={{ disabled: !canConfirm }}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.deleteBtnText}>Excluir minha conta permanentemente</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={s.cancelBtn}
        onPress={() => router.back()}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel="Cancelar e manter minha conta"
      >
        <Text style={s.cancelBtnText}>Cancelar e manter minha conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = (t: SemanticTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.screen },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 24, paddingBottom: 16,
  },
  backBtn: { padding: 4, minWidth: 44, minHeight: 44, justifyContent: 'center' },
  title: { fontSize: 22, fontFamily: 'Nunito-Bold', color: t.text.primary, flex: 1 },
  warnCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 20, padding: 14, borderRadius: 12,
    backgroundColor: t.bg.elevated,
    borderWidth: 1, borderColor: t.status.error,
  },
  warnText: { flex: 1, fontSize: 15, fontFamily: 'Nunito-Bold', color: t.status.error },
  sectionTitle: {
    fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginHorizontal: 16, marginBottom: 8,
  },
  card: {
    marginHorizontal: 16, marginBottom: 20, padding: 16, borderRadius: 12,
    backgroundColor: t.bg.elevated,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border.subtle,
    gap: 10,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowText: { flex: 1, fontSize: 15, fontFamily: 'Nunito-Regular', color: t.text.primary, lineHeight: 21 },
  legalText: { fontSize: 14, fontFamily: 'Nunito-Regular', color: t.text.secondary, lineHeight: 20 },
  bold: { fontFamily: 'Nunito-Bold' },
  input: {
    borderWidth: 1, borderColor: t.border.subtle, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 4,
    fontSize: 16, fontFamily: 'Nunito-Bold', color: t.text.primary,
    backgroundColor: t.bg.surface,
    minHeight: 48,
  },
  deleteBtn: {
    marginHorizontal: 16, marginBottom: 12, paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', minHeight: 52,
    backgroundColor: t.status.error,
  },
  deleteBtnDisabled: { opacity: 0.45 },
  deleteBtnText: { fontSize: 16, fontFamily: 'Nunito-Bold', color: '#fff' },
  cancelBtn: {
    marginHorizontal: 16, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', minHeight: 48,
  },
  cancelBtnText: { fontSize: 15, fontFamily: 'Nunito-Bold', color: t.text.secondary },
});
