/**
 * Coordinator Screen
 * ==================
 * Área do coordenador: lista as unidades que ele coordena
 * e permite gerenciar membros de cada uma.
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router, Stack, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import { orgService } from '@/services';
import type { Membership } from '@/types';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';

const COORD_COLOR = '#059669';
const COORD_COLOR_LIGHT = 'rgba(5, 150, 105, 0.10)';

const ORG_UNIT_TYPE_LABEL: Record<string, string> = {
  CONSELHO_GERAL: 'Conselho Geral',
  SETOR: 'Setor',
  MINISTERIO: 'Ministério',
  GRUPO: 'Grupo',
};

const ORG_UNIT_TYPE_ICON: Record<string, string> = {
  CONSELHO_GERAL: 'shield',
  SETOR: 'git-branch',
  MINISTERIO: 'people',
  GRUPO: 'person-circle',
};

interface CoordOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  onPress: () => void;
}

export default function CoordinatorScreen() {
  const [units, setUnits] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTheme();
  const styles = makeStyles(t);

  useEffect(() => {
    (async () => {
      try {
        const memberships = await orgService.getMyMemberships();
        // Mostra: coordenadores de qualquer unidade + membros de unidades com retreat_scope
        const coordUnits = memberships.filter(
          (m) => m.status === 'ACTIVE' &&
            (m.role === 'COORDINATOR' || m.retreat_scope === true)
        );
        setUnits(coordUnits);
      } catch {
        // Silencioso
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COORD_COLOR} />
      </View>
    );
  }

  if (units.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Minha Coordenação' }} />
        <View style={styles.centered}>
          <Ionicons name="ribbon-outline" size={48} color={COORD_COLOR} />
          <Text style={styles.emptyTitle}>Nenhuma coordenação</Text>
          <Text style={styles.emptyDescription}>
            Você ainda não é coordenador de nenhuma unidade.
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Minha Coordenação' }} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="ribbon" size={32} color="#ffffff" />
          </View>
          <Text style={styles.headerTitle}>Área do Coordenador</Text>
          <Text style={styles.headerSubtitle}>
            {units.length === 1
              ? 'Gerencie sua unidade e seus membros'
              : `Você coordena ${units.length} unidades`}
          </Text>
        </View>

        {/* Units */}
        {units.map((unit) => {
          const typeLabel = ORG_UNIT_TYPE_LABEL[unit.org_unit_type] ?? unit.org_unit_type;
          const typeIcon = (ORG_UNIT_TYPE_ICON[unit.org_unit_type] ?? 'people') as IoniconsName;

          const options: CoordOption[] = [];

          if (unit.role === 'COORDINATOR') {
            options.push({
              id: 'members',
              title: 'Membros',
              description: 'Veja, convide e gerencie os membros',
              icon: 'people-outline',
              onPress: () =>
                router.push({
                  pathname: '/members',
                  params: {
                    org_unit_id: unit.org_unit_id,
                    org_unit_name: unit.org_unit_name,
                  },
                }),
            });
          }

          if (unit.retreat_scope) {
            options.push({
              id: 'retreats',
              title: 'Retiros',
              description: 'Crie e gerencie retiros e inscrições',
              icon: 'compass-outline',
              onPress: () => router.push('/admin/retreats' as Href),
            });
          }

          return (
            <View key={unit.org_unit_id} style={styles.unitSection}>
              {units.length > 1 && (
                <View style={styles.unitHeader}>
                  <Ionicons name={typeIcon} size={16} color={COORD_COLOR} />
                  <Text style={styles.unitHeaderText}>
                    {unit.org_unit_name}
                  </Text>
                  <View style={styles.unitTypeBadge}>
                    <Text style={styles.unitTypeBadgeText}>{typeLabel}</Text>
                  </View>
                </View>
              )}

              {units.length === 1 && (
                <View style={styles.singleUnitInfo}>
                  <Ionicons name={typeIcon} size={20} color={COORD_COLOR} />
                  <Text style={styles.singleUnitName}>{unit.org_unit_name}</Text>
                  <Text style={styles.singleUnitType}>{typeLabel}</Text>
                </View>
              )}

              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={styles.optionCard}
                  onPress={opt.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionIconContainer}>
                    <Ionicons name={opt.icon as IoniconsName} size={24} color={COORD_COLOR} />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>{opt.title}</Text>
                    <Text style={styles.optionDescription}>{opt.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={t.text.secondary} />
                </TouchableOpacity>
              ))}
            </View>
          );
        })}

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Voltar ao Início</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg.elevated,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    backgroundColor: t.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: t.text.primary,
  },
  emptyDescription: {
    fontSize: 14,
    color: t.text.secondary,
    textAlign: 'center',
  },
  header: {
    backgroundColor: COORD_COLOR,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  unitSection: {
    marginBottom: 24,
  },
  unitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  unitHeaderText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: t.text.primary,
  },
  unitTypeBadge: {
    backgroundColor: COORD_COLOR_LIGHT,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  unitTypeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COORD_COLOR,
  },
  singleUnitInfo: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 4,
  },
  singleUnitName: {
    fontSize: 18,
    fontWeight: '600',
    color: t.text.primary,
    textAlign: 'center',
  },
  singleUnitType: {
    fontSize: 13,
    color: t.text.secondary,
  },
  optionCard: {
    backgroundColor: t.bg.screen,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COORD_COLOR_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: t.text.primary,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    color: t.text.secondary,
  },
  backButton: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COORD_COLOR,
    alignItems: 'center',
  },
  backButtonText: {
    color: COORD_COLOR,
    fontSize: 16,
    fontWeight: '600',
  },
});
