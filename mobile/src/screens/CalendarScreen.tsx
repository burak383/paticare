import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { colors, fonts } from '../theme';
import { usePets } from '../context/PetContext';
import { useAuth } from '../context/AuthContext';
import { careItemsApi, type CareItem, type CareItemKind } from '../api';
import { scheduleCareItemReminder, cancelCareItemReminder } from '../notifications';
import { toISODate } from '../dateUtils';

const DAY_LABELS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const MONTH_LABELS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as first day
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildWeek(anchor: Date) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function Icon({ name, size = 20, color = colors.foreground }: { name: React.ComponentProps<typeof MaterialCommunityIcons>['name']; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

function StatusDot({ color }: { color: string }) {
  return <View style={[styles.statusDot, { backgroundColor: color }]} />;
}

const KIND_ICON: Record<CareItemKind, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  medication: 'pill',
  weight_check: 'scale-balance',
  vaccine: 'shield-plus-outline',
  other: 'calendar-check-outline',
};

const KIND_COLOR: Record<CareItemKind, string> = {
  medication: colors.success,
  weight_check: colors.chart2,
  vaccine: colors.accent,
  other: colors.chart4,
};

const KIND_LABELS: { key: CareItemKind; label: string }[] = [
  { key: 'medication', label: 'İlaç' },
  { key: 'weight_check', label: 'Kilo' },
  { key: 'vaccine', label: 'Aşı' },
  { key: 'other', label: 'Diğer' },
];

// Matches the Turkish labels the backend's nextOccurrenceDate() already
// recognizes (backend/src/routes/careItems.js) and the ones seed.js uses —
// reusing the same strings rather than inventing new ones so existing data
// (e.g. seeded 'Yıllık' items) keeps working with the picker's values.
const RECURRENCE_LABELS = ['Bir kez', 'Her gün', 'Haftalık', 'Aylık'];

export default function CalendarScreen() {
  const { pets, selectedPet, selectPet } = usePets();
  const { user } = useAuth();
  const remindersEnabled = user?.preferences?.medicationReminders !== false;
  const notificationSound = user?.preferences?.notificationSound;
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dayItems, setDayItems] = useState<CareItem[]>([]);
  const [upcoming, setUpcoming] = useState<CareItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<CareItem | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formKind, setFormKind] = useState<CareItemKind>('medication');
  const [formTime, setFormTime] = useState('09:00');
  const [formDescription, setFormDescription] = useState('');
  const [formRecurrence, setFormRecurrence] = useState('Bir kez');
  const [submitting, setSubmitting] = useState(false);

  const week = useMemo(() => buildWeek(anchorDate), [anchorDate]);

  const load = useCallback(async () => {
    if (!selectedPet) {
      setDayItems([]);
      setUpcoming([]);
      return;
    }
    setLoading(true);
    try {
      const dateStr = toISODate(selectedDate);
      const [items, upcomingItems] = await Promise.all([
        careItemsApi.listCareItems({ petId: selectedPet.id, date: dateStr }),
        careItemsApi.listCareItems({
          petId: selectedPet.id,
          from: toISODate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
          to: toISODate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
        }),
      ]);
      setDayItems(items);
      setUpcoming(upcomingItems.filter((i) => i.status === 'pending').slice(0, 4));
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Takvim yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [selectedPet, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Tapping a "Yaklaşanlar" row used to do nothing — this jumps the week
  // strip and the day plan below it to that item's date so the user can
  // actually see/act on it, instead of just displaying it as a dead end.
  function handleUpcomingPress(item: CareItem) {
    const target = new Date(`${item.date}T00:00:00`);
    setAnchorDate(target);
    setSelectedDate(target);
  }

  function handlePetSwitch() {
    if (pets.length === 0) return;
    Alert.alert(
      'Evcil hayvan seç',
      undefined,
      pets.map((pet) => ({ text: pet.name, onPress: () => selectPet(pet.id) })),
    );
  }

  async function runAction(item: CareItem, action: 'complete' | 'skip' | 'undo') {
    setBusyId(item.id);
    try {
      // complete/skip also spawn the next occurrence for a recurring item
      // (nextOccurrence is null for a one-off 'Bir kez' item, or for undo,
      // which never spawns anything — see careItems.js's comment on why).
      let updated: CareItem;
      let nextOccurrence: CareItem | null = null;
      if (action === 'complete') {
        const res = await careItemsApi.completeCareItem(item.id);
        updated = res.careItem;
        nextOccurrence = res.nextOccurrence;
      } else if (action === 'skip') {
        const res = await careItemsApi.skipCareItem(item.id);
        updated = res.careItem;
        nextOccurrence = res.nextOccurrence;
      } else {
        updated = await careItemsApi.undoCareItem(item.id);
      }
      setDayItems((prev) => {
        const next = prev.map((c) => (c.id === updated.id ? updated : c));
        // Only splice the spawned occurrence into today's list if it actually
        // falls on the day currently being viewed — otherwise it belongs to a
        // future day and will show up naturally when that day is opened.
        if (nextOccurrence && nextOccurrence.date === toISODate(selectedDate)) {
          next.push(nextOccurrence);
        }
        return next.sort((a, b) => a.time.localeCompare(b.time));
      });
      // The same item can also be showing in "Yaklaşanlar" below (its query
      // window overlaps the day plan's) — without this it kept displaying
      // the old pending state there until the screen lost and regained
      // focus. Completed/skipped items drop out of "Yaklaşanlar" (it only
      // ever lists pending items); an undone item goes back to pending. The
      // spawned next occurrence is deliberately NOT added here — same as a
      // freshly created reminder, it'll appear once "Yaklaşanlar" reloads.
      setUpcoming((prev) =>
        action === 'undo' ? prev.map((c) => (c.id === updated.id ? updated : c)) : prev.filter((c) => c.id !== updated.id),
      );
      // A completed/skipped item no longer needs its phone reminder; an
      // undone one goes back to pending and should be re-armed if its time
      // hasn't already passed. A spawned next occurrence starts out with no
      // notification scheduled at all (it's a brand-new item, different id
      // from the one cancelCareItemReminder(item.id) just cancelled) — without
      // scheduling one here, a recurring reminder would silently stop
      // notifying after its very first completion/skip.
      if (action === 'undo') {
        if (remindersEnabled && selectedPet) scheduleCareItemReminder(updated, selectedPet.name, notificationSound).catch(() => {});
      } else {
        cancelCareItemReminder(item.id).catch(() => {});
        if (nextOccurrence && remindersEnabled && selectedPet) {
          scheduleCareItemReminder(nextOccurrence, selectedPet.name, notificationSound).catch(() => {});
        }
      }
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'İşlem tamamlanamadı.');
    } finally {
      setBusyId(null);
    }
  }

  function closeReminderModal() {
    setModalVisible(false);
    setEditingItem(null);
  }

  function openAddReminderModal() {
    setEditingItem(null);
    setFormTitle('');
    setFormDescription('');
    setFormTime('09:00');
    setFormKind('medication');
    setFormRecurrence('Bir kez');
    setModalVisible(true);
  }

  function handleEditPress(item: CareItem) {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormDescription(item.description || '');
    setFormTime(item.time);
    setFormKind(item.kind);
    // Keep whatever recurrence value the item already has, even one the
    // picker below doesn't offer a chip for (e.g. seeded 'Yıllık' items) —
    // that chip just shows unselected until the user actively picks a
    // different one, so an untouched edit never silently downgrades it to
    // 'Bir kez'.
    setFormRecurrence(item.recurrence);
    setModalVisible(true);
  }

  async function handleSubmitReminder() {
    if (!selectedPet) {
      Alert.alert('Önce bir evcil hayvan seç');
      return;
    }
    if (!formTitle.trim()) {
      Alert.alert('Başlık gerekli', 'Hatırlatıcı için bir başlık gir.');
      return;
    }
    if (!/^\d{1,2}:\d{2}$/.test(formTime.trim())) {
      Alert.alert('Saat formatı hatalı', 'Saati 09:00 gibi girmelisin.');
      return;
    }
    setSubmitting(true);
    try {
      if (editingItem) {
        const updated = await careItemsApi.updateCareItem(editingItem.id, {
          kind: formKind,
          title: formTitle.trim(),
          description: formDescription.trim(),
          time: formTime.trim(),
          recurrence: formRecurrence,
        });
        closeReminderModal();
        setDayItems((prev) =>
          prev
            .map((c) => (c.id === updated.id ? updated : c))
            .sort((a, b) => a.time.localeCompare(b.time)),
        );
        setUpcoming((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        // Time/kind may have changed, so the old scheduled notification (if any)
        // no longer matches — cancel and re-arm rather than leaving it stale.
        if (remindersEnabled && updated.status === 'pending') {
          await cancelCareItemReminder(updated.id).catch(() => {});
          scheduleCareItemReminder(updated, selectedPet.name, notificationSound).catch(() => {});
        }
      } else {
        const created = await careItemsApi.createCareItem({
          petId: selectedPet.id,
          kind: formKind,
          title: formTitle.trim(),
          description: formDescription.trim(),
          date: toISODate(selectedDate),
          time: formTime.trim(),
          recurrence: formRecurrence,
        });
        closeReminderModal();
        if (created.date === toISODate(selectedDate)) {
          setDayItems((prev) => [...prev, created].sort((a, b) => a.time.localeCompare(b.time)));
        }
        if (remindersEnabled) scheduleCareItemReminder(created, selectedPet.name, notificationSound).catch(() => {});
      }
      setFormTitle('');
      setFormDescription('');
      setFormTime('09:00');
      setFormKind('medication');
      setFormRecurrence('Bir kez');
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Hatırlatıcı kaydedilemedi.');
    } finally {
      setSubmitting(false);
    }
  }

  const weekRangeLabel = week.length
    ? `${week[0].getDate()}–${week[6].getDate()} ${MONTH_LABELS[week[6].getMonth()]}`
    : '';
  const selectedDayLabel = `${selectedDate.getDate()} ${MONTH_LABELS[selectedDate.getMonth()]} ${DAY_LABELS[selectedDate.getDay()] === 'Paz' ? 'Pazar' : ''}`.trim();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        testID="calendar-scroll"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl testID="calendar-refresh-control" refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>BAKIM TAKVİMİ</Text>
            <Text style={styles.pageTitle}>Takvim</Text>
          </View>
          <View style={styles.weekNavRow}>
            <Pressable
              style={styles.settingsButton}
              accessibilityLabel="Önceki haftaya git"
              testID="previous-week-button"
              onPress={() => {
                const d = new Date(anchorDate);
                d.setDate(d.getDate() - 7);
                setAnchorDate(d);
              }}
            >
              <Icon name="chevron-left" size={21} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              style={styles.settingsButton}
              accessibilityLabel="Bugüne dön"
              testID="jump-to-today-button"
              onPress={() => {
                const now = new Date();
                setAnchorDate(now);
                setSelectedDate(now);
              }}
            >
              <Icon name="calendar-today" size={18} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              style={styles.settingsButton}
              accessibilityLabel="Sonraki haftaya git"
              testID="next-week-button"
              onPress={() => {
                const d = new Date(anchorDate);
                d.setDate(d.getDate() + 7);
                setAnchorDate(d);
              }}
            >
              <Icon name="chevron-right" size={21} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

        {selectedPet ? (
          <View style={styles.petCard}>
            <View style={styles.petImageWrap}>
              {selectedPet.avatarUrl ? (
                <Image source={{ uri: selectedPet.avatarUrl }} style={styles.petImage} resizeMode="contain" />
              ) : (
                <Icon name="paw" size={26} color={colors.primary} />
              )}
            </View>
            <View style={styles.petInfo}>
              <View style={styles.petNameRow}>
                <Text style={styles.petName}>{selectedPet.name}</Text>
                <Text style={styles.activeBadge}>AKTİF</Text>
              </View>
              <Text style={styles.petMeta}>
                {selectedPet.species}
                {selectedPet.weightKg ? ` · ${selectedPet.weightKg.toString().replace('.', ',')} kg` : ''}
              </Text>
            </View>
            <Pressable style={styles.changeButton} onPress={handlePetSwitch}>
              <Text style={styles.changeText}>Değiştir</Text>
              <Icon name="chevron-down" size={16} color={colors.secondaryForeground} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyPetCard}>
            <Text style={styles.emptyPetText}>Henüz kayıtlı bir evcil hayvanın yok. Profil sekmesinden ekleyebilirsin.</Text>
          </View>
        )}

        <View style={styles.calendarCard}>
          <View style={styles.calendarTopRow}>
            <View style={styles.weekSelector}>
              <Text style={styles.weekTitle}>{weekRangeLabel}</Text>
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <StatusDot color={colors.success} />
                <Text style={styles.legendText}>İlaç</Text>
              </View>
              <View style={styles.legendItem}>
                <StatusDot color={colors.chart2} />
                <Text style={styles.legendText}>Kilo</Text>
              </View>
              <View style={styles.legendItem}>
                <StatusDot color={colors.accent} />
                <Text style={styles.legendText}>Aşı</Text>
              </View>
            </View>
          </View>

          <View style={styles.daysRow}>
            {week.map((day, dayIndex) => {
              const active = toISODate(day) === toISODate(selectedDate);
              return (
                <Pressable
                  key={day.toISOString()}
                  style={styles.day}
                  onPress={() => setSelectedDate(day)}
                  testID={`day-cell-${dayIndex}`}
                >
                  <Text style={[styles.dayLabel, active && { color: colors.primary }]}>{DAY_LABELS[day.getDay()]}</Text>
                  <View style={[styles.dateCircle, active && styles.activeDateCircle]}>
                    <Text style={[styles.dateText, active && styles.activeDateText]}>{day.getDate()}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.planSection}>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Planı</Text>
              <Text style={styles.sectionTitle}>{selectedDayLabel}</Text>
            </View>
            <Text style={styles.recordBadge}>{dayItems.length} kayıt</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : dayItems.length === 0 ? (
            <View style={styles.emptyDay}>
              <Text style={styles.emptyPetText}>Bu gün için kayıt yok. Sağ alttaki + ile ekleyebilirsin.</Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              <View style={styles.timelineLine} />
              {dayItems.map((item) => (
                <View key={item.id} style={styles.timelineItem}>
                  <View style={styles.timeColumn}>
                    <Text style={styles.timeText}>{item.time}</Text>
                    <View style={[styles.timelineDot, { backgroundColor: KIND_COLOR[item.kind], borderColor: colors.background }]} />
                  </View>

                  <View style={[styles.scheduleCard, item.status === 'pending' && item.kind === 'vaccine' && styles.warmCard]}>
                    <View style={styles.scheduleHeader}>
                      <View style={[styles.scheduleIcon, { backgroundColor: colors.muted }]}>
                        <Icon name={KIND_ICON[item.kind]} size={21} color={KIND_COLOR[item.kind]} />
                      </View>
                      <View style={styles.scheduleContent}>
                        <View style={styles.titleRow}>
                          <Text style={styles.scheduleTitle} numberOfLines={1}>{item.title}</Text>
                          {item.status === 'done' ? (
                            <View style={styles.completedLabel}>
                              <Icon name="check-circle-outline" size={14} color={colors.success} />
                              <Text style={[styles.smallStrong, { color: colors.success }]}>Verildi</Text>
                            </View>
                          ) : (
                            <Text
                              style={[
                                styles.statusLabel,
                                { color: colors.secondaryForeground, backgroundColor: item.status === 'skipped' ? colors.muted : colors.secondary },
                              ]}
                            >
                              {item.status === 'skipped' ? 'Atlandı' : 'Bekliyor'}
                            </Text>
                          )}
                          <Pressable
                            hitSlop={8}
                            style={styles.editIconButton}
                            onPress={() => handleEditPress(item)}
                            testID={`edit-reminder-${item.id}`}
                            accessibilityLabel={`${item.title} hatırlatıcısını düzenle`}
                          >
                            <Icon name="pencil-outline" size={16} color={colors.mutedForeground} />
                          </Pressable>
                        </View>
                        <Text style={styles.scheduleDescription}>{item.description}</Text>
                        <Text style={styles.scheduleDetails}>{item.recurrence}</Text>
                      </View>
                    </View>

                    {busyId === item.id ? (
                      <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
                    ) : item.status === 'done' ? (
                      <View style={styles.completedFooter}>
                        <Text style={styles.scheduleDetails}>{selectedPet?.name}</Text>
                        <Pressable style={styles.undoButton} onPress={() => runAction(item, 'undo')}>
                          <Text style={styles.undoText}>Geri al</Text>
                        </Pressable>
                      </View>
                    ) : item.status === 'skipped' ? (
                      <View style={styles.completedFooter}>
                        <Text style={styles.scheduleDetails}>Atlandı</Text>
                        <Pressable style={styles.undoButton} onPress={() => runAction(item, 'undo')}>
                          <Text style={styles.undoText}>Geri al</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.actionsRow}>
                        <Pressable style={styles.primaryActionButton} onPress={() => runAction(item, 'complete')}>
                          <Icon name="check" size={16} color={colors.primaryForeground} />
                          <Text style={[styles.actionButtonText, { color: colors.primaryForeground }]}>Verildi</Text>
                        </Pressable>
                        <Pressable style={styles.mutedActionButton} onPress={() => runAction(item, 'skip')}>
                          <Icon name="skip-next-outline" size={16} color={colors.mutedForeground} />
                          <Text style={[styles.actionButtonText, { color: colors.mutedForeground }]}>Atlandı</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.upcomingSection}>
          <View style={styles.upcomingHeading}>
            <Text style={styles.sectionTitle}>Yaklaşanlar</Text>
          </View>
          {upcoming.length === 0 ? (
            <Text style={styles.emptyPetText}>Önümüzdeki 30 gün içinde planlanmış başka kayıt yok.</Text>
          ) : (
            upcoming.map((item) => (
              <Pressable
                key={item.id}
                style={styles.upcomingRow}
                testID={`upcoming-item-${item.id}`}
                accessibilityLabel={`${item.title} tarihine git`}
                onPress={() => handleUpcomingPress(item)}
              >
                <View style={[styles.upcomingImageWrap, { backgroundColor: colors.muted }]}>
                  <Icon name={KIND_ICON[item.kind]} size={21} color={KIND_COLOR[item.kind]} />
                </View>
                <View style={styles.upcomingContent}>
                  <Text style={styles.upcomingTitle}>{item.title}</Text>
                  <Text style={styles.upcomingSubtitle}>
                    {selectedPet?.name} · {new Date(item.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                  </Text>
                </View>
                <Icon name="chevron-right" size={21} color={colors.mutedForeground} />
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <Pressable
        style={styles.floatingButton}
        accessibilityLabel="Yeni hatırlatıcı ekle"
        testID="add-reminder-button"
        onPress={() => (selectedPet ? openAddReminderModal() : Alert.alert('Önce bir evcil hayvan ekle'))}
      >
        <Icon name="plus" size={27} color={colors.accentForeground} />
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeReminderModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingItem ? 'Hatırlatıcıyı düzenle' : 'Yeni hatırlatıcı'}</Text>
            <Text style={styles.modalSubtitle}>
              {editingItem ? `${new Date(`${editingItem.date}T00:00:00`).getDate()} ${MONTH_LABELS[new Date(`${editingItem.date}T00:00:00`).getMonth()]}` : selectedDayLabel} için
            </Text>

            <Text style={styles.modalLabel}>Tür</Text>
            <View style={styles.kindRow}>
              {KIND_LABELS.map((k) => (
                <Pressable
                  key={k.key}
                  style={[styles.kindChip, formKind === k.key && styles.kindChipActive]}
                  onPress={() => setFormKind(k.key)}
                >
                  <Text style={[styles.kindChipText, formKind === k.key && styles.kindChipTextActive]}>{k.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.modalLabel}>Başlık</Text>
            <TextInput
              style={styles.modalInput}
              value={formTitle}
              onChangeText={setFormTitle}
              placeholder="Örn. Kalp ilacı"
              placeholderTextColor={colors.mutedForeground}
              testID="reminder-title-input"
            />

            <Text style={styles.modalLabel}>Saat (SS:DD)</Text>
            <TextInput
              style={styles.modalInput}
              value={formTime}
              onChangeText={setFormTime}
              placeholder="09:00"
              placeholderTextColor={colors.mutedForeground}
              testID="reminder-time-input"
            />

            <Text style={styles.modalLabel}>Tekrar</Text>
            <View style={styles.kindRow}>
              {RECURRENCE_LABELS.map((label) => (
                <Pressable
                  key={label}
                  style={[styles.kindChip, formRecurrence === label && styles.kindChipActive]}
                  onPress={() => setFormRecurrence(label)}
                  testID={`recurrence-chip-${label}`}
                >
                  <Text style={[styles.kindChipText, formRecurrence === label && styles.kindChipTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.modalLabel}>Not (isteğe bağlı)</Text>
            <TextInput style={styles.modalInput} value={formDescription} onChangeText={setFormDescription} placeholder="Örn. 1 tablet" placeholderTextColor={colors.mutedForeground} />

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={closeReminderModal}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </Pressable>
              <Pressable style={styles.modalSubmit} onPress={handleSubmitReminder} disabled={submitting} testID="reminder-submit">
                {submitting ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.modalSubmitText}>{editingItem ? 'Kaydet' : 'Ekle'}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 150 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  pageTitle: { marginTop: 4, color: colors.foreground, fontFamily: fonts.heading, fontSize: 28, fontWeight: '900' },
  weekNavRow: { flexDirection: 'row', gap: 8 },
  settingsButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  petCard: { marginTop: 20, minHeight: 82, padding: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.card },
  emptyPetCard: { marginTop: 20, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  emptyPetText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  petImageWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted },
  petImage: { width: 56, height: 56 },
  petInfo: { flex: 1, marginLeft: 12 },
  petNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  petName: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 19, fontWeight: '900' },
  activeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, color: colors.primary, backgroundColor: colors.muted, fontFamily: fonts.body, fontSize: 10, fontWeight: '900' },
  petMeta: { marginTop: 3, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '600' },
  changeButton: { paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 20, backgroundColor: colors.secondary },
  changeText: { color: colors.secondaryForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '900' },
  calendarCard: { marginTop: 20, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  calendarTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekSelector: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  weekTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 16, fontWeight: '900' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 10, fontWeight: '700' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  daysRow: { marginTop: 18, flexDirection: 'row', justifyContent: 'space-between' },
  day: { flex: 1, alignItems: 'center', gap: 8 },
  dayLabel: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 10, fontWeight: '700' },
  dateCircle: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  activeDateCircle: { backgroundColor: colors.primary },
  dateText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 14, fontWeight: '900' },
  activeDateText: { color: colors.primaryForeground },
  planSection: { marginTop: 24 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  sectionEyebrow: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
  sectionTitle: { marginTop: 4, color: colors.foreground, fontFamily: fonts.heading, fontSize: 20, fontWeight: '900' },
  recordBadge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, color: colors.primaryForeground, backgroundColor: colors.primary, fontFamily: fonts.body, fontSize: 12, fontWeight: '900' },
  emptyDay: { marginTop: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  timeline: { position: 'relative' },
  timelineLine: { position: 'absolute', top: 8, bottom: 25, left: 43, width: 1, backgroundColor: colors.border },
  timelineItem: { flexDirection: 'row', gap: 12, paddingBottom: 12 },
  timeColumn: { width: 44, alignItems: 'center', paddingTop: 4 },
  timeText: { color: colors.foreground, fontFamily: fonts.body, fontSize: 12, fontWeight: '900' },
  timelineDot: { width: 11, height: 11, marginTop: 10, borderRadius: 6, borderWidth: 2 },
  scheduleCard: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  warmCard: { borderColor: colors.accent },
  scheduleHeader: { flexDirection: 'row', gap: 12 },
  scheduleIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  scheduleContent: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  scheduleTitle: { flex: 1, color: colors.foreground, fontFamily: fonts.body, fontSize: 14, fontWeight: '900' },
  completedLabel: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  smallStrong: { fontFamily: fonts.body, fontSize: 10, fontWeight: '900' },
  statusLabel: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, fontFamily: fonts.body, fontSize: 10, fontWeight: '900' },
  editIconButton: { padding: 4 },
  scheduleDescription: { marginTop: 7, color: colors.foreground, fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
  scheduleDetails: { marginTop: 5, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '600' },
  completedFooter: { marginTop: 12, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border },
  undoButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: colors.border },
  undoText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '900' },
  actionsRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  primaryActionButton: { flex: 1, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, backgroundColor: colors.primary },
  mutedActionButton: { flex: 1, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.muted },
  actionButtonText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '900' },
  upcomingSection: { marginTop: 18 },
  upcomingHeading: { marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  upcomingRow: { minHeight: 68, marginBottom: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  upcomingImageWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  upcomingContent: { flex: 1 },
  upcomingTitle: { color: colors.foreground, fontFamily: fonts.body, fontSize: 14, fontWeight: '900' },
  upcomingSubtitle: { marginTop: 4, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '600' },
  floatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 98,
    zIndex: 10,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.accent,
    elevation: 5,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(23,53,44,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, gap: 6 },
  modalTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 20, fontWeight: '900' },
  modalSubtitle: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, marginBottom: 8 },
  modalLabel: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  kindRow: { flexDirection: 'row', gap: 8 },
  kindChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.muted },
  kindChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  kindChipText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '800' },
  kindChipTextActive: { color: colors.primaryForeground },
  modalInput: { height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, paddingHorizontal: 14, color: colors.foreground, fontFamily: fonts.body, fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalCancel: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  modalCancelText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  modalSubmit: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  modalSubmitText: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
});
