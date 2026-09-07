import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/src/api/client';
import { userLookup, type UserResult } from '@/src/api/entities';
import { useTheme } from '@/src/theme/useTheme';

/**
 * Поиск по автору (Dominex Users) - для фильтра поиска Вики
 * (RecordsFeed.tsx). Тот же принцип "чип выбранного/поиск иначе", что и
 * DominexLookupPicker в EntityPicker.tsx, но результаты пользователей
 * имеют другую форму (username вместо numeric id, нет kind/access_class) -
 * отдельный компонент, не через DominexLookupPicker. Порт веб-версии
 * (frontend/src/components/DominexPickers.jsx::AuthorPicker).
 */
export function AuthorPicker({ value, onChange }: { value: UserResult | null; onChange: (user: UserResult | null) => void }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const handle = setTimeout(() => {
      userLookup(query)
        .then((data) => {
          setResults(data.results || []);
          setError(null);
        })
        .catch((err) => {
          setResults([]);
          setError(err instanceof ApiError ? err.message : 'Не удалось выполнить поиск.');
        })
        .finally(() => setIsLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  if (value) {
    return (
      <View>
        <Text style={styles.label}>Автор</Text>
        <View style={styles.selectedCard}>
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedName}>{value.display_name || value.username}</Text>
            <Text style={styles.selectedMeta}>
              {value.username}
              {value.organization ? ` · ${value.organization}` : ''}
            </Text>
          </View>
          <Pressable onPress={() => onChange(null)}>
            <Text style={styles.removeText}>Убрать</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.label}>Автор</Text>
      <TextInput style={styles.input} placeholder="Начните вводить имя или логин..." value={query} onChangeText={setQuery} />

      {isLoading && <ActivityIndicator size="small" color={theme.colors.accent} style={{ marginTop: theme.spacing.sm }} />}

      {!isLoading && error && <Text style={styles.errorText}>{error}</Text>}

      {!isLoading && !error && query.trim() && results.length === 0 && (
        <Text style={styles.emptyText}>Ничего не найдено.</Text>
      )}

      {!isLoading && results.length > 0 && (
        <View style={styles.resultsBox}>
          {results.map((u) => (
            <Pressable
              key={u.username}
              style={styles.resultRow}
              onPress={() => {
                onChange(u);
                setQuery('');
                setResults([]);
              }}>
              <Text style={styles.resultName}>{u.display_name || u.username}</Text>
              <Text style={styles.resultMeta}>
                {u.username}
                {u.organization ? ` · ${u.organization}` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    label: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
      marginTop: theme.spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      fontSize: 15,
      color: theme.colors.text,
    },
    resultsBox: {
      marginTop: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      overflow: 'hidden',
    },
    resultRow: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    resultName: { fontSize: 14, color: theme.colors.text },
    resultMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
    errorText: { marginTop: theme.spacing.sm, fontSize: 13, color: theme.colors.danger },
    emptyText: { marginTop: theme.spacing.sm, fontSize: 13, color: theme.colors.textMuted },
    selectedCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
    },
    selectedInfo: { flex: 1 },
    selectedName: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
    selectedMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
    removeText: { fontSize: 13, color: theme.colors.accent, fontWeight: '600' },
  });
}
