# CP5: Perfil, Comunidade e Membros — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenho visual completo das telas de Perfil, Comunidade/Convites e Membros seguindo o conceito "Casa organizada" — confiança, pertencimento, cuidado com dados, sem alterar nenhuma lógica, serviço, store ou tipo existente.

**Architecture:** Cada arquivo é modificado de forma independente. Tokens do design system (`useTheme`, `SemanticTokens`, `radius`, `typography` de `@/theme`) substituem todas as constantes de cor hardcoded. Nenhum novo arquivo de serviço, store ou tipo é criado — apenas componentes visuais locais onde necessário.

**Tech Stack:** React Native, Expo Router, `@expo/vector-icons` (Ionicons), Design System interno (`@/theme` com `SemanticTokens`), Nunito font family.

---

## Regras invioláveis (relembrar antes de cada task)

- NÃO alterar `services/`, `stores/`, `types/`, rotas, endpoints, payloads, validações ou permissões.
- NÃO alterar handlers de estado (`useState`, `useCallback`, `useEffect`) existentes.
- NÃO alterar lógica de formulário, masks de input ou submit handlers.
- Se encontrar bug funcional, documentar em comentário `// BUG: ...` e continuar.
- Redesign visual apenas.

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `lumen_mobile/app/(tabs)/profile.tsx` | `useTheme` import, header identity strip, `SectionTitle`+`InfoRow` redesign, seções sensíveis com shield, modal separadores visuais, logout ghost |
| `lumen_mobile/app/(tabs)/community.tsx` | `useTheme` import, sub-label header, org-type pills, card redesign, estado vazio acolhedor |
| `lumen_mobile/app/members.tsx` | `useTheme` import, substituir `colors.*` por tokens, header, section chips, `MemberCard` com email mascarado + anel coord, modais |
| `lumen_mobile/app/(onboarding)/profile.tsx` | `useTheme` import, títulos de seção acolhedores, separadores visuais entre blocos, barra de progresso decorativa |
| `lumen_mobile/app/(onboarding)/profile-update.tsx` | `useTheme` import, header pastoral, textos, botões |

---

## Task 1: Profile (tabs) — useTheme + header identity strip

**Arquivo:** `lumen_mobile/app/(tabs)/profile.tsx`

O header atual mostra avatar + nome + email + status. O novo header acrescenta uma "faixa de pertencimento" com pills de identidade comunitária (realidade vocacional, estado de vida, missão, encontro Despertar), transmitindo identidade antes de cadastro.

- [ ] **1.1 Adicionar import de `useTheme` e remover constantes hardcoded**

Localizar no topo do arquivo:
```tsx
const PRIMARY = '#1A859B';
const WHITE = '#ffffff';
const GRAY = '#6b7280';
const BG = '#f3f4f6';
```

Substituir pelas imports e remover essas constantes:
```tsx
import { useTheme } from '@/theme';
import { radius, typography } from '@/theme/tokens';
```

Dentro de `ProfileScreen()`, logo após a declaração de estados existentes, adicionar:
```tsx
const { t } = useTheme();
```

- [ ] **1.2 Substituir constantes por tokens ao longo do arquivo**

No `StyleSheet.create` ao final do arquivo, substituir todas as referências:
- `PRIMARY` → usar `t.brand.primary` inline (nos componentes `SectionTitle`, `InfoRow`, `ProfileScreen` header)
- `WHITE` → `t.bg.elevated`
- `GRAY` → `t.text.secondary`
- `BG` → `t.bg.screen`

Como `StyleSheet.create` é estático e não aceita tokens dinâmicos, manter o `StyleSheet` para estrutura (padding, borderRadius, flexDirection) e aplicar cores como inline styles onde necessário, ou converter o StyleSheet para uma função que recebe `t`. A abordagem mais simples: converter `styles` em uma função:

