# CP6 — Design System Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all remaining screens (Admin, Coordinator, Auth residual, Onboarding residual) to `useTheme()` + `makeStyles(t)`, achieving 100% dark/light mode consistency across the entire Lumen+ app.

**Architecture:** Each file currently defines a local `const colors = { ... }` object with hardcoded hex values. We replace this with `const t = useTheme()` inside the component and move all `StyleSheet.create(...)` to `makeStyles(t => ({ ... }))` at the bottom of the file, referencing `t.bg.screen`, `t.text.primary`, `t.border.subtle`, etc. from the semantic tokens. No functional logic is touched.

**Tech Stack:** React Native, Expo Router, `@/theme` (`useTheme`, `makeStyles`, `SemanticTokens`), Ionicons, TypeScript.

---

## The Migration Pattern

Every task in this plan follows the same mechanical pattern. Read this once before starting.

### Before (legacy pattern)
```tsx
const colors = {
  primary: '#1A859B',
  white: '#ffffff',
  background: '#f3f4f6',
  // ...
};

export default function MyScreen() {
  // ...
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background },
  title: { color: colors.primary },
});
```

### After (Design System pattern)
```tsx
import { useTheme, makeStyles } from '@/theme';
import type { SemanticTokens } from '@/theme';

export default function MyScreen() {
  const t = useTheme();
  const styles = useStyles(t);
  // ...
  return <View style={styles.container} />;
}

const useStyles = makeStyles((t: SemanticTokens) => ({
  container: { backgroundColor: t.bg.screen },
  title: { color: t.text.primary },
}));
```

### Semantic Token Map (reference for all tasks)

| Old hardcoded color | Semantic token |
|---|---|
| `#ffffff` / white background | `t.bg.screen` |
| `#f3f4f6` / light gray bg | `t.bg.elevated` |
| `#E8E8E8` / `#e5e7eb` border | `t.border.subtle` |
| `#171717` / `#0f172a` dark text | `t.text.primary` |
| `#6b7280` gray text | `t.text.muted` |
| `#1A859B` teal primary | `t.action.primary` |
| `#7c3aed` purple admin | `t.accent.purple` (or hardcode as brand color — admin-only, acceptable) |
| `#059669` green coord | `t.accent.emerald` (or hardcode as brand color — coord-only, acceptable) |
| `#ef4444` error red | `t.status.error` |
| `#22c55e` success green | `t.status.success` |
| `#f59e0b` warning amber | `t.status.warning` |
| `rgba(0,0,0,0.5)` overlay | `t.bg.overlay` |

**Note on admin/coord brand colors:** `#7c3aed` (admin purple) and `#059669` (coordinator green) are role identity colors that intentionally don't change with theme. Keep them as constants. Only migrate backgrounds, text, borders to semantic tokens.

### How to check current tokens
```
lumen_mobile/src/theme/tokens.ts  — all semantic token names
lumen_mobile/src/theme/index.ts   — exports (makeStyles, useTheme, SemanticTokens)
```

---

## File Map — 23 Files to Migrate

### Admin (16 files)
| File | Lines | Priority |
|---|---|---|
| `lumen_mobile/app/admin/_layout.tsx` | ~40 | Low |
| `lumen_mobile/app/admin/index.tsx` | ~120 | High |
| `lumen_mobile/app/admin/dashboard.tsx` | 805 | High |
| `lumen_mobile/app/admin/create-aviso.tsx` | 758 | High |
| `lumen_mobile/app/admin/sent-avisos.tsx` | 285 | Medium |
| `lumen_mobile/app/admin/audit-logs.tsx` | 411 | Medium |
| `lumen_mobile/app/admin/approvals/index.tsx` | 184 | Medium |
| `lumen_mobile/app/admin/entities/_layout.tsx` | ~30 | Low |
| `lumen_mobile/app/admin/entities/index.tsx` | 1504 | High |
| `lumen_mobile/app/admin/users/_layout.tsx` | ~30 | Low |
| `lumen_mobile/app/admin/users/index.tsx` | 761 | High |
| `lumen_mobile/app/admin/users/[id].tsx` | 263 | Medium |
| `lumen_mobile/app/admin/users/export.tsx` | ~100 | Low |
| `lumen_mobile/app/admin/retreats/index.tsx` | 174 | Medium |
| `lumen_mobile/app/admin/retreats/[id].tsx` | 1717 | High |
| `lumen_mobile/app/admin/retreats/create.tsx` | 231 | Medium |

