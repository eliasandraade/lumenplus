/**
 * Sagradas Escrituras — Seletor de Livros
 * ========================================
 * Lista os 73 livros da Bíblia Católica Ave Maria agrupados por seção.
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import type { SemanticTokens } from '@/theme';
import {
  getTodosOsLivros,
  GRUPOS_AT,
  GRUPOS_NT,
  type Livro,
} from '@/services/bible';

const PRIMARY = '#1A859B';
const GOLD = '#b45309';
const WHITE = '#ffffff';
const GRAY = '#6b7280';
const BG = '#f5f5f5';

const TODOS = getTodosOsLivros();

export default function BibliaScreen() {
  const { t } = useTheme();
  const styles = makeStyles(t);
  const [busca, setBusca] = useState('');

  const livrosFiltrados = busca.trim()
    ? TODOS.filter(l => l.nome.toLowerCase().includes(busca.toLowerCase()))
    : null;

  const abrirLivro = (livro: Livro) => {
    router.push({
      pathname: '/biblia/reader',
      params: { livroIndex: livro.index, capitulo: 1, livroNome: livro.nome },
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Sagradas Escrituras' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Busca */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={t.text.secondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar livro..."
            placeholderTextColor={t.text.tertiary}
            value={busca}
            onChangeText={setBusca}
          />
          {busca ? (
            <TouchableOpacity onPress={() => setBusca('')}>
              <Ionicons name="close-circle" size={18} color={t.text.secondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Resultados de busca */}
        {livrosFiltrados ? (
          <View>
            {livrosFiltrados.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum livro encontrado.</Text>
            ) : (
              livrosFiltrados.map(l => (
                <LivroRow key={l.index} livro={l} onPress={abrirLivro} />
              ))
            )}
          </View>
        ) : (
          <>
            <SecaoTestamento
              label="Antigo Testamento"
              emoji="✡️"
              cor={GOLD}
              grupos={GRUPOS_AT}
              livros={TODOS}
              onSelect={abrirLivro}
            />
            <SecaoTestamento
              label="Novo Testamento"
              emoji="✝️"
              cor={PRIMARY}
              grupos={GRUPOS_NT}
              livros={TODOS}
              onSelect={abrirLivro}
            />
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </>
  );
}

// ─── Seção de testamento com grupos expansíveis ──────────────────────────────

function SecaoTestamento({
  label, emoji, cor, grupos, livros, onSelect,
}: {
  label: string;
  emoji: string;
  cor: string;
  grupos: { label: string; indices: number[] }[];
  livros: Livro[];
  onSelect: (l: Livro) => void;
}) {
  const { t } = useTheme();
  const styles = makeStyles(t);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const toggle = (g: string) =>
    setExpandidos(prev => {
      const n = new Set(prev);
      n.has(g) ? n.delete(g) : n.add(g);
      return n;
    });

  return (
    <View style={styles.secao}>
      <View style={[styles.secaoHeader, { borderLeftColor: cor }]}>
        <Text style={styles.secaoEmoji}>{emoji}</Text>
        <Text style={[styles.secaoLabel, { color: cor }]}>{label}</Text>
      </View>

      {grupos.map(grupo => {
        const aberto = expandidos.has(grupo.label);
        return (
          <View key={grupo.label} style={styles.grupo}>
            <TouchableOpacity
              style={styles.grupoHeader}
              onPress={() => toggle(grupo.label)}
              activeOpacity={0.7}
            >
              <Text style={styles.grupoLabel}>{grupo.label}</Text>
              <View style={styles.grupoRight}>
                <Text style={styles.grupoCount}>{grupo.indices.length} livros</Text>
                <Ionicons
                  name={aberto ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={t.text.secondary}
                />
              </View>
            </TouchableOpacity>

            {aberto && (
              <View style={styles.livrosList}>
                {grupo.indices.map(i => {
                  const l = livros[i];
                  return l ? <LivroRow key={i} livro={l} onPress={onSelect} /> : null;
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Linha de livro ──────────────────────────────────────────────────────────

function LivroRow({ livro, onPress }: { livro: Livro; onPress: (l: Livro) => void }) {
  const { t } = useTheme();
  const styles = makeStyles(t);
  return (
    <TouchableOpacity
      style={styles.livroRow}
      onPress={() => onPress(livro)}
      activeOpacity={0.7}
    >
      <Text style={styles.livroNome}>{livro.nome}</Text>
      <View style={styles.livroRight}>
        <Text style={styles.livroChapters}>{livro.capitulos.length} cap.</Text>
        <Ionicons name="chevron-forward" size={16} color={t.text.secondary} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const makeStyles = (t: SemanticTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg.screen },
  content: { padding: 16 },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.bg.elevated,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: t.border.subtle,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: t.text.primary },

  emptyText: { textAlign: 'center', color: t.text.secondary, marginTop: 20 },

  secao: { marginBottom: 24 },
  secaoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    paddingLeft: 10,
    marginBottom: 12,
  },
  secaoEmoji: { fontSize: 20, marginRight: 8 },
  secaoLabel: { fontSize: 18, fontWeight: '700' },

  grupo: {
    backgroundColor: t.bg.elevated,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: t.border.subtle,
  },
  grupoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  grupoLabel: { fontSize: 15, fontWeight: '600', color: t.text.primary },
  grupoRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grupoCount: { fontSize: 12, color: t.text.secondary },

  livrosList: { borderTopWidth: 1, borderTopColor: t.border.subtle },
  livroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.border.subtle,
  },
  livroNome: { fontSize: 15, color: t.text.primary },
  livroRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  livroChapters: { fontSize: 12, color: t.text.secondary },
});
