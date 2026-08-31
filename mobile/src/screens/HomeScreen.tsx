import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, fonts } from '../theme';
import { usePets } from '../context/PetContext';
import { useAuth } from '../context/AuthContext';
import { careItemsApi, type CareItem } from '../api';
import { cancelCareItemReminder, scheduleCareItemReminder } from '../notifications';
import { todayISO } from '../dateUtils';
import type { RootStackParamList } from '../navigation/types';

const withOpacity = (color: string, opacity: number) => {
  if (!color.startsWith('#')) return color;
  const value = color.slice(1);
  const normalized = value.length === 3 ? value.split('').map((part) => part + part).join('') : value;
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
};

const SPECIES_ICON: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  Kedi: 'cat',
  Köpek: 'dog',
  Kuş: 'bird',
};

function Icon({ name, size = 20, color = colors.foreground }: { name: React.ComponentProps<typeof Feather>['name']; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}

function todayLabel() {
  return new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
}

const STATUS_COLOR: Record<CareItem['kind'], string> = {
  medication: colors.success,
  weight_check: colors.chart2,
  vaccine: colors.accent,
  other: colors.chart4,
};

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { pets, selectedPet, selectPet } = usePets();
  const { user } = useAuth();
  const remindersEnabled = user?.preferences?.medicationReminders !== false;
  const notificationSound = user?.preferences?.notificationSound;
  const [careItems, setCareItems] = useState<CareItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    if (!selectedPet) {
      setCareItems([]);
      return;
    }
    setLoading(true);
    try {
      const items = await careItemsApi.listCareItems({ petId: selectedPet.id, date: todayISO() });
      setCareItems(items);
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Görevler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [selectedPet]);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks]),
  );

  // Recurring items spawn their next occurrence on complete/skip (see
  // careItems.js). Today's list never needs it spliced in — the next
  // occurrence always lands on a later date — but its phone reminder DOES
  // need to be armed here, the same way CalendarScreen does, or a recurring
  // reminder would silently stop notifying after being completed/skipped
  // from the home screen even once.
  async function handleComplete(item: CareItem) {
    setBusyId(item.id);
    try {
      const { careItem: updated, nextOccurrence } = await careItemsApi.completeCareItem(item.id);
      setCareItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      cancelCareItemReminder(item.id).catch(() => {});
      if (nextOccurrence && remindersEnabled && selectedPet) {
        scheduleCareItemReminder(nextOccurrence, selectedPet.name, notificationSound).catch(() => {});
      }
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'İşlem tamamlanamadı.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleSkip(item: CareItem) {
    setBusyId(item.id);
    try {
      const { careItem: updated, nextOccurrence } = await careItemsApi.skipCareItem(item.id);
      setCareItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      cancelCareItemReminder(item.id).catch(() => {});
      if (nextOccurrence && remindersEnabled && selectedPet) {
        scheduleCareItemReminder(nextOccurrence, selectedPet.name, notificationSound).catch(() => {});
      }
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'İşlem tamamlanamadı.');
    } finally {
      setBusyId(null);
    }
  }

  const doneCount = careItems.filter((c) => c.status === 'done').length;
  const totalCount = careItems.length;
  const progressRatio = totalCount > 0 ? doneCount / totalCount : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadTasks} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>AKTİF BAKIM DOSYASI</Text>
            <Text style={styles.pageTitle}>
              {selectedPet ? `${selectedPet.name} için bakım planı` : 'Bakım planın'}
            </Text>
          </View>
          <View style={styles.healthBadge}>
            <Icon name="shield" size={15} color={colors.success} />
            <Text style={styles.healthText}>Her şey yolunda</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.petList}>
          {pets.map((pet) => (
            <TouchableOpacity
              key={pet.id}
              onPress={() => selectPet(pet.id)}
              style={[styles.petCard, pet.active && styles.selectedPetCard]}
              accessibilityLabel={`${pet.name} seç`}
            >
              <View style={[styles.petAvatar, pet.avatarUrl ? styles.imageAvatar : styles.secondaryAvatar]}>
                {pet.avatarUrl ? (
                  <Image source={{ uri: pet.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <MaterialCommunityIcons
                    name={SPECIES_ICON[pet.species] ?? 'paw'}
                    size={25}
                    color={colors.secondaryForeground}
                  />
                )}
              </View>
              <View>
                <Text style={styles.petName}>{pet.name}</Text>
                <Text style={styles.petDetail}>
                  {pet.species}
                  {pet.weightKg ? ` · ${pet.weightKg.toString().replace('.', ',')} kg` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.addPetCard}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Profil' })}
            accessibilityLabel="Yeni evcil hayvan ekle"
          >
            <Icon name="plus" size={18} color={colors.primary} />
            <Text style={styles.addPetText}>Ekle</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Bugünün görevleri</Text>
              <Text style={styles.date}>{todayLabel()}</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{totalCount} görev</Text>
            </View>
          </View>

          <View style={styles.tasksCard}>
            {loading && careItems.length === 0 ? (
              <View style={styles.emptyState}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : totalCount === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Bugün için planlanmış görev yok.</Text>
              </View>
            ) : (
              careItems.map((item, index) => {
                const isHighlighted = item.status === 'pending' && item.kind === 'medication' && index === careItems.length - 1;
                return (
                  <View key={item.id} style={[styles.taskRow, isHighlighted && styles.highlightedTask]}>
                    <View style={styles.timeColumn}>
                      <Text style={styles.time}>{item.time}</Text>
                      <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.kind] }]} />
                    </View>
                    <View style={styles.taskDivider} />
                    <View style={styles.taskContent}>
                      <View style={styles.taskTitleLine}>
                        <Text style={styles.taskTitle} numberOfLines={1}>{item.title}</Text>
                        {item.tag ? (
                          <View style={[styles.tag, isHighlighted ? styles.accentTag : styles.mutedTag]}>
                            <Text style={[styles.tagText, isHighlighted && { color: colors.accentForeground }]}>{item.tag}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.taskSubtitle}>{item.description}</Text>
                    </View>
                    {item.status === 'done' ? (
                      <View style={styles.doneBadge}>
                        <Icon name="check" size={16} color={colors.success} />
                      </View>
                    ) : item.status === 'skipped' ? (
                      <Text style={styles.skippedText}>Atlandı</Text>
                    ) : busyId === item.id ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <View style={styles.taskActions}>
                        <TouchableOpacity
                          style={styles.completeButton}
                          accessibilityLabel={`${item.title} tamamla`}
                          onPress={() => handleComplete(item)}
                        >
                          <Icon name="check" size={20} color={colors.primaryForeground} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.skipButton} onPress={() => handleSkip(item)}>
                          <Text style={styles.skipText}>Atla</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.reminderCard} onPress={() => navigation.navigate('MainTabs', { screen: 'Takvim' })}>
          <View style={styles.reminderIcon}>
            <MaterialCommunityIcons name="needle" size={22} color={colors.secondaryForeground} />
          </View>
          <View style={styles.reminderCopy}>
            <Text style={styles.reminderLabel}>Aşı ve tüm hatırlatıcılar</Text>
            <Text style={styles.reminderTitle}>Takvimi görüntüle</Text>
            <Text style={styles.reminderSubtitle}>Yaklaşan aşı ve ilaçları buradan takip et</Text>
          </View>
          <Icon name="chevron-right" size={21} color={colors.mutedForeground} />
        </TouchableOpacity>

        <View style={styles.quickActions}>
          <QuickAction icon="camera" label="Ürün tara" tone="secondary" onPress={() => navigation.navigate('MainTabs', { screen: 'Tara' })} />
          <QuickAction icon="bell" label="Hatırlatıcı ekle" tone="muted" onPress={() => navigation.navigate('MainTabs', { screen: 'Takvim' })} />
          <QuickAction
            icon="shield-off"
            label="Güvenlik kontrolü"
            tone="accent"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Tara', params: { initialTab: 'security' } })}
          />
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressLabel}>Günlük bakım</Text>
              <Text style={styles.progressTitle}>
                {totalCount} görevden {doneCount}&apos;i tamamlandı
              </Text>
            </View>
            <View style={styles.progressCircle}>
              <Text style={styles.progressFraction}>{doneCount}/{totalCount || 0}</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressValue, { width: `${Math.round(progressRatio * 100)}%` }]} />
          </View>
          {totalCount > doneCount ? (
            <View style={styles.notice}>
              <Icon name="alert-circle" size={18} color={colors.primaryForeground} />
              <Text style={styles.noticeText}>Tamamlanmamış {totalCount - doneCount} görevin var, akşam öğününden önce gözden geçir.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({
  icon,
  label,
  tone,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  tone: 'secondary' | 'muted' | 'accent';
  onPress: () => void;
}) {
  const background = tone === 'secondary' ? colors.secondary : tone === 'accent' ? withOpacity(colors.accent, 0.1) : colors.muted;
  const iconColor = tone === 'accent' ? colors.accent : colors.primary;

  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickIcon, { backgroundColor: background }]}>
        <Icon name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCopy: { flex: 1, marginRight: 10 },
  eyebrow: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  pageTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 25, fontWeight: '800', marginTop: 4 },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  healthText: { color: colors.success, fontFamily: fonts.body, fontSize: 10, fontWeight: '800' },
  petList: { gap: 10, paddingVertical: 20 },
  petCard: {
    minWidth: 128,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
    padding: 8,
  },
  selectedPetCard: { minWidth: 142, borderColor: colors.primary },
  petAvatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, overflow: 'hidden' },
  imageAvatar: { backgroundColor: colors.muted },
  secondaryAvatar: { backgroundColor: colors.secondary },
  avatarImage: { width: 48, height: 48 },
  petName: { color: colors.foreground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  petDetail: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 10, fontWeight: '600', marginTop: 2 },
  addPetCard: {
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  addPetText: { color: colors.primary, fontFamily: fonts.body, fontSize: 10, fontWeight: '800' },
  section: { marginTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  sectionTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 20, fontWeight: '800' },
  date: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  countBadge: { borderRadius: 20, backgroundColor: colors.muted, paddingHorizontal: 12, paddingVertical: 7 },
  countText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '800' },
  tasksCard: { overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.card },
  emptyState: { minHeight: 88, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 13 },
  taskRow: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: 15,
  },
  highlightedTask: { borderBottomWidth: 0, backgroundColor: withOpacity(colors.accent, 0.06) },
  timeColumn: { width: 42, alignItems: 'center' },
  time: { color: colors.foreground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  taskDivider: { width: 1, height: 44, backgroundColor: colors.border },
  taskContent: { flex: 1, minWidth: 0 },
  taskTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taskTitle: { flexShrink: 1, color: colors.foreground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  taskSubtitle: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, marginTop: 5 },
  tag: { borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3 },
  mutedTag: { backgroundColor: colors.muted },
  accentTag: { backgroundColor: colors.accent },
  tagText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 9, fontWeight: '800' },
  taskActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  completeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.primary },
  skipButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 8 },
  skipText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 10, fontWeight: '800' },
  doneBadge: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: withOpacity(colors.success, 0.12) },
  skippedText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 10, fontWeight: '800' },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
    padding: 15,
    marginTop: 16,
  },
  reminderIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.secondary },
  reminderCopy: { flex: 1 },
  reminderLabel: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 10, fontWeight: '800' },
  reminderTitle: { color: colors.foreground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800', marginTop: 3 },
  reminderSubtitle: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 10, marginTop: 4 },
  quickActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  quickAction: { flex: 1, minHeight: 96, justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.card, padding: 12 },
  quickIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  quickLabel: { color: colors.foreground, fontFamily: fonts.body, fontSize: 11, fontWeight: '800', lineHeight: 16 },
  progressCard: { borderRadius: 16, backgroundColor: colors.primary, padding: 20, marginTop: 20 },
  progressHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  progressLabel: { color: withOpacity(colors.primaryForeground, 0.75), fontFamily: fonts.body, fontSize: 11, fontWeight: '800' },
  progressTitle: { maxWidth: 220, color: colors.primaryForeground, fontFamily: fonts.heading, fontSize: 19, fontWeight: '800', marginTop: 4 },
  progressCircle: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: withOpacity(colors.primaryForeground, 0.3), borderRadius: 21 },
  progressFraction: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '800' },
  progressTrack: { height: 8, overflow: 'hidden', borderRadius: 4, backgroundColor: withOpacity(colors.primaryForeground, 0.25), marginTop: 17 },
  progressValue: { height: '100%', borderRadius: 4, backgroundColor: colors.primaryForeground },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: withOpacity(colors.primaryForeground, 0.15), paddingHorizontal: 12, paddingVertical: 10, marginTop: 16 },
  noticeText: { flex: 1, color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 10, fontWeight: '700', lineHeight: 15 },
});