### Coordinator (2 files)
| File | Lines | Priority |
|---|---|---|
| `lumen_mobile/app/coordinator/_layout.tsx` | ~30 | Low |
| `lumen_mobile/app/coordinator/index.tsx` | 340 | Medium |

### Auth residual (2 files)
| File | Lines | Priority |
|---|---|---|
| `lumen_mobile/app/(auth)/verify-email.tsx` | ~180 | Medium |
| `lumen_mobile/app/(auth)/verify-phone.tsx` | ~180 | Medium |

### Onboarding residual (3 files)
| File | Lines | Priority |
|---|---|---|
| `lumen_mobile/app/(onboarding)/verify-phone.tsx` | ~150 | Medium |
| `lumen_mobile/app/(onboarding)/terms.tsx` | ~300 | Medium |
| `lumen_mobile/app/(onboarding)/complete-documents.tsx` | ~250 | Medium |

---

## Task 1: Admin Layout Files (Low-complexity warmup)

**Files:**
- Modify: `lumen_mobile/app/admin/_layout.tsx`
- Modify: `lumen_mobile/app/admin/entities/_layout.tsx`
- Modify: `lumen_mobile/app/admin/users/_layout.tsx`
- Modify: `lumen_mobile/app/coordinator/_layout.tsx`

Layout files typically use `Stack` from expo-router. They usually have no StyleSheet at all, or a trivial one.

- [ ] **Step 1: Read all 4 layout files**

```bash
cat lumen_mobile/app/admin/_layout.tsx
cat lumen_mobile/app/admin/entities/_layout.tsx
cat lumen_mobile/app/admin/users/_layout.tsx
cat lumen_mobile/app/coordinator/_layout.tsx
```

- [ ] **Step 2: Migrate `admin/_layout.tsx`**

For each layout file, if it contains a `Stack.Screen` with hardcoded `headerStyle`, replace with theme tokens. Pattern:

```tsx
import { useTheme } from '@/theme';

export default function AdminLayout() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.bg.screen },
        headerTintColor: t.text.primary,
        headerTitleStyle: { fontFamily: 'Nunito_700Bold', color: t.text.primary },
      }}
    />
  );
}
```

If the file has no colors at all, skip it (no migration needed).

- [ ] **Step 3: Apply same pattern to the other 3 layout files**

Repeat step 2 for `entities/_layout.tsx`, `users/_layout.tsx`, and `coordinator/_layout.tsx`.

- [ ] **Step 4: Typecheck**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | head -40
```

Expected: no new errors (pre-existing errors are acceptable — compare against the 4 pre-existing errors documented in CP5 report).

- [ ] **Step 5: Commit**

```bash
git add lumen_mobile/app/admin/_layout.tsx lumen_mobile/app/admin/entities/_layout.tsx lumen_mobile/app/admin/users/_layout.tsx lumen_mobile/app/coordinator/_layout.tsx
git commit -m "feat(admin-coord): migrar layouts para useTheme — dark/light mode"
```

---

## Task 2: Admin Index + Coordinator Index (Menu screens)

**Files:**
- Modify: `lumen_mobile/app/admin/index.tsx`
- Modify: `lumen_mobile/app/coordinator/index.tsx`

These are menu/list screens with simple card layouts. Medium complexity.

- [ ] **Step 1: Read both files completely**

```bash
cat lumen_mobile/app/admin/index.tsx
cat lumen_mobile/app/coordinator/index.tsx
```

- [ ] **Step 2: Migrate `admin/index.tsx`**

1. Remove the top-level `const colors = { ... }` block.
2. Add imports at the top of the file:
   ```tsx
   import { useTheme, makeStyles } from '@/theme';
   import type { SemanticTokens } from '@/theme';
   ```
3. Inside `AdminMenuScreen` (the default export component), add as first lines:
   ```tsx
   const t = useTheme();
   const styles = useStyles(t);
   ```
4. Move `StyleSheet.create({ ... })` to the bottom of the file and convert to `makeStyles`:
   ```tsx
   const useStyles = makeStyles((t: SemanticTokens) => ({
     container: { flex: 1, backgroundColor: t.bg.screen },
     section: { marginBottom: 24 },
     sectionTitle: { fontSize: 13, fontFamily: 'Nunito_700Bold', color: t.text.muted, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 16, marginBottom: 8 },
     card: { backgroundColor: t.bg.elevated, borderRadius: 12, marginHorizontal: 16, marginBottom: 8, overflow: 'hidden', borderWidth: 1, borderColor: t.border.subtle },
     cardRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
     iconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
     cardTitle: { fontSize: 15, fontFamily: 'Nunito_700Bold', color: t.text.primary },
     cardDesc: { fontSize: 13, color: t.text.muted, marginTop: 2 },
     chevron: { marginLeft: 'auto' },
   }));
   ```
   Adjust the exact style values to match what was already there — only swap the color references.

   Keep `admin` purple (`#7c3aed`) as a constant for the icon background:
   ```tsx
   const ADMIN_COLOR = '#7c3aed';
   const ADMIN_COLOR_LIGHT = 'rgba(124, 58, 237, 0.12)';
   ```

