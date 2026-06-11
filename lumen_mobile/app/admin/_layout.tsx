/**
 * Admin Layout
 * ============
 * Usa BreadcrumbHeader em todas as telas da área administrativa.
 */

import { Stack } from 'expo-router';
import { BreadcrumbHeader } from '@/components/ui/BreadcrumbHeader';
import { useTheme } from '@/theme';

const ADMIN: { label: string; href: '/admin' } = { label: 'Administração', href: '/admin' };
const ADMIN_RETIROS: { label: string; href: '/admin/retreats' } = { label: 'Retiros', href: '/admin/retreats' };

export default function AdminLayout() {
  const { t } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg.screen } }}>
      <Stack.Screen name="index" options={{
        header: () => <BreadcrumbHeader items={[{ label: 'Administração' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="dashboard" options={{
        header: () => <BreadcrumbHeader items={[ADMIN, { label: 'Dashboard' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="entities" options={{
        header: () => <BreadcrumbHeader items={[ADMIN, { label: 'Entidades' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="users" options={{
        header: () => <BreadcrumbHeader items={[ADMIN, { label: 'Usuários' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="create-aviso" options={{
        header: () => <BreadcrumbHeader items={[ADMIN, { label: 'Criar Aviso' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="sent-avisos" options={{
        header: () => <BreadcrumbHeader items={[ADMIN, { label: 'Avisos Enviados' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="audit-logs" options={{
        header: () => <BreadcrumbHeader items={[ADMIN, { label: 'Logs de Auditoria' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="approvals/index" options={{
        header: () => <BreadcrumbHeader items={[ADMIN, { label: 'Aprovações' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="retreats/index" options={{
        header: () => <BreadcrumbHeader items={[ADMIN, { label: 'Retiros' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="retreats/create" options={{
        header: () => <BreadcrumbHeader items={[ADMIN, ADMIN_RETIROS, { label: 'Novo retiro' }]} />,
        headerShown: true,
      }} />
      <Stack.Screen name="retreats/[id]" options={{
        header: () => <BreadcrumbHeader items={[ADMIN, ADMIN_RETIROS, { label: 'Gerenciar' }]} />,
        headerShown: true,
      }} />
    </Stack>
  );
}
