import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { RecordCard } from '@/src/components/RecordCard';
import { useTheme } from '@/src/theme/useTheme';
import type { EntityResult, UserResult } from '@/src/api/entities';
import type { WikiFilters } from '@/src/api/records';
import type { BiographyRecord, Zone } from '@/src/api/types';
import { DiaryCalendarView } from '@/src/features/diary/DiaryCalendarView';
import { OutboxBanner } from '@/src/offline/OutboxBanner';
import { processOutbox } from '@/src/offline/outbox';
import { AddRecordForm } from './AddRecordForm';
import { AuthorPicker } from './AuthorPicker';
import { EquipmentPicker } from './EntityPicker';
import { RECORD_TYPE_OPTIONS } from './labels';

type RecordsFeedProps = {
  // Внедряется снаружи (fetchRecentRecords или fetchMyRecords из
  // src/api/records.ts) - RecordsFeed не знает и не должен знать, "Вики"
  // он показывает или "Мои записи". Тот же приём, что и с RecordCard -
  // компонент переиспользуется, потому что не завязан на конкретный
  // источник данных. filters игнорируется источниками, которые их не
  // принимают (fetchMyRecords) - TS позволяет функции с меньшим числом
  // параметров подставляться туда, где ожидается больше.
  loadRecords: (filters: WikiFilters) => Promise<{ results: BiographyRecord[] }>;
  emptyMessage: string;
  // Прокидывается дальше в AddRecordForm как есть - см. её собственный
  // комментарий про fixedZone (используется вкладкой "Дневник").
  fixedZone?: Zone;
  // Поиск/фильтр + переключатель Лента/Календарь - только для Вики (по
  // запросу пользователя: "много будет заноситься записей, лента
  // неэффективна"), "Мои записи" остаётся как было - там объём меньше
  // (только свои записи) и uже есть собственное разделение по зонам.
  enableSearch?: boolean;
};

/**
 * Лента записей + кнопка "Добавить" + форма создания. И "Вики" (лента
 * последних записей), и раздел "Мои записи" в личном кабинете - это одна
 * и та же механика с разным источником данных, поэтому она вынесена в
 * общий компонент, а не продублирована дважды.
 */
