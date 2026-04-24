/**
 * Projeto de Vida — Revisão Mensal
 * ==================================
 * Permite ao usuário registrar uma revisão mensal do ciclo ativo.
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import lifePlanApi from '@/services/lifePlan';
import { REVIEW_DECISION_OPTIONS, type ReviewDecisionKey } from '@/data/vida';

const colors = {
  primary: '#1A859B',
  primaryLight: '#E8F4F7',
  white: '#ffffff',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  dark: '#171717',
  border: '#e5e7eb',
  error: '#ef4444',
};

export default function RevisaoScreen() {
  const { cycleId } = useLocalSearchParams<{ cycleId: string }>();

  const today = new Date().toISOString().split('T')[0];

  const [progressReflection, setProgressReflection] = useState('');
  const [difficulties, setDifficulties] = useState('');
  const [constancyReflection, setConstancyReflection] = useState('');
  const [decision, setDecision] = useState<ReviewDecisionKey | ''>('');
  const [notes, setNotes] = useState('');
  const [updatedGoalTitle, setUpdatedGoalTitle] = useState('');
  const [updatedGoalDescription, setUpdatedGoalDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const requiresGoalUpdate = decision === 'ADJUST_GOAL' || decision === 'CHANGE_PRIMARY_GOAL';

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!cycleId) {
      setErrorMessage('Ciclo não identificado. Volte e tente novamente.');
      return;
    }
    if (!decision) {
      setErrorMessage('Selecione uma decisão antes de continuar.');
      return;
    }

    setSaving(true);
    try {
      await lifePlanApi.createReview(cycleId, {
        review_date: today,
        progress_reflection: progressReflection || null,
        difficulties: difficulties || null,
        constancy_reflection: constancyReflection || null,
        decision,
        notes: notes || null,
        updated_goal_title: updatedGoalTitle || null,
        updated_goal_description: updatedGoalDescription || null,
      });

      if (decision === 'NEW_CYCLE') {
        setSuccessMessage('Ciclo encerrado. Você pode iniciar um novo Projeto de Vida quando quiser.');
      } else {
        setSuccessMessage('Revisão mensal registrada com sucesso!');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail?.message || 'Erro ao salvar revisão. Tente novamente.';
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header info */}
      <View style={styles.infoBox}>
        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
        <Text style={styles.infoText}>
          Revisão de {new Date(today).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </Text>
      </View>

      {/* Progress Reflection */}
      <Text style={styles.sectionTitle}>Reflexão sobre o progresso</Text>
      <Text style={styles.fieldHint}>Como foi seu progresso em relação ao objetivo principal neste mês?</Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={4}
        placeholder="Escreva sua reflexão..."
        placeholderTextColor={colors.gray}
        value={progressReflection}
        onChangeText={setProgressReflection}
      />

      {/* Difficulties */}
      <Text style={styles.sectionTitle}>Dificuldades encontradas</Text>
      <Text style={styles.fieldHint}>Quais foram os principais obstáculos ou tentações neste mês?</Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={4}
        placeholder="Escreva sobre as dificuldades..."
        placeholderTextColor={colors.gray}
        value={difficulties}
        onChangeText={setDifficulties}
      />

      {/* Constancy Reflection */}
      <Text style={styles.sectionTitle}>Constância e fidelidade</Text>
      <Text style={styles.fieldHint}>Você foi fiel aos meios definidos no seu plano? Como está sua constância?</Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={4}
        placeholder="Reflita sobre sua constância..."
        placeholderTextColor={colors.gray}
        value={constancyReflection}
        onChangeText={setConstancyReflection}
      />

      {/* Decision */}
      <Text style={styles.sectionTitle}>Decisão *</Text>
      <Text style={styles.fieldHint}>Com base nesta revisão, qual é sua decisão?</Text>

      {REVIEW_DECISION_OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.key}
          style={[styles.decisionCard, decision === opt.key && { borderColor: opt.color, backgroundColor: `${opt.color}10` }]}
          onPress={() => setDecision(opt.key)}
        >
          <View style={styles.decisionLeft}>
            <View style={[styles.decisionRadio, decision === opt.key && { borderColor: opt.color }]}>
              {decision === opt.key && <View style={[styles.decisionRadioFill, { backgroundColor: opt.color }]} />}
            </View>
            <View style={styles.decisionText}>
              <Text style={[styles.decisionTitle, decision === opt.key && { color: opt.color }]}>
                {opt.label}
              </Text>
              <Text style={styles.decisionDesc}>{opt.description}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}

      {/* Goal update fields (for ADJUST_GOAL / CHANGE_PRIMARY_GOAL) */}
      {requiresGoalUpdate && (
        <View style={styles.goalUpdateBox}>
          <View style={styles.goalUpdateHeader}>
            <Ionicons name="flag-outline" size={18} color={colors.primary} />
            <Text style={styles.goalUpdateTitle}>
              {decision === 'CHANGE_PRIMARY_GOAL' ? 'Novo objetivo principal' : 'Objetivo ajustado'}
            </Text>
          </View>
          <Text style={styles.fieldLabel}>Título do objetivo</Text>
          <TextInput
            style={styles.input}
            placeholder="Novo título..."
            placeholderTextColor={colors.gray}
            value={updatedGoalTitle}
            maxLength={80}
            onChangeText={setUpdatedGoalTitle}
          />
          <Text style={styles.fieldLabel}>Descrição (opcional)</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={3}
            placeholder="Nova descrição..."
            placeholderTextColor={colors.gray}
            value={updatedGoalDescription}
            onChangeText={setUpdatedGoalDescription}
          />
        </View>
      )}

      {/* Warning for NEW_CYCLE */}
      {decision === 'NEW_CYCLE' && (
        <View style={styles.warningBox}>
          <Ionicons name="alert-circle-outline" size={20} color="#b45309" />
          <Text style={styles.warningText}>
            Esta ação irá encerrar o ciclo atual e arquivá-lo. Você precisará criar um novo Projeto de Vida.
          </Text>
        </View>
      )}

      {/* Notes */}
      <Text style={styles.sectionTitle}>Observações adicionais</Text>
      <TextInput
        style={styles.textArea}
        multiline
        numberOfLines={3}
        placeholder="Anotações livres, graças recebidas, intenções..."
        placeholderTextColor={colors.gray}
        value={notes}
        onChangeText={setNotes}
      />

      {/* Inline error */}
      {errorMessage && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={styles.errorBoxText}>{errorMessage}</Text>
          <TouchableOpacity onPress={() => setErrorMessage(null)}>
            <Ionicons name="close" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      )}

      {/* Inline success */}
      {successMessage && (
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={16} color="#059669" />
          <Text style={styles.successBoxText}>{successMessage}</Text>
          <TouchableOpacity
            style={styles.successBackButton}
            onPress={() =>
              decision === 'NEW_CYCLE'
                ? router.replace('/vida' as Href)
                : router.back()
            }
          >
            <Text style={styles.successBackText}>OK</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Submit */}
      {!successMessage && (
      <TouchableOpacity
        style={[styles.submitButton, (!decision || saving) && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={!decision || saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.white} />
            <Text style={styles.submitText}>Registrar Revisão</Text>
          </>
        )}
      </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.lightGray },
  content: { padding: 16, paddingBottom: 40 },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  infoText: { fontSize: 14, color: colors.primary, fontWeight: '500' },

  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.dark, marginBottom: 4, marginTop: 16 },
  fieldHint: { fontSize: 13, color: colors.gray, marginBottom: 8, lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.dark, marginBottom: 6, marginTop: 10 },

  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.dark,
  },
  textArea: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.dark,
    textAlignVertical: 'top',
    minHeight: 100,
  },

  decisionCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  decisionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  decisionRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decisionRadioFill: { width: 12, height: 12, borderRadius: 6 },
  decisionText: { flex: 1 },
  decisionTitle: { fontSize: 15, fontWeight: '600', color: colors.dark, marginBottom: 2 },
  decisionDesc: { fontSize: 13, color: colors.gray },

  goalUpdateBox: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalUpdateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  goalUpdateTitle: { fontSize: 14, fontWeight: '600', color: colors.primary },

  warningBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
    alignItems: 'flex-start',
  },
  warningText: { flex: 1, fontSize: 13, color: '#92400e', lineHeight: 19 },

  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    marginTop: 24,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontSize: 16, fontWeight: '600' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 16,
    marginBottom: 8,
  },
  errorBoxText: { flex: 1, fontSize: 13, color: colors.error, lineHeight: 18 },

  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 16,
  },
  successBoxText: { flex: 1, fontSize: 13, color: '#166534', lineHeight: 18 },
  successBackButton: {
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  successBackText: { color: colors.white, fontSize: 13, fontWeight: '600' },
});
