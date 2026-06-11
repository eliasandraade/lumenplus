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
  ActivityIndicator, Linking, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { adminExportService } from '@/services';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';
import { showAlert, showConfirm } from '@/utils/alerts';

const ADMIN_COLOR = '#7c3aed';

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
    showAlert('CSV gerado', 'Abra a URL no browser para baixar o arquivo.');
  }
}

export default function ExportScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const styles = makeStyles(t);

  const [selected, setSelected] = useState<Set<string>>(new Set(['name', 'email']));
  const [format, setFormat] = useState<'csv' | 'xlsx'>('xlsx');
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
      const result = await adminExportService.requestExport([...selected], {}, format);

      if (result.status === 'GENERATED' && result.blob) {
        // Download imediato
        downloadBlob(result.blob, result.filename ?? 'lumenplus_usuarios.csv');
        showAlert(
          'Download iniciado',
          'O CSV foi gerado. Se não baixou automaticamente, verifique a aba de downloads do navegador.',
          () => router.back(),
        );
      } else {
        // Pendente de aprovação
        showAlert(
          'Enviado para aprovação',
          result.message ?? 'Sua solicitação foi enviada ao Conselho Geral. Você será notificado quando aprovada.',
          () => router.back(),
        );
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail?.message ??
        e?.message ??
        'Erro ao solicitar exportação';
      showAlert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (selected.size === 0) {
      showAlert('Selecione ao menos um campo');
      return;
    }
    if (hasSensitive) {
      showConfirm({
        title: 'Dados sensíveis incluídos',
        message: 'Esta exportação contém CPF e/ou RG e será enviada para aprovação do Conselho Geral antes de ser gerada.',
        confirmText: 'Enviar para aprovação',
        onConfirm: doExport,
      });
    } else {
      doExport();
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {hasSensitive && (
          <View style={styles.warningBox}>
            <Ionicons name="lock-closed-outline" size={16} color={t.status.warning} />
            <Text style={styles.warningText}>
              CPF/RG selecionados — requer aprovação do Conselho Geral
            </Text>
          </View>
        )}

        {/* Seletor de formato */}
        <View style={styles.formatRow}>
          <Text style={styles.formatLabel}>Formato:</Text>
          <TouchableOpacity
            style={[styles.formatChip, format === 'xlsx' && styles.formatChipActive]}
            onPress={() => setFormat('xlsx')}
          >
            <Ionicons name="grid-outline" size={14} color={format === 'xlsx' ? '#ffffff' : ADMIN_COLOR} />
            <Text style={[styles.formatChipText, format === 'xlsx' && styles.formatChipTextActive]}>
              Excel (.xlsx)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.formatChip, format === 'csv' && styles.formatChipActive]}
            onPress={() => setFormat('csv')}
          >
            <Ionicons name="document-text-outline" size={14} color={format === 'csv' ? '#ffffff' : ADMIN_COLOR} />
            <Text style={[styles.formatChipText, format === 'csv' && styles.formatChipTextActive]}>
              CSV (.csv)
            </Text>
          </TouchableOpacity>
        </View>

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
                    <Ionicons name="lock-closed-outline" size={14} color={t.status.warning} />
                  )}
                  <Text style={[styles.groupLabel, group.sensitive && { color: t.status.warning }]}>
                    {group.label}
                  </Text>
                </View>
                <Ionicons
                  name={allActive ? 'checkbox' : someActive ? 'remove-circle-outline' : 'square-outline'}
                  size={20}
                  color={allActive || someActive ? ADMIN_COLOR : t.text.secondary}
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
                      color={active ? ADMIN_COLOR : t.text.secondary}
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
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color="#ffffff" />
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

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg.elevated },
  scroll: { padding: 16 },

  warningBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: t.status.warningBg, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#fcd34d', marginBottom: 12,
  },
  warningText: { flex: 1, fontSize: 13, color: t.status.warning, lineHeight: 18 },

  formatRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16,
  },
  formatLabel: { fontSize: 13, color: t.text.secondary, fontWeight: '600', marginRight: 4 },
  formatChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: ADMIN_COLOR, backgroundColor: t.bg.screen,
  },
  formatChipActive: { backgroundColor: ADMIN_COLOR },
  formatChipText: { fontSize: 13, fontWeight: '600', color: ADMIN_COLOR },
  formatChipTextActive: { color: '#ffffff' },

  counterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  counterText: { fontSize: 13, color: t.text.secondary, fontWeight: '500' },
  clearText: { fontSize: 13, color: ADMIN_COLOR, fontWeight: '600' },

  group: {
    backgroundColor: t.bg.screen, borderRadius: 12, marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: t.border.subtle,
    backgroundColor: t.bg.elevated,
  },
  groupHeaderSensitive: { backgroundColor: t.status.warningBg },
  groupLabel: {
    fontSize: 12, fontWeight: '700', color: t.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  fieldRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderTopWidth: 1, borderTopColor: t.border.subtle,
  },
  fieldLabel: { fontSize: 15, color: t.text.secondary, flex: 1 },
  fieldLabelActive: { color: t.text.primary, fontWeight: '600' },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: t.bg.screen,
    borderTopWidth: 1, borderTopColor: t.border.subtle,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: ADMIN_COLOR, borderRadius: 12, paddingVertical: 16,
  },
  exportBtnDisabled: { opacity: 0.5 },
  exportBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
});