export function RecordsFeed({ loadRecords, emptyMessage, fixedZone, enableSearch = false }: RecordsFeedProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();

  const [records, setRecords] = useState<BiographyRecord[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'feed' | 'calendar'>('feed');

  const [q, setQ] = useState('');
  const [recordType, setRecordType] = useState<string | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<EntityResult | null>(null);
  const [authorFilter, setAuthorFilter] = useState<UserResult | null>(null);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const filters: WikiFilters = useMemo(
    () => ({
      q: q || undefined,
      recordType: recordType || undefined,
      entityId: equipmentFilter?.id,
      author: authorFilter?.username,
    }),
    [q, recordType, equipmentFilter, authorFilter],
  );
  const hasActiveFilters = Boolean(q || recordType || equipmentFilter || authorFilter);

  const load = useCallback(async () => {
    try {
      const data = await loadRecords(filters);
      setRecords(data.results);
      setError(null);
    } catch {
      setError('Не удалось загрузить записи.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadRecords, q, recordType, equipmentFilter, authorFilter]);

  // Дебаунс на весь набор фильтров разом - пикер оборудования/автора
  // выбирается одним кликом (задержка в 300 мс незаметна), а текстовый
  // поиск как раз и рассчитан на дебаунс по мере набора.
  useEffect(() => {
    const handle = setTimeout(load, enableSearch ? 300 : 0);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Потянул список вниз - разумный повод заодно попробовать отправить
    // всё, что накопилось в офлайн-очереди (см. src/offline/outbox.ts) -
    // если связь появилась, не обязательно ждать следующего перезапуска
    // приложения.
    await Promise.all([load(), processOutbox()]);
    setIsRefreshing(false);
  };

  const handleCreated = () => {
    setShowForm(false);
    load(); // обновляем ленту, чтобы новая запись сразу стала видна
  };

  const clearFilters = () => {
    setQ('');
    setRecordType(null);
    setEquipmentFilter(null);
    setAuthorFilter(null);
  };

  if (records === null && !error) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  const effectiveEmptyMessage = hasActiveFilters ? 'Ничего не найдено по этим условиям.' : emptyMessage;

  const filterBar = enableSearch && (
    <View style={styles.filterBar}>
      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeButton, mode === 'feed' && styles.modeButtonActive]}
          onPress={() => setMode('feed')}>
          <Text style={[styles.modeButtonText, mode === 'feed' && styles.modeButtonTextActive]}>Лента</Text>
        </Pressable>
        <Pressable
          style={[styles.modeButton, mode === 'calendar' && styles.modeButtonActive]}
          onPress={() => setMode('calendar')}>
          <Text style={[styles.modeButtonText, mode === 'calendar' && styles.modeButtonTextActive]}>Календарь</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Поиск по тексту записи..."
        value={q}
        onChangeText={setQ}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
        <Pressable
          style={[styles.typeChip, recordType === null && styles.typeChipActive]}
          onPress={() => setRecordType(null)}>
          <Text style={[styles.typeChipText, recordType === null && styles.typeChipTextActive]}>Все категории</Text>
        </Pressable>
        {RECORD_TYPE_OPTIONS.map(([value, label]) => (
          <Pressable
            key={value}
            style={[styles.typeChip, recordType === value && styles.typeChipActive]}
            onPress={() => setRecordType(value)}>
            <Text style={[styles.typeChipText, recordType === value && styles.typeChipTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.filterActionsRow}>
        <Pressable onPress={() => setShowMoreFilters((v) => !v)}>
          <Text style={styles.filterActionText}>{showMoreFilters ? 'Скрыть фильтры' : 'Ещё фильтры'}</Text>
        </Pressable>
        {hasActiveFilters && (
          <Pressable onPress={clearFilters}>
            <Text style={styles.filterActionText}>Сбросить</Text>
          </Pressable>
        )}
      </View>

      {showMoreFilters && (
        <View style={styles.moreFilters}>
          <EquipmentPicker value={equipmentFilter} onChange={setEquipmentFilter} label="Оборудование" />
          <AuthorPicker value={authorFilter} onChange={setAuthorFilter} />
        </View>
      )}
    </View>
  );

  if (enableSearch && mode === 'calendar') {
    return (
      <View style={styles.container}>
        <OutboxBanner />
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}>
          {filterBar}
          {showForm && (
            <AddRecordForm onCreated={handleCreated} onCancel={() => setShowForm(false)} fixedZone={fixedZone} />
          )}
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (records ?? []).length === 0 ? (
            <Text style={styles.emptyText}>{effectiveEmptyMessage}</Text>
          ) : (
            <DiaryCalendarView records={records ?? []} />
          )}
        </ScrollView>
        {!showForm && (
          <Pressable style={styles.fab} onPress={() => setShowForm(true)}>
            <Ionicons name="add" size={28} color="#fff" />
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OutboxBanner />
      <FlatList
        data={records ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/record/[id]', params: { id: String(item.id) } })}>
            <RecordCard record={item} />
          </Pressable>
        )}
        contentContainerStyle={styles.listContent}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={
          <View>
            {filterBar}
            {showForm && (
              <AddRecordForm onCreated={handleCreated} onCancel={() => setShowForm(false)} fixedZone={fixedZone} />
            )}
          </View>
        }
        ListEmptyComponent={
          error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <Text style={styles.emptyText}>{effectiveEmptyMessage}</Text>
          )
        }
      />

      {!showForm && (
        <Pressable style={styles.fab} onPress={() => setShowForm(true)}>
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
    },
    listContent: {
      padding: theme.spacing.md,
      flexGrow: 1,
    },
    emptyText: {
      textAlign: 'center',
      color: theme.colors.textMuted,
      marginTop: theme.spacing.xl,
    },
    errorText: {
      textAlign: 'center',
      color: theme.colors.danger,
      marginTop: theme.spacing.xl,
    },
    fab: {
      position: 'absolute',
      right: theme.spacing.lg,
      bottom: theme.spacing.lg,
      width: 56,
      height: 56,
      borderRadius: theme.radius.round,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 5, // тень на Android (shadow* работает только на iOS)
    },
    filterBar: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    modeRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    modeButton: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.round,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    modeButtonActive: {
      backgroundColor: theme.colors.accentLight,
      borderColor: theme.colors.accent,
    },
    modeButtonText: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    modeButtonTextActive: {
      color: theme.colors.accent,
      fontWeight: '600',
    },
    searchInput: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      fontSize: 15,
      color: theme.colors.text,
    },
    typeRow: {
      flexDirection: 'row',
    },
    typeChip: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.round,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      marginRight: theme.spacing.xs,
    },
    typeChipActive: {
      backgroundColor: theme.colors.accentLight,
      borderColor: theme.colors.accent,
    },
    typeChipText: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    typeChipTextActive: {
      color: theme.colors.accent,
      fontWeight: '600',
    },
    filterActionsRow: {
      flexDirection: 'row',
      gap: theme.spacing.lg,
    },
    filterActionText: {
      fontSize: 13,
      color: theme.colors.accent,
      fontWeight: '600',
    },
    moreFilters: {
      gap: theme.spacing.sm,
    },
  });
}