- [ ] **Step 3: Migrate `coordinator/index.tsx`**

Same mechanical steps as above. Keep coordinator green as a constant:
```tsx
const COORD_COLOR = '#059669';
const COORD_COLOR_LIGHT = 'rgba(5, 150, 105, 0.10)';
```

Replace all other color references with semantic tokens per the token map above.

- [ ] **Step 4: Typecheck**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 5: Commit**

```bash
git add lumen_mobile/app/admin/index.tsx lumen_mobile/app/coordinator/index.tsx
git commit -m "feat(admin-coord): migrar menu screens para makeStyles(t) — dark/light mode"
```

---

## Task 3: Admin Dashboard

**Files:**
- Modify: `lumen_mobile/app/admin/dashboard.tsx` (805 lines)

This is a metrics/charts screen with many custom-styled elements.

- [ ] **Step 1: Read the file**

```bash
cat lumen_mobile/app/admin/dashboard.tsx
```

- [ ] **Step 2: Identify the `colors` const block**

It starts at the top of the file. Note every key and its usage.

- [ ] **Step 3: Add imports and migrate**

1. Remove `const colors = { ... }` at the top.
2. Add:
   ```tsx
   import { useTheme, makeStyles } from '@/theme';
   import type { SemanticTokens } from '@/theme';
   ```
3. In the default export component, add:
   ```tsx
   const t = useTheme();
   const styles = useStyles(t);
   ```
4. The `colors.admin` (`#7c3aed`) is used for admin-specific accent (header, badges). Keep it as a file-level constant:
   ```tsx
   const ADMIN_COLOR = '#7c3aed';
   ```
5. Replace all other `colors.*` references in JSX inline styles with `t.*` tokens directly (not via styles object):
   - `colors.primary` → `t.action.primary`
   - `colors.white` → `t.bg.screen`
   - `colors.background` → `t.bg.elevated`
   - `colors.border` → `t.border.subtle`
   - `colors.text` → `t.text.primary`
   - `colors.textMuted` → `t.text.muted`
   - `colors.barBg` → `t.border.subtle`
   - `colors.success` → `t.status.success`
   - `colors.warning` → `t.status.warning`
   - `colors.error` → `t.status.error`
6. Convert `StyleSheet.create({ ... })` to `makeStyles` at the bottom.

- [ ] **Step 4: Check for sub-components**

If `dashboard.tsx` defines internal components (e.g. `StatCard`, `BarRow`), each needs `t` passed as a prop or they need their own `useTheme()` call. Prefer passing `t` as prop to avoid multiple hook calls:

```tsx
function StatCard({ t, label, value }: { t: SemanticTokens; label: string; value: string }) {
  return (
    <View style={{ backgroundColor: t.bg.elevated, borderRadius: 12, padding: 16 }}>
      <Text style={{ color: t.text.muted }}>{label}</Text>
      <Text style={{ color: t.text.primary, fontFamily: 'Nunito_700Bold' }}>{value}</Text>
    </View>
  );
}
```

