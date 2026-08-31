import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { colors, fonts } from '../theme';
import { usePets } from '../context/PetContext';
import { productsApi, type Product, type SafetyAnalysis, type ScanHistoryEntry } from '../api';
import type { RootStackParamList, MainTabParamList } from '../navigation/types';

const scanImage =
  'https://fwtngjyirchhhysukjxi.supabase.co/storage/v1/object/public/project-images/bdc175db-7851-4139-9f11-a3216057da08/835a2c40-7f2c-4701-a2f5-112660366893.png';
const securityImage =
  'https://fwtngjyirchhhysukjxi.supabase.co/storage/v1/object/public/project-images/bdc175db-7851-4139-9f11-a3216057da08/026da4df-a98f-4f0d-bc47-99ce80d667c0.png';

type IconName = keyof typeof Feather.glyphMap;

function Icon({ name, size = 20, color = colors.foreground }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}

export default function ScanScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList> & BottomTabNavigationProp<MainTabParamList, 'Tara'>>();
  const route = useRoute<RouteProp<MainTabParamList, 'Tara'>>();
  const { selectedPet } = usePets();
  const [tab, setTab] = useState<'camera' | 'security'>('camera');

  // HomeScreen's "Güvenlik kontrolü" quick action and ProductAnalysisScreen's
  // "Birlikte kullanım kontrolü" card both deep-link here wanting the
  // Güvenlik segment pre-selected instead of dumping the user on Kamera.
  // Consume the param once, then clear it — otherwise a later plain tap on
  // the bottom "Tara" tab would keep landing on Güvenlik forever, since React
  // Navigation preserves a tab route's last params across a bare tab press.
  useFocusEffect(
    useCallback(() => {
      if (route.params?.initialTab) {
        setTab(route.params.initialTab);
        navigation.setParams({ initialTab: undefined });
      }
    }, [route.params?.initialTab, navigation]),
  );

  // --- Search (the previously missing feature) ---
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const products = await productsApi.searchProducts(query.trim());
        setResults(products);
      } catch (err) {
        // Silent: a failed search shouldn't block the rest of the screen.
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function openProduct(productId: string) {
    setSearchFocused(false);
    navigation.navigate('RNAnalizi', { productId });
  }

  // --- Recent scans ---
  const [recentScans, setRecentScans] = useState<ScanHistoryEntry[]>([]);
  const [scanning, setScanning] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!selectedPet) return;
    try {
      const history = await productsApi.fetchScanHistory(selectedPet.id);
      setRecentScans(history.slice(0, 3));
    } catch {
      // Non-critical — leave list empty on failure.
    }
  }, [selectedPet]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory]),
  );

  async function handleScanPress() {
    setScanning(true);
    try {
      const product = await productsApi.scanProduct({ petId: selectedPet?.id });
      await loadHistory();
      openProduct(product.id);
    } catch (err) {
      Alert.alert('Tarama başarısız', err instanceof Error ? err.message : 'Ürün tanınamadı.');
    } finally {
      setScanning(false);
    }
  }

  // --- Security / interaction analysis ---
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [foodProduct, setFoodProduct] = useState<Product | null>(null);
  const [supplementProduct, setSupplementProduct] = useState<Product | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<SafetyAnalysis | null>(null);

  useEffect(() => {
    productsApi.searchProducts('').then((products) => {
      setAllProducts(products);
      setFoodProduct((prev) => prev ?? products.find((p) => p.category === 'Mama') ?? null);
      setSupplementProduct((prev) => prev ?? products.find((p) => p.category === 'Vitamin ve takviye') ?? null);
    }).catch(() => {});
  }, []);

  function pickProduct(target: 'food' | 'supplement') {
    if (allProducts.length === 0) return;
    Alert.alert(
      target === 'food' ? 'Kullanılan mama' : 'Kullanılacak takviye / ilaç',
      undefined,
      allProducts.map((p) => ({
        text: `${p.brand} — ${p.name}`,
        onPress: () => (target === 'food' ? setFoodProduct(p) : setSupplementProduct(p)),
      })),
    );
  }

  async function handleAnalyze() {
    if (!selectedPet) {
      Alert.alert('Önce bir evcil hayvan ekle');
      return;
    }
    if (!foodProduct || !supplementProduct) {
      Alert.alert('Eksik seçim', 'Analiz için mama ve takviye/ilaç seçmelisin.');
      return;
    }
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const result = await productsApi.analyzeSafety(selectedPet.id, [foodProduct.id, supplementProduct.id]);
      setAnalysis(result);
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Analiz yapılamadı.');
    } finally {
      setAnalyzing(false);
    }
  }

  const riskColor = analysis?.risk === 'high' ? colors.destructive : analysis?.risk === 'medium' ? colors.accent : colors.success;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.cameraHeader}>
          <Image source={{ uri: scanImage }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          <View style={styles.imageShade} />
          <LinearGradient
            colors={[colors.foreground, 'transparent', colors.foreground]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={styles.topControls}>
            <View style={styles.petBadge}>
              {selectedPet?.avatarUrl ? (
                <Image source={{ uri: selectedPet.avatarUrl }} style={styles.petImage} />
              ) : (
                <View style={[styles.petImage, styles.petImageFallback]}>
                  <Icon name="camera" size={16} color={colors.mutedForeground} />
                </View>
              )}
              <View>
                <Text style={styles.eyebrow}>Şunun için analiz</Text>
                <Text style={styles.petName}>
                  {selectedPet ? `${selectedPet.name}${selectedPet.weightKg ? ` · ${selectedPet.weightKg}kg` : ''}` : 'Evcil hayvan seç'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.scanArea}>
            <View style={styles.scanFrame}>
              <View style={styles.innerFrame} />
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
            <Text style={styles.scanHint}>Etiket veya prospektüsü çerçeveye ortalayın</Text>
          </View>

          <View style={styles.cameraActions}>
            <Pressable
              accessibilityLabel="Ürünü tara"
              style={styles.scanButton}
              onPress={handleScanPress}
              disabled={scanning}
            >
              {scanning ? <ActivityIndicator color={colors.primaryForeground} /> : <Icon name="maximize" size={30} color={colors.primaryForeground} />}
            </Pressable>
          </View>
        </View>

        <View style={styles.main}>
          {/* --- Search: the feature that was missing entirely --- */}
          <View style={styles.searchWrap}>
            <View style={styles.searchBox}>
              <Icon name="search" size={18} color={colors.mutedForeground} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                onFocus={() => setSearchFocused(true)}
                placeholder="Ürün adıyla ara (örn. OmegaPet, PatiPlus)"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="search"
              />
              {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
              {query.length > 0 && !searching ? (
                <Pressable onPress={() => setQuery('')} accessibilityLabel="Aramayı temizle">
                  <Icon name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>

            {searchFocused ? (
              <View style={styles.searchResults}>
                {results.length === 0 ? (
                  <Text style={styles.searchEmpty}>{query ? 'Sonuç bulunamadı.' : 'Aramaya başlamak için yaz.'}</Text>
                ) : (
                  results.map((product) => (
                    <Pressable key={product.id} style={styles.searchResultRow} onPress={() => openProduct(product.id)}>
                      <Image source={{ uri: product.imageUrl }} style={styles.searchResultImage} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.searchResultName} numberOfLines={1}>{product.name}</Text>
                        <Text style={styles.searchResultMeta}>{product.brand} · {product.category}</Text>
                      </View>
                      <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
                    </Pressable>
                  ))
                )}
                <Pressable style={styles.searchClose} onPress={() => setSearchFocused(false)}>
                  <Text style={styles.searchCloseText}>Kapat</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.segmentedControl}>
            <Pressable onPress={() => setTab('camera')} style={[styles.segment, tab === 'camera' && styles.selectedSegment]}>
              <Text style={[styles.segmentText, tab === 'camera' && styles.selectedSegmentText]}>Kamera</Text>
            </Pressable>
            <Pressable onPress={() => setTab('security')} style={[styles.segment, tab === 'security' && styles.selectedSegment]}>
              <Text style={[styles.segmentText, tab === 'security' && styles.selectedSegmentText]}>Güvenlik</Text>
            </Pressable>
          </View>

          {tab === 'camera' ? (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeading}>
                  <View>
                    <Text style={styles.heading}>Son taramalar</Text>
                    <Text style={styles.mutedText}>Ürünleri yeniden aç</Text>
                  </View>
                </View>

                {recentScans.length === 0 ? (
                  <View style={styles.recentCard}>
                    <Text style={styles.mutedText}>Henüz tarama yok. Yukarıdaki kamera butonunu veya arama kutusunu dene.</Text>
                  </View>
                ) : (
                  recentScans.map((entry) => (
                    <Pressable
                      key={entry.id}
                      style={styles.recentCard}
                      onPress={() => entry.product && openProduct(entry.product.id)}
                    >
                      <Image source={{ uri: entry.product?.imageUrl }} style={styles.productImage} />
                      <View style={styles.recentCopy}>
                        <Text numberOfLines={2} style={styles.cardTitle}>{entry.product?.name}</Text>
                        <Text style={styles.mutedText}>
                          {new Date(entry.scannedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} · {entry.resultSummary}
                        </Text>
                      </View>
                      <Icon name="chevron-right" color={colors.mutedForeground} />
                    </Pressable>
                  ))
                )}
              </View>

              <Pressable
                style={styles.securityPromo}
                onPress={() => setTab('security')}
                accessibilityLabel="Güvenlik sekmesine geç"
                testID="security-promo-card"
              >
                <Image source={{ uri: securityImage }} style={styles.securityImage} />
                <View style={styles.promoCopy}>
                  <View style={styles.promoLabel}>
                    <Icon name="shield" size={17} color={colors.secondaryForeground} />
                    <Text style={styles.promoLabelText}>GÜVENLİK KONTROLÜ</Text>
                  </View>
                  <Text style={styles.promoTitle}>Mama ve ürünü birlikte kontrol edin</Text>
                  <Text style={styles.promoText}>
                    {selectedPet?.name ?? 'Dostunun'} günlük hedeflerini ve olası etkileşimleri karşılaştırmak için Güvenlik
                    sekmesine geç.
                  </Text>
                </View>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.section}>
                <Text style={styles.heading}>Güvenlik analizi</Text>
                <Text style={styles.mutedText}>
                  Değerlendirilen hayvan: {selectedPet ? `${selectedPet.name} · ${selectedPet.species}` : 'Seçilmedi'}
                </Text>

                <View style={styles.formStack}>
                  <Pressable style={styles.selectorCard} onPress={() => pickProduct('food')}>
                    <View style={styles.selectorHeader}>
                      <Text style={styles.mutedLabel}>Kullanılan mama</Text>
                      <Icon name="chevron-down" size={18} color={colors.mutedForeground} />
                    </View>
                    <Text style={styles.selectorValue}>{foodProduct ? foodProduct.name : 'Seç'}</Text>
                  </Pressable>
                  <Pressable style={styles.selectorCard} onPress={() => pickProduct('supplement')}>
                    <View style={styles.selectorHeader}>
                      <Text style={styles.mutedLabel}>Kullanılacak takviye / ilaç</Text>
                      <Icon name="chevron-down" size={18} color={colors.mutedForeground} />
                    </View>
                    <Text style={styles.selectorValue}>{supplementProduct ? supplementProduct.name : 'Seç'}</Text>
                  </Pressable>
                  <Pressable style={styles.primaryButton} onPress={handleAnalyze} disabled={analyzing}>
                    {analyzing ? (
                      <ActivityIndicator color={colors.primaryForeground} />
                    ) : (
                      <>
                        <Icon name="shield" size={18} color={colors.primaryForeground} />
                        <Text style={styles.primaryButtonText}>Analiz et</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>

              {analysis ? (
                <View style={[styles.warningCard, { borderColor: riskColor }]}>
                  <View style={styles.warningHeader}>
                    <View style={[styles.warningIcon, { borderColor: riskColor }]}>
                      <Icon name={analysis.risk === 'high' ? 'alert-triangle' : 'check-circle'} size={21} color={riskColor} />
                    </View>
                    <View style={styles.warningCopy}>
                      <Text style={styles.warningTitle}>
                        {analysis.risk === 'high' ? 'Dikkat · Günlük hedef aşılıyor' : analysis.risk === 'medium' ? 'Hedefe yakın' : 'Güvenli aralıkta'}
                      </Text>
                      <Text style={styles.warningText}>{analysis.recommendation}</Text>
                    </View>
                  </View>

                  <View style={styles.warningDetails}>
                    <Text style={styles.warningTitle}>Katkı dağılımı</Text>
                    {analysis.contributions.map((c) => (
                      <View key={c.productId} style={styles.contributionRow}>
                        <Text style={styles.warningText}>{c.name}</Text>
                        <Text style={styles.warningText}>{c.omega3Mg} mg</Text>
                      </View>
                    ))}
                    <View style={styles.totalRow}>
                      <Text style={styles.warningTitle}>Toplam</Text>
                      <Text style={styles.warningTitle}>{analysis.totalMg} mg / gün</Text>
                    </View>

                    {analysis.risk !== 'low' ? (
                      <View style={styles.vetButton}>
                        <Icon name="alert-triangle" size={19} color={colors.destructiveForeground} />
                        <Text style={styles.vetButtonText}>Veterinere danışın</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 112 },
  cameraHeader: { height: 340, overflow: 'hidden', backgroundColor: colors.foreground, position: 'relative' },
  imageShade: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.foreground, opacity: 0.28 },
  topControls: { position: 'absolute', top: 46, left: 20, right: 20, zIndex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  petBadge: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 8, paddingRight: 12, borderRadius: 28, backgroundColor: colors.card },
  petImage: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.muted },
  petImageFallback: { alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 10, fontWeight: '700' },
  petName: { color: colors.foreground, fontFamily: fonts.body, fontSize: 12, fontWeight: '800', marginTop: 1 },
  scanArea: { position: 'absolute', top: 110, left: 20, right: 20, alignItems: 'center' },
  scanFrame: { width: '100%', height: 160, borderWidth: 2, borderColor: colors.card, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  innerFrame: { position: 'absolute', width: '82%', height: 120, borderWidth: 1, borderColor: colors.card, opacity: 0.35, borderRadius: 20 },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: colors.primary, borderWidth: 4 },
  cornerTopLeft: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 28 },
  cornerTopRight: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 28 },
  cornerBottomLeft: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 28 },
  cornerBottomRight: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 28 },
  scanHint: { marginTop: 14, color: colors.card, fontFamily: fonts.body, fontSize: 14, fontWeight: '700' },
  cameraActions: { position: 'absolute', bottom: 20, left: 20, right: 20, alignItems: 'center' },
  scanButton: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderWidth: 5, borderColor: colors.card },
  main: { paddingHorizontal: 20, paddingTop: 20 },
  searchWrap: { marginBottom: 16 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, color: colors.foreground, fontFamily: fonts.body, fontSize: 14 },
  searchResults: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 8,
    gap: 4,
  },
  searchEmpty: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, padding: 12, textAlign: 'center' },
  searchResultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 12 },
  searchResultImage: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.muted },
  searchResultName: { color: colors.foreground, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  searchResultMeta: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  searchClose: { alignItems: 'center', paddingVertical: 8 },
  searchCloseText: { color: colors.primary, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
  segmentedControl: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: colors.muted },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
  selectedSegment: { backgroundColor: colors.card },
  segmentText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 14, fontWeight: '700' },
  selectedSegmentText: { color: colors.foreground, fontWeight: '800' },
  section: { marginTop: 24 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  heading: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 18, fontWeight: '800' },
  mutedText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, lineHeight: 19, marginTop: 4 },
  recentCard: { minHeight: 82, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 12 },
  productImage: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.input },
  recentCopy: { flex: 1 },
  cardTitle: { flex: 1, color: colors.foreground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  securityPromo: { overflow: 'hidden', marginTop: 24, borderRadius: 16, backgroundColor: colors.secondary },
  securityImage: { width: '100%', height: 128 },
  promoCopy: { padding: 16 },
  promoLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promoLabelText: { color: colors.secondaryForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  promoTitle: { marginTop: 4, color: colors.secondaryForeground, fontFamily: fonts.heading, fontSize: 18, fontWeight: '800' },
  promoText: { marginTop: 4, color: colors.secondaryForeground, fontFamily: fonts.body, fontSize: 12, lineHeight: 20 },
  formStack: { gap: 12, marginTop: 14 },
  selectorCard: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  selectorHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  mutedLabel: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
  selectorValue: { color: colors.foreground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  primaryButton: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: colors.primary },
  primaryButtonText: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  warningCard: { marginTop: 20, padding: 16, borderRadius: 16, borderWidth: 1, backgroundColor: colors.input },
  warningHeader: { flexDirection: 'row', gap: 12 },
  warningIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  warningCopy: { flex: 1 },
  warningTitle: { color: colors.foreground, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
  warningText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, lineHeight: 20, marginTop: 4 },
  warningDetails: { paddingTop: 14, marginTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  contributionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  vetButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: colors.destructive },
  vetButtonText: { color: colors.destructiveForeground, fontFamily: fonts.body, fontSize: 12, fontWeight: '800' },
});
