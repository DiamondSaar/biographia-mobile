import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ApiError } from '@/src/api/client';
import { entityLookup, organizationLookup, type EntityResult } from '@/src/api/entities';
import { useTheme } from '@/src/theme/useTheme';

type PickerProps = {
  value: EntityResult | null;
  onChange: (entity: EntityResult | null) => void;
  label: string;
  attachedLabel: string;
  search: (query: string, showComposite: boolean) => Promise<{ results: EntityResult[] }>;
  showCompositeToggle: boolean;
  describeResult: (r: EntityResult) => string;
};

/**
 * Общий поиск-по-мере-набора против Dominex - порт DominexLookupPicker из
 * веб-версии (frontend/src/components/AddRecordForm.jsx). Используется и
 * "Привязать к сущности" (сущности+юрлица вперемешку), и отдельным полем
 * "Юрлицо" (только организации, по запросу пользователя - раньше юрлицо
 * можно было прикрепить только через общий пикер, что не позволяло
 * одновременно указать и сущность, и юрлицо на одной записи).
 */
function DominexLookupPicker({ value, onChange, label, attachedLabel, search, showCompositeToggle, describeResult }: PickerProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntityResult[]>([]);
  const [showComposite, setShowComposite] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }
    setIsLoading(true);
    const handle = setTimeout(() => {
      search(query, showComposite)
        .then((data) => {
          setResults(data.results || []);
          setError(null);
        })
        .catch((err) => {
          // Раньше ошибка молча проглатывалась - список результатов просто
          // оставался пустым без единого объяснения, будто у Dominex нет
          // ни одной подходящей сущности. Теперь видно, что именно не так
          // (сеть, недоступность Dominex и т.п.), тем же принципом, что
          // и describeUploadError в attachmentUpload.ts.
          setResults([]);
          setError(err instanceof ApiError ? err.message : 'Не удалось выполнить поиск.');
        })
        .finally(() => setIsLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, showComposite]);

  if (value) {
    return (
      <View>
        <Text style={styles.label}>{attachedLabel}</Text>
        <View style={styles.selectedCard}>
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedName}>{value.display_name}</Text>
            <Text style={styles.selectedMeta}>{describeResult(value)}</Text>
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
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder="Начните вводить название..."
        value={query}
        onChangeText={setQuery}
      />
      {showCompositeToggle && (
        <Pressable style={styles.toggleRow} onPress={() => setShowComposite((v) => !v)}>
          <Ionicons
            name={showComposite ? 'checkbox-outline' : 'square-outline'}
            size={18}
            color={theme.colors.textMuted}
          />
          <Text style={styles.toggleText}>Показать составные элементы</Text>
        </Pressable>
      )}

      {isLoading && <ActivityIndicator size="small" color={theme.colors.accent} style={{ marginTop: theme.spacing.sm }} />}

      {!isLoading && error && <Text style={styles.errorText}>{error}</Text>}

      {!isLoading && !error && query.trim() && results.length === 0 && (
        <Text style={styles.emptyText}>Ничего не найдено.</Text>
      )}

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

export function EntityPicker({ value, onChange }: { value: EntityResult | null; onChange: (entity: EntityResult | null) => void }) {
  return (
    <DominexLookupPicker
      value={value}
      onChange={onChange}
      label="Привязать к сущности (необязательно)"
      attachedLabel="Привязано к"
      search={(q, showComposite) => entityLookup(q, !showComposite)}
      showCompositeToggle
      describeResult={(r) => (r.kind === 'organization' ? `Юрлицо · класс ${r.access_class}` : `${r.template_name} · класс ${r.access_class}`)}
    />
  );
}

export function OrgPicker({ value, onChange }: { value: EntityResult | null; onChange: (entity: EntityResult | null) => void }) {
  return (
    <DominexLookupPicker
      value={value}
      onChange={onChange}
      label="Юрлицо (необязательно)"
      attachedLabel="Юрлицо"
      search={(q) => organizationLookup(q)}
      showCompositeToggle={false}
      describeResult={(r) => `Юрлицо${r.access_class ? ` · класс ${r.access_class}` : ''}`}
    />
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
    errorText: {
      marginTop: theme.spacing.sm,
      fontSize: 13,
      color: theme.colors.danger,
    },
    emptyText: {
      marginTop: theme.spacing.sm,
      fontSize: 13,
      color: theme.colors.textMuted,
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