- [ ] **Step 5: Typecheck**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 6: Commit**

```bash
git add lumen_mobile/app/admin/dashboard.tsx
git commit -m "feat(admin): migrar dashboard para makeStyles(t) — dark/light mode"
```

---

## Task 4: Admin Users Module

**Files:**
- Modify: `lumen_mobile/app/admin/users/index.tsx` (761 lines)
- Modify: `lumen_mobile/app/admin/users/[id].tsx` (263 lines)
- Modify: `lumen_mobile/app/admin/users/export.tsx`

- [ ] **Step 1: Read all 3 files**

```bash
cat lumen_mobile/app/admin/users/index.tsx
cat "lumen_mobile/app/admin/users/[id].tsx"
cat lumen_mobile/app/admin/users/export.tsx
```

- [ ] **Step 2: Migrate `users/index.tsx`**

Follow the standard migration pattern. Key mappings for this file:
- User list backgrounds → `t.bg.elevated`
- Role badge backgrounds — keep role-specific colors (admin purple, coord green, etc.) as constants since they're semantic role identifiers
- Search input background → `t.bg.surface`
- Dividers → `t.border.subtle`

```tsx
// Keep role identity colors as constants
const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#7c3aed',
  DEV: '#3b82f6',
  ANALISTA: '#f59e0b',
  COORD: '#059669',
  MEMBRO: '#1A859B',
};
```

- [ ] **Step 3: Migrate `users/[id].tsx`**

Same pattern. User detail screen — backgrounds, text, borders all use semantic tokens.

- [ ] **Step 4: Migrate `users/export.tsx`**

Same pattern. Usually a simpler screen.

- [ ] **Step 5: Typecheck**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 6: Commit**

```bash
git add lumen_mobile/app/admin/users/index.tsx "lumen_mobile/app/admin/users/[id].tsx" lumen_mobile/app/admin/users/export.tsx
git commit -m "feat(admin): migrar users module para makeStyles(t) — dark/light mode"
```

---

## Task 5: Admin Retreats Module

**Files:**
- Modify: `lumen_mobile/app/admin/retreats/index.tsx` (174 lines)
- Modify: `lumen_mobile/app/admin/retreats/[id].tsx` (1717 lines)
- Modify: `lumen_mobile/app/admin/retreats/create.tsx` (231 lines)

The admin retreats `[id].tsx` is the largest file in the migration (1717 lines). It likely contains sub-components.

- [ ] **Step 1: Read all 3 files**

```bash
cat lumen_mobile/app/admin/retreats/index.tsx
cat "lumen_mobile/app/admin/retreats/[id].tsx"
cat lumen_mobile/app/admin/retreats/create.tsx
```

- [ ] **Step 2: Migrate `retreats/index.tsx`**

Standard pattern. Small file.

- [ ] **Step 3: Migrate `retreats/create.tsx`**

Standard pattern. Form screen — inputs, labels, buttons.

Key: form input backgrounds → `t.bg.surface`, input border → `t.border.default`, placeholder text → `t.text.placeholder`.

Check if `SemanticTokens` has `t.text.placeholder` — if not, use `t.text.muted`.

- [ ] **Step 4: Migrate `retreats/[id].tsx`**

This is large. Strategy:
1. Identify all sub-components defined in the file (look for `function ` or `const X = (` patterns after the main export).
2. For sub-components that receive props but need colors, pass `t: SemanticTokens` as a prop from the parent.
3. Migrate the single `StyleSheet.create` at the bottom to `makeStyles`.
4. Replace all `colors.*` inline references throughout.

Sub-component pattern:
```tsx
function RegistrationCard({ reg, t }: { reg: Registration; t: SemanticTokens }) {
  return (
    <View style={{ backgroundColor: t.bg.elevated, borderRadius: 12 }}>
      ...
    </View>
  );
}

// In parent:
const t = useTheme();
// Pass to sub-components:
<RegistrationCard reg={reg} t={t} />
```

- [ ] **Step 5: Typecheck**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 6: Commit**