```tsx
// Substituir a declaração final:
// const styles = StyleSheet.create({ ... })
// Por:
const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.screen },
  content: { padding: 16, paddingBottom: 48 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.bg.screen },

  headerCard: { backgroundColor: t.bg.elevated, borderRadius: radius.xl, padding: 24, alignItems: 'center', marginBottom: 12 },
  avatarContainer: { marginBottom: 14 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarPlaceholder: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: t.brand.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: t.brand.primaryLight,
  },
  avatarRing: {
    width: 92, height: 92, borderRadius: 46,
    borderWidth: 2.5, borderColor: t.brand.primary,
    alignItems: 'center', justifyContent: 'center',
    ...t.shadow.sm,
  },
  userName: { fontSize: typography.size['2xl'], fontFamily: typography.family.bold, color: t.text.primary, marginBottom: 4 },
  userEmail: { fontSize: typography.size.sm, color: t.text.secondary, marginBottom: 12 },
  statusChip: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: radius.full, marginBottom: 14 },
  statusComplete: { backgroundColor: t.status.successBg },
  statusPending: { backgroundColor: t.status.warningBg },
  statusText: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },

  belongingStrip: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    justifyContent: 'center', marginBottom: 16, paddingHorizontal: 8,
  },
  belongingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: t.brand.primaryDim,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.full,
  },
  belongingPillText: {
    fontSize: typography.size.xs, fontFamily: typography.family.semibold,
    color: t.brand.primary,
  },

  editProfileButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: radius.full, borderWidth: 1, borderColor: t.border.subtle,
  },
  editProfileButtonText: { color: t.brand.primary, fontSize: typography.size.md, fontFamily: typography.family.semibold },

  sectionTitle: { fontSize: typography.size.xs, fontFamily: typography.family.bold, color: t.text.tertiary, marginTop: 16, marginBottom: 6, paddingHorizontal: 2, textTransform: 'uppercase', letterSpacing: 1 },
  sectionTitleSensitive: { fontSize: typography.size.xs, fontFamily: typography.family.bold, color: t.text.tertiary, marginTop: 16, marginBottom: 6, paddingHorizontal: 2, textTransform: 'uppercase', letterSpacing: 1 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, marginBottom: 6, paddingHorizontal: 2 },

  card: { backgroundColor: t.bg.elevated, borderRadius: radius.lg, marginBottom: 4, overflow: 'hidden', ...t.shadow.sm },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: t.border.subtle },
  rowLast: { borderBottomWidth: 0 },
  rowContent: { flex: 1, marginLeft: 12 },
  rowLabel: { fontSize: typography.size.xs, color: t.text.secondary, fontFamily: typography.family.regular },
  rowValue: { fontSize: typography.size.md, color: t.text.primary, marginTop: 2, fontFamily: typography.family.semibold },
  rowValueEmpty: { fontSize: typography.size.sm, color: t.text.tertiary, marginTop: 2, fontFamily: typography.family.italic },

  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 24, padding: 14, gap: 8,
  },
  logoutText: { color: t.status.error, fontSize: typography.size.sm, fontFamily: typography.family.semibold },
  version: { textAlign: 'center', fontSize: typography.size.xs, color: t.text.tertiary, marginTop: 12 },

  // Edit modal
  editModal: { flex: 1, backgroundColor: t.bg.screen },
  editHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: t.bg.elevated, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: t.border.subtle,
  },
  editHeaderBack: { padding: 4 },
  editHeaderTitle: { fontSize: typography.size.lg, fontFamily: typography.family.bold, color: t.text.primary },
  editHeaderSave: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: t.brand.primary, borderRadius: radius.full,
  },
  editHeaderSaveText: { color: t.text.inverse, fontSize: typography.size.sm, fontFamily: typography.family.bold },
  editBody: { flex: 1 },
  editBodyContent: { padding: 16, paddingBottom: 48 },

  editSectionSeparator: { height: 1, backgroundColor: t.border.subtle, marginTop: 24, marginBottom: 12 },
  editSection: {
    fontSize: typography.size.xs, fontFamily: typography.family.bold, color: t.brand.primary,
    marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  editLabel: { fontSize: typography.size.sm, color: t.text.secondary, marginBottom: 4, marginLeft: 2, fontFamily: typography.family.regular },
  editInput: {
    backgroundColor: t.bg.elevated, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: typography.size.md, color: t.text.primary, marginBottom: 12,
    borderWidth: 1, borderColor: t.border.subtle,
    fontFamily: typography.family.regular,
  },
  editInputError: { borderColor: t.status.error, backgroundColor: t.status.errorBg, marginBottom: 4 },
  editInputMultiline: { height: 110, textAlignVertical: 'top', paddingTop: 12 },
  editSelector: {
    backgroundColor: t.bg.elevated, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12, borderWidth: 1, borderColor: t.border.subtle,
  },
  editSelectorValue: { fontSize: typography.size.md, color: t.text.primary, flex: 1, fontFamily: typography.family.regular },
  editSelectorPlaceholder: { fontSize: typography.size.md, color: t.text.tertiary, flex: 1, fontFamily: typography.family.regular },
  editError: { color: t.status.error, fontSize: typography.size.xs, marginBottom: 10, marginLeft: 4 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: t.bg.elevated, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 12, borderWidth: 1, borderColor: t.border.subtle,
  },
  toggleLabel: { fontSize: typography.size.md, color: t.text.primary, flex: 1, marginRight: 12, fontFamily: typography.family.regular },
  saveButton: { backgroundColor: t.brand.primary, borderRadius: radius.lg, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: t.text.inverse, fontSize: typography.size.lg, fontFamily: typography.family.bold },
  saveErrorBox: {
    backgroundColor: t.status.errorBg, borderRadius: radius.sm, padding: 12,
    marginTop: 12, borderWidth: 1, borderColor: t.status.error,
  },
  saveErrorText: { color: t.status.error, fontSize: typography.size.sm, textAlign: 'center', fontFamily: typography.family.regular },

  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: t.border.subtle, backgroundColor: t.bg.surface,
  },
  chipSelected: { borderColor: t.brand.primary, backgroundColor: t.brand.primary },
  chipText: { fontSize: typography.size.sm, color: t.text.secondary, fontFamily: typography.family.semibold },
  chipTextSelected: { color: t.text.inverse, fontFamily: typography.family.bold },

  availGrid: { backgroundColor: t.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: t.border.subtle, marginBottom: 12, overflow: 'hidden' },
  availHeaderRow: { flexDirection: 'row', backgroundColor: t.bg.surface, paddingVertical: 8, paddingHorizontal: 10 },
  availTurnHeader: { flex: 1, textAlign: 'center', fontSize: typography.size.xs, fontFamily: typography.family.bold, color: t.text.secondary },
  availRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: t.border.subtle },
  availDayCell: { width: 62 },
  availDayLabel: { width: 62, fontSize: typography.size.xs, color: t.text.primary, fontFamily: typography.family.semibold },
  availCell: { flex: 1, height: 28, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginHorizontal: 3, borderWidth: 1, borderColor: t.border.subtle, backgroundColor: t.bg.surface },
  availCellChecked: { backgroundColor: t.brand.primary, borderColor: t.brand.primary },

  subOverlay: { flex: 1, backgroundColor: t.bg.overlay, justifyContent: 'flex-end' },
  subSheet: { backgroundColor: t.bg.elevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '70%' },
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: t.border.subtle },
  subTitle: { fontSize: typography.size.lg, fontFamily: typography.family.bold, color: t.text.primary },
  subItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: t.border.subtle },
  subItemSelected: { backgroundColor: t.brand.primaryDim },
  subItemText: { fontSize: typography.size.lg, color: t.text.primary, fontFamily: typography.family.regular },
  subItemTextSelected: { color: t.brand.primary, fontFamily: typography.family.bold },
});
```

No corpo do componente `ProfileScreen`, após `const { t } = useTheme()`, instanciar os estilos:
```tsx
const styles = makeStyles(t);
```

- [ ] **1.3 Adicionar import de `SemanticTokens`**

No topo do arquivo, adicionar no import de `@/theme`:
```tsx
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';
import { radius, typography } from '@/theme/tokens';
```

- [ ] **1.4 Atualizar `SectionTitle` para suportar ícone de sensibilidade**

Localizar:
```tsx
const SectionTitle = memo(function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
});
```

Substituir por (o componente agora recebe `t` e `sensitive` opcionais):
```tsx
const SectionTitle = memo(function SectionTitle({
  children, t, sensitive = false,
}: { children: string; t: SemanticTokens; sensitive?: boolean }) {
  if (sensitive) {
    return (
      <View style={styles(t).sectionTitleRow}>
        <Text style={styles(t).sectionTitleSensitive}>{children}</Text>
        <Ionicons name="shield-checkmark-outline" size={13} color={t.brand.primary} style={{ opacity: 0.5 }} />
      </View>
    );
  }
  return <Text style={styles(t).sectionTitle}>{children}</Text>;
});
```

**Atenção:** como `styles` agora é uma função `makeStyles(t)`, ao chamar dentro de sub-componentes que não têm `t` disponível precisamos passar `t` como prop. Ajustar as chamadas de `<SectionTitle>` na tela principal para passar `t`:

```tsx
// Seções normais:
<SectionTitle t={t}>Dados Pessoais</SectionTitle>
<SectionTitle t={t}>Informações da Comunidade</SectionTitle>
<SectionTitle t={t}>Acompanhamento Vocacional</SectionTitle>
<SectionTitle t={t}>Interesse em Ministério</SectionTitle>
<SectionTitle t={t}>Música e Ministério Musical</SectionTitle>

// Seções sensíveis:
<SectionTitle t={t} sensitive>Retiros e Eventos</SectionTitle>
<SectionTitle t={t} sensitive>Contato de Emergência</SectionTitle>
```

- [ ] **1.5 Atualizar `InfoRow` para usar tokens e tratar "não informado" com graça**

Localizar:
```tsx
const InfoRow = memo(function InfoRow({ icon, label, value, last }: {
  icon: string; label: string; value?: string | null; last?: boolean;
}) {
  return (
    <View style={[styles.row, last ? styles.rowLast : null]}>
      <Ionicons name={icon as IoniconsName} size={20} color={GRAY} />
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value || 'Não informado'}</Text>
      </View>
    </View>
  );
});
```

