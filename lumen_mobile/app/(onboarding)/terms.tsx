/**
 * Terms Screen
 * ============
 * Tela de aceitação de termos e privacidade.
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useOnboardingStore, useAuthStore } from '@/stores';
import { Button, Loading, Card } from '@/components';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';
import { showConfirm } from '@/utils/alerts';

function Checkbox({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2,
        borderColor: checked ? t.brand.primary : t.border.default,
        backgroundColor: checked ? t.brand.primary : 'transparent',
        alignItems: 'center', justifyContent: 'center' }}>
        {checked && <Text style={{ color: t.bg.screen, fontSize: 13, fontFamily: 'Nunito_700Bold' }}>✓</Text>}
      </View>
      <Text style={{ flex: 1, color: t.text.primary, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export default function TermsScreen() {
  const { t } = useTheme();
  const styles = makeStyles(t);

  const [analyticsOptIn, setAnalyticsOptIn] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const { legal, isLoadingLegal, isSaving, loadLegal, acceptTerms, error } =
    useOnboardingStore();
  const { refreshUser, logout } = useAuthStore();

  useEffect(() => {
    loadLegal();
  }, []);

  const canAccept = termsAccepted && privacyAccepted;

  const handleDecline = () => {
    showConfirm({
      title: 'Recusar termos',
      message: 'Ao recusar, você será desconectado do app. Deseja continuar?',
      confirmText: 'Sim, sair',
      destructive: true,
      onConfirm: async () => {
        await logout();
        router.replace('/(auth)/login');
      },
    });
  };

  const handleAccept = async () => {
    if (!canAccept) return;
    try {
      await acceptTerms(analyticsOptIn);
      await refreshUser();
      router.replace('/');
    } catch {
      // Error handled by store
    }
  };

  if (isLoadingLegal) {
    return <Loading fullScreen message="Carregando termos..." />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Terms Card */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Termos de Uso</Text>
          <Text style={styles.version}>Versão {legal?.terms?.version}</Text>
          <ScrollView style={styles.contentScroll} nestedScrollEnabled>
            <Text style={styles.content}>{legal?.terms?.content}</Text>
          </ScrollView>
        </Card>

        {/* Privacy Card */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Política de Privacidade</Text>
          <Text style={styles.version}>Versão {legal?.privacy?.version}</Text>
          <ScrollView style={styles.contentScroll} nestedScrollEnabled>
            <Text style={styles.content}>{legal?.privacy?.content}</Text>
          </ScrollView>
        </Card>

        {/* Confirmação explícita (LGPD art. 8 — consentimento granular) */}
        <Card style={styles.card}>
          <Text style={styles.consentTitle}>Confirmação de leitura</Text>
          <Checkbox
            checked={termsAccepted}
            onPress={() => setTermsAccepted(v => !v)}
            label="Li e aceito os Termos de Uso"
          />
          <Checkbox
            checked={privacyAccepted}
            onPress={() => setPrivacyAccepted(v => !v)}
            label="Li e aceito a Política de Privacidade e o tratamento dos meus dados pessoais conforme a LGPD"
          />
        </Card>

        {/* Analytics opt-in */}
        <Card variant="filled" style={styles.optInCard}>
          <View style={styles.optInRow}>
            <View style={styles.optInText}>
              <Text style={styles.optInTitle}>Compartilhar dados de uso</Text>
              <Text style={styles.optInDescription}>
                Ajude-nos a melhorar o app compartilhando dados anônimos de uso (opcional).
              </Text>
            </View>
            <Switch
              value={analyticsOptIn}
              onValueChange={setAnalyticsOptIn}
              trackColor={{
                false: t.border.default,
                true: t.brand.primary,
              }}
              thumbColor={t.bg.screen}
            />
          </View>
        </Card>

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {!canAccept && (
          <Text style={styles.footerHint}>
            Leia e confirme os documentos acima para continuar.
          </Text>
        )}
        <Button
          title="Aceitar e Continuar"
          onPress={handleAccept}
          loading={isSaving}
          disabled={!canAccept}
          fullWidth
          size="lg"
        />
        <Button
          title="Não aceito"
          onPress={handleDecline}
          variant="ghost"
          fullWidth
          size="md"
          style={styles.declineButton}
        />
      </View>
    </View>
  );
}

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg.elevated,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: t.text.primary,
    marginBottom: 4,
  },
  version: {
    fontSize: 13,
    color: t.text.tertiary,
    marginBottom: 16,
  },
  contentScroll: {
    maxHeight: 320,
  },
  content: {
    fontSize: 13,
    color: t.text.secondary,
    lineHeight: 20,
  },
  consentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: t.text.primary,
    marginBottom: 16,
  },
  optInCard: {
    marginBottom: 16,
  },
  optInRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optInText: {
    flex: 1,
    marginRight: 16,
  },
  optInTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: t.text.primary,
    marginBottom: 4,
  },
  optInDescription: {
    fontSize: 13,
    color: t.text.secondary,
  },
  error: {
    color: t.status.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  footer: {
    padding: 16,
    backgroundColor: t.bg.screen,
    borderTopWidth: 1,
    borderTopColor: t.border.subtle,
  },
  footerHint: {
    fontSize: 13,
    color: t.text.tertiary,
    textAlign: 'center',
    marginBottom: 12,
  },
  declineButton: {
    marginTop: 4,
  },
});
