import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { colors, fonts } from '../theme';
import { usePets } from '../context/PetContext';
import { careItemsApi, productsApi, type Product, type PriceNote } from '../api';
import { todayISO } from '../dateUtils';
import type { RootStackParamList } from '../navigation/types';

const radius = 16;
type IconName = React.ComponentProps<typeof Feather>['name'];

function IconCircle({
  icon,
  size = 40,
  iconSize = 20,
  backgroundColor = colors.muted,
  color = colors.primary,
}: {
  icon: IconName;
  size?: number;
  iconSize?: number;
  backgroundColor?: string;
  color?: string;
}) {
  return (
    <View style={[styles.iconCircle, { width: size, height: size, borderRadius: size / 2, backgroundColor }]}>
      <Feather name={icon} size={iconSize} color={color} />
    </View>
  );
}

export default function ProductAnalysisScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'RNAnalizi'>>();
  const { selectedPet } = usePets();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingToCalendar, setAddingToCalendar] = useState(false);

  const [priceNotes, setPriceNotes] = useState<PriceNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [addNoteVisible, setAddNoteVisible] = useState(false);
  const [noteStore, setNoteStore] = useState('');
  const [notePrice, setNotePrice] = useState('');
  const [noteDate, setNoteDate] = useState(todayISO());
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    productsApi
      .getProduct(route.params.productId)
      .then((p) => {
        if (!cancelled) setProduct(p);
      })
      .catch((err) => {
        Alert.alert('Hata', err instanceof Error ? err.message : 'Ürün yüklenemedi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [route.params.productId]);

  useEffect(() => {
    let cancelled = false;
    setLoadingNotes(true);
    productsApi
      .listPriceNotes(route.params.productId)
      .then((notes) => {
        if (!cancelled) setPriceNotes(notes);
      })
      .catch(() => {
        // Non-critical — the rest of the screen still works without price notes.
      })
      .finally(() => {
        if (!cancelled) setLoadingNotes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [route.params.productId]);

  async function handleAddPriceNote() {
    if (!noteStore.trim()) {
      Alert.alert('Mağaza adı gerekli', 'Fiyatı nerede gördüğünü/ödediğini girer misin?');
      return;
    }
    const priceNum = Number(notePrice.replace(',', '.'));
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      Alert.alert('Geçersiz fiyat', 'Geçerli bir fiyat gir, örn. 249,90.');
      return;
    }
    setSavingNote(true);
    try {
      const created = await productsApi.addPriceNote(route.params.productId, {
        store: noteStore.trim(),
        price: priceNum,
        date: noteDate.trim() || todayISO(),
        note: noteText.trim() || undefined,
      });
      setPriceNotes((prev) => [created, ...prev]);
      setAddNoteVisible(false);
      setNoteStore('');
      setNotePrice('');
      setNoteDate(todayISO());
      setNoteText('');
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Fiyat notu eklenemedi.');
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDeletePriceNote(noteId: string) {
    setDeletingNoteId(noteId);
    try {
      await productsApi.deletePriceNote(route.params.productId, noteId);
      setPriceNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Fiyat notu silinemedi.');
    } finally {
      setDeletingNoteId(null);
    }
  }

  async function handleAddToCalendar() {
    if (!product) return;
    if (!selectedPet) {
      Alert.alert('Önce bir evcil hayvan ekle');
      return;
    }
    setAddingToCalendar(true);
    try {
      await careItemsApi.createCareItem({
        petId: selectedPet.id,
        kind: 'medication',
        title: product.name,
        description: product.doseNote,
        tag: product.doseTitle,
        date: todayISO(),
        time: '09:00',
        recurrence: 'Her gün',
      });
      Alert.alert('Takvime eklendi', `${product.name}, ${selectedPet.name} için takvime eklendi.`);
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Takvime eklenemedi.');
    } finally {
      setAddingToCalendar(false);
    }
  }

  function handleInteractionCheck() {
    navigation.navigate('MainTabs', { screen: 'Tara', params: { initialTab: 'security' } });
  }

  async function handleShare() {
    if (!product) return;
    try {
      await Share.share({
        title: product.name,
        message: `${product.brand} — ${product.name}\n${product.aiSummary}`,
      });
    } catch (err) {
      Alert.alert('Paylaşılamadı', err instanceof Error ? err.message : 'Bilinmeyen hata.');
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <Text style={styles.mutedInline}>Ürün bulunamadı.</Text>
          <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
            <Text style={{ color: colors.primary, fontFamily: fonts.body, fontWeight: '800' }}>Geri dön</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable accessibilityLabel="Geri dön" style={styles.headerButton} onPress={() => navigation.goBack()}>
              <Feather name="arrow-left" size={21} color={colors.foreground} />
            </Pressable>

            <View style={styles.petPill}>
              <IconCircle size={20} iconSize={13} icon="award" />
              <Text style={styles.petPillText}>{selectedPet ? `${selectedPet.name} · ${selectedPet.weightKg ?? '—'}kg` : 'Evcil hayvan seç'}</Text>
            </View>

            <Pressable accessibilityLabel="Paylaş" style={styles.headerButton} onPress={handleShare}>
              <Feather name="share-2" size={19} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>ÜRÜN ANALİZİ</Text>
            <Text style={styles.pageTitle}>{selectedPet ? `${selectedPet.name} için daha bilinçli bakım` : 'Ürün detayları'}</Text>
            <Text style={styles.subtitle}>Etiketi inceledik. Bu ürünü bakım planına güvenle ekleyebilirsin.</Text>
          </View>
        </View>

        <View style={styles.mainContent}>
          <View style={styles.productCard}>
            <View style={styles.matchBadge}>
              <Feather name="check-circle" size={14} color={colors.success} />
              <Text style={styles.matchText}>Etiket eşleşti</Text>
            </View>

            <View style={styles.productImageWrap}>
              <Image source={{ uri: product.imageUrl }} resizeMode="contain" style={styles.productImage} />
            </View>

            <View style={styles.productDetails}>
              <Text style={styles.brand}>{product.brand}</Text>
              <Text style={styles.productName}>{product.name}</Text>
              <View style={styles.productMeta}>
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryText}>{product.category}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.summaryCard}>
            <IconCircle icon="star" size={40} iconSize={20} backgroundColor={colors.card} color={colors.primary} />
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryEyebrow}>ÜRÜN ÖZETİ</Text>
              <Text style={styles.summaryTitle}>Bu ürün ne işe yarar?</Text>
              <Text style={styles.summaryText}>{product.aiSummary}</Text>
            </View>
          </View>

          <View style={styles.doseCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleGroup}>
                <IconCircle icon="clipboard" size={36} iconSize={18} />
                <Text style={styles.sectionTitle}>{selectedPet ? `${selectedPet.name} için önerilen doz` : 'Önerilen doz'}</Text>
              </View>
              <View style={styles.dailyBadge}>
                <Text style={styles.dailyBadgeText}>Günlük</Text>
              </View>
            </View>

            <View style={styles.dosePanel}>
              <IconCircle icon="award" size={48} iconSize={24} backgroundColor={colors.card} />
              <View style={styles.doseCopy}>
                <Text style={styles.caption}>{selectedPet ? `${selectedPet.name} · ${selectedPet.weightKg ?? '—'}kg` : ''}</Text>
                <Text style={styles.doseTitle}>{product.doseTitle}</Text>
                <Text style={styles.doseNote}>{product.doseNote}</Text>
              </View>
            </View>

            <View style={styles.infoBox}>
              <Feather name="info" size={18} color={colors.accent} />
              <Text style={styles.infoText}>
                Bu yalnızca genel bir rehberdir. Ambalaj üzerindeki talimatları ve veterinerinizin önerisini
                mutlaka doğrulayın.
              </Text>
            </View>
          </View>

          {product.ingredients.length > 0 ? (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.cardTitle}>Etken maddeler</Text>
              </View>
              <View style={styles.ingredients}>
                {product.ingredients.map((ing, index) => (
                  <View
                    key={ing.name}
                    style={[styles.ingredientRow, index > 0 && styles.ingredientDivider, index === product.ingredients.length - 1 && styles.ingredientLast]}
                  >
                    <View style={styles.ingredientName}>
                      <View style={[styles.ingredientDot, { backgroundColor: [colors.chart1, colors.chart2, colors.chart3, colors.chart4, colors.chart5][index % 5] }]} />
                      <Text style={styles.bodySemibold}>{ing.name}</Text>
                    </View>
                    <Text style={styles.bodyExtraBold}>{ing.amount}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {product.warnings.length > 0 || product.interactsWith.length > 0 ? (
            <View style={styles.card}>
              <View style={styles.warningHeader}>
                <IconCircle icon="alert-triangle" size={40} iconSize={20} backgroundColor={colors.input} color={colors.accent} />
                <View>
                  <Text style={styles.cardTitle}>Uyarılar</Text>
                  <Text style={styles.caption}>Karar vermeden önce gözden geçirin</Text>
                </View>
              </View>

              <View style={styles.alertList}>
                {product.warnings.map((w) => (
                  <View key={w} style={styles.alertItem}>
                    <Feather name="alert-circle" size={18} color={colors.accent} style={styles.alertIcon} />
                    <Text style={styles.alertText}>{w}</Text>
                  </View>
                ))}
                {product.interactsWith.map((interaction) => (
                  <View key={interaction.productName} style={styles.attentionBox}>
                    <Feather name="alert-triangle" size={18} color={colors.accent} />
                    <View style={styles.attentionCopy}>
                      <Text style={styles.attentionLabel}>DİKKAT</Text>
                      <Text style={styles.alertText}>{interaction.note}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <Pressable style={styles.actionCard} onPress={handleInteractionCheck}>
            <View style={styles.actionLeading}>
              <IconCircle icon="shield" />
              <View>
                <Text style={styles.actionTitle}>Birlikte kullanım kontrolü</Text>
                <Text style={styles.caption}>Tara · Güvenlik modunda aç</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={21} color={colors.mutedForeground} />
          </Pressable>

          <View style={styles.cardSmall}>
            <View style={styles.actionLeadingRow}>
              <IconCircle icon="tag" backgroundColor={colors.input} color={colors.accent} />
              <View style={styles.actionFlex}>
                <Text style={styles.actionTitle}>Fiyat notların</Text>
                <Text style={styles.caption}>Gördüğün ya da ödediğin fiyatları burada tut</Text>
              </View>
              <Pressable
                style={styles.addNoteButton}
                onPress={() => setAddNoteVisible(true)}
                testID="price-note-add-button"
              >
                <Feather name="plus" size={16} color={colors.primary} />
              </Pressable>
            </View>

            {loadingNotes ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 14 }} />
            ) : priceNotes.length === 0 ? (
              <Text style={styles.disclaimer}>
                Henüz bir fiyat notun yok. Bu ürünü bir mağazada gördüğünde veya satın aldığında buraya ekleyip
                zaman içindeki fiyat değişimini kendi takip edebilirsin.
              </Text>
            ) : (
              <View style={styles.priceNoteList}>
                {priceNotes.map((n) => (
                  <View key={n.id} style={styles.priceNoteRow} testID={`price-note-${n.id}`}>
                    <View style={styles.actionFlex}>
                      <Text style={styles.bodySemibold}>{n.store}</Text>
                      <Text style={styles.caption}>
                        {new Date(n.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {n.note ? ` · ${n.note}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.bodyExtraBold}>{n.price.toLocaleString('tr-TR')} ₺</Text>
                    {deletingNoteId === n.id ? (
                      <ActivityIndicator color={colors.mutedForeground} style={{ marginLeft: 10 }} />
                    ) : (
                      <Pressable
                        style={styles.priceNoteDelete}
                        onPress={() => handleDeletePriceNote(n.id)}
                        testID={`price-note-delete-${n.id}`}
                        accessibilityLabel={`${n.store} fiyat notunu sil`}
                      >
                        <Feather name="trash-2" size={15} color={colors.mutedForeground} />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.disclaimerNote}>
              Bunlar senin girdiğin notlar — başka mağazaların gerçek zamanlı fiyatlarını göstermiyoruz.
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal visible={addNoteVisible} transparent animationType="slide" onRequestClose={() => setAddNoteVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Fiyat notu ekle</Text>

            <Text style={styles.modalLabel}>Mağaza</Text>
            <TextInput
              style={styles.modalInput}
              value={noteStore}
              onChangeText={setNoteStore}
              placeholder="Örn. Petshop XYZ"
              placeholderTextColor={colors.mutedForeground}
              testID="price-note-store-input"
            />

            <Text style={styles.modalLabel}>Fiyat (₺)</Text>
            <TextInput
              style={styles.modalInput}
              value={notePrice}
              onChangeText={setNotePrice}
              placeholder="249,90"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              testID="price-note-price-input"
            />

            <Text style={styles.modalLabel}>Tarih</Text>
            <TextInput
              style={styles.modalInput}
              value={noteDate}
              onChangeText={setNoteDate}
              placeholder={todayISO()}
              placeholderTextColor={colors.mutedForeground}
              testID="price-note-date-input"
            />

            <Text style={styles.modalLabel}>Not (isteğe bağlı)</Text>
            <TextInput
              style={styles.modalInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Örn. Kampanyalı fiyat"
              placeholderTextColor={colors.mutedForeground}
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setAddNoteVisible(false)}>
                <Text style={styles.modalCancelText}>Vazgeç</Text>
              </Pressable>
              <Pressable style={styles.modalSubmit} onPress={handleAddPriceNote} disabled={savingNote} testID="price-note-submit">
                {savingNote ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.modalSubmitText}>Ekle</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.footer}>
        <Pressable style={styles.primaryButton} onPress={handleAddToCalendar} disabled={addingToCalendar}>
          {addingToCalendar ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="calendar" size={21} color={colors.primaryForeground} />
              <Text style={styles.primaryButtonText}>Takvime ekle</Text>
            </>
          )}
        </Pressable>
        <Text style={styles.reminder}>
          {selectedPet ? `${selectedPet.name} için her gün 09:00 · ${product.name} hatırlatıcısı` : 'Hatırlatıcı eklemek için evcil hayvan seç'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mutedInline: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 13 },
  scrollContent: { paddingBottom: 150 },
  header: { paddingHorizontal: 20, paddingTop: 12 },
  headerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerButton: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  petPill: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 7 },
  petPillText: { color: colors.foreground, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
  titleBlock: { marginTop: 24 },
  eyebrow: { color: colors.primary, fontFamily: fonts.body, fontSize: 12, fontWeight: '800', letterSpacing: 1.7 },
  pageTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 28, fontWeight: '800', lineHeight: 36, marginTop: 8, maxWidth: 320 },
  subtitle: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 14, lineHeight: 24, marginTop: 8 },
  mainContent: { paddingHorizontal: 20 },
  productCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius, borderWidth: 1, marginTop: 24, padding: 20 },
  matchBadge: { alignItems: 'center', alignSelf: 'flex-end', backgroundColor: colors.muted, borderRadius: 20, flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingVertical: 6 },
  matchText: { color: colors.success, fontFamily: fonts.body, fontSize: 10, fontWeight: '800' },
  productImageWrap: { alignItems: 'center', height: 190, justifyContent: 'center', marginTop: 4 },
  productImage: { height: 192, width: 192 },
  productDetails: { borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 16 },
  brand: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
  productName: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 20, fontWeight: '800', lineHeight: 28, marginTop: 4 },
  productMeta: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 12 },
  categoryPill: { backgroundColor: colors.secondary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  categoryText: { color: colors.secondaryForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '800' },
  caption: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
  summaryCard: { alignItems: 'flex-start', backgroundColor: colors.secondary, borderColor: colors.border, borderRadius: radius, borderWidth: 1, flexDirection: 'row', gap: 12, marginTop: 16, padding: 20 },
  summaryCopy: { flex: 1 },
  summaryEyebrow: { color: colors.secondaryForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '800', letterSpacing: 1, opacity: 0.7 },
  summaryTitle: { color: colors.secondaryForeground, fontFamily: fonts.heading, fontSize: 18, fontWeight: '800', marginTop: 4 },
  summaryText: { color: colors.secondaryForeground, fontFamily: fonts.body, fontSize: 14, lineHeight: 24, marginTop: 8 },
  doseCard: { backgroundColor: colors.card, borderColor: colors.primary, borderRadius: radius, borderWidth: 2, marginTop: 20, padding: 20 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitleGroup: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8 },
  sectionTitle: { color: colors.foreground, flex: 1, fontFamily: fonts.heading, fontSize: 18, fontWeight: '800' },
  dailyBadge: { backgroundColor: colors.success, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  dailyBadgeText: { color: colors.successForeground, fontFamily: fonts.body, fontSize: 10, fontWeight: '800' },
  dosePanel: { alignItems: 'flex-end', backgroundColor: colors.muted, borderRadius: radius, flexDirection: 'row', gap: 12, marginTop: 20, padding: 16 },
  doseCopy: { flex: 1 },
  doseTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 20, fontWeight: '800', lineHeight: 28, marginTop: 4 },
  doseNote: { color: colors.primary, fontFamily: fonts.body, fontSize: 14, fontWeight: '700', marginTop: 4 },
  infoBox: { alignItems: 'flex-start', backgroundColor: colors.input, borderColor: colors.border, borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 10, marginTop: 16, padding: 12 },
  infoText: { color: colors.accent, flex: 1, fontFamily: fonts.body, fontSize: 12, fontWeight: '600', lineHeight: 20 },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius, borderWidth: 1, marginTop: 20, padding: 20 },
  cardTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 20, fontWeight: '800' },
  ingredients: { marginTop: 12 },
  ingredientRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  ingredientDivider: { borderTopColor: colors.border, borderTopWidth: 1 },
  ingredientLast: { paddingBottom: 0 },
  ingredientName: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  ingredientDot: { borderRadius: 4, height: 8, width: 8 },
  bodySemibold: { color: colors.foreground, fontFamily: fonts.body, fontSize: 14, fontWeight: '600' },
  bodyExtraBold: { color: colors.foreground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  warningHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  alertList: { gap: 12, marginTop: 16 },
  alertItem: { alignItems: 'flex-start', backgroundColor: colors.muted, borderRadius: 12, flexDirection: 'row', gap: 12, padding: 12 },
  alertIcon: { marginTop: 2 },
  alertText: { color: colors.foreground, flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  attentionBox: { alignItems: 'flex-start', backgroundColor: colors.input, borderColor: colors.accent, borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 10, padding: 12 },
  attentionCopy: { flex: 1 },
  attentionLabel: { color: colors.accent, fontFamily: fonts.body, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  actionCard: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, padding: 16 },
  actionLeading: { alignItems: 'center', flexDirection: 'row', gap: 12, flex: 1 },
  actionLeadingRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  actionFlex: { flex: 1 },
  actionTitle: { color: colors.foreground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  cardSmall: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius, borderWidth: 1, marginTop: 16, padding: 16 },
  disclaimer: { borderTopColor: colors.border, borderTopWidth: 1, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 10, lineHeight: 16, marginTop: 12, paddingTop: 12 },
  iconCircle: { alignItems: 'center', justifyContent: 'center' },
  footer: { backgroundColor: colors.background, borderTopColor: colors.border, borderTopWidth: 1, bottom: 0, left: 0, paddingHorizontal: 20, paddingTop: 12, position: 'absolute', right: 0, paddingBottom: 20 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius, flexDirection: 'row', gap: 8, height: 56, justifyContent: 'center' },
  primaryButtonText: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 16, fontWeight: '800' },
  reminder: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, fontWeight: '600', marginBottom: 4, marginTop: 8, textAlign: 'center' },
  addNoteButton: { alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 16, backgroundColor: colors.input },
  priceNoteList: { marginTop: 14, gap: 10 },
  priceNoteRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  priceNoteDelete: { marginLeft: 10, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.muted },
  disclaimerNote: { borderTopColor: colors.border, borderTopWidth: 1, color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 10, lineHeight: 16, marginTop: 12, paddingTop: 12 },
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