Substituir por:
```tsx
const InfoRow = memo(function InfoRow({
  icon, label, value, last, t,
}: {
  icon: string; label: string; value?: string | null; last?: boolean; t: SemanticTokens;
}) {
  const s = makeStyles(t);
  const isEmpty = !value;
  return (
    <View style={[s.row, last ? s.rowLast : null]}>
      <Ionicons name={icon as IoniconsName} size={18} color={t.brand.primary} style={{ opacity: 0.7 }} />
      <View style={s.rowContent}>
        <Text style={s.rowLabel}>{label}</Text>
        {isEmpty
          ? <Text style={s.rowValueEmpty}>—</Text>
          : <Text style={s.rowValue}>{value}</Text>
        }
      </View>
    </View>
  );
});
```

Adicionar `t={t}` em todas as chamadas de `<InfoRow>` na tela (são ~20 ocorrências). Exemplo:
```tsx
<InfoRow icon="person-outline" label="Nome" value={profile?.full_name} t={t} />
```

- [ ] **1.6 Adicionar faixa de pertencimento ao header**

Localizar no JSX a seção do headerCard:
```tsx
<View style={styles.headerCard}>
  <View style={styles.avatarContainer}>
    ...
  </View>
  <Text style={styles.userName}>{profile?.full_name || 'Nome não informado'}</Text>
  <Text style={styles.userEmail}>{email}</Text>
  <View style={[styles.statusChip, ...]}>
```

Após o `<Text style={styles.userEmail}>`, inserir antes do statusChip:
```tsx
{/* Faixa de pertencimento comunitário */}
{(profile?.vocational_reality_label || profile?.life_state_label ||
  (profile?.is_from_mission && profile?.mission_name) ||
  profile?.despertar_encounter) && (
  <View style={makeStyles(t).belongingStrip}>
    {profile?.vocational_reality_label ? (
      <View style={makeStyles(t).belongingPill}>
        <Ionicons name="star-outline" size={11} color={t.brand.primary} />
        <Text style={makeStyles(t).belongingPillText}>{profile.vocational_reality_label}</Text>
      </View>
    ) : null}
    {profile?.life_state_label ? (
      <View style={makeStyles(t).belongingPill}>
        <Ionicons name="heart-outline" size={11} color={t.brand.primary} />
        <Text style={makeStyles(t).belongingPillText}>{profile.life_state_label}</Text>
      </View>
    ) : null}
    {profile?.is_from_mission && profile?.mission_name ? (
      <View style={makeStyles(t).belongingPill}>
        <Ionicons name="globe-outline" size={11} color={t.brand.primary} />
        <Text style={makeStyles(t).belongingPillText}>{profile.mission_name}</Text>
      </View>
    ) : null}
    {profile?.despertar_encounter ? (
      <View style={makeStyles(t).belongingPill}>
        <Ionicons name="flame-outline" size={11} color={t.brand.primary} />
        <Text style={makeStyles(t).belongingPillText}>{profile.despertar_encounter}</Text>
      </View>
    ) : null}
  </View>
)}
```

- [ ] **1.7 Redesenhar avatar com anel teal**

Localizar:
```tsx
<View style={styles.avatarContainer}>
  {profile?.photo_url
    ? <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
    : <View style={styles.avatarPlaceholder}><Ionicons name="person" size={48} color={WHITE} /></View>
  }
</View>
```

Substituir por (anel externo envolve o avatar):
```tsx
<View style={makeStyles(t).avatarContainer}>
  <View style={makeStyles(t).avatarRing}>
    {profile?.photo_url
      ? <Image source={{ uri: profile.photo_url }} style={makeStyles(t).avatar} />
      : <View style={makeStyles(t).avatarPlaceholder}>
          <Ionicons name="person" size={40} color={t.text.inverse} />
        </View>
    }
  </View>
</View>
```

- [ ] **1.8 Redesenhar botão de logout como ghost**

Localizar:
```tsx
<TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
  <Ionicons name="log-out-outline" size={20} color="#ef4444" />
  <Text style={styles.logoutText}>Sair da Conta</Text>
</TouchableOpacity>
```

O `makeStyles` já define `logoutButton` sem borda. Apenas confirmar que não há `borderWidth` ou `borderColor` nos estilos do logout. A aparência será: só ícone + texto vermelho, sem caixa.

- [ ] **1.9 Adicionar botão "Salvar" no header do modal de edição**

Localizar o `editHeader` do modal:
```tsx
<View style={styles.editHeader}>
  <TouchableOpacity onPress={() => !saving && setEditVisible(false)} style={styles.editHeaderBack}>
    <Ionicons name="arrow-back" size={24} color="#171717" />
  </TouchableOpacity>
  <Text style={styles.editHeaderTitle}>Editar Perfil</Text>
  <View style={{ width: 40 }} />
</View>
```

Substituir por:
```tsx
<View style={makeStyles(t).editHeader}>
  <TouchableOpacity onPress={() => !saving && setEditVisible(false)} style={makeStyles(t).editHeaderBack}>
    <Ionicons name="arrow-back" size={24} color={t.text.primary} />
  </TouchableOpacity>
  <Text style={makeStyles(t).editHeaderTitle}>Editar Perfil</Text>
  <TouchableOpacity
    style={[makeStyles(t).editHeaderSave, saving ? { opacity: 0.5 } : null]}
    onPress={handleSaveProfile}
    disabled={saving}
  >
    <Text style={makeStyles(t).editHeaderSaveText}>Salvar</Text>
  </TouchableOpacity>
</View>
```

- [ ] **1.10 Adicionar separadores visuais entre blocos do modal de edição**

Cada `<Text style={styles.editSection}>` que começa um bloco recebe um separador antes. Localizar cada ocorrência de `<Text style={styles.editSection}` (ou equivalente `<Text style={[styles.editSection, ...]}`) e inserir antes delas:

```tsx
<View style={makeStyles(t).editSectionSeparator} />
<Text style={makeStyles(t).editSection}>DADOS PESSOAIS</Text>
```

Fazer o mesmo para todos os blocos: Dados Pessoais, Informações da Comunidade, Acompanhamento Vocacional, Interesse em Ministério, Música e Ministério Musical, Retiros e Eventos, Contato de Emergência.

**Exceção:** o primeiro bloco (Dados Pessoais) não precisa de separador antes — já está no topo do scroll.

- [ ] **1.11 Verificar e commitar**

```bash
cd lumen_mobile
npx expo start --web 2>/dev/null &
# Abrir no browser e verificar:
# - Avatar com anel teal
# - Faixa de pertencimento com pills (se dados preenchidos)
# - Seções com "—" ao invés de "Não informado"
# - Seções sensíveis com shield-checkmark-outline discreto
# - Modal de edição com separadores e botão Salvar no header
# - Logout como texto simples sem borda
```

```bash
git add lumen_mobile/app/\(tabs\)/profile.tsx
git commit -m "feat(perfil): redesign visual CP5 — identity strip, tokens, modal separators, sensitive sections"
```

---

## Task 2: Community/Invites — redesign completo

**Arquivo:** `lumen_mobile/app/(tabs)/community.tsx`

