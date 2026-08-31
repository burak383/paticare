import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, fonts, radius } from '../theme';
import { useAuth } from '../context/AuthContext';
import { authApi, subscriptionApi } from '../api';
import type { Subscription, SubscriptionPlan, SubscriptionPlanId } from '../api';
import type { RootStackParamList } from '../navigation/types';
import {
  addPlusUpdateListener,
  configureRevenueCat,
  fetchPlusOfferings,
  getPlusCustomerInfo,
  hasPlusEntitlement,
  isRevenueCatConfigured,
  purchasePlusPackage,
  PLUS_ENTITLEMENT_ID,
} from '../purchases';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

type IconName = React.ComponentProps<typeof Feather>['name'];

function Icon({ name, size = 20, color = colors.foreground }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}

function daysLeft(iso: string | null) {
  if (!iso) return 0;
  const diffMs = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const BENEFITS = ['Sınırsız tarama geçmişi'];

export default function PlusScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, updateUser } = useAuth();

  // Local state rather than AuthContext.refreshUser(): that helper re-runs
  // the biometric-lock bootstrap and could kick the user to the Face ID lock
  // screen mid-flow. authApi.fetchCurrentUser() gets the same fresh
  // subscription without that side effect — updateUser() below then patches
  // AuthContext's in-memory user so ProfileScreen/ScanScreen (which read
  // user.subscription straight from AuthContext) see the change immediately
  // too, instead of staying stale until the app restarts.
  const [subscription, setSubscription] = useState<Subscription | null>(user?.subscription ?? null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [trialDays, setTrialDays] = useState(7);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>('yearly');
  const [starting, setStarting] = useState(false);
  const [canceling, setCanceling] = useState(false);

  // Gerçek RevenueCat satın alma durumu — REVENUECAT_IOS_API_KEY /
  // REVENUECAT_ANDROID_API_KEY (mobile/src/purchases.ts) doldurulmadığı
  // sürece isRevenueCatConfigured() false döner ve bu state hiç kullanılmaz,
  // ekran aşağıdaki demo deneme akışını gösterir — bkz. purchases.ts başındaki
  // not.
  const [plusPackages, setPlusPackages] = useState<PurchasesPackage[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [purchasingPackageId, setPurchasingPackageId] = useState<string | null>(null);

  useEffect(() => {
    if (!isRevenueCatConfigured() || !user?.id) return;
    configureRevenueCat(user.id);
    let cancelled = false;
    (async () => {
      const [packages, info] = await Promise.all([fetchPlusOfferings(), getPlusCustomerInfo()]);
      if (!cancelled) {
        setPlusPackages(packages);
        setCustomerInfo(info);
      }
    })();
    const unsubscribe = addPlusUpdateListener((info) => setCustomerInfo(info));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user?.id]);

  async function handlePurchasePackage(pkg: PurchasesPackage) {
    setPurchasingPackageId(pkg.identifier);
    try {
      const info = await purchasePlusPackage(pkg);
      setCustomerInfo(info);
      Alert.alert('Teşekkürler!', 'PatiCare Plus artık aktif.');
    } catch (err) {
      const cancelled = (err as { userCancelled?: boolean } | null)?.userCancelled;
      if (!cancelled) {
        Alert.alert('Satın alma başarısız', err instanceof Error ? err.message : 'Bir şeyler ters gitti.');
      }
    } finally {
      setPurchasingPackageId(null);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const [plansRes, freshUser] = await Promise.all([subscriptionApi.getPlans(), authApi.fetchCurrentUser()]);
        setPlans(plansRes.plans);
        setTrialDays(plansRes.trialDays);
        setSubscription(freshUser.subscription);
        updateUser(freshUser);
      } catch (err) {
        // Non-critical — the screen still works with whatever AuthContext
        // already had, just possibly a beat stale.
      } finally {
        setLoadingPlans(false);
      }
    })();
  }, []);

  async function handleStartTrial() {
    setStarting(true);
    try {
      const updated = await subscriptionApi.startTrial(selectedPlan);
      setSubscription(updated.subscription);
      updateUser(updated);
    } catch (err) {
      Alert.alert('Deneme başlatılamadı', err instanceof Error ? err.message : 'Bir şeyler ters gitti.');
    } finally {
      setStarting(false);
    }
  }

  function handleCancel() {
    Alert.alert(
      'Denemeyi iptal et',
      'Deneme iptal edilecek. Erişimin, denemenin bitiş tarihine kadar sürmeye devam edecek.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'İptal et',
          style: 'destructive',
          onPress: async () => {
            setCanceling(true);
            try {
              const updated = await subscriptionApi.cancelTrial();
              setSubscription(updated.subscription);
              updateUser(updated);
            } catch (err) {
              Alert.alert('Hata', err instanceof Error ? err.message : 'İptal edilemedi.');
            } finally {
              setCanceling(false);
            }
          },
        },
      ],
    );
  }

  const status = subscription?.status ?? 'none';
  const planLabel = plans.find((p) => p.id === subscription?.plan)?.label ?? subscription?.plan ?? '';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable accessibilityLabel="Geri dön" style={styles.headerButton} onPress={() => navigation.goBack()} testID="plus-back-button">
              <Feather name="arrow-left" size={21} color={colors.foreground} />
            </Pressable>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>PATICARE PLUS</Text>
            <Text style={styles.pageTitle}>{trialDays} gün ücretsiz dene</Text>
            <Text style={styles.subtitle}>İstediğin zaman iptal edebilirsin. Kart bilgisi istenmez.</Text>
          </View>
        </View>

        <View style={styles.mainContent}>
          {isRevenueCatConfigured() && hasPlusEntitlement(customerInfo) ? (
            <View style={styles.statusCard} testID="plus-status-active-purchase">
              <View style={styles.statusBadge}>
                <Icon name="check-circle" size={14} color={colors.successForeground} />
                <Text style={styles.statusBadgeText}>PLUS AKTİF</Text>
              </View>
              <Text style={styles.statusTitle}>Gerçek abonelik aktif</Text>
              <Text style={styles.statusText}>
                {customerInfo?.entitlements.active[PLUS_ENTITLEMENT_ID]?.expirationDate
                  ? `Yenileme/son geçerlilik: ${formatDate(customerInfo.entitlements.active[PLUS_ENTITLEMENT_ID].expirationDate)}`
                  : 'Aboneliğin aktif.'}
              </Text>
            </View>
          ) : isRevenueCatConfigured() && plusPackages.length > 0 ? (
            <View style={styles.planToggle} testID="plus-purchase-packages">
              {plusPackages.map((pkg) => (
                <Pressable
                  key={pkg.identifier}
                  style={styles.planOption}
                  onPress={() => handlePurchasePackage(pkg)}
                  disabled={purchasingPackageId === pkg.identifier}
                  testID={`plus-purchase-${pkg.identifier}`}
                >
                  {purchasingPackageId === pkg.identifier ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <>
                      <Text style={styles.planLabel}>{pkg.product.title}</Text>
                      <Text style={styles.planPrice}>{pkg.product.priceString}</Text>
                    </>
                  )}
                </Pressable>
              ))}
            </View>
          ) : null}

          {loadingPlans ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <>
              {status === 'trialing' ? (
                <View style={styles.statusCard} testID="plus-status-trialing">
                  <View style={styles.statusBadge}>
                    <Icon name="check-circle" size={14} color={colors.successForeground} />
                    <Text style={styles.statusBadgeText}>DENEME AKTİF</Text>
                  </View>
                  <Text style={styles.statusTitle}>{planLabel} plan</Text>
                  <Text style={styles.statusText}>
                    {daysLeft(subscription?.trialEndsAt ?? null)} gün kaldı · {formatDate(subscription?.trialEndsAt ?? null)} tarihinde sona erer
                  </Text>
                  <Pressable style={styles.cancelButton} onPress={handleCancel} disabled={canceling} testID="cancel-trial-button">
                    {canceling ? <ActivityIndicator color={colors.destructive} /> : <Text style={styles.cancelButtonText}>Denemeyi iptal et</Text>}
                  </Pressable>
                </View>
              ) : status === 'canceled' ? (
                <View style={styles.statusCard} testID="plus-status-canceled">
                  <View style={[styles.statusBadge, styles.statusBadgeMuted]}>
                    <Icon name="info" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.statusBadgeText, styles.statusBadgeTextMuted]}>İPTAL EDİLDİ</Text>
                  </View>
                  <Text style={styles.statusTitle}>{planLabel} plan</Text>
                  <Text style={styles.statusText}>
                    Erişimin {formatDate(subscription?.trialEndsAt ?? null)} tarihine kadar sürüyor. Bu demo sürümünde yeniden abone olma seçeneği yok.
                  </Text>
                </View>
              ) : status === 'expired' ? (
                <View style={styles.statusCard} testID="plus-status-expired">
                  <View style={[styles.statusBadge, styles.statusBadgeMuted]}>
                    <Icon name="clock" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.statusBadgeText, styles.statusBadgeTextMuted]}>DENEME SONA ERDİ</Text>
                  </View>
                  <Text style={styles.statusTitle}>Ücretsiz deneme hakkını kullandın</Text>
                  <Text style={styles.statusText}>
                    Bu demo sürümünde gerçek bir ödeme sistemi bağlı olmadığı için yeniden abone olma seçeneği bulunmuyor.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.planToggle}>
                    {plans.map((plan) => {
                      const isSelected = selectedPlan === plan.id;
                      return (
                        <Pressable
                          key={plan.id}
                          style={[styles.planOption, isSelected && styles.planOptionSelected]}
                          onPress={() => setSelectedPlan(plan.id)}
                          testID={`plan-toggle-${plan.id}`}
                        >
                          {plan.badgeLabel ? (
                            <View style={styles.planBadge}>
                              <Text style={styles.planBadgeText}>{plan.badgeLabel}</Text>
                            </View>
                          ) : null}
                          <Text style={[styles.planLabel, isSelected && styles.planLabelSelected]}>{plan.label}</Text>
                          <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>{plan.priceLabel}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Pressable style={styles.primaryButton} onPress={handleStartTrial} disabled={starting} testID="start-trial-button">
                    {starting ? (
                      <ActivityIndicator color={colors.primaryForeground} />
                    ) : (
                      <Text style={styles.primaryButtonText}>{trialDays} günlük ücretsiz denemeyi başlat</Text>
                    )}
                  </Pressable>
                </>
              )}

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Neler dahil</Text>
                <View style={styles.benefitList}>
                  {BENEFITS.map((benefit) => (
                    <View key={benefit} style={styles.benefitRow}>
                      <Icon name="check" size={16} color={colors.primary} />
                      <Text style={styles.benefitText}>{benefit}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.demoBox}>
                <Text style={styles.demoLabel}>DEMO MODU</Text>
                <Text style={styles.demoText}>
                  Bu deneme gerçek bir ödeme sağlayıcısına (App Store/Play Store, Stripe vb.) bağlı değil. Kart bilgisi
                  istenmez ve deneme süresi sonunda otomatik ücretlendirme yapılmaz.
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 60 },
  header: { paddingHorizontal: 20, paddingTop: 12 },
  headerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerButton: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border, borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  titleBlock: { marginTop: 24 },
  eyebrow: { color: colors.primary, fontFamily: fonts.body, fontSize: 12, fontWeight: '800', letterSpacing: 1.7 },
  pageTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 28, fontWeight: '800', lineHeight: 36, marginTop: 8, maxWidth: 320 },
  subtitle: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 14, lineHeight: 22, marginTop: 8 },
  mainContent: { paddingHorizontal: 20 },
  statusCard: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius, borderWidth: 1, marginTop: 24, padding: 20 },
  statusBadge: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.success, borderRadius: 20, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 5 },
  statusBadgeMuted: { backgroundColor: colors.muted },
  statusBadgeText: { color: colors.successForeground, fontFamily: fonts.body, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  statusBadgeTextMuted: { color: colors.mutedForeground },
  statusTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 18, fontWeight: '800', marginTop: 12 },
  statusText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 13, lineHeight: 20, marginTop: 6 },
  cancelButton: { alignItems: 'center', borderColor: colors.destructive, borderRadius: 14, borderWidth: 1, height: 46, justifyContent: 'center', marginTop: 16 },
  cancelButtonText: { color: colors.destructive, fontFamily: fonts.body, fontSize: 13, fontWeight: '800' },
  planToggle: { flexDirection: 'row', gap: 12, marginTop: 24 },
  planOption: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius, borderWidth: 1, flex: 1, padding: 16 },
  planOptionSelected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.muted },
  planBadge: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: 12, marginBottom: 8, paddingHorizontal: 8, paddingVertical: 3 },
  planBadgeText: { color: colors.accentForeground, fontFamily: fonts.body, fontSize: 9, fontWeight: '800' },
  planLabel: { color: colors.foreground, fontFamily: fonts.body, fontSize: 14, fontWeight: '800' },
  planLabelSelected: { color: colors.primary },
  planPrice: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 13, fontWeight: '700', marginTop: 4 },
  planPriceSelected: { color: colors.foreground },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius, flexDirection: 'row', gap: 8, height: 56, justifyContent: 'center', marginTop: 20 },
  primaryButtonText: { color: colors.primaryForeground, fontFamily: fonts.body, fontSize: 15, fontWeight: '800' },
  card: { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius, borderWidth: 1, marginTop: 20, padding: 20 },
  cardTitle: { color: colors.foreground, fontFamily: fonts.heading, fontSize: 16, fontWeight: '800' },
  benefitList: { gap: 10, marginTop: 12 },
  benefitRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  benefitText: { color: colors.foreground, fontFamily: fonts.body, fontSize: 14, fontWeight: '600' },
  demoBox: { backgroundColor: colors.muted, borderRadius: 12, marginTop: 20, padding: 14 },
  demoLabel: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  demoText: { color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, marginTop: 6 },
});
