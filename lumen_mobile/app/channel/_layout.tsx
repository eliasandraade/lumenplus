import { Stack } from 'expo-router';

export default function ChannelLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="[unitId]" options={{ title: 'Canal' }} />
    </Stack>
  );
}
