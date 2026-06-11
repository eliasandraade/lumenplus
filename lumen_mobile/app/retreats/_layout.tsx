/**
 * Retreats Layout
 * ===============
 */

import { Stack } from 'expo-router';
import { BreadcrumbHeader } from '@/components/ui/BreadcrumbHeader';
import { useTheme } from '@/theme';

const RETIROS: { label: string; href: '/retreats' } = { label: 'Retiros', href: '/retreats' };

export default function RetreatsLayout() {
  const { t } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg.screen } }}>
      <Stack.Screen name="index" options={{
        header: () => <BreadcrumbHeader items={[{ label: 'Retiros' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="[id]" options={{
        header: () => <BreadcrumbHeader items={[RETIROS, { label: 'Detalhes' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="[id]/payment" options={{
        header: () => <BreadcrumbHeader items={[RETIROS, { label: 'Comprovante' }]} />,
        headerShown: true,
      }} />
    </Stack>
  );
}