O arquivo atual é a tela de convites nomeada como "Comunidade". O mismatch é documentado mas não corrigido. O redesign torna o conteúdo mais acolhedor e coerente com o nome.

- [ ] **2.1 Adicionar imports e documentar mismatch**

Localizar o topo do arquivo. Substituir a constante `colors` por:
```tsx
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';
import { radius, typography } from '@/theme/tokens';
// BUG-SEMÂNTICO (não corrigir neste CP): este arquivo é nomeado community.tsx
// e a tab tem title="Comunidade", mas o conteúdo é inviteService.getMyInvites().
// Rota, serviço e chamada de API permanecem intocados.
```

Remover o bloco `const colors = { ... }` inteiro.

- [ ] **2.2 Criar `makeStyles` para a tela**

Após os imports, adicionar:
```tsx
const ORG_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  MINISTERIO:     { bg: '#e6f4f7', text: '#1A859B' },
  GRUPO:          { bg: '#f3ecfd', text: '#7C3AED' },
  SETOR:          { bg: '#eff6ff', text: '#2563EB' },
  CONSELHO_GERAL: { bg: '#fffbeb', text: '#d97706' },
};

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.screen },
  list: { padding: 16, gap: 12 },

  centered: {
    flex: 1, backgroundColor: t.bg.screen,
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  emptyIconContainer: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: t.brand.primaryDim,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: {
    fontSize: typography.size.xl, fontFamily: typography.family.bold,
    color: t.text.primary, marginBottom: 8, textAlign: 'center',
  },
  emptyDescription: {
    fontSize: typography.size.sm, color: t.text.secondary,
    textAlign: 'center', lineHeight: 22, fontFamily: typography.family.regular,
  },

  card: {
    backgroundColor: t.bg.elevated, borderRadius: radius.lg,
    padding: 16, gap: 12, ...t.shadow.sm,
  },
  cardTypePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: radius.full,
  },
  cardTypePillText: {
    fontSize: 10, fontFamily: typography.family.bold,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  orgName: {
    fontSize: typography.size.lg, fontFamily: typography.family.bold,
    color: t.text.primary, marginTop: 2,
  },
  orgMeta: {
    fontSize: typography.size.sm, color: t.text.secondary,
    fontFamily: typography.family.regular, marginTop: 2,
  },
  invitedByRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  invitedBy: { fontSize: typography.size.sm, color: t.text.tertiary, fontFamily: typography.family.regular },
  invitedByName: { fontFamily: typography.family.semibold, color: t.text.secondary },
  message: {
    fontSize: typography.size.sm, color: t.text.tertiary,
    fontStyle: 'italic', lineHeight: 18, fontFamily: typography.family.italic,
    borderLeftWidth: 2, borderLeftColor: t.border.subtle, paddingLeft: 10,
  },

  divider: { height: 1, backgroundColor: t.border.subtle, marginVertical: 4 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: {
    flex: 1, paddingVertical: 11, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  btnReject: { backgroundColor: 'transparent' },
  btnRejectText: {
    color: t.status.error, fontFamily: typography.family.semibold,
    fontSize: typography.size.sm,
  },
  btnAccept: { backgroundColor: t.brand.primary },
  btnAcceptText: {
    color: t.text.inverse, fontFamily: typography.family.bold,
    fontSize: typography.size.sm,
  },
});
```

- [ ] **2.3 Adicionar `useTheme` no componente e instanciar styles**

Dentro de `InvitesScreen()`, no início:
```tsx
const { t } = useTheme();
const styles = makeStyles(t);
```

- [ ] **2.4 Atualizar o loading state**

Localizar:
```tsx
return (
  <View style={styles.centered}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>
);
```

Substituir `colors.primary` por `t.brand.primary`. O `styles.centered` já vem do `makeStyles`.

- [ ] **2.5 Atualizar o estado vazio**

Localizar o bloco de `invites.length === 0`:
```tsx
return (
  <View style={styles.centered}>
    <View style={styles.emptyIconContainer}>
      <Ionicons name="mail-open-outline" size={48} color={colors.primary} />
    </View>
    <Text style={styles.emptyTitle}>Nenhum convite pendente</Text>
    <Text style={styles.emptyDescription}>
      Quando alguém te convidar para um ministério ou grupo, ele aparecerá aqui.
    </Text>
  </View>
);
```

Substituir por:
```tsx
return (
  <View style={styles.centered}>
    <View style={styles.emptyIconContainer}>
      <Ionicons name="mail-open-outline" size={48} color={t.brand.primary} />
    </View>
    <Text style={styles.emptyTitle}>Nenhum convite ainda</Text>
    <Text style={styles.emptyDescription}>
      Quando alguém te convidar para um ministério,{'\n'}
      grupo ou setor, o convite aparecerá aqui.
    </Text>
  </View>
);
```

- [ ] **2.6 Atualizar o card de convite no `renderItem`**

Localizar o `return` dentro de `renderItem`. Substituir por:
```tsx
const typeColors = ORG_TYPE_COLORS[item.org_unit_type] ?? { bg: t.brand.primaryDim, text: t.brand.primary };

return (
  <View style={styles.card}>
    {/* Pill do tipo de unidade */}
    <View style={[styles.cardTypePill, { backgroundColor: typeColors.bg }]}>
      <Text style={[styles.cardTypePillText, { color: typeColors.text }]}>
        {unitTypeLabel}
      </Text>
    </View>

    {/* Nome e papel */}
    <View>
      <Text style={styles.orgName}>{item.org_unit_name}</Text>
      <Text style={styles.orgMeta}>Você seria: {roleLabel}</Text>
    </View>

    {/* Convidado por */}
    <View style={styles.invitedByRow}>
      <Ionicons name="person-outline" size={13} color={t.text.tertiary} />
      <Text style={styles.invitedBy}>
        Convidado por{' '}
        <Text style={styles.invitedByName}>{item.invited_by_name}</Text>
      </Text>
    </View>

    {/* Mensagem opcional */}
    {item.message ? (
      <Text style={styles.message}>"{item.message}"</Text>
    ) : null}

    <View style={styles.divider} />

    {/* Ações */}
    <View style={styles.actions}>
      <TouchableOpacity
        style={[styles.btn, styles.btnReject]}
        onPress={() => handleReject(item)}
        disabled={isActing}
      >
        <Text style={styles.btnRejectText}>Recusar</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, styles.btnAccept]}
        onPress={() => handleAccept(item)}
        disabled={isActing}
      >
        {isActing ? (
          <ActivityIndicator size="small" color={t.text.inverse} />
        ) : (
          <Text style={styles.btnAcceptText}>Aceitar →</Text>
        )}
      </TouchableOpacity>
    </View>
  </View>
);
```

- [ ] **2.7 Atualizar o container da FlatList**

Localizar:
```tsx
return (
  <FlatList
    data={invites}
    keyExtractor={(item) => item.id}
    contentContainerStyle={styles.list}
    style={styles.container}
    renderItem={...}
  />
);
```

A estrutura permanece. Apenas confirmar que `styles.container` e `styles.list` vêm do `makeStyles(t)`.

- [ ] **2.8 Commitar**

