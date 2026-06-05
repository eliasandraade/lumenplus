/**
 * Profile Update Gate Screen
 * ==========================
 * Tela semestral — mostra dados atuais e pede confirmação para destravar o app.
 * Tom: "vamos revisar juntos", não "atualize ou não acessa".
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { profileService } from '@/services';
import { Button, Loading, Card } from '@/components';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';
import { radius, typography } from '@/theme/tokens';
import type { Profile } from '@/types';

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg.screen,
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },

  headerCard: { marginBottom: 16 },
  headerIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: t.brand.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.family.bold,
    color: t.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  headerDescription: {
    fontSize: typography.size.sm,
    color: t.text.secondary,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: typography.family.regular,
  },

  summaryCard: { marginBottom: 16 },
  summaryTitle: {
    fontSize: typography.size.md,
    fontFamily: typography.family.semibold,
    color: t.text.primary,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: t.border.subtle,
  },
  rowLabel: {
    fontSize: typography.size.sm,
    color: t.text.secondary,
    flex: 1,
    fontFamily: typography.family.regular,
  },
  rowValue: {
    fontSize: typography.size.sm,
    color: t.text.primary,
    fontFamily: typography.family.semibold,
    flex: 2,
    textAlign: 'right',
  },

  error: {
    color: '#ef4444',
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: typography.family.regular,
  },

  footer: {
    padding: 16,
    backgroundColor: t.bg.elevated,
    borderTopWidth: 1,
    borderTopColor: t.border.subtle,
  },
  editButton: { marginTop: 8 },
});

export default function ProfileUpdateScreen() {
  const { t } = useTheme();
  const styles = makeStyles(t);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    profileService.getProfile()
      .then(setProfile)
      .catch(() => setError('Não foi possível carregar o perfil.'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleConfirm = async () => {
    setIsConfirming(true);
    setError(null);
    try {
      await profileService.confirmProfile();
      router.replace('/(tabs)/home');
    } catch {
      setError('Erro ao confirmar perfil. Tente novamente.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleEdit = () => {
    router.push('/(onboarding)/profile');
  };

  if (isLoading) {
    return <Loading fullScreen message="Carregando perfil..." />;
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header pastoral */}
        <Card style={styles.headerCard}>
          <View style={styles.headerIconCircle}>
            <Ionicons name="heart-circle-outline" size={36} color={t.brand.primary} />
          </View>
          <Text style={styles.headerTitle}>Vamos revisar seus dados?</Text>
          <Text style={styles.headerDescription}>
            De tempos em tempos revisamos suas informações para cuidar melhor da sua caminhada na comunidade.
          </Text>
        </Card>

        {/* Resumo dos dados */}
        {profile && (
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Tudo como você deixou?</Text>
            <Row label="Nome" value={profile.full_name} styles={styles} />
            <Row label="Cidade" value={profile.city ? `${profile.city}${profile.state ? ` / ${profile.state}` : ''}` : null} styles={styles} />
            <Row label="Estado de Vida" value={profile.life_state_label} styles={styles} />
            <Row label="Estado Civil" value={profile.marital_status_label} styles={styles} />
            <Row label="Realidade Vocacional" value={profile.vocational_reality_label} styles={styles} />
          </Card>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Confirmar, está tudo certo ✓"
          onPress={handleConfirm}
          loading={isConfirming}
          fullWidth
          size="lg"
        />
        <Button
          title="Preciso atualizar algo"
          onPress={handleEdit}
          variant="ghost"
          fullWidth
          size="md"
          style={styles.editButton}
          disabled={isConfirming}
        />
      </View>
    </View>
  );
}

function Row({
  label, value, styles,
}: {
  label: string;
  value: string | null | undefined;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value ?? '—'}</Text>
    </View>
  );
}
