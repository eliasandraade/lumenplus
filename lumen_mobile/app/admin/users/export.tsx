/**
 * Admin — Exportar Lista de Usuários
 * ====================================
 * Seleciona campos, solicita exportação CSV.
 * - Sem dados sensíveis: download imediato no browser.
 * - Com CPF/RG: enviado para aprovação do Conselho Geral.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adminExportService } from '@/services';

const FIELD_GROUPS = [
  {
    label: 'Identificação',
    fields: [
      { code: 'name',           label: 'Nome completo' },
      { code: 'email',          label: 'E-mail' },
      { code: 'phone',          label: 'Telefone' },
      { code: 'birth_date',     label: 'Data de Nascimento' },
      { code: 'profile_status', label: 'Status do Perfil' },
      { code: 'global_roles',   label: 'Cargos' },
    ],
  },
  {
    label: 'Localização',
    fields: [
      { code: 'city',      label: 'Cidade' },
      { code: 'state',     label: 'Estado (UF)' },
      { code: 'instagram', label: 'Instagram' },
    ],
  },
  {
    label: 'Vocacional',
    fields: [
      { code: 'estado_de_vida',            label: 'Estado de Vida' },
      { code: 'realidade_vocacional',      label: 'Realidade Vocacional' },
      { code: 'estado_civil',              label: 'Estado Civil' },
      { code: 'acompanhamento_vocacional', label: 'Acompanhamento Vocacional' },
      { code: 'interesse_ministerio',      label: 'Interesse em Ministério' },
      { code: 'consagracao_ano',           label: 'Ano de Consagração' },
    ],
  },
  {
    label: 'Documentos — requer aprovação do Conselho',
    fields: [
      { code: 'cpf', label: 'CPF' },
      { code: 'rg',  label: 'RG'  },
    ],
    sensitive: true,
  },
];

const SENSITIVE = new Set(['cpf', 'rg']);

const colors = {
  admin: '#7c3aed',
  white: '#fff',
  gray: '#6b7280',
  lightGray: '#E8E8E8',
  text: '#171717',
  danger: '#dc2626',
  warning: '#d97706',
  success: '#16a34a',
};

/** Dispara download de um Blob CSV no browser (web) ou alerta no native */
function downloadBlob(blob: Blob, filename: string) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    Alert.alert('CSV gerado', 'Abra a URL no browser para baixar o arquivo.');
  }
}

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

  const toggleGroup = (codes: string[]) => {
    const allActive = codes.every((c) => selected.has(c));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allActive) codes.forEach((c) => next.delete(c));
      else codes.forEach((c) => next.add(c));
      return next;
    });
  };

  const hasSensitive = [...selected].some((f) => SENSITIVE.has(f));

  const doExport = async () => {
    setLoading(true);
    try {
      const result = await adminExportService.requestExport([...selected]);

      if (result.status === 'GENERATED' && result.blob) {
        // Download imediato
        downloadBlob(result.blob, result.filename ?? 'lumenplus_usuarios.csv');
        Alert.alert(
          'Download iniciado',
          'O CSV foi gerado. Se não baixou automaticamente, verifique a aba de downloads do navegador.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } else {
        // Pendente de aprovação
        Alert.alert(
          'Enviado para aprovação',
          result.message ?? 'Sua solicitação foi enviada ao Conselho Geral. Você será notificado quando aprovada.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail?.message ??
        e?.message ??
        'Erro ao solicitar exportação';
      Alert.alert('Erro', msg);
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
        'Dados sensíveis incluídos',
        'Esta exportação contém CPF e/ou RG e será enviada para aprovação do Conselho Geral antes de ser gerada.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Enviar para aprovação', onPress: doExport },
        ],
      );
    } else {
      doExport();
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {hasSensitive && (
          <View style={styles.warningBox}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.warning} />
            <Text style={styles.warningText}>
              CPF/RG selecionados — requer aprovação do Conselho Geral
            </Text>
          </View>
        )}

        <View style={styles.counterRow}>
          <Text style={styles.counterText}>
            {selected.size} campo{selected.size !== 1 ? 's' : ''} selecionado{selected.size !== 1 ? 's' : ''}
          </Text>
          {selected.size > 0 && (
            <TouchableOpacity onPress={() => setSelected(new Set())}>
              <Text style={styles.clearText}>Limpar seleção</Text>
            </TouchableOpacity>
          )}
        </View>

        {FIELD_GROUPS.map((group) => {
          const codes = group.fields.map((f) => f.code);
          const allActive = codes.every((c) => selected.has(c));
          const someActive = codes.some((c) => selected.has(c));

          return (
            <View key={group.label} style={styles.group}>
              <TouchableOpacity
                style={[styles.groupHeader, group.sensitive && styles.groupHeaderSensitive]}
                onPress={() => toggleGroup(codes)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  {group.sensitive && (
                    <Ionicons name="lock-closed-outline" size={14} color={colors.warning} />
                  )}
                  <Text style={[styles.groupLabel, group.sensitive && { color: colors.warning }]}>
                    {group.label}
                  </Text>
                </View>
                <Ionicons
                  name={allActive ? 'checkbox' : someActive ? 'remove-circle-outline' : 'square-outline'}
                  size={20}
                  color={allActive || someActive ? colors.admin : colors.gray}
                />
              </TouchableOpacity>

              {group.fields.map((field) => {
                const active = selected.has(field.code);
                return (
                  <TouchableOpacity
                    key={field.code}
                    style={styles.fieldRow}
                    onPress={() => toggle(field.code)}
                    activeOpacity={0.6}
                  >
                    <Ionicons
                      name={active ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={active ? colors.admin : colors.gray}
                    />
                    <Text style={[styles.fieldLabel, active && styles.fieldLabelActive]}>
                      {field.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        <View style={{ height: 90 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.exportBtn, (loading || selected.size === 0) && styles.exportBtnDisabled]}
          onPress={handleExport}
          disabled={loading || selected.size === 0}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color={colors.white} />
              <Text style={styles.exportBtnText}>
                {hasSensitive
                  ? 'Solicitar aprovação'
                  : `Exportar ${selected.size} campo${selected.size !== 1 ? 's' : ''}`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 16 },

  warningBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#fffbeb', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#fcd34d', marginBottom: 12,
  },
  warningText: { flex: 1, fontSize: 13, color: colors.warning, lineHeight: 18 },

  counterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  counterText: { fontSize: 13, color: colors.gray, fontWeight: '500' },
  clearText: { fontSize: 13, color: colors.admin, fontWeight: '600' },

  group: {
    backgroundColor: colors.white, borderRadius: 12, marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
    backgroundColor: '#fafafa',
  },
  groupHeaderSensitive: { backgroundColor: '#fffbeb' },
  groupLabel: {
    fontSize: 12, fontWeight: '700', color: colors.gray,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  fieldRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  fieldLabel: { fontSize: 15, color: colors.gray, flex: 1 },
  fieldLabelActive: { color: colors.text, fontWeight: '600' },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: colors.white,
    borderTopWidth: 1, borderTopColor: colors.lightGray,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.admin, borderRadius: 12, paddingVertical: 16,
  },
  exportBtnDisabled: { opacity: 0.5 },
  exportBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