```bash
git add lumen_mobile/app/\(tabs\)/community.tsx
git commit -m "feat(comunidade): redesign visual CP5 — org-type pills, card acolhedor, estado vazio"
```

---

## Task 3: Members — token migration + helper maskEmail + header + section chips

**Arquivo:** `lumen_mobile/app/members.tsx`

- [ ] **3.1 Adicionar imports e remover constante `colors`**

Substituir o bloco de imports no topo por:
```tsx
import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput, ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '@/services/api';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';
import { radius, typography } from '@/theme/tokens';
```

Remover o bloco `const colors = { ... }` inteiro.

- [ ] **3.2 Adicionar helper `maskEmail`**

Após os imports, antes das interfaces, adicionar:
```tsx
function maskEmail(email: string): string {
  const atIdx = email.indexOf('@');
  if (atIdx < 2) return email;
  return `${email.slice(0, 2)}***${email.slice(atIdx)}`;
}
```

- [ ] **3.3 Criar `makeStyles` para members**

```tsx
const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.screen },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: t.bg.screen },
  loadingText: { marginTop: 12, fontSize: typography.size.md, color: t.text.secondary, fontFamily: typography.family.regular },

  header: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: t.bg.elevated,
    borderBottomWidth: 1, borderBottomColor: t.border.subtle,
  },
  headerTitle: { flex: 1, marginLeft: 12 },
  headerTitleText: { fontSize: typography.size.lg, fontFamily: typography.family.bold, color: t.text.primary },
  headerSubtitle: { fontSize: typography.size.sm, color: t.text.secondary, marginTop: 2, fontFamily: typography.family.regular },

  canalButton: {
    backgroundColor: t.brand.primaryDim,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.full, marginRight: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  canalButtonText: { color: t.brand.primary, fontFamily: typography.family.bold, fontSize: 13 },
  inviteButton: { backgroundColor: t.brand.primary, padding: 10, borderRadius: radius.md },

  listContent: { padding: 16 },

  sectionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: radius.full, marginBottom: 12,
  },
  sectionChipCoord: { backgroundColor: '#fffbeb' },
  sectionChipMember: { backgroundColor: t.brand.primaryDim, marginTop: 16 },
  sectionChipText: { fontSize: typography.size.xs, fontFamily: typography.family.bold },
  sectionChipTextCoord: { color: '#d97706' },
  sectionChipTextMember: { color: t.brand.primary },
  sectionChipCount: {
    fontSize: typography.size.xs, fontFamily: typography.family.bold,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full,
  },
  sectionChipCountCoord: { backgroundColor: '#fef9c3', color: '#a16207' },
  sectionChipCountMember: { backgroundColor: t.brand.primary, color: t.text.inverse },

  memberCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: t.bg.elevated, padding: 14,
    borderRadius: radius.lg, marginBottom: 10,
    ...t.shadow.sm,
  },
  memberAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: t.brand.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: t.brand.primaryDim,
  },
  memberAvatarCoord: {
    borderColor: '#fde68a',
    backgroundColor: '#d97706',
  },
  avatarText: { fontSize: 18, fontFamily: typography.family.bold, color: t.text.inverse },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: typography.size.md, fontFamily: typography.family.bold, color: t.text.primary },
  memberEmailMasked: { fontSize: typography.size.xs, color: t.text.tertiary, marginTop: 2, fontFamily: typography.family.regular },
  memberJoined: { fontSize: typography.size.xs, color: t.text.tertiary, marginTop: 2, fontFamily: typography.family.regular },
  coordBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full, backgroundColor: '#fffbeb',
  },
  coordBadgeText: { fontSize: 11, fontFamily: typography.family.bold, color: '#d97706' },

  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: typography.size.sm, color: t.text.secondary, marginTop: 12, fontFamily: typography.family.regular },

  // Modais
  modalOverlay: { flex: 1, backgroundColor: t.bg.overlay, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: t.bg.elevated, borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl, padding: 24, maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20, gap: 8,
  },
  modalTitle: { fontSize: typography.size.xl, fontFamily: typography.family.bold, color: t.text.primary },
  label: { fontSize: typography.size.sm, fontFamily: typography.family.bold, color: t.text.primary, marginBottom: 8, marginTop: 16 },
  searchInputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: t.bg.surface, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: t.border.subtle, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: typography.size.md, color: t.text.primary, marginLeft: 8, fontFamily: typography.family.regular },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  input: {
    backgroundColor: t.bg.surface, borderRadius: radius.md, padding: 14,
    fontSize: typography.size.md, borderWidth: 1, borderColor: t.border.subtle,
    color: t.text.primary, fontFamily: typography.family.regular,
  },
  searchLoader: { marginTop: 12 },
  searchResults: { marginTop: 4, maxHeight: 200 },
  searchResultItem: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderBottomWidth: 1, borderBottomColor: t.border.subtle,
  },
  searchResultAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: t.brand.primary, justifyContent: 'center', alignItems: 'center',
  },
  searchResultInfo: { flex: 1, marginLeft: 12 },
  searchResultName: { fontSize: typography.size.md, fontFamily: typography.family.semibold, color: t.text.primary },
  roleOptions: { flexDirection: 'row', gap: 12 },
  roleOption: {
    flex: 1, padding: 14, borderRadius: radius.md,
    borderWidth: 2, borderColor: t.border.subtle, alignItems: 'center',
    backgroundColor: t.bg.surface,
  },
  roleOptionActive: { borderColor: t.brand.primary, backgroundColor: t.brand.primaryDim },
  roleOptionText: { fontSize: typography.size.md, fontFamily: typography.family.semibold, color: t.text.secondary },
  roleOptionTextActive: { color: t.brand.primary },

  confirmContainer: { alignItems: 'center', paddingVertical: 16, gap: 16 },
  confirmAvatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: t.brand.primary, justifyContent: 'center', alignItems: 'center',
  },
  confirmQuestion: {
    fontSize: typography.size.lg, color: t.text.secondary,
    textAlign: 'center', lineHeight: 26, fontFamily: typography.family.regular,
  },
  confirmHighlight: { fontFamily: typography.family.bold, color: t.brand.primary },
  confirmMessage: {
    fontSize: typography.size.sm, color: t.text.tertiary,
    fontStyle: 'italic', textAlign: 'center', fontFamily: typography.family.italic,
  },
  confirmButton: {
    width: '100%', backgroundColor: t.brand.primary,
    borderRadius: radius.lg, padding: 16, alignItems: 'center',
  },
  confirmButtonText: { color: t.text.inverse, fontSize: typography.size.lg, fontFamily: typography.family.bold },
  cancelConfirmButton: { padding: 12, alignItems: 'center' },
  cancelConfirmText: { color: t.text.secondary, fontSize: typography.size.md, fontFamily: typography.family.regular },

  actionsModal: { backgroundColor: t.bg.elevated, margin: 20, borderRadius: radius.xl, padding: 20 },
  actionsTitle: { fontSize: typography.size.lg, fontFamily: typography.family.bold, color: t.text.primary, textAlign: 'center' },
  actionsSubtitle: { fontSize: typography.size.sm, color: t.text.secondary, textAlign: 'center', marginBottom: 20, fontFamily: typography.family.regular },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: radius.lg, backgroundColor: t.bg.surface, marginBottom: 10,
  },
  actionButtonText: { fontSize: typography.size.md, fontFamily: typography.family.semibold, color: t.brand.primary },
  actionButtonDanger: { backgroundColor: t.status.errorBg },
  actionButtonTextDanger: { color: t.status.error },
  cancelButton: { padding: 16, alignItems: 'center' },
  cancelButtonText: { fontSize: typography.size.md, color: t.text.secondary, fontFamily: typography.family.regular },
});
```

