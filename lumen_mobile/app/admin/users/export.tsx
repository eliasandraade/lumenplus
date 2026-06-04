/**
 * Admin — Exportar Lista de Usuários
 * ====================================
 * Permite selecionar campos e solicitar exportação em CSV.
 * Campos sensíveis (RG/CPF) requerem aprovação do Conselho Geral.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adminExportService } from '@/services';

const FIELD_GROUPS = [
  {
    label: 'Dados Básicos',
    fields: [
      { code: 'name',           label: 'Nome' },
      { code: 'email',          label: 'E-mail' },
      { code: 'phone',          label: 'Telefone' },
      { code: 'birth_date',     label: 'Data de Nascimento' },
      { code: 'city',           label: 'Cidade' },
      { code: 'state',          label: 'Estado' },
      { code: 'profile_status', label: 'Status do Perfil' },
    ],
  },
  {
    label: 'Documentos (requer aprovação)',
    fields: [
      { code: 'cpf', label: 'CPF' },
      { code: 'rg',  label: 'RG'  },
    ],
  },
];

const SENSITIVE = new Set(['cpf', 'rg']);
const colors = { admin: '#7c3aed', white: '#fff', gray: '#6b7280', lightGray: '#E8E8E8', text: '#171717', danger: '#dc2626', warning: '#d97706' };

export default function ExportScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(['name', 'email']));
  const [loading, setLoading] = useState(false);

  const toggle = (code: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });

  const hasSensitive = [...selected].some((f) => SENSITIVE.has(f));

  const doExport = async () => {
    setLoading(true);
    try {
      const result = await adminExportService.requestExport([...selected]);
      if (result.status === 'GENERATED') {
        Alert.alert('Pronto!', 'O CSV está disponível. Acesse Aprovações para baixar.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Enviado para aprovação', result.message ?? 'Aguardando aprovação do Conselho Geral.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.detail?.message ?? 'Erro ao solicitar exportação');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (selected.size === 0) {
      Alert.alert('Selecione ao menos um campo');
      return;
    }
    if (hasSensitive) {
      Alert.alert(
        'Dados sensíveis',
        'Esta exportação inclui RG e/ou CPF e requer aprovação do Conselho Geral. Deseja enviar para aprovação?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Enviar', onPress: doExport },
        ]
      );
    } else {
      doExport();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {hasSensitive && (
          <View style={styles.warningBox}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.warning} />
            <Text style={styles.warningText}>
              Campos sensíveis selecionados — exportação requer aprovação do Conselho Geral
            </Text>
          </View>
        )}
        {FIELD_GROUPS.map((group) => (
          <View key={group.label} style={styles.group}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {group.fields.map((field) => {
              const active = selected.has(field.code);
              return (
                <TouchableOpacity
                  key={field.code}
                  style={styles.fieldRow}
                  onPress={() => toggle(field.code)}
                >
                  <Ionicons
                    name={active ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={active ? colors.admin : colors.gray}
                  />
                  <Text style={[styles.fieldLabel, active && { color: colors.text, fontWeight: '600' }]}>
                    {field.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.exportBtn, loading && { opacity: 0.6 }]}
          onPress={handleExport}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color={colors.white} />
              <Text style={styles.exportBtnText}>
                Exportar {selected.size} campo{selected.size !== 1 ? 's' : ''}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  warningBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fffbeb', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#fcd34d', marginBottom: 16,
  },
  warningText: { flex: 1, fontSize: 13, color: colors.warning },
  group: { backgroundColor: colors.white, borderRadius: 12, marginBottom: 12, overflow: 'hidden' },
  groupLabel: {
    fontSize: 12, fontWeight: '700', color: colors.gray,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, textTransform: 'uppercase',
  },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  fieldLabel: { fontSize: 15, color: colors.gray },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: colors.white,
    borderTopWidth: 1, borderTopColor: colors.lightGray,
  },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.admin, borderRadius: 12, paddingVertical: 16,
  },
  exportBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
