import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';

import { colors, fonts } from '../theme';
import { usePets } from '../context/PetContext';
import { healthApi, type Condition, type VetNote, type Vaccine, type WeightLog } from '../api';

const withAlpha = (color: string, alpha: string) => `${color}${alpha}`;

const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const FILTERS = ['Aşılar', 'Kilo', 'Rahatsızlıklar', 'Veteriner notları'] as const;
type Filter = (typeof FILTERS)[number];

function Icon({ name, size = 20, color = colors.foreground }: { name: React.ComponentProps<typeof Feather>['name']; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function WeightChart({ logs }: { logs: WeightLog[] }) {
  if (logs.length < 2) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.mutedInline}>Grafik için en az iki kilo kaydı gerekir.</Text>
      </View>
    );
  }
  const left = 28;
  const right = 328;
  const top = 22;
  const bottom = 106;
  const weights = logs.map((l) => l.weightKg);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;
  const step = (right - left) / (logs.length - 1);

  const coords = logs.map((log, i) => ({
    x: left + step * i,
    y: bottom - ((log.weightKg - minW) / range) * (bottom - top),
    label: `${new Date(log.date).getDate()} ${MONTHS_SHORT[new Date(log.date).getMonth()]}`,
  }));
  const points = coords.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <Svg width="100%" height={150} viewBox="0 0 340 150">
      {[22, 64, 106].map((y) => (
        <Line key={y} x1="28" y1={y} x2="328" y2={y} stroke={colors.muted} strokeWidth="1" />
      ))}
      <Polyline points={points} fill="none" stroke={colors.chart1} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <Circle key={i} cx={c.x} cy={c.y} r="5" fill={colors.chart1} />
      ))}
      {coords
        .filter((_, i) => i === 0 || i === coords.length - 1 || i % Math.ceil(coords.length / 6) === 0)
        .map((c, i) => (
          <SvgText key={i} x={c.x} y="133" fill={colors.mutedForeground} fontSize="10">
            {c.label}
          </SvgText>
        ))}
    </Svg>
  );
}