```bash
git add lumen_mobile/app/admin/retreats/index.tsx "lumen_mobile/app/admin/retreats/[id].tsx" lumen_mobile/app/admin/retreats/create.tsx
git commit -m "feat(admin): migrar retreats module para makeStyles(t) — dark/light mode"
```

---

## Task 6: Admin Entities Module

**Files:**
- Modify: `lumen_mobile/app/admin/entities/index.tsx` (1504 lines)

The second-largest file. Org unit management — tree structure, forms, modals.

- [ ] **Step 1: Read the file**

```bash
cat lumen_mobile/app/admin/entities/index.tsx
```

- [ ] **Step 2: Map sub-components**

Look for internal components in the file. List them. For each one, determine if it already calls `useTheme()` or needs `t` passed as prop.

- [ ] **Step 3: Migrate**

Standard pattern. Specific notes:
- Entity type colors (CONSELHO_GERAL, SETOR, etc.) may have their own color coding — keep those as constants since they're semantic identifiers.
- Modal backgrounds → `t.bg.elevated`
- Tree connector lines → `t.border.subtle`
- Form inputs → standard input token pattern

- [ ] **Step 4: Typecheck**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 5: Commit**

```bash
git add lumen_mobile/app/admin/entities/index.tsx
git commit -m "feat(admin): migrar entities module para makeStyles(t) — dark/light mode"
```

---

## Task 7: Admin Communications (Avisos)

**Files:**
- Modify: `lumen_mobile/app/admin/create-aviso.tsx` (758 lines)
- Modify: `lumen_mobile/app/admin/sent-avisos.tsx` (285 lines)
- Modify: `lumen_mobile/app/admin/audit-logs.tsx` (411 lines)
- Modify: `lumen_mobile/app/admin/approvals/index.tsx` (184 lines)

- [ ] **Step 1: Read all 4 files**

```bash
cat lumen_mobile/app/admin/create-aviso.tsx
cat lumen_mobile/app/admin/sent-avisos.tsx
cat lumen_mobile/app/admin/audit-logs.tsx
cat lumen_mobile/app/admin/approvals/index.tsx
```

- [ ] **Step 2: Migrate `create-aviso.tsx`**

Form screen with rich text or targeting options. Standard pattern.
- Audience type badges/chips may have their own colors — keep as constants.
- Form elements → standard token pattern.

- [ ] **Step 3: Migrate `sent-avisos.tsx`**

List screen. Standard pattern.

- [ ] **Step 4: Migrate `audit-logs.tsx`**

Log list with status colors. Keep status-specific colors (error=red, success=green, info=blue) as semantic tokens from the theme (`t.status.error`, `t.status.success`, `t.status.info`).

- [ ] **Step 5: Migrate `approvals/index.tsx`**

Standard pattern. Approval status colors → `t.status.*`.

- [ ] **Step 6: Typecheck**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 7: Commit**

```bash
git add lumen_mobile/app/admin/create-aviso.tsx lumen_mobile/app/admin/sent-avisos.tsx lumen_mobile/app/admin/audit-logs.tsx lumen_mobile/app/admin/approvals/index.tsx
git commit -m "feat(admin): migrar avisos, audit-logs, approvals para makeStyles(t)"
```

---

## Task 8: Auth Residual Flows

**Files:**
- Modify: `lumen_mobile/app/(auth)/verify-email.tsx`
- Modify: `lumen_mobile/app/(auth)/verify-phone.tsx`

- [ ] **Step 1: Read both files**

```bash
cat "lumen_mobile/app/(auth)/verify-email.tsx"
cat "lumen_mobile/app/(auth)/verify-phone.tsx"
```

- [ ] **Step 2: Migrate `verify-email.tsx`**

Standard pattern. This screen likely has:
- A large centered icon/illustration area → `t.bg.screen`
- Input for token code → `t.bg.surface`, `t.border.default`
- Dev debug panel (yellow background) → keep hardcoded `#fefce8` / `#fde047` since it's a dev-only UI element

```tsx
// Dev panel uses intentionally visible warning color — keep hardcoded
const DEV_BG = '#fefce8';
const DEV_BORDER = '#fde047';
```

- [ ] **Step 3: Migrate `verify-phone.tsx`**

Same pattern as verify-email.

- [ ] **Step 4: Typecheck**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 5: Commit**

