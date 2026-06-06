/**
 * Vida (Projeto de Vida Mensal) Layout
 * ======================================
 */

import { Stack } from 'expo-router';
import { BreadcrumbHeader } from '@/components/ui/BreadcrumbHeader';

const VIDA: { label: string; href: '/vida' } = { label: 'Projeto de Vida', href: '/vida' };

export default function VidaLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{
          header: () => <BreadcrumbHeader items={[{ label: 'Projeto de Vida' }]} />,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="wizard"
        options={{
          header: () => <BreadcrumbHeader items={[VIDA, { label: 'Novo Ciclo' }]} />,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="unlock"
        options={{
          header: () => <BreadcrumbHeader items={[VIDA, { label: 'Desbloquear' }]} />,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="ciclo"
        options={{
          header: () => <BreadcrumbHeader items={[VIDA, { label: 'Ciclo Mensal' }]} />,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="revisao"
        options={{
          header: () => <BreadcrumbHeader items={[VIDA, { label: 'Revisão Mensal' }]} />,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="historico"
        options={{
          header: () => <BreadcrumbHeader items={[VIDA, { label: 'Histórico' }]} />,
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="exame"
        options={{
          header: () => <BreadcrumbHeader items={[VIDA, { label: 'Exame de Consciência' }]} />,
          headerShown: true,
        }}
      />
    </Stack>
  );
}
