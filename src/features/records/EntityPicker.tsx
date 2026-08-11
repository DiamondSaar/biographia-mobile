import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { entityLookup, type EntityResult } from '@/src/api/entities';
import { useTheme } from '@/src/theme/useTheme';

/**
 * Привязка записи к сущности Dominex (объекту, юрлицу) - порт
 * EntityPicker из веб-версии (frontend/src/components/AddRecordForm.jsx:
 * 10-91). По умолчанию показывает только родительские сущности
 * (parentsOnly=true, TZ 7.1/8 - "по умолчанию доступны только
 * родительские; тумблер «показать составные элементы»"), тумблер снимает
 * это ограничение.
 */
export function EntityPicker({
  value,
  onChange,
}: {
  value: EntityResult | null;
  onChange: (entity: EntityResult | null) => void;
}) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntityResult[]>([]);
  const [showComposite, setShowComposite] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    const handle = setTimeout(() => {
      entityLookup(query, !showComposite)
        .then((data) => setResults(data.results || []))
        .catch(() => setResults([]))
        .finally(() => setIsLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, showComposite]);

  if (value) {
    return (
      <View>
        <Text style={styles.label}>Привязано к</Text>
        <View style={styles.selectedCard}>
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedName}>{value.display_name}</Text>
            <Text style={styles.selectedMeta}>
              {value.kind === 'organization' ? 'Юрлицо' : value.template_name} · класс {value.access_class}
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
      <Text style={styles.label}>Привязать к сущности (необязательно)</Text>
      <TextInput
        style={styles.input}
        placeholder="Начните вводить название..."
        value={query}
        onChangeText={setQuery}
      />
      <Pressable style={styles.toggleRow} onPress={() => setShowComposite((v) => !v)}>
        <Ionicons
          name={showComposite ? 'checkbox-outline' : 'square-outline'}
          size={18}
          color={theme.colors.textMuted}
        />
        <Text style={styles.toggleText}>Показать составные элементы</Text>
      </Pressable>

      {isLoading && <ActivityIndicator size="small" color={theme.colors.accent} style={{ marginTop: theme.spacing.sm }} />}

      {!isLoading && results.length > 0 && (
        <View style={styles.resultsBox}>
          {results.map((r) => (
            <Pressable
              key={`${r.kind}-${r.id}`}
              style={styles.resultRow}
              onPress={() => {
                onChange(r);
                setQuery('');
                setResults([]);
              }}>
              <Text style={styles.resultName}>{r.display_name}</Text>
              <Text style={styles.resultMeta}>{r.kind === 'organization' ? 'Юрлицо' : r.template_name}</Text>
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
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      marginTop: theme.spacing.sm,
    },
    toggleText: {
      fontSize: 13,
      color: theme.colors.textMuted,
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
    resultName: {
      fontSize: 14,
      color: theme.colors.text,
    },
    resultMeta: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    selectedCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
    },
    selectedInfo: {
      flex: 1,
    },
    selectedName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    selectedMeta: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    removeText: {
      fontSize: 13,
      color: theme.colors.accent,
      fontWeight: '600',
    },
  });
}