```bash
git add "lumen_mobile/app/(auth)/verify-email.tsx" "lumen_mobile/app/(auth)/verify-phone.tsx"
git commit -m "feat(auth): migrar verify-email e verify-phone para makeStyles(t)"
```

---

## Task 9: Onboarding Residual Flows

**Files:**
- Modify: `lumen_mobile/app/(onboarding)/verify-phone.tsx`
- Modify: `lumen_mobile/app/(onboarding)/terms.tsx`
- Modify: `lumen_mobile/app/(onboarding)/complete-documents.tsx`

- [ ] **Step 1: Read all 3 files**

```bash
cat "lumen_mobile/app/(onboarding)/verify-phone.tsx"
cat "lumen_mobile/app/(onboarding)/terms.tsx"
cat "lumen_mobile/app/(onboarding)/complete-documents.tsx"
```

- [ ] **Step 2: Migrate `verify-phone.tsx`**

Standard pattern. Similar to auth verify-phone.

- [ ] **Step 3: Migrate `terms.tsx`**

This screen uses `theme` import (old pattern: `import theme from '@/theme'`). Replace:
- `import theme from '@/theme'` → `import { useTheme, makeStyles } from '@/theme'`
- `theme.colors.*` references → `t.*` from semantic tokens
- The `Checkbox` sub-component defined inline needs `t` passed as prop or its own `useTheme()` call.

`Checkbox` inline component:
```tsx
function Checkbox({ checked, onPress, label, t }: { checked: boolean; onPress: () => void; label: string; t: SemanticTokens }) {
  return (
    <Pressable style={styles(t).checkboxRow} onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles(t).checkboxBox, checked && styles(t).checkboxBoxChecked]}>
        {checked && <Text style={styles(t).checkboxTick}>✓</Text>}
      </View>
      <Text style={styles(t).checkboxLabel}>{label}</Text>
    </Pressable>
  );
}
```

Or simpler — use inline styles inside `Checkbox` with a `useTheme()` call since it's a self-contained mini-component:
```tsx
function Checkbox({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: checked ? t.action.primary : t.border.default, backgroundColor: checked ? t.action.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {checked && <Text style={{ color: t.bg.screen, fontSize: 13 }}>✓</Text>}
      </View>
      <Text style={{ flex: 1, color: t.text.primary, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 4: Migrate `complete-documents.tsx`**

Standard pattern. Document upload form — file picker areas, status indicators.

- [ ] **Step 5: Typecheck**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 6: Commit**

```bash
git add "lumen_mobile/app/(onboarding)/verify-phone.tsx" "lumen_mobile/app/(onboarding)/terms.tsx" "lumen_mobile/app/(onboarding)/complete-documents.tsx"
git commit -m "feat(onboarding): migrar verify-phone, terms, complete-documents para makeStyles(t)"
```

---

## Task 10: Final Typecheck + Audit

**Files:** No code changes — validation only.

- [ ] **Step 1: Full TypeScript check**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1
```

Classify output:
- **Pre-existing errors (CP5 report):** `(onboarding)/profile.tsx:459`, `(tabs)/profile.tsx:390`, `(tabs)/service.tsx:289-290`, `retreats/[id].tsx:247`
- **New errors introduced by CP6:** anything not in the list above → must fix before completing

- [ ] **Step 2: Grep for remaining hardcoded colors in migrated files**

```bash
grep -rn "const colors" lumen_mobile/app/admin/ lumen_mobile/app/coordinator/ "lumen_mobile/app/(auth)/verify-" "lumen_mobile/app/(onboarding)/"
```

Expected: empty output (no remaining `const colors` blocks).

- [ ] **Step 3: Grep for remaining `StyleSheet.create` in migrated files**

```bash
grep -rn "StyleSheet.create" lumen_mobile/app/admin/ lumen_mobile/app/coordinator/ "lumen_mobile/app/(auth)/verify-" "lumen_mobile/app/(onboarding)/"
```

Expected: empty output (all converted to `makeStyles`).

- [ ] **Step 4: Grep for any remaining hardcoded color hex in migrated files (not counting approved constants)**

