/**
 * Profile Update Gate Screen
 * ==========================
 * Tela semestral obrigatória (13/Jun e 13/Dez).
 * Mostra dados atuais e pede confirmação para destravar o app.
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { profileService } from '@/services';
import { Button, Loading, Card } from '@/components';
import theme from '@/theme';
import type { Profile } from '@/types';

export default function ProfileUpdateScreen() {
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
        {/* Header */}
        <Card style={styles.headerCard}>
          <Text style={styles.headerTitle}>Atualização Semestral</Text>
          <Text style={styles.headerDescription}>
            Revise seus dados abaixo e confirme para continuar usando o app.
            Esta atualização é obrigatória duas vezes ao ano (13/Jun e 13/Dez).
          </Text>
        </Card>

        {/* Profile summary */}
        {profile && (
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Seus dados atuais</Text>
            <Row label="Nome" value={profile.full_name} />
            <Row label="Cidade" value={profile.city ? `${profile.city} / ${profile.state}` : null} />
            <Row label="Estado de Vida" value={profile.life_state_label} />
            <Row label="Estado Civil" value={profile.marital_status_label} />
            <Row label="Realidade Vocacional" value={profile.vocational_reality_label} />
          </Card>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Confirmar dados"
          onPress={handleConfirm}
          loading={isConfirming}
          fullWidth
          size="lg"
        />
        <Button
          title="Editar perfil"
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

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  headerCard: {
    marginBottom: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  headerDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
  summaryCard: {
    marginBottom: theme.spacing.md,
  },
  summaryTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[100],
  },
  rowLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    flex: 1,
  },
  rowValue: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.primary,
    fontWeight: theme.fontWeight.medium,
    flex: 2,
    textAlign: 'right',
  },
  error: {
    color: theme.colors.error.main,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  footer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[200],
  },
  editButton: {
    marginTop: theme.spacing.xs,
  },
});