- [ ] **3.4 Adicionar `useTheme` no componente e instanciar styles**

Dentro de `MembersScreen()`, no início:
```tsx
const { t } = useTheme();
const styles = makeStyles(t);
```

- [ ] **3.5 Atualizar o header da tela**

Localizar:
```tsx
<View style={styles.header}>
  <TouchableOpacity onPress={() => router.back()}>
    <Ionicons name="arrow-back" size={24} color={colors.primary} />
  </TouchableOpacity>
  <View style={styles.headerTitle}>
    <Text style={styles.headerTitleText}>{params.org_unit_name}</Text>
    <Text style={styles.headerSubtitle}>{members.length} membros</Text>
  </View>
  <TouchableOpacity
    onPress={() => router.push(`/channel/${params.org_unit_id}` as any)}
    style={{ backgroundColor: '#EDE9FE', ... }}
  >
    <Text style={{ color: '#7C3AED', ... }}>💬 Canal</Text>
  </TouchableOpacity>
  {permissions?.can_invite && (
    <TouchableOpacity style={styles.inviteButton} onPress={() => setShowInvite(true)}>
      <Ionicons name="person-add" size={20} color={colors.white} />
    </TouchableOpacity>
  )}
</View>
```

Substituir por:
```tsx
<View style={styles.header}>
  <TouchableOpacity onPress={() => router.back()}>
    <Ionicons name="arrow-back" size={24} color={t.brand.primary} />
  </TouchableOpacity>
  <View style={styles.headerTitle}>
    <Text style={styles.headerTitleText}>{params.org_unit_name}</Text>
    <Text style={styles.headerSubtitle}>{members.length} membros</Text>
  </View>
  <TouchableOpacity
    onPress={() => router.push(`/channel/${params.org_unit_id}` as any)}
    style={styles.canalButton}
  >
    <Ionicons name="chatbubble-outline" size={13} color={t.brand.primary} />
    <Text style={styles.canalButtonText}>Canal</Text>
  </TouchableOpacity>
  {permissions?.can_invite && (
    <TouchableOpacity style={styles.inviteButton} onPress={() => setShowInvite(true)}>
      <Ionicons name="person-add" size={20} color={t.text.inverse} />
    </TouchableOpacity>
  )}
</View>
```

- [ ] **3.6 Atualizar section chips e `renderMember`**

Localizar `ListHeaderComponent` na FlatList:
```tsx
ListHeaderComponent={
  coordinators.length > 0 ? (
    <Text style={styles.sectionTitle}>
      ⭐ Coordenadores ({coordinators.length})
    </Text>
  ) : null
}
```

Substituir por (dois chips: um para coordenadores antes da lista, um para membros com separador):

Para implementar a separação de coordenadores e membros com chips de seção entre eles, a abordagem mais limpa com FlatList existente é usar `ListHeaderComponent` para o chip de coordenadores, e adicionar um item separador artificial na lista. Como a lógica já separa `[...coordinators, ...regularMembers]`, adicionar um sentinel:

```tsx
// Dentro do componente, após a lógica existente de separação:
const listData = [
  ...(coordinators.length > 0 ? coordinators : []),
  ...(regularMembers.length > 0 ? [{ __separator: true, user_id: '__sep__' } as any] : []),
  ...regularMembers,
];
```

Atualizar a FlatList:
```tsx
<FlatList
  data={listData}
  renderItem={renderMember}
  keyExtractor={(item) => item.user_id}
  contentContainerStyle={styles.listContent}
  refreshControl={
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      colors={[t.brand.primary]}
    />
  }
  ListHeaderComponent={
    coordinators.length > 0 ? (
      <View style={[styles.sectionChip, styles.sectionChipCoord]}>
        <Text style={[styles.sectionChipText, styles.sectionChipTextCoord]}>Coordenadores</Text>
        <Text style={[styles.sectionChipCount, styles.sectionChipCountCoord]}>{coordinators.length}</Text>
      </View>
    ) : null
  }
  ListEmptyComponent={
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={48} color={t.text.tertiary} />
      <Text style={styles.emptyText}>Nenhum membro encontrado</Text>
    </View>
  }
/>
```

Atualizar `renderMember` para tratar o sentinel e o MemberCard redesenhado:

```tsx
const renderMember = ({ item }: { item: Member | { __separator: boolean; user_id: string } }) => {
  // Separador entre coordenadores e membros
  if ('__separator' in item) {
    return (
      <View style={[styles.sectionChip, styles.sectionChipMember]}>
        <Text style={[styles.sectionChipText, styles.sectionChipTextMember]}>Membros</Text>
        <Text style={[styles.sectionChipCount, styles.sectionChipCountMember]}>{regularMembers.length}</Text>
      </View>
    );
  }

  const member = item as Member;
  const isCoord = member.role === 'COORDINATOR';

  return (
    <TouchableOpacity
      style={styles.memberCard}
      onPress={() => {
        if (permissions?.can_manage_members) {
          setSelectedMember(member);
          setShowMemberActions(true);
        }
      }}
      disabled={!permissions?.can_manage_members}
    >
      <View style={[styles.memberAvatar, isCoord ? styles.memberAvatarCoord : null]}>
        <Text style={styles.avatarText}>
          {member.user_name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{member.user_name}</Text>
        {member.user_email ? (
          <Text style={styles.memberEmailMasked}>{maskEmail(member.user_email)}</Text>
        ) : null}
        <Text style={styles.memberJoined}>
          Desde {formatDate(member.joined_at)}
        </Text>
      </View>

      {isCoord && (
        <View style={styles.coordBadge}>
          <Text style={styles.coordBadgeText}>Coord.</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};
```

- [ ] **3.7 Atualizar os modais de convite, ações e remoção**

**Modal de convite — substituir o input de busca:**

Localizar:
```tsx
<Text style={styles.label}>Buscar usuário</Text>
<TextInput
  style={styles.input}
  placeholder="Digite o nome..."
  value={searchQuery}
  onChangeText={setSearchQuery}
  placeholderTextColor={colors.gray}
/>
```

Substituir por:
```tsx
<Text style={styles.label}>Buscar usuário</Text>
<View style={styles.searchInputWrapper}>
  <Ionicons name="search-outline" size={18} color={t.text.tertiary} />
  <TextInput
    style={styles.searchInput}
    placeholder="Digite o nome..."
    value={searchQuery}
    onChangeText={setSearchQuery}
    placeholderTextColor={t.text.tertiary}
  />
</View>
```