```bash
grep -rn "'#[0-9a-fA-F]\{6\}'" lumen_mobile/app/admin/ lumen_mobile/app/coordinator/ "lumen_mobile/app/(auth)/verify-" "lumen_mobile/app/(onboarding)/" | grep -v "ADMIN_COLOR\|COORD_COLOR\|ROLE_COLOR\|DEV_BG\|DEV_BORDER"
```

Review any results — if they're role/brand/status identity colors used intentionally, add them to the approved-constants comment in the file. If they're accidental leaks, fix them.

- [ ] **Step 5: Commit audit results**

If any fixes were made in this step:
```bash
git add -p
git commit -m "fix(cp6): corrigir cores hardcoded residuais pós-auditoria"
```

If no changes needed:
No commit needed.

---

## Task 11: CP6 Final Report

**Files:**
- Create: `docs/superpowers/plans/2026-06-05-cp6-final-report.md`

- [ ] **Step 1: Run final typecheck and capture output**

```bash
cd lumen_mobile && npx tsc --noEmit 2>&1
```

- [ ] **Step 2: Count migrated files**

```bash
grep -rl "makeStyles\|useTheme" lumen_mobile/app/admin/ lumen_mobile/app/coordinator/ "lumen_mobile/app/(auth)/" "lumen_mobile/app/(onboarding)/" | wc -l
```

- [ ] **Step 3: Write the final report**

Create `docs/superpowers/plans/2026-06-05-cp6-final-report.md` with:
- Commits list (from `git log --oneline` for CP6 commits)
- Files migrated (23 files)
- TypeScript errors: new vs pre-existing
- Remaining hardcoded colors (approved constants only)
- Dark mode coverage: list of all screens now covered
- QA checklist (same format as CP5 report)
- Release recommendation: "Release Candidate" or "needs CP7"

- [ ] **Step 4: Commit report**

```bash
git add docs/superpowers/plans/2026-06-05-cp6-final-report.md
git commit -m "docs(cp6): relatório final — consolidação visual completa"
```

---

## Risks

| Risk | Mitigation |
|---|---|
| `makeStyles` not exported from `@/theme` | Check `lumen_mobile/src/theme/index.ts` exports before starting; if not exported, add it |
| `SemanticTokens` type missing some tokens (e.g. `t.status.*`, `t.accent.*`) | Check `tokens.ts` before using; fall back to `t.text.muted` or keep as approved constant |
| Admin/coord screens crash in dark mode due to wrong contrast | Test each module on web dark mode after each task |
| `terms.tsx` uses old `import theme from '@/theme'` (not `useTheme`) | Handled explicitly in Task 9 — read old import pattern and replace |
| Sub-components in large files don't receive `t` | Handled by explicit sub-component prop pattern in Tasks 3, 5, 6 |
| TypeScript errors from adding `t: SemanticTokens` props to sub-components | Use `import type { SemanticTokens } from '@/theme'` to avoid value import |

---

## Effort Estimate

| Task | Files | Complexity | Est. Time |
|---|---|---|---|
| Task 1: Layout files | 4 | Low | 20 min |
| Task 2: Admin + Coord index | 2 | Medium | 30 min |
| Task 3: Admin Dashboard | 1 | High | 45 min |
| Task 4: Admin Users | 3 | Medium-High | 45 min |
| Task 5: Admin Retreats | 3 | High | 60 min |
| Task 6: Admin Entities | 1 | High | 60 min |
| Task 7: Admin Avisos | 4 | Medium | 40 min |
| Task 8: Auth residual | 2 | Medium | 25 min |
| Task 9: Onboarding residual | 3 | Medium | 35 min |
| Task 10: Audit | 0 | Low | 15 min |
| Task 11: Report | 1 | Low | 15 min |
| **Total** | **23+1** | — | **~6h** |

---

## Success Criteria

CP6 is complete when all of the following are true:

1. `grep -rn "const colors" lumen_mobile/app/` returns zero results outside of approved files.
2. `npx tsc --noEmit` shows zero errors beyond the 4 pre-existing ones documented in CP5.
3. Dark mode toggle in browser shows no white-background screens in admin, coordinator, or auth flows.
4. The app visually feels like one product — no module looks like "another app."
5. Final report recommends Release Candidate.
