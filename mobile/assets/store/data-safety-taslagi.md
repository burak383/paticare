# PatiCare — Data Safety (Veri Güvenliği) Formu Taslağı

Play Console > App content > Data safety bölümünü doldururken kullanılacak taslak.
Kod tabanı taranarak (backend `db.js` şeması, mobile `package.json` bağımlılıkları)
gerçekte ne toplandığı çıkarıldı — hiçbir varsayımsal/pazarlama amaçlı veri eklenmedi.

## 1. Genel sorular

- **Uygulamanız kullanıcı verisi topluyor veya paylaşıyor mu?** Evet.
- **Tüm veriler aktarım sırasında şifreleniyor mu (HTTPS)?**
  Üretimde (gerçek, deploy edilmiş backend ile) **Evet** olmalı — backend'i
  deploy ederken (task #59) HTTPS zorunlu kılınmalı. Şu an yalnızca yerel
  `http://localhost` ile test ediliyor, bu haliyle Play'e gönderilemez.
- **Kullanıcılar veri silme talep edebiliyor mu?** Evet — uygulama içi
  (Profil → Hesabımı ve tüm verilerimi sil) ve uygulama dışı web bağlantısı
  (task #54'te yayınlanan sayfa) ile.

## 2. Toplanan veri türleri

### Kişisel bilgiler (Personal info)
| Veri | Toplanıyor mu | Zorunlu mu | Amaç | Paylaşılıyor mu |
|---|---|---|---|---|
| Ad | Evet | Zorunlu | Hesap işlevi | Hayır |
| E-posta adresi | Evet | Zorunlu | Hesap işlevi, iletişim | Hayır |

### Fotoğraflar ve videolar
| Veri | Toplanıyor mu | Zorunlu mu | Amaç | Paylaşılıyor mu |
|---|---|---|---|---|
| Fotoğraflar | Evet (evcil hayvan fotoğrafları, ürün tarama fotoğrafları) | Opsiyonel | Uygulama işlevi | **Ürün tarama fotoğrafları**, `GOOGLE_VISION_API_KEY` yapılandırıldığında etiket tanıma için Google Cloud Vision API'ye gönderiliyor (hizmet sağlayıcı olarak paylaşım) |

### Finansal bilgiler (Financial info)
| Veri | Toplanıyor mu | Zorunlu mu | Amaç | Paylaşılıyor mu |
|---|---|---|---|---|
| Satın alma geçmişi | RevenueCat + gerçek IAP yapılandırıldığında evet (task #52) | Opsiyonel | Abonelik yönetimi | Evet — RevenueCat (hizmet sağlayıcı) ve Apple/Google mağazaları ile |

### Uygulama etkinliği (App activity)
| Veri | Toplanıyor mu | Zorunlu mu | Amaç | Paylaşılıyor mu |
|---|---|---|---|---|
| Uygulama içi eylemler | Evet (bakım görevleri, tarama geçmişi, fiyat notları) | Zorunlu (temel işlev) | Uygulama işlevi | Hayır |

### Cihaz veya diğer kimlikler (Device or other IDs)
| Veri | Toplanıyor mu | Zorunlu mu | Amaç | Paylaşılıyor mu |
|---|---|---|---|---|
| Push bildirim token'ı | Evet | Opsiyonel (bildirimler kapatılabilir) | Hatırlatıcı bildirimleri göndermek | Evet — Expo'nun push servisi (ve onun üzerinden Google FCM / Apple APNs) aracılığıyla, yalnızca bildirim iletimi için |

### Toplanmayan veriler
Konum, kişiler, mesajlar, web tarama geçmişi, ses kaydı, dosyalar/belgeler,
takvim (cihaz takvimi değil — uygulama içi bakım takvimi, yukarıda "uygulama
etkinliği" altında).

## 3. Değerlendirme gerektiren nokta — evcil hayvan sağlık verisi

Aşı geçmişi, sağlık durumları ve veteriner notları toplanıyor, ama bunlar
**kullanıcının kendi** sağlık verisi değil, evcil hayvanının. Play'in "Health
and fitness" kategorisi tanım olarak uygulamanın kullanıcısına ait sağlık
verilerini kapsıyor; bu yüzden teknik olarak bu kategoriye girmeyebilir. Yine
de temkinli olmak adına ya "Health and fitness" altında ek bir açıklama
notuyla beyan etmenizi ya da en azından "App activity" altındaki genel
açıklamada evcil hayvan sağlık kayıtlarından açıkça bahsetmenizi öneririm —
KVKK incelemesi yapacak avukata da bu noktayı sormanız iyi olur (task #49 ile
aynı inceleme kapsamına girebilir).

## 4. Biyometrik kilit (Face ID / parmak izi) hakkında not

`expo-local-authentication` uygulama kilidi için kullanılıyor ama biyometrik
veri cihazdan hiç çıkmıyor — işletim sistemi yalnızca "başarılı/başarısız"
sonucunu döndürüyor, PatiCare hiçbir biyometrik veri toplamıyor veya
saklamıyor. Data Safety formunda bu nedenle ayrı bir veri türü olarak
belirtilmesi gerekmiyor.

## 5. Üçüncü taraf SDK'lar (referans)

Kod tabanında analytics/crash-reporting SDK'sı (Firebase, Sentry, Amplitude
vb.) **yok** — bu nedenle "Analytics" veya "Crash logs" için ayrı bir beyan
gerekmiyor. Kullanılan tek dış servisler: Google Cloud Vision (opsiyonel,
yapılandırılırsa), RevenueCat (opsiyonel, gerçek IAP kurulunca), Expo push
servisi (bildirimler açıksa).