**Modal de ações — atualizar cores:**

No `renderMemberActionsModal`, substituir todos os `colors.*` pelos tokens equivalentes via `styles.*` (já definidos no `makeStyles`).

**Modal de remoção — atualizar texto destrutivo:**

Localizar:
```tsx
<Text style={{ textAlign: 'center', color: '#374151', marginTop: 8, marginBottom: 20, lineHeight: 22 }}>
  Deseja remover{' '}
  <Text style={{ fontWeight: '700' }}>{memberToRemove?.user_name}</Text>
  {' '}de{' '}
  <Text style={{ fontWeight: '700' }}>{params.org_unit_name}</Text>?
  {'\n'}Esta ação não pode ser desfeita.
</Text>
```

Substituir por:
```tsx
<Text style={{ textAlign: 'center', color: t.text.secondary, marginTop: 8, marginBottom: 20, lineHeight: 22, fontFamily: typography.family.regular }}>
  Remover{' '}
  <Text style={{ fontFamily: typography.family.bold, color: t.text.primary }}>{memberToRemove?.user_name}</Text>
  {' '}de{' '}
  <Text style={{ fontFamily: typography.family.bold, color: t.text.primary }}>{params.org_unit_name}</Text>?
</Text>
```

Também atualizar o botão destrutivo do modal de remoção: substituir `colors.error` por `t.status.error` e `colors.white` por `t.text.inverse`.

- [ ] **3.8 Commitar**

```bash
git add lumen_mobile/app/members.tsx
git commit -m "feat(membros): redesign visual CP5 — tokens, section chips, member card, masked email, modais"
```

---

## Task 4: Onboarding Profile — títulos acolhedores + separadores + barra de progresso

**Arquivo:** `lumen_mobile/app/(onboarding)/profile.tsx`

- [ ] **4.1 Adicionar imports**

Localizar os imports existentes e adicionar:
```tsx
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';
import { radius, typography } from '@/theme/tokens';
```

- [ ] **4.2 Substituir mapa de títulos de seção**

As seções atuais usam `sectionTitle` com emoji hardcoded (`📷 Foto de Perfil`, `👤 Dados Pessoais`, etc.). Criar um mapa de títulos acolhedores:

Após os imports, adicionar:
```tsx
// Títulos de seção acolhedores para o onboarding
const ONBOARDING_SECTION_TITLES: Record<string, string> = {
  foto:         'Uma foto sua',
  pessoal:      'Sobre você',
  localizacao:  'Onde você mora',
  comunidade:   'Sua jornada na comunidade',
  realidade:    'Onde você está agora',
  missao:       'Missão',
  ministerio:   'Como você quer servir',
  acomodacao:   'Para cuidar de você',
  extras:       'Últimos detalhes',
};
```

- [ ] **4.3 Adicionar `useTheme` e converter StyleSheet**

No início do componente, adicionar:
```tsx
const { t } = useTheme();
```

Localizar o `StyleSheet.create` ao final do arquivo. A estratégia é a mesma do profile.tsx: converter para `makeStyles(t)`. Mas como esse arquivo é muito extenso, a abordagem mais segura é substituir apenas as propriedades de cor hardcoded no StyleSheet existente por expressões dinâmicas usando `useMemo`:

```tsx
// Após const { t } = useTheme(); no componente:
const colors = {
  primary: t.brand.primary,
  white: t.bg.elevated,
  gray: t.text.secondary,
  bg: t.bg.screen,
  border: t.border.subtle,
  error: t.status.error,
};
```

Dessa forma o código existente que usa `colors.primary`, `colors.white`, etc. funciona sem alterar cada linha. Apenas substituir a constante no topo:

Remover (do topo do arquivo onde existirem):
```tsx
const PRIMARY = '#1A859B';  // ou qualquer variante de cor hardcoded
```

E garantir que o objeto `colors` local dentro do componente use tokens.

- [ ] **4.4 Substituir os `sectionTitle` texts para usar títulos acolhedores**

Localizar cada `<Text style={styles.sectionTitle}>` no JSX. São 8 ocorrências. Substituí-las:

```tsx
// Era:
<Text style={styles.sectionTitle}>📷 Foto de Perfil</Text>
// Vira:
<SectionBlock title={ONBOARDING_SECTION_TITLES.foto} t={t} first />

// Era:
<Text style={styles.sectionTitle}>👤 Dados Pessoais</Text>
// Vira:
<SectionBlock title={ONBOARDING_SECTION_TITLES.pessoal} t={t} />

// Era:
<Text style={styles.sectionTitle}>📍 Localização</Text>
// Vira:
<SectionBlock title={ONBOARDING_SECTION_TITLES.localizacao} t={t} />

// Era:
<Text style={styles.sectionTitle}>⛪ Informações da Comunidade</Text>
// Vira:
<SectionBlock title={ONBOARDING_SECTION_TITLES.comunidade} t={t} />

// Era:
<Text style={styles.sectionTitle}>🌟 Realidade Atual</Text>
// Vira:
<SectionBlock title={ONBOARDING_SECTION_TITLES.realidade} t={t} />

// Era:
<Text style={styles.sectionTitle}>✈️ Missão</Text>
// Vira:
<SectionBlock title={ONBOARDING_SECTION_TITLES.missao} t={t} />

// Era:
<Text style={styles.sectionTitle}>💼 Interesse em Ministério</Text>
// Vira:
<SectionBlock title={ONBOARDING_SECTION_TITLES.ministerio} t={t} />

// Era:
<Text style={styles.sectionTitle}>🛏️ Disponibilidade de Acomodação</Text>
// Vira:
<SectionBlock title={ONBOARDING_SECTION_TITLES.acomodacao} t={t} />

// Era:
<Text style={styles.sectionTitle}>⭐ Informações Extras</Text>
// Vira:
<SectionBlock title={ONBOARDING_SECTION_TITLES.extras} t={t} />
```

Adicionar o componente `SectionBlock` ao final do arquivo (antes do StyleSheet):
```tsx
function SectionBlock({ title, t, first = false }: { title: string; t: SemanticTokens; first?: boolean }) {
  return (
    <View style={{ marginTop: first ? 0 : 32 }}>
      {!first && (
        <View style={{ height: 1, backgroundColor: t.border.subtle, marginBottom: 20 }} />
      )}
      <Text style={{
        fontSize: typography.size.xl,
        fontFamily: typography.family.bold,
        color: t.text.primary,
        marginBottom: 16,
      }}>
        {title}
      </Text>
    </View>
  );
}
```

- [ ] **4.5 Adicionar barra de progresso decorativa no topo do formulário**

Logo após o início do `<ScrollView>` (ou `<KeyboardAvoidingView>`), antes do primeiro `SectionBlock`:

```tsx
{/* Barra de progresso decorativa — não rastreia estado real */}
<View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
  <Text style={{
    fontSize: typography.size.sm,
    color: t.text.secondary,
    fontFamily: typography.family.regular,
    marginBottom: 10,
    textAlign: 'center',
  }}>
    Não se preocupe — você poderá editar depois.
  </Text>
  <View style={{ height: 4, backgroundColor: t.bg.surface, borderRadius: radius.full }}>
    <View style={{
      height: 4, width: '40%',
      backgroundColor: t.brand.primary,
      borderRadius: radius.full,
    }} />
  </View>
</View>
```

