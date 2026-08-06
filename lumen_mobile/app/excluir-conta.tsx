/**
 * Exclusão de conta — PÁGINA PÚBLICA (web)
 * =========================================
 * Requisito do Google Play: além do caminho dentro do app, é preciso oferecer
 * uma URL **pública** (sem login) onde qualquer pessoa possa entender e
 * solicitar a exclusão da conta e dos dados.
 *
 * URL pública: https://<dominio-do-app>/excluir-conta
 *
 * DECISÃO DE SEGURANÇA — por que esta página NÃO exclui direto:
 * Permitir exclusão só com o e-mail digitado deixaria qualquer pessoa apagar a
 * conta de outra. Por isso a página:
 *   1. instrui o caminho autenticado (dentro do app), que é o mais rápido e seguro;
 *   2. oferece o canal do Encarregado (LGPD) para quem perdeu o acesso, onde a
 *      identidade é verificada por um humano antes de qualquer exclusão.
 * Não há formulário que dispare exclusão sem autenticação — isso é proposital
 * e também evita enumeração de e-mails cadastrados.
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';

const DPO_EMAIL = 'lgpd@lumenserfeliz.org';

export default function PublicAccountDeletionScreen() {
  const { t } = useTheme();
  const s = styles(t);

  const mailto = () => {
    const subject = encodeURIComponent('Solicitação de exclusão de conta — Lumen+');
    const body = encodeURIComponent(
      'Olá,\n\nSolicito a exclusão da minha conta e dos meus dados pessoais no aplicativo Lumen+.\n\n' +
        'Nome completo:\nE-mail cadastrado:\n\n' +
        'Estou ciente de que alguns registros são mantidos por obrigação legal, ' +
        'conforme descrito na Política de Privacidade.\n'
    );
    Linking.openURL(`mailto:${DPO_EMAIL}?subject=${subject}&body=${body}`);
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title} accessibilityRole="header">
        Excluir sua conta do Lumen+
      </Text>

      <Text style={s.lead}>
        Esta página explica como solicitar a exclusão da sua conta e dos seus
        dados pessoais no aplicativo Lumen+.
      </Text>

      {/* ── Caminho 1: dentro do app ── */}
      <Text style={s.sectionTitle}>Opção 1 — pelo aplicativo (mais rápido)</Text>
      <View style={s.card}>
        <Text style={s.body}>
          Se você ainda consegue entrar na sua conta, este é o caminho recomendado:
        </Text>
        {[
          'Abra o aplicativo Lumen+ e faça login',
          'Toque em "Perfil", no menu inferior',
          'Role até o fim da página',
          'Toque em "Excluir minha conta"',
          'Leia as informações e confirme',
        ].map((step, i) => (
          <View key={step} style={s.step}>
            <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
            <Text style={s.stepText}>{step}</Text>
          </View>
        ))}
        {Platform.OS === 'web' ? null : (
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => router.push('/account/delete' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Ir para a tela de exclusão de conta"
          >
            <Text style={s.primaryBtnText}>Ir para a exclusão agora</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Caminho 2: sem acesso ── */}
      <Text style={s.sectionTitle}>Opção 2 — se você perdeu o acesso</Text>
      <View style={s.card}>
        <Text style={s.body}>
          Se você não consegue mais entrar na sua conta, escreva para o
          Encarregado pelo Tratamento de Dados Pessoais. Sua identidade será
          verificada antes da exclusão — isso protege você contra pedidos feitos
          por terceiros.
        </Text>
        <TouchableOpacity
          style={s.emailBtn}
          onPress={mailto}
          accessibilityRole="button"
          accessibilityLabel={`Enviar e-mail para ${DPO_EMAIL}`}
        >
          <Ionicons name="mail-outline" size={20} color={t.brand.primary} />
          <Text style={s.emailText}>{DPO_EMAIL}</Text>
        </TouchableOpacity>
        <Text style={s.note}>
          Informe seu nome completo e o e-mail cadastrado. Responderemos dentro
          do prazo previsto na Lei Geral de Proteção de Dados.
        </Text>
      </View>

      {/* ── O que acontece ── */}
      <Text style={s.sectionTitle}>O que acontece com os seus dados</Text>
      <View style={s.card}>
        <Text style={s.subTitle}>São excluídos ou anonimizados</Text>
        {[
          'Dados pessoais do perfil (nome, CPF, RG, data de nascimento, telefone e endereço)',
          'Foto de perfil',
          'Preferências e configurações',
          'Vínculos com ministérios e comunidades',
          'Contatos de emergência',
          'Acesso ao aplicativo',
        ].map((i) => (
          <View key={i} style={s.row}>
            <Ionicons name="close-circle" size={16} color={t.status.error} />
            <Text style={s.rowText}>{i}</Text>
          </View>
        ))}

        <Text style={s.subTitle}>São mantidos por obrigação legal</Text>
        {[
          'Registro de aceite dos Termos e da Política de Privacidade (prova de consentimento)',
          'Trilha de auditoria de segurança',
        ].map((i) => (
          <View key={i} style={s.row}>
            <Ionicons name="lock-closed-outline" size={16} color={t.text.secondary} />
            <Text style={s.rowText}>{i}</Text>
          </View>
        ))}
        <Text style={s.note}>
          Esses registros deixam de estar associados aos seus dados pessoais.
          Os prazos de retenção estão descritos na Política de Privacidade.
        </Text>
      </View>

      <Text style={s.footer}>Lumen+ · Comunidade Católica Lumen Christi</Text>
    </ScrollView>
  );
}

const styles = (t: SemanticTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.screen },
  content: { padding: 20, paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontSize: 26, fontFamily: 'Nunito-Bold', color: t.text.primary, marginTop: 16, marginBottom: 10 },
  lead: { fontSize: 16, fontFamily: 'Nunito-Regular', color: t.text.secondary, lineHeight: 23, marginBottom: 24 },
  sectionTitle: {
    fontSize: 13, fontFamily: 'Nunito-Bold', color: t.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 8,
  },
  card: {
    padding: 18, borderRadius: 12, marginBottom: 22, gap: 10,
    backgroundColor: t.bg.elevated,
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.border.subtle,
  },
  subTitle: { fontSize: 15, fontFamily: 'Nunito-Bold', color: t.text.primary, marginTop: 6 },
  body: { fontSize: 15, fontFamily: 'Nunito-Regular', color: t.text.primary, lineHeight: 22 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNum: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.brand.primaryDim,
  },
  stepNumText: { fontSize: 13, fontFamily: 'Nunito-Bold', color: t.brand.primary },
  stepText: { flex: 1, fontSize: 15, fontFamily: 'Nunito-Regular', color: t.text.primary },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowText: { flex: 1, fontSize: 14, fontFamily: 'Nunito-Regular', color: t.text.primary, lineHeight: 20 },
  note: { fontSize: 13, fontFamily: 'Nunito-Regular', color: t.text.secondary, lineHeight: 19, marginTop: 4 },
  primaryBtn: {
    marginTop: 8, paddingVertical: 14, borderRadius: 10, alignItems: 'center', minHeight: 48,
    justifyContent: 'center', backgroundColor: t.brand.primary,
  },
  primaryBtnText: { fontSize: 15, fontFamily: 'Nunito-Bold', color: '#fff' },
  emailBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 10, minHeight: 48,
    borderWidth: 1, borderColor: t.brand.primary,
  },
  emailText: { fontSize: 15, fontFamily: 'Nunito-Bold', color: t.brand.primary },
  footer: { fontSize: 12, fontFamily: 'Nunito-Regular', color: t.text.secondary, textAlign: 'center', marginTop: 12 },
});