export default function HealthRecordScreen() {
  const { selectedPet } = usePets();
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [vetNotes, setVetNotes] = useState<VetNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('Aşılar');
  const [exporting, setExporting] = useState(false);

  const [addVaccineVisible, setAddVaccineVisible] = useState(false);
  const [vaccineTitle, setVaccineTitle] = useState('');
  const [vaccineDate, setVaccineDate] = useState('');
  const [savingVaccine, setSavingVaccine] = useState(false);

  const load = useCallback(async () => {
    if (!selectedPet) {
      setVaccines([]);
      setWeightLogs([]);
      setConditions([]);
      setVetNotes([]);
      return;
    }
    setLoading(true);
    try {
      const data = await healthApi.fetchPetHealth(selectedPet.id);
      setVaccines(data.vaccines);
      setWeightLogs(data.weightLogs);
      setConditions(data.conditions);
      setVetNotes(data.vetNotes);
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Sağlık karnesi yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [selectedPet]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const latestWeight = useMemo(() => weightLogs[weightLogs.length - 1], [weightLogs]);

  async function handleToggleVaccine(vaccine: Vaccine) {
    if (vaccine.status === 'completed') return;
    Alert.alert('Aşıyı güncelle', `${vaccine.title} tamamlandı olarak işaretlensin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Tamamlandı',
        onPress: async () => {
          try {
            const updated = await healthApi.updateVaccine(vaccine.id, { status: 'completed' });
            setVaccines((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
          } catch (err) {
            Alert.alert('Hata', err instanceof Error ? err.message : 'Güncellenemedi.');
          }
        },
      },
    ]);
  }

  async function handleAddVaccine() {
    if (!selectedPet) return;
    if (!vaccineTitle.trim() || !vaccineDate.trim()) {
      Alert.alert('Eksik bilgi', 'Aşı adı ve tarih gerekli (YYYY-AA-GG).');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vaccineDate.trim())) {
      Alert.alert('Tarih formatı hatalı', 'Tarihi 2026-09-01 gibi girmelisin.');
      return;
    }
    setSavingVaccine(true);
    try {
      const created = await healthApi.addVaccine(selectedPet.id, {
        title: vaccineTitle.trim(),
        date: vaccineDate.trim(),
        status: 'upcoming',
      });
      setVaccines((prev) => [...prev, created]);
      setAddVaccineVisible(false);
      setVaccineTitle('');
      setVaccineDate('');
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Aşı eklenemedi.');
    } finally {
      setSavingVaccine(false);
    }
  }

  async function handleExport() {
    if (!selectedPet) return;
    setExporting(true);
    try {
      const { text, fileName } = await healthApi.exportHealthReport(selectedPet.id);
      await Share.share({ title: fileName, message: text });
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Rapor oluşturulamadı.');
    } finally {
      setExporting(false);
    }
  }

  if (!selectedPet) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Sağlık karnesini görmek için önce Profil sekmesinden bir evcil hayvan ekle.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>SAĞLIK KARNESİ</Text>
            <Text style={styles.pageTitle}>{selectedPet.name}&apos;in dosyası</Text>
          </View>
          {loading ? <ActivityIndicator color={colors.primary} /> : null}
        </View>

        <View style={styles.passportCard}>
          <View style={styles.cover}>
            {selectedPet.coverUrl ? <Image source={{ uri: selectedPet.coverUrl }} style={styles.coverImage} /> : <View style={[styles.coverImage, { backgroundColor: colors.muted }]} />}
            <View style={styles.coverShade} />
            <View style={styles.coverBadge}>
              <Icon name="compass" size={15} color={colors.primary} />
              <Text style={styles.coverBadgeText}>Veteriner sağlık kaydı</Text>
            </View>
          </View>

          <View style={styles.cardPadding}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                {selectedPet.avatarUrl ? <Image source={{ uri: selectedPet.avatarUrl }} style={styles.avatarImage} /> : null}
              </View>
              <View style={styles.profileDetails}>
                <View style={styles.nameRow}>
                  <Text style={styles.petName}>{selectedPet.name}</Text>
                  <View style={styles.currentPill}>
                    <Text style={styles.currentPillText}>Kayıt güncel</Text>
                  </View>
                </View>
                <Text style={styles.subtitle}>{selectedPet.breed || selectedPet.species}</Text>
              </View>
            </View>

            <View style={styles.stats}>
              <Stat label="DOĞUM TARİHİ" value={selectedPet.birthDate || '—'} />
              <Stat label="GÜNCEL KİLO" value={latestWeight ? `${latestWeight.weightKg.toString().replace('.', ',')} kg` : '—'} />
              <Stat label="TÜR" value={selectedPet.species} />
            </View>
          </View>
        </View>

        <Pressable style={styles.exportButton} onPress={handleExport} disabled={exporting}>
          <View style={styles.exportLeading}>
            <View style={styles.exportIcon}>
              {exporting ? <ActivityIndicator color={colors.primaryForeground} /> : <Icon name="download" size={20} color={colors.primaryForeground} />}
            </View>
            <View>
              <Text style={styles.exportTitle}>Rapor olarak dışa aktar / paylaş</Text>
              <Text style={styles.exportSubtitle}>Veteriner ziyaretine hazır bir özet oluştur</Text>
            </View>
          </View>
          <Icon name="chevron-right" size={21} color={colors.primaryForeground} />
        </Pressable>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((label) => (
            <Pressable
              key={label}
              style={[styles.filter, filter === label ? styles.selectedFilter : styles.unselectedFilter]}
              onPress={() => setFilter(label)}
            >
              <Text style={[styles.filterText, filter === label ? styles.selectedFilterText : styles.unselectedFilterText]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {filter === 'Aşılar' ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Aşı takibi</Text>
                <Text style={styles.sectionSubtitle}>{selectedPet.name}&apos;in bağışıklık kayıtları</Text>
              </View>
              <Pressable style={styles.addButton} testID="add-vaccine-button" onPress={() => setAddVaccineVisible(true)}>
                <Icon name="plus" size={16} color={colors.primary} />
                <Text style={styles.addText}>Kayıt ekle</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              {vaccines.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.mutedInline}>Henüz aşı kaydı yok.</Text>
                </View>
              ) : (
                vaccines.map((vaccine) => (
                  <Pressable
                    key={vaccine.id}
                    style={[styles.vaccineRow, vaccine.status === 'upcoming' && styles.upcomingRow]}
                    onPress={() => handleToggleVaccine(vaccine)}
                  >
                    <View style={[styles.vaccineIcon, vaccine.status === 'upcoming' ? styles.upcomingIcon : styles.completedIcon]}>
                      <Icon name={vaccine.status === 'upcoming' ? 'clock' : 'award'} size={21} color={vaccine.status === 'upcoming' ? colors.accent : colors.success} />
                    </View>
                    <View style={styles.flexContent}>
                      <View style={styles.rowTitle}>
                        <Text style={styles.itemTitle}>{vaccine.title}</Text>
                        <View style={[styles.statusPill, vaccine.status === 'upcoming' ? styles.upcomingPill : styles.completedPill]}>
                          <Text style={[styles.statusText, { color: vaccine.status === 'upcoming' ? colors.accentForeground : colors.successForeground }]}>
                            {vaccine.status === 'upcoming' ? 'Yaklaşıyor' : 'Tamamlandı'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.itemMeta}>{vaccine.date}{vaccine.clinic ? ` · ${vaccine.clinic}` : ''}</Text>
                    </View>
                    <Icon name={vaccine.status === 'upcoming' ? 'chevron-right' : 'check-circle'} size={21} color={vaccine.status === 'upcoming' ? colors.mutedForeground : colors.success} />
                  </Pressable>
                ))
              )}
            </View>
          </View>
        ) : null}

        {filter === 'Kilo' ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Ağırlık geçmişi</Text>
                <Text style={styles.sectionSubtitle}>{weightLogs.length} kayıt</Text>
              </View>
              {latestWeight ? (
                <View style={styles.weightPill}>
                  <Text style={styles.weightText}>{latestWeight.weightKg.toString().replace('.', ',')} kg</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.cardWithPadding}>
              <WeightChart logs={weightLogs} />
              <View style={styles.trendBox}>
                <Icon name="trending-up" size={20} color={colors.primary} />
                <View style={styles.flexContent}>
                  <Text style={styles.trendTitle}>Kilo geçmişi</Text>
                  <Text style={styles.trendBody}>
                    Kesin değerlendirme için veterinerinize danışın. Yeni ölçüm, evcil hayvanını Profil&apos;de düzenleyerek eklenebilir.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {filter === 'Rahatsızlıklar' ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderOnly}>
              <Text style={styles.sectionTitle}>Rahatsızlıklar</Text>
              <Text style={styles.sectionSubtitle}>{selectedPet.name} için kaydedilen sağlık notları</Text>
            </View>
            {conditions.length === 0 ? (
              <View style={styles.cardWithPadding}>
                <Text style={styles.mutedInline}>Kayıtlı rahatsızlık yok.</Text>
              </View>
            ) : (
              conditions.map((condition) => (
                <View key={condition.id} style={styles.cardRow}>
                  <View style={styles.alertIcon}>
                    <Icon name="alert-circle" size={21} color={colors.accent} />
                  </View>
                  <View style={styles.flexContent}>
                    <Text style={styles.itemTitle}>{condition.title}</Text>
                    <Text style={styles.itemMeta}>{condition.date} tarihinde eklendi</Text>
                    {condition.note ? <Text style={styles.alertText}>{condition.note}</Text> : null}
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {filter === 'Veteriner notları' ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, styles.notesTitle]}>Veteriner notları</Text>
            {vetNotes.length === 0 ? (
              <View style={styles.cardWithPadding}>
                <Text style={styles.mutedInline}>Kayıtlı veteriner notu yok.</Text>
              </View>
            ) : (
              vetNotes.map((note) => (
                <View key={note.id} style={styles.cardWithPadding}>
                  <View style={styles.doctorRow}>
                    <View style={styles.doctorIcon}>
                      <Icon name="activity" size={20} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={styles.itemTitle}>{note.vetName}</Text>
                      <Text style={styles.itemMeta}>{note.date}</Text>
                    </View>
                  </View>
                  <Text style={styles.quote}>&ldquo;{note.note}&rdquo;</Text>
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={addVaccineVisible} transparent animationType="slide" onRequestClose={() => setAddVaccineVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Aşı kaydı ekle</Text>
            <Text style={styles.modalLabel}>Aşı adı</Text>
            <TextInput
              style={styles.modalInput}
              value={vaccineTitle}
              onChangeText={setVaccineTitle}
              placeholder="Örn. Kuduz rapeli"
              placeholderTextColor={colors.mutedForeground}
              testID="vaccine-title-input"
            />
            <Text style={styles.modalLabel}>Tarih (YYYY-AA-GG)</Text>
            <TextInput
              style={styles.modalInput}
              value={vaccineDate}
              onChangeText={setVaccineDate}
              placeholder="2026-09-01"
              placeholderTextColor={colors.mutedForeground}
              testID="vaccine-date-input"
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setAddVaccineVisible(false)}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </Pressable>
              <Pressable style={styles.modalSubmit} onPress={handleAddVaccine} disabled={savingVaccine} testID="vaccine-submit">
                {savingVaccine ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.modalSubmitText}>Ekle</Text>}
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
  scrollContent: { paddingTop: 16, paddingBottom: 120 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  pageTitle: { marginTop: 4, color: colors.foreground, fontFamily: fonts.heading, fontSize: 26, fontWeight: '900' },
  passportCard: { marginHorizontal: 20, marginTop: 20, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  cover: { height: 160, overflow: 'hidden', position: 'relative', backgroundColor: colors.muted },
  coverImage: { width: '100%', height: '100%' },
  coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: withAlpha(colors.foreground, '59'), opacity: 0.45 },
  coverBadge: { position: 'absolute', left: 16, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: withAlpha(colors.card, 'E8') },
  coverBadgeText: { color: colors.foreground, fontFamily: fonts.body, fontSize: 11, fontWeight: '900' },
  cardPadding: { padding: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.card, backgroundColor: colors.muted },
  avatarImage: { width: 64, height: 64 },
  profileDetails: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  petName: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 21, fontWeight: '900' },
  currentPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.muted },
  currentPillText: { color: colors.success, fontFamily: fonts.body, fontSize: 10, fontWeight: '900' },
  subtitle: { marginTop: 2, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
  stats: { marginTop: 16, flexDirection: 'row', borderRadius: 14, backgroundColor: withAlpha(colors.muted, '99'), paddingVertical: 12 },
  stat: { flex: 1, paddingHorizontal: 10, borderRightWidth: 1, borderRightColor: colors.border },
  statLabel: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  statValue: { marginTop: 5, color: colors.foreground, fontFamily: fonts.body, fontSize: 11, fontWeight: '900' },
  exportButton: { marginHorizontal: 20, marginTop: 16, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primary },
  exportLeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  exportIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(colors.primaryForeground, '26') },
  exportTitle: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '900' },
  exportSubtitle: { marginTop: 3, color: withAlpha(colors.primaryForeground, 'BF'), fontFamily: fonts.body, fontSize: 11, fontWeight: '600' },
  filterRow: { gap: 8, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 2 },
  filter: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  selectedFilter: { backgroundColor: colors.primary },
  unselectedFilter: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  filterText: { fontFamily: fonts.body, fontSize: 11 },
  selectedFilterText: { color: colors.primaryForeground, fontWeight: '900' },
  unselectedFilterText: { color: colors.mutedForeground, fontWeight: '800' },
  section: { marginTop: 20, paddingHorizontal: 20 },
  sectionHeader: { marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionHeaderOnly: { marginBottom: 12 },
  sectionTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 21, fontWeight: '900' },
  sectionSubtitle: { marginTop: 4, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '600' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: { color: colors.primary, fontFamily: fonts.body, fontSize: 11, fontWeight: '900' },
  card: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  emptyRow: { padding: 20 },
  mutedInline: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12 },
  vaccineRow: { minHeight: 87, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  upcomingRow: { borderBottomWidth: 0, backgroundColor: withAlpha(colors.accent, '0D') },
  vaccineIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  completedIcon: { backgroundColor: colors.muted },
  upcomingIcon: { backgroundColor: withAlpha(colors.accent, '1A') },
  flexContent: { flex: 1 },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  itemTitle: { color: colors.foreground, fontFamily: fonts.body, fontSize: 13, fontWeight: '900' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 },
  completedPill: { backgroundColor: colors.success },
  upcomingPill: { backgroundColor: colors.accent },
  statusText: { fontFamily: fonts.body, fontSize: 9, fontWeight: '900' },
  itemMeta: { marginTop: 5, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '600' },
  weightPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.muted },
  weightText: { color: colors.primary, fontFamily: fonts.body, fontSize: 11, fontWeight: '900' },
  cardWithPadding: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chartEmpty: { minHeight: 100, alignItems: 'center', justifyContent: 'center' },
  trendBox: { marginTop: 12, padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.muted },
  trendTitle: { color: colors.foreground, fontFamily: fonts.body, fontSize: 11, fontWeight: '900' },
  trendBody: { marginTop: 3, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 10, lineHeight: 16, fontWeight: '600' },
  cardRow: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card },
  alertIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(colors.accent, '1A') },
  alertText: { marginTop: 8, color: colors.accent, fontFamily: fonts.body, fontSize: 10, fontWeight: '800' },
  notesTitle: { marginBottom: 12 },
  doctorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doctorIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted },
  quote: { marginTop: 16, padding: 12, borderRadius: 12, color: colors.cardForeground, backgroundColor: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 24, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(23,53,44,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, gap: 6 },
  modalTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 20, fontWeight: '900' },
  modalLabel: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '800', marginTop: 10, marginBottom: 6 },
  modalInput: { height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, paddingHorizontal: 14, color: colors.foreground, fontFamily: fonts.body, fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalCancel: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  modalCancelText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  modalSubmit: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  modalSubmitText: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
});