O `40%` é um valor fixo decorativo — indica progresso visual sem rastrear estado.

- [ ] **4.6 Commitar**

```bash
git add lumen_mobile/app/\(onboarding\)/profile.tsx
git commit -m "feat(onboarding-perfil): redesign visual CP5 — títulos acolhedores, separadores, barra de progresso"
```

---

## Task 5: Gate semestral — redesign pastoral

**Arquivo:** `lumen_mobile/app/(onboarding)/profile-update.tsx`

- [ ] **5.1 Adicionar imports de `useTheme`**

Localizar os imports:
```tsx
import theme from '@/theme';
```

Adicionar junto:
```tsx
import { useTheme } from '@/theme';
import { radius, typography } from '@/theme/tokens';
```

- [ ] **5.2 Adicionar `useTheme` no componente**

Dentro de `ProfileUpdateScreen()`, no início:
```tsx
const { t } = useTheme();
```

- [ ] **5.3 Redesenhar o header card com tom pastoral**

Localizar:
```tsx
<Card style={styles.headerCard}>
  <Text style={styles.headerTitle}>Atualização Semestral</Text>
  <Text style={styles.headerDescription}>
    Revise seus dados abaixo e confirme para continuar usando o app.
    Esta atualização é obrigatória duas vezes ao ano (13/Jun e 13/Dez).
  </Text>
</Card>
```

Substituir por:
```tsx
<Card style={styles.headerCard}>
  <View style={{ alignItems: 'center', marginBottom: 16 }}>
    <View style={{
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: t.brand.primaryDim,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Ionicons name="heart-circle-outline" size={36} color={t.brand.primary} />
    </View>
  </View>
  <Text style={[styles.headerTitle, { textAlign: 'center' }]}>
    Vamos revisar seus dados?
  </Text>
  <Text style={[styles.headerDescription, { textAlign: 'center' }]}>
    De tempos em tempos revisamos suas informações para cuidar melhor da sua caminhada na comunidade.
  </Text>
</Card>
```

- [ ] **5.4 Atualizar o título do card de resumo**

Localizar:
```tsx
<Text style={styles.summaryTitle}>Seus dados atuais</Text>
```

Substituir por:
```tsx
<Text style={styles.summaryTitle}>Tudo como você deixou?</Text>
```

- [ ] **5.5 Atualizar os botões com tom acolhedor**

Localizar:
```tsx
<Button
  title="Confirmar dados"
  onPress={handleConfirm}
  loading={isConfirming}
  fullWidth
  size="lg"
/>
<Button
  title="Editar perfil"
  onPress={handleEdit}
  variant="ghost"
  fullWidth
  size="md"
  style={styles.editButton}
  disabled={isConfirming}
/>
```

Substituir por:
```tsx
<Button
  title="Confirmar, está tudo certo ✓"
  onPress={handleConfirm}
  loading={isConfirming}
  fullWidth
  size="lg"
/>
<Button
  title="Preciso atualizar algo"
  onPress={handleEdit}
  variant="ghost"
  fullWidth
  size="md"
  style={styles.editButton}
  disabled={isConfirming}
/>
```

- [ ] **5.6 Commitar**

```bash
git add lumen_mobile/app/\(onboarding\)/profile-update.tsx
git commit -m "feat(gate-semestral): redesign visual CP5 — tom pastoral, títulos acolhedores"
```

---

## Task 6: Checkpoint e validação final

- [ ] **6.1 Verificar tsc sem novos erros**

```bash
cd lumen_mobile
node_modules/.bin/tsc --noEmit 2>&1 | grep -v "^$"
# Confirmar que erros de canal são os mesmos pré-existentes
# Nenhum novo erro em profile.tsx, community.tsx, members.tsx, profile-update.tsx
```

- [ ] **6.2 Checklist visual no Expo Web**

Rodar `npx expo start --web` e verificar cada tela:

**Perfil (tabs):**
- [ ] Avatar com anel teal + sombra
- [ ] Faixa de pertencimento com pills (vocational, life_state, missão, despertar) quando preenchidos
- [ ] Status chip verde/âmbar
- [ ] `—` ao invés de "Não informado" nos campos vazios
- [ ] Seções "Retiros e Eventos" e "Contato de Emergência" com shield-checkmark discreto
- [ ] Botão logout sem borda, só texto vermelho
- [ ] Modal de edição: separadores entre blocos + botão "Salvar" no header
- [ ] Dark mode funcional (bg escuro, textos claros)

**Comunidade:**
- [ ] Card com pill de tipo colorido (MINISTERIO=teal, GRUPO=purple, SETOR=blue)
- [ ] "Você seria: Membro" como meta
- [ ] Convidado por com ícone person-outline
- [ ] Botão Recusar ghost, Aceitar primário
- [ ] Estado vazio com texto revisado

**Membros:**
- [ ] Header com cor teal (não navy escuro)
- [ ] Botão Canal com ícone chatbubble-outline
- [ ] Chip "Coordenadores N" em amber antes dos coordenadores
- [ ] Chip "Membros N" em teal antes dos membros
- [ ] Avatar coordenador com anel dourado
- [ ] Email mascarado: `jo***@gmail.com`
- [ ] Badge "Coord." amber para coordenadores
- [ ] Modal de convite com input de busca rounded

**Onboarding profile:**
- [ ] Barra de progresso decorativa no topo
- [ ] Títulos de seção acolhedores (sem emojis, texto humano)
- [ ] Separadores horizontais entre seções

**Gate semestral:**
- [ ] Ícone heart-circle-outline teal centralizado
- [ ] Título "Vamos revisar seus dados?"
- [ ] Texto pastoral sobre cuidado
- [ ] "Tudo como você deixou?" no card de resumo
- [ ] Botão "Confirmar, está tudo certo ✓"

- [ ] **6.3 Salvar checkpoint**

```bash
git add -A
git commit -m "chore(cp5): checkpoint final — perfil, comunidade e membros redesenhados"
```

---

## Notas para o implementador

1. **`makeStyles(t)` chamado múltiplas vezes no JSX:** para evitar recriação a cada render, instanciar uma vez no corpo do componente: `const styles = makeStyles(t);` e usar `styles.*` no JSX.

2. **Sub-componentes `SectionTitle` e `InfoRow` em `profile.tsx`:** recebem `t` como prop. Ao chamar `makeStyles(t)` dentro deles, o resultado é recriado a cada render do sub-componente. Para componentes `memo`, isso é aceitável pois o `t` só muda na troca de tema.

3. **`profile-update.tsx` usa componentes `Button` e `Card` do design system (`@/components`):** não alterar esses componentes. Apenas os textos e o header card são modificados.

4. **Verificar se `Ionicons` está importado** em todos os arquivos antes de adicionar novos ícones.

5. **Bug semântico documentado:** `app/(tabs)/community.tsx` é a tela de convites. Registrado com comentário no topo do arquivo. Não corrigir neste CP.
