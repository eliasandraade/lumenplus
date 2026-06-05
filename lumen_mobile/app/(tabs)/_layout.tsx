/**
 * Tabs Layout
 * ===========
 * Lógica de onboarding intacta.
 * Tab bar substituída pelo CustomTabBar com pill animado.
 */

import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { View, Image, StyleSheet } from 'react-native';
import { authService, profileService } from '@/services';
import { CustomTabBar } from '@/components/ui/CustomTabBar';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const { t } = useTheme();

  useEffect(() => {
    (async () => {
      try {
        const me = await authService.getMe();
        if (me.consents.pending_terms || me.consents.pending_privacy) {
          router.replace('/(onboarding)/terms');
          return;
        }
        const profile = await profileService.getProfile();
        if (!profile.has_documents) {
          router.replace('/(onboarding)/complete-documents');
          return;
        }
        if (me.profile_update_due) {
          router.replace('/(onboarding)/profile-update');
          return;
        }
      } catch {
        // Ignora erros de rede
      }
    })();
  }, []);

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        header: () => (
          <View style={[styles.header, { backgroundColor: t.bg.elevated, borderBottomColor: t.border.subtle }]}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        ),
      }}
    >
      <Tabs.Screen name="service"   options={{ title: 'Servir'     }} />
      <Tabs.Screen name="community" options={{ title: 'Comunidade' }} />
      <Tabs.Screen name="home"      options={{ title: 'Início'     }} />
      <Tabs.Screen name="invites"   options={{ title: 'Inbox'      }} />
      <Tabs.Screen name="profile"   options={{ title: 'Perfil'     }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logo: {
    height: 30,
    width: 120,
  },
});
