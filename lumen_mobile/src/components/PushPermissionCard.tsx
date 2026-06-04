// lumen_mobile/src/components/PushPermissionCard.tsx
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { requestAndRegisterPush, savePushDecision } from '@/services/push';

interface Props {
  onDismiss: () => void;
}

export function PushPermissionCard({ onDismiss }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAllow = async () => {
    setLoading(true);
    setError(null);
    const result = await requestAndRegisterPush();
    setLoading(false);
    if (result === 'error') {
      setError('Não foi possível ativar as notificações. Tente novamente.');
    } else {
      onDismiss();
    }
  };

  const handleLater = async () => {
    await savePushDecision('later');
    onDismiss();
  };

  return (
    <View
      style={{
        backgroundColor: '#EDE9FE',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#7C3AED',
      }}
    >
      <Text style={{ fontWeight: '700', fontSize: 15, color: '#1F2937', marginBottom: 4 }}>
        🔔 Receber avisos importantes?
      </Text>
      <Text style={{ color: '#374151', fontSize: 13, lineHeight: 20, marginBottom: 12 }}>
        Ative as notificações para receber avisos da Obra Lumen diretamente no seu navegador,
        mesmo quando o aplicativo estiver fechado.
      </Text>

      {error && (
        <View style={{ backgroundColor: '#FEE2E2', padding: 8, borderRadius: 6, marginBottom: 8 }}>
          <Text style={{ color: '#DC2626', fontSize: 12 }}>{error}</Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={handleLater}
          disabled={loading}
          style={{
            flex: 1, padding: 10, borderRadius: 8,
            borderWidth: 1, borderColor: '#C4B5FD', alignItems: 'center',
          }}
        >
          <Text style={{ color: '#7C3AED', fontSize: 13 }}>Agora não</Text>
        </Pressable>
        <Pressable
          onPress={handleAllow}
          disabled={loading}
          style={{
            flex: 1, padding: 10, borderRadius: 8,
            backgroundColor: loading ? '#C4B5FD' : '#7C3AED', alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
            {loading ? 'Ativando...' : 'Permitir'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
