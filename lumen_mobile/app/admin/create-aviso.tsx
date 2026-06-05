/**
 * Create Aviso Screen
 * ===================
 * Tela para criar e enviar avisos.
 * Suporta:
 *  - Envio global (CAN_SEND_INBOX) → "Todos os membros"
 *  - Envio por escopo (coordenador) → seleciona setor/grupo
 *  - Filtros de perfil adicionais (vocacional, civil, UF, cidade)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IoniconsName } from '@/types/icons';
import { inboxService } from '@/services';
import type { InboxPreviewResponse, InboxSendResponse, OrgScopeResponse, SendScopesResponse } from '@/types';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';

const ADMIN_COLOR = '#7c3aed';

interface FilterOptions {
  vocational_realities: { code: string; label: string }[];
  life_states: { code: string; label: string }[];
  marital_statuses: { code: string; label: string }[];
  states: string[];
  cities: string[];
}

type MessageType = 'info' | 'warning' | 'success' | 'urgent';

const CATEGORIES = [
  { value: 'GENERAL', label: 'Geral' },
  { value: 'EVENT', label: 'Evento' },
  { value: 'RETREAT', label: 'Retiro' },
  { value: 'FORMATION', label: 'Formação' },
  { value: 'ALERT', label: 'Alerta' },
] as const;

const PRIORITIES = [
  { value: 'LOW', label: 'Baixa', description: 'Somente Inbox', color: '#6B7280' },
  { value: 'NORMAL', label: 'Normal', description: 'Push + e-mail fallback', color: '#2563EB' },
  { value: 'HIGH', label: 'Alta', description: 'Push + e-mail sempre', color: '#D97706' },
  { value: 'CRITICAL', label: 'Urgente', description: 'Entrega imediata a todos', color: '#DC2626' },
] as const;

type DestMode = 'all' | 'scope' | 'filter';

export default function CreateAvisoScreen() {
  const { t } = useTheme();
  const styles = makeStyles(t);

  const messageTypes: { type: MessageType; label: string; color: string; icon: string }[] = [
    { type: 'info', label: 'Informativo', color: t.status.info, icon: 'information-circle' },
    { type: 'warning', label: 'Atencao', color: t.status.warning, icon: 'warning' },
    { type: 'success', label: 'Confirmacao', color: t.status.success, icon: 'checkmark-circle' },
    { type: 'urgent', label: 'Urgente', color: t.status.error, icon: 'alert-circle' },
  ];

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('info');
  const [category, setCategory] = useState<string>('GENERAL');
  const [priority, setPriority] = useState<string>('NORMAL');
  const [deepLink, setDeepLink] = useState<string>('');
  const [actionLabel, setActionLabel] = useState<string>('');
  const [criticalReason, setCriticalReason] = useState<string>('');

  // Escopos disponíveis
  const [scopesData, setScopesData] = useState<SendScopesResponse | null>(null);
  const [loadingScopes, setLoadingScopes] = useState(true);

  // Modo de destinatários
  const [destMode, setDestMode] = useState<DestMode>('all');
  const [selectedScope, setSelectedScope] = useState<OrgScopeResponse | null>(null);

  // Filtros de perfil (modo 'filter')
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [selectedVocational, setSelectedVocational] = useState<string[]>([]);
  const [selectedLifeState, setSelectedLifeState] = useState<string[]>([]);
  const [selectedMarital, setSelectedMarital] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [showScopeModal, setShowScopeModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [sendError, setSendError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [scopeLoadError, setScopeLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadScopes();
  }, []);

  useEffect(() => {
    if (destMode === 'filter' && !filterOptions) loadFilterOptions();
    updatePreview();
  }, [destMode, selectedScope, selectedVocational, selectedLifeState, selectedMarital, selectedStates, selectedCities]);

  const loadScopes = async () => {
    setLoadingScopes(true);
    try {
      const data = await inboxService.getSendableScopes();
      setScopesData(data);
      // Default: se não pode enviar para todos, mas tem escopos → modo scope
      if (!data.can_send_to_all && data.scopes.length > 0) {
        setDestMode('scope');
        if (data.scopes.length === 1) setSelectedScope(data.scopes[0]);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail?.message ||
        err?.message ||
        'Sem permissão para enviar avisos.';
      setScopeLoadError(msg);
    } finally {
      setLoadingScopes(false);
    }
  };

  const loadFilterOptions = async () => {
    setLoadingFilters(true);
    try {
      const response = await inboxService.getFilterOptions<FilterOptions>();
      setFilterOptions(response);
    } catch {
      // silencioso — filtros são opcionais
    } finally {
      setLoadingFilters(false);
    }
  };

  const updatePreview = async () => {
    try {
      const filters = buildFilters();
      const payload: any = {
        send_to_all: destMode === 'all',
        scope_org_unit_id: destMode === 'scope' ? selectedScope?.id ?? null : null,
        filters: destMode === 'filter' ? filters : null,
      };
      const response = await inboxService.previewSend(payload);
      setPreviewCount(response.recipient_count);
    } catch {
      setPreviewCount(null);
    }
  };

  const buildFilters = () => {
    const filters: any = {};
    if (selectedVocational.length > 0) filters.vocational_reality_codes = selectedVocational;
    if (selectedLifeState.length > 0) filters.life_state_codes = selectedLifeState;
    if (selectedMarital.length > 0) filters.marital_status_codes = selectedMarital;
    if (selectedStates.length > 0) filters.states = selectedStates;
    if (selectedCities.length > 0) filters.cities = selectedCities;
    return Object.keys(filters).length > 0 ? filters : null;
  };

  const handleSend = async () => {
    setValidationError(null);
    setSendError(null);
    if (!title.trim()) { setValidationError('Digite um titulo para o aviso'); return; }
    if (title.trim().length < 3) { setValidationError('O titulo deve ter pelo menos 3 caracteres'); return; }
    if (!message.trim()) { setValidationError('Digite o texto do aviso'); return; }
    if (message.trim().length < 10) { setValidationError('O texto do aviso deve ter pelo menos 10 caracteres'); return; }
    if (destMode === 'scope' && !selectedScope) { setValidationError('Selecione um setor ou grupo'); return; }
    if (destMode === 'filter' && !buildFilters()) { setValidationError('Selecione pelo menos um filtro'); return; }
    if (priority === 'CRITICAL' && criticalReason.trim().length < 10) {
      setValidationError('Avisos urgentes exigem uma justificativa com pelo menos 10 caracteres.');
      return;
    }
    setShowConfirmModal(true);
  };

  const sendAviso = async () => {
    setShowConfirmModal(false);
    setLoading(true);
    setSendError(null);
    try {
      const filters = destMode === 'filter' ? buildFilters() : null;
      const response = await inboxService.send({
        title: title.trim(),
        message: message.trim(),
        type: messageType,
        send_to_all: destMode === 'all',
        scope_org_unit_id: destMode === 'scope' ? (selectedScope?.id ?? null) : null,
        filters,
        // Novos campos
        category,
        priority,
        deep_link: deepLink.trim() || null,
        action_label: actionLabel.trim() || null,
        critical_reason: priority === 'CRITICAL' ? criticalReason.trim() : null,
      } as any);
      setSentCount(response.recipient_count);
      setShowSuccessModal(true);
    } catch (error: any) {
      const raw = error.response?.data?.detail;
      let msg = 'Nao foi possivel enviar o aviso';
      if (typeof raw === 'string') {
        msg = raw;
      } else if (raw?.message) {
        msg = raw.message;
      } else if (Array.isArray(raw) && raw.length > 0) {
        // Erro de validação Pydantic: [{ loc, msg, type }]
        msg = raw[0].msg || msg;
      }
      setSendError(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (item: string, selected: string[], setSelected: (items: string[]) => void) => {
    setSelected(selected.includes(item) ? selected.filter(i => i !== item) : [...selected, item]);
  };

  const openFilter = (filter: string) => {
    setActiveFilter(filter);
    setShowFilterModal(true);
  };

  const getFilterData = () => {
    switch (activeFilter) {
      case 'vocational':
        return { options: filterOptions?.vocational_realities || [], selected: selectedVocational, setSelected: setSelectedVocational, title: 'Realidade Vocacional' };
      case 'lifeState':
        return { options: filterOptions?.life_states || [], selected: selectedLifeState, setSelected: setSelectedLifeState, title: 'Estado de Vida' };
      case 'marital':
        return { options: filterOptions?.marital_statuses || [], selected: selectedMarital, setSelected: setSelectedMarital, title: 'Estado Civil' };
      case 'states':
        return { options: filterOptions?.states.map(s => ({ code: s, label: s })) || [], selected: selectedStates, setSelected: setSelectedStates, title: 'Estado (UF)' };
      case 'cities':
        return { options: filterOptions?.cities.map(c => ({ code: c, label: c })) || [], selected: selectedCities, setSelected: setSelectedCities, title: 'Cidade' };
      default:
        return { options: [], selected: [], setSelected: () => {}, title: '' };
    }
  };

  const filterData = getFilterData();
  const canSendToAll = scopesData?.can_send_to_all ?? false;
  const hasScopes = (scopesData?.scopes.length ?? 0) > 0;

  if (loadingScopes) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ADMIN_COLOR} />
      </View>
    );
  }

  if (scopeLoadError) {
    return (
      <>
        <Stack.Screen options={{ title: 'Criar Aviso' }} />
        <View style={styles.loadingContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={t.status.error} />
          <Text style={[styles.label, { textAlign: 'center', marginTop: 16, color: t.status.error }]}>
            {scopeLoadError}
          </Text>
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: t.text.secondary, marginTop: 24 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.sendButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Criar Aviso' }} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Tipo */}
        <Text style={styles.label}>Tipo do Aviso</Text>
        <View style={styles.typeContainer}>
          {messageTypes.map((mt) => (
            <TouchableOpacity
              key={mt.type}
              style={[styles.typeButton, messageType === mt.type && { borderColor: mt.color, backgroundColor: `${mt.color}15` }]}
              onPress={() => setMessageType(mt.type)}
            >
              <Ionicons name={mt.icon as IoniconsName} size={20} color={mt.color} />
              <Text style={[styles.typeLabel, { color: messageType === mt.type ? mt.color : t.text.secondary }]}>{mt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Categoria */}
        <Text style={styles.label}>Categoria</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              onPress={() => setCategory(cat.value)}
              style={{
                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                backgroundColor: category === cat.value ? t.brand.primary : t.bg.screen,
                borderWidth: 1,
                borderColor: category === cat.value ? t.brand.primary : t.border.subtle,
              }}
            >
              <Text style={{ color: category === cat.value ? t.text.inverse : t.text.secondary, fontSize: 13 }}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Prioridade */}
        <Text style={styles.label}>Prioridade de Entrega</Text>
        {PRIORITIES.map((p) => (
          <TouchableOpacity
            key={p.value}
            onPress={() => setPriority(p.value)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              padding: 12, borderRadius: 10, marginBottom: 8,
              backgroundColor: priority === p.value ? t.bg.elevated : t.bg.screen,
              borderWidth: 1,
              borderColor: priority === p.value ? p.color : t.border.subtle,
            }}
          >
            <View style={{
              width: 16, height: 16, borderRadius: 8,
              backgroundColor: priority === p.value ? p.color : 'transparent',
              borderWidth: 2, borderColor: priority === p.value ? p.color : t.text.tertiary,
            }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600', fontSize: 13, color: priority === p.value ? p.color : t.text.primary }}>
                {p.label}
              </Text>
              <Text style={{ fontSize: 11, color: t.text.secondary }}>{p.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
        {priority === 'CRITICAL' && (
          <View style={{ backgroundColor: t.status.errorBg, padding: 10, borderRadius: 8, marginBottom: 8 }}>
            <Text style={{ color: t.status.error, fontSize: 12, marginBottom: 8 }}>
              ⚠️ Urgente ignora preferências de notificação. Use apenas para comunicados críticos.
            </Text>
            <TextInput
              value={criticalReason}
              onChangeText={setCriticalReason}
              placeholder="Justificativa obrigatória (mín. 10 caracteres)"
              style={{
                borderWidth: 1, borderColor: t.border.subtle, borderRadius: 8,
                padding: 10, backgroundColor: t.bg.screen, fontSize: 13,
                color: t.text.primary,
              }}
            />
          </View>
        )}

        {/* Deep Link */}
        <Text style={styles.label}>Deep Link (opcional)</Text>
        <TextInput
          value={deepLink}
          onChangeText={setDeepLink}
          placeholder="Ex: /retreats/abc, /vida, /channel/xyz"
          style={[styles.input, { marginBottom: 16 }]}
          placeholderTextColor={t.text.secondary}
        />

        {/* Action Label */}
        <Text style={styles.label}>Texto do Botão (opcional)</Text>
        <TextInput
          value={actionLabel}
          onChangeText={setActionLabel}
          placeholder='Ex: "Inscrever-se", "Ver Programação"'
          style={[styles.input, { marginBottom: 16 }]}
          placeholderTextColor={t.text.secondary}
        />

        {/* Titulo */}
        <Text style={styles.label}>Titulo</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Ex: Reuniao de Formacao"
          maxLength={200}
          placeholderTextColor={t.text.secondary}
        />

        {/* Mensagem */}
        <Text style={styles.label}>Texto do Aviso</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={message}
          onChangeText={setMessage}
          placeholder="Escreva o conteudo..."
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={5000}
          placeholderTextColor={t.text.secondary}
        />

        {/* Destinatarios */}
        <Text style={styles.label}>Destinatarios</Text>
        <View style={styles.destContainer}>

          {/* Todos os membros (apenas CAN_SEND_INBOX) */}
          {canSendToAll && (
            <TouchableOpacity
              style={[styles.destOption, destMode === 'all' && styles.destOptionActive]}
              onPress={() => setDestMode('all')}
            >
              <Ionicons
                name={destMode === 'all' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={destMode === 'all' ? ADMIN_COLOR : t.text.secondary}
              />
              <View style={styles.destTextBlock}>
                <Text style={[styles.destText, destMode === 'all' && styles.destTextActive]}>Todos os membros</Text>
                <Text style={styles.destSubtext}>Envia para toda a comunidade</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Setor / Grupo (coordenadores) */}
          {hasScopes && (
            <TouchableOpacity
              style={[styles.destOption, destMode === 'scope' && styles.destOptionActive]}
              onPress={() => setDestMode('scope')}
            >
              <Ionicons
                name={destMode === 'scope' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={destMode === 'scope' ? ADMIN_COLOR : t.text.secondary}
              />
              <View style={styles.destTextBlock}>
                <Text style={[styles.destText, destMode === 'scope' && styles.destTextActive]}>
                  {selectedScope ? selectedScope.name : 'Setor ou Grupo'}
                </Text>
                <Text style={styles.destSubtext}>
                  {selectedScope
                    ? `${selectedScope.member_count} membro(s)`
                    : 'Selecione um setor ou grupo'}
                </Text>
              </View>
              {destMode === 'scope' && scopesData && scopesData.scopes.length > 1 && (
                <TouchableOpacity onPress={() => setShowScopeModal(true)} style={styles.changeScopeBtn}>
                  <Text style={styles.changeScopeText}>Alterar</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}

          {/* Por filtros de perfil (apenas CAN_SEND_INBOX) */}
          {canSendToAll && (
            <TouchableOpacity
              style={[styles.destOption, destMode === 'filter' && styles.destOptionActive]}
              onPress={() => setDestMode('filter')}
            >
              <Ionicons
                name={destMode === 'filter' ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={destMode === 'filter' ? ADMIN_COLOR : t.text.secondary}
              />
              <View style={styles.destTextBlock}>
                <Text style={[styles.destText, destMode === 'filter' && styles.destTextActive]}>Segmentado por perfil</Text>
                <Text style={styles.destSubtext}>Filtra por vocacao, estado civil, UF...</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Seletor de escopo inline quando só há 1 escopo */}
        {destMode === 'scope' && !selectedScope && hasScopes && (
          <TouchableOpacity style={styles.pickScopeBtn} onPress={() => setShowScopeModal(true)}>
            <Ionicons name="people" size={20} color={ADMIN_COLOR} />
            <Text style={styles.pickScopeText}>Escolher setor/grupo</Text>
            <Ionicons name="chevron-forward" size={18} color={ADMIN_COLOR} />
          </TouchableOpacity>
        )}

        {/* Filtros de perfil (modo filter) */}
        {destMode === 'filter' && (
          <View style={styles.filtersContainer}>
            <Text style={styles.filtersTitle}>Filtros de Segmentacao</Text>
            {loadingFilters ? <ActivityIndicator color={ADMIN_COLOR} /> : (
              <>
                <FilterBtn label="Realidade Vocacional" count={selectedVocational.length} onPress={() => openFilter('vocational')} styles={styles} t={t} />
                <FilterBtn label="Estado de Vida" count={selectedLifeState.length} onPress={() => openFilter('lifeState')} styles={styles} t={t} />
                <FilterBtn label="Estado Civil" count={selectedMarital.length} onPress={() => openFilter('marital')} styles={styles} t={t} />
                <FilterBtn label="Estado (UF)" count={selectedStates.length} onPress={() => openFilter('states')} styles={styles} t={t} />
                <FilterBtn label="Cidade" count={selectedCities.length} onPress={() => openFilter('cities')} styles={styles} t={t} />
              </>
            )}
          </View>
        )}

        {/* Preview de destinatarios */}
        {previewCount !== null && (
          <View style={styles.previewBox}>
            <Ionicons name="people" size={20} color={ADMIN_COLOR} />
            <Text style={styles.previewText}>{previewCount} membro(s) receberao este aviso</Text>
          </View>
        )}

        {/* Erros inline */}
        {validationError && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={t.status.error} />
            <Text style={styles.errorText}>{validationError}</Text>
          </View>
        )}
        {sendError && (
          <View style={styles.errorBox}>
            <Ionicons name="close-circle" size={16} color={t.status.error} />
            <Text style={styles.errorText}>{sendError}</Text>
          </View>
        )}

        {/* Botao de envio */}
        <TouchableOpacity
          style={[styles.sendButton, loading && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={t.text.inverse} /> : (
            <>
              <Ionicons name="send" size={20} color={t.text.inverse} />
              <Text style={styles.sendButtonText}>Enviar Aviso</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de seleção de escopo */}
      <Modal visible={showScopeModal} animationType="slide" transparent onRequestClose={() => setShowScopeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Setor/Grupo</Text>
              <TouchableOpacity onPress={() => setShowScopeModal(false)}>
                <Ionicons name="close" size={24} color={t.text.secondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {(scopesData?.scopes ?? []).map((scope) => (
                <TouchableOpacity
                  key={scope.id}
                  style={[styles.scopeOption, selectedScope?.id === scope.id && styles.scopeOptionSelected]}
                  onPress={() => { setSelectedScope(scope); setDestMode('scope'); setShowScopeModal(false); }}
                >
                  <View style={styles.scopeOptionLeft}>
                    <Text style={styles.scopeOptionName}>{scope.name}</Text>
                    <Text style={styles.scopeOptionMeta}>{scope.type} • {scope.member_count} membro(s)</Text>
                  </View>
                  {selectedScope?.id === scope.id && (
                    <Ionicons name="checkmark-circle" size={22} color={ADMIN_COLOR} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalDoneButton} onPress={() => setShowScopeModal(false)}>
              <Text style={styles.modalDoneText}>Concluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de confirmação de envio */}
      <Modal visible={showConfirmModal} animationType="fade" transparent onRequestClose={() => setShowConfirmModal(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Ionicons name="send" size={32} color={ADMIN_COLOR} style={{ marginBottom: 12 }} />
            <Text style={styles.confirmTitle}>Confirmar envio</Text>
            <Text style={styles.confirmMessage}>
              Enviar aviso para{' '}
              <Text style={{ fontWeight: '700' }}>
                {destMode === 'all'
                  ? 'todos os membros'
                  : destMode === 'scope'
                    ? (selectedScope?.name ?? '')
                    : `${previewCount ?? '?'} membro(s) filtrado(s)`}
              </Text>
              ?
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmSendBtn}
                onPress={sendAviso}
              >
                <Ionicons name="send" size={16} color={t.text.inverse} />
                <Text style={styles.confirmSendText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de sucesso */}
      <Modal visible={showSuccessModal} animationType="fade" transparent onRequestClose={() => { setShowSuccessModal(false); router.back(); }}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={40} color={t.text.inverse} />
            </View>
            <Text style={styles.confirmTitle}>Aviso enviado!</Text>
            <Text style={styles.confirmMessage}>
              Seu aviso foi enviado para{' '}
              <Text style={{ fontWeight: '700', color: t.text.primary }}>{sentCount} membro(s)</Text>
              {' '}com sucesso.
            </Text>
            <TouchableOpacity
              style={[styles.confirmSendBtn, { width: '100%' }]}
              onPress={() => { setShowSuccessModal(false); router.back(); }}
            >
              <Ionicons name="checkmark-circle" size={18} color={t.text.inverse} />
              <Text style={styles.confirmSendText}>Concluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de seleção de filtros de perfil */}
      <Modal visible={showFilterModal} animationType="slide" transparent onRequestClose={() => setShowFilterModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{filterData.title}</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color={t.text.secondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {filterData.options.map((opt) => (
                <TouchableOpacity
                  key={opt.code}
                  style={styles.filterOption}
                  onPress={() => toggleSelection(opt.code, filterData.selected, filterData.setSelected)}
                >
                  <Text style={styles.filterOptionText}>{opt.label}</Text>
                  <View style={[styles.checkbox, filterData.selected.includes(opt.code) && styles.checkboxChecked]}>
                    {filterData.selected.includes(opt.code) && <Ionicons name="checkmark" size={16} color={t.text.inverse} />}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalDoneButton} onPress={() => setShowFilterModal(false)}>
              <Text style={styles.modalDoneText}>Concluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function FilterBtn({ label, count, onPress, styles, t }: { label: string; count: number; onPress: () => void; styles: ReturnType<typeof makeStyles>; t: SemanticTokens }) {
  return (
    <TouchableOpacity style={styles.filterButton} onPress={onPress}>
      <Text style={styles.filterButtonText}>{label}</Text>
      <View style={styles.filterButtonRight}>
        {count > 0 && <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{count}</Text></View>}
        <Ionicons name="chevron-forward" size={20} color={t.text.secondary} />
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.elevated },
  content: { padding: 16, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.bg.elevated },
  label: { fontSize: 14, fontWeight: '600', color: t.text.primary, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: t.bg.surface, borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: t.border.subtle, color: t.text.primary },
  textArea: { minHeight: 120 },
  typeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: t.border.subtle, backgroundColor: t.bg.screen, gap: 6 },
  typeLabel: { fontSize: 13, fontWeight: '500' },
  destContainer: { backgroundColor: t.bg.screen, borderRadius: 12, overflow: 'hidden' },
  destOption: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: t.bg.elevated },
  destOptionActive: { backgroundColor: `${ADMIN_COLOR}08` },
  destTextBlock: { flex: 1 },
  destText: { fontSize: 15, color: t.text.secondary },
  destTextActive: { color: t.text.primary, fontWeight: '500' },
  destSubtext: { fontSize: 12, color: t.text.secondary, marginTop: 2 },
  changeScopeBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: `${ADMIN_COLOR}15` },
  changeScopeText: { fontSize: 12, color: ADMIN_COLOR, fontWeight: '600' },
  pickScopeBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: `${ADMIN_COLOR}10`, borderRadius: 12, padding: 14, marginTop: 8 },
  pickScopeText: { flex: 1, fontSize: 15, color: ADMIN_COLOR, fontWeight: '500' },
  filtersContainer: { backgroundColor: t.bg.screen, borderRadius: 12, padding: 16, marginTop: 12 },
  filtersTitle: { fontSize: 14, fontWeight: '600', color: t.text.primary, marginBottom: 12 },
  filterButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.bg.elevated },
  filterButtonText: { fontSize: 15, color: t.text.primary },
  filterButtonRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBadge: { backgroundColor: ADMIN_COLOR, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  filterBadgeText: { color: t.text.inverse, fontSize: 12, fontWeight: '600' },
  previewBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, padding: 12, backgroundColor: `${ADMIN_COLOR}10`, borderRadius: 8 },
  previewText: { fontSize: 14, color: ADMIN_COLOR, fontWeight: '500' },
  sendButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ADMIN_COLOR, borderRadius: 12, padding: 16, marginTop: 24 },
  sendButtonDisabled: { opacity: 0.6 },
  sendButtonText: { color: t.text.inverse, fontSize: 16, fontWeight: '600' },
  // Modais
  modalOverlay: { flex: 1, backgroundColor: t.bg.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: t.bg.screen, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: t.border.subtle },
  modalTitle: { fontSize: 18, fontWeight: '600', color: t.text.primary },
  modalScroll: { padding: 16 },
  scopeOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: t.bg.elevated },
  scopeOptionSelected: { backgroundColor: `${ADMIN_COLOR}08` },
  scopeOptionLeft: { flex: 1 },
  scopeOptionName: { fontSize: 15, fontWeight: '500', color: t.text.primary },
  scopeOptionMeta: { fontSize: 12, color: t.text.secondary, marginTop: 2 },
  filterOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: t.bg.elevated },
  filterOptionText: { fontSize: 15, color: t.text.primary },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: t.border.default, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: ADMIN_COLOR, borderColor: ADMIN_COLOR },
  modalDoneButton: { margin: 16, padding: 16, backgroundColor: ADMIN_COLOR, borderRadius: 12, alignItems: 'center' },
  modalDoneText: { color: t.text.inverse, fontSize: 16, fontWeight: '600' },
  // Erros inline
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 12, backgroundColor: t.status.errorBg, borderRadius: 10, borderWidth: 1, borderColor: t.border.subtle },
  errorText: { flex: 1, fontSize: 14, color: t.status.error, fontWeight: '500' },
  // Modal de confirmação
  confirmOverlay: { flex: 1, backgroundColor: t.bg.overlay, justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmBox: { backgroundColor: t.bg.screen, borderRadius: 20, padding: 28, width: '100%', maxWidth: 380, alignItems: 'center' },
  confirmTitle: { fontSize: 20, fontWeight: '700', color: t.text.primary, marginBottom: 10 },
  confirmMessage: { fontSize: 15, color: t.text.secondary, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  confirmActions: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmCancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: t.border.subtle, alignItems: 'center' },
  confirmCancelText: { fontSize: 15, fontWeight: '600', color: t.text.secondary },
  confirmSendBtn: { flex: 1, flexDirection: 'row', gap: 8, padding: 14, borderRadius: 12, backgroundColor: ADMIN_COLOR, alignItems: 'center', justifyContent: 'center' },
  confirmSendText: { fontSize: 15, fontWeight: '600', color: t.text.inverse },
  successIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: t.status.success, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
});
