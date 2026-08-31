// PatiCare Plus — gerçek satın alma (RevenueCat / react-native-purchases).
//
// ÖNEMLİ — bu dosya YAZILDI ama UÇTAN UCA TEST EDİLEMEDİ: gerçek bir satın
// alma denemek için (a) EAS ile alınmış bir development build gerekiyor
// (Expo Go'da native IAP modülü çalışmaz — RevenueCat SDK'sı Expo Go'da
// otomatik olarak "Preview API Mode"a düşüp native çağrıları mock'lar, yani
// çökmez ama gerçek satın alma da yapmaz), (b) App Store Connect / Google
// Play Console'da PLUS_PRODUCT_IDS ile birebir eşleşen abonelik ürünleri
// tanımlanmış olmalı, (c) RevenueCat panelinde bu ürünleri saran bir
// "Offering" ve PLUS_ENTITLEMENT_ID kimlikli bir "Entitlement" kurulmuş
// olmalı. Bunların hiçbiri bu ortamda kurulamaz/denenemez — görev #44 (EAS)
// tamamlanıp gerçek bir cihazda dev build çalıştırıldığında test edilmeli.
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

// RevenueCat panelinden (Project settings > API keys) alınan, platforma özel
// "public" SDK anahtarları — bunlar gizli/secret değildir, istemci kodunda
// durmaları RevenueCat'in tasarımı gereği güvenlidir. Kendi RevenueCat
// hesabını oluşturup buraya yapıştırman gerekiyor; boş kaldığı sürece bu
// modüldeki hiçbir fonksiyon gerçek bir şey yapmaz (aşağıdaki
// isRevenueCatConfigured() false döner) ve PlusScreen mevcut demo deneme
// akışını göstermeye devam eder — yani bu dosya, doldurulana kadar hiçbir
// mevcut davranışı değiştirmez.
const REVENUECAT_IOS_API_KEY = '';
const REVENUECAT_ANDROID_API_KEY = '';

// RevenueCat panelinde bu kimlikle bir Entitlement oluşturulmalı (ör.
// "plus"), Aylık/Yıllık ürünlerin ikisi de bu Entitlement'a bağlanmalı.
export const PLUS_ENTITLEMENT_ID = 'plus';

// App Store Connect / Google Play Console'da BİREBİR bu kimliklerle abonelik
// ürünleri oluşturulmalı — backend/src/subscription.js'teki PLANS[*].productId
// ile de eşleşiyor olmalı (bkz. o dosyadaki yorum).
export const PLUS_PRODUCT_IDS = {
  monthly: 'com.paticare.app.plus.monthly',
  yearly: 'com.paticare.app.plus.yearly',
} as const;

let configured = false;

export function isRevenueCatConfigured() {
  return Platform.OS === 'ios' ? Boolean(REVENUECAT_IOS_API_KEY) : Boolean(REVENUECAT_ANDROID_API_KEY);
}

// appUserID'yi bilerek PatiCare'in kendi kullanıcı id'siyle aynı tutuyoruz
// (Purchases.logIn(user.id)) — böylece backend'deki RevenueCat webhook
// handler'ı (POST /api/subscription/revenuecat-webhook) event.app_user_id'yi
// doğrudan db.users id'siyle eşleştirebiliyor, ayrı bir eşleme tablosu
// gerekmiyor.
export function configureRevenueCat(appUserID: string) {
  if (configured || !isRevenueCatConfigured()) return;
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_API_KEY : REVENUECAT_ANDROID_API_KEY;
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey, appUserID });
  configured = true;
}

export async function fetchPlusOfferings(): Promise<PurchasesPackage[]> {
  if (!configured) return [];
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch (err) {
    console.warn('[PatiCare] RevenueCat offerings alınamadı:', err);
    return [];
  }
}

// Satın alma tamamlandığında güncel CustomerInfo'yu döndürür — kullanıcı
// native satın alma ekranını iptal ederse RevenueCat bir hata fırlatır
// (err.userCancelled === true); çağıran taraf bu durumda kullanıcıya hata
// göstermemeli.
export async function purchasePlusPackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function getPlusCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (err) {
    console.warn('[PatiCare] RevenueCat müşteri bilgisi alınamadı:', err);
    return null;
  }
}

export function hasPlusEntitlement(info: CustomerInfo | null): boolean {
  return Boolean(info?.entitlements.active[PLUS_ENTITLEMENT_ID]);
}

// CustomerInfo her değiştiğinde (satın alma, yenileme, iptal...) tetiklenir.
// Döndürülen fonksiyonu unmount'ta çağırıp dinleyiciyi kaldır.
export function addPlusUpdateListener(listener: (info: CustomerInfo) => void) {
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => Purchases.removeCustomerInfoUpdateListener(listener);
}
