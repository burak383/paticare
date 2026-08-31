# PatiCare — Düzeltilmiş ve Tamamlanmış Uygulama

Bu klasör, yüklediğin `petcare.zip` içindeki (FireVibe.ai tarafından üretilmiş) 7 ekranlık
React Native taslağının düzeltilmiş, uçtan uca çalışan halidir. Artık gerçek bir **backend**
ve **arama özelliği** ile birlikte geliyor.

## Önce ne bozuktu?

1. **Uygulama hiç derlenmiyordu.** `theme.ts`, `Colors` / `Fonts` / `Theme` (büyük harfle, düz)
   export ediyordu; ekranlarsa `{ theme }` (yani `theme.colors`) ya da `{ colors, fonts }` import
   ediyordu. Hiçbiri eşleşmiyordu — proje tek satır kod çalışmadan önce hata veriyordu.
2. **Butonların neredeyse hiçbirinde `onPress` yoktu.** Örneğin Ana Sayfa'daki 15
   `TouchableOpacity`'den hiçbiri bir işlev çalıştırmıyordu; "tamamla", "atla", alt gezinme,
   "hatırlatıcı ekle" gibi butonlar tamamen dekoratifti.
3. **Navigasyon yoktu.** `App.tsx`, `package.json`, ekranlar arası geçiş — hiçbiri yoktu. Her
   dosya kendi başına, birbirinden habersiz bir bileşendi.
4. **Arama özelliği hiç yoktu.** Uygulamada bir ürünü adıyla arayıp güvenlik/doz bilgisine
   ulaşabileceğin hiçbir yer yoktu — sadece kamera ile "tarama" vardı, o da işlevsizdi.
5. **Backend tamamen yoktu.** Tüm veriler (Ares, Luna, Mavi, görevler, aşılar...) ekranların
   içine gömülü sabit metinlerdi.

## Ne yapıldı?

- `backend/` — gerçek bir Node/Express API (bkz. aşağıda). Native derleme gerektiren hiçbir
  bağımlılık yok (SQLite yerine basit bir JSON dosya deposu), bu yüzden her makinede
  `npm install && npm start` ile çalışır.
- `mobile/` — düzeltilmiş `theme.ts`, gerçek React Navigation (alt sekme çubuğu + üstte ürün
  detay ekranı), tüm butonların backend'e bağlı gerçek `onPress` işlevleri, ve **Tara**
  sekmesine eklenen gerçek **ürün arama** kutusu (yaz → anlık sonuç → ürün detayına git).
- Tüm TypeScript kodu `tsc --noEmit` ile hatasız derleniyor ve gerçek Metro bundler ile
  (`expo export`) 1000+ modül halinde başarıyla paketlendi — yani proje gerçekten çalışır
  durumda, sadece görsel bir taslak değil.

## Nasıl çalıştırılır

### 1) Backend

```bash
cd backend
npm install
cp .env.example .env
npm start
```

`http://localhost:4000/api/health-check` adresi `{"ok":true,...}` döndürmeli. İlk çalıştırmada
veritabanı otomatik olarak Ares/Luna/Mavi örnek verileriyle doldurulur
(`backend/data/db.json` — silip `npm run seed:reset` ile sıfırlayabilirsin).

Demo hesap: `deniz.kaya@email.com` / `paticare123` (ya da uygulamada "Misafir olarak devam et").

### 2) Mobil uygulama

```bash
cd mobile
npm install
npx expo install --fix   # bu makinedeki tam Expo SDK sürümüne göre paketleri hizalar
npx expo start
```

Ardından Expo Go ile QR kodu okut ya da `i` / `a` ile simülatör/emülatör aç.

**Backend adresi:** Varsayılan olarak `mobile/src/api/client.ts` şu adresleri kullanır:
- iOS simülatör / web: `http://localhost:4000/api`
- Android emülatör: `http://10.0.2.2:4000/api`
- Gerçek telefon: bilgisayarının yerel ağ IP'sini kullanmalısın, örn.:
  ```bash
  EXPO_PUBLIC_API_URL=http://192.168.1.23:4000/api npx expo start
  ```

### 3) Gerçek bir APK/AAB derlemek (EAS Build)

PatiCare Plus için eklenecek RevenueCat SDK'sı (`react-native-purchases`) native bir modül —
Expo Go'da çalışmıyor, gerçek cihazda test etmek için EAS Build ile bir "development" veya
"preview" derlemesi almak gerekiyor. `mobile/eas.json` üç profille birlikte hazır:

| Profil | Ne üretir | Ne zaman kullanılır |
| --- | --- | --- |
| `development` | Dev client'lı `.apk` | Metro'ya bağlı, canlı yeniden yükleme ile geliştirme |
| `preview` | Bağımsız, kurulabilir `.apk` | Play Console dışında hızlıca test etmek (`eas build` bitince indirme linki verir) |
| `production` | Play Store için `.aab` | Play Console'a yüklemek |

Bu ortamın (bulut sandbox) dışa dönük ağ erişimi Expo'nun derleme sunucularına
(`api.expo.dev`, `exp.host`) kapalı olduğu için `eas build` **buradan çalıştırılamıyor** —
kendi bilgisayarında çalıştırman gerekiyor:

```bash
cd mobile
npm install
npx eas login                                    # Expo hesabınla giriş (yoksa expo.dev'den ücretsiz oluştur)
npx eas build --platform android --profile preview
```

İlk çalıştırmada `eas init` otomatik tetiklenip projeyi Expo hesabına bağlar. Derleme
Expo'nun bulut sunucularında olur (~10-20 dk) — bilgisayarında Android Studio/SDK kurulu
olması gerekmiyor. Bittiğinde verilen linkten `.apk`'yı indirip telefonuna kurabilir ya da
Play Console'un İç test kanalına yükleyebilirsin.

## Arama özelliği nerede?

**Tara** sekmesinde, kamera görselinin hemen altında bir arama kutusu var
("Ürün adıyla ara..."). Yazdıkça `GET /api/products/search?q=...` uç noktasına 300ms
gecikmeli istek atılır, sonuçlar listelenir, birine dokununca ürün detay/analiz ekranına
gidersin. Aynı ekranın "Güvenlik" sekmesinde de mama + takviye seçip **Analiz et**'e basarak
gerçek bir doz/etkileşim hesaplaması (backend'de hesaplanıyor) görebilirsin.

## Giriş yöntemleri

- **E-posta ile kayıt ol / giriş yap** — tam çalışır durumda.
- **Şifremi unuttum** — Giriş ekranında "Şifremi unuttum" bağlantısı: e-postanı
  gir → 6 haneli bir sıfırlama kodu oluşturulur → kodu ve yeni şifreni gir →
  hesabın açılır. Bu demo backend'de gerçek bir e-posta/SMS sağlayıcısı
  olmadığından kod, e-posta ile gönderilmek yerine doğrudan uygulama içinde
  ("DEMO MODU" etiketiyle) gösterilir ve backend konsoluna loglanır. Gerçek bir
  ortama taşırken `backend/src/routes/auth.js` içindeki `devCode` alanını
  kaldırıp kodu gerçek bir e-posta/SMS sağlayıcısıyla göndermelisin.
- **Google ile giriş** — uçtan uca kodlandı (mobilde `expo-auth-session`,
  backend'de Google'ın `tokeninfo` uç noktasıyla kimlik doğrulama), ama
  çalışması için kendi Google OAuth istemci kimliğin gerekir — bu, senin
  Google Cloud hesabına bağlı olduğundan burada üretilemez. Kurulum:
  1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials)'da bir OAuth 2.0 istemcisi oluştur.
  2. Mobilde: `EXPO_PUBLIC_GOOGLE_CLIENT_ID=<istemci-kimliğin> npx expo start`
  3. Backend'de: `backend/.env` dosyasına `GOOGLE_CLIENT_ID=<aynı istemci kimliği>` ekle.

  Bu değerler ayarlanmadan "Google ile devam et" butonuna basılırsa, uygulama
  sessizce başarısız olmak yerine bunun yapılandırılması gerektiğini açıkça
  söyleyen bir uyarı gösterir.
- **Face ID / parmak izi ile hızlı giriş** — tam çalışır durumda (gerçek cihaz
  gerekir, simülatörde/emülatörde biyometrik donanım yoksa seçenek görünmez).
  E-posta ile giriş yaptıktan sonra uygulama Face ID'yi etkinleştirmek isteyip
  istemediğini sorar; Profil → Hesap ve gizlilik altından da açılıp
  kapatılabilir. Etkinleştirildiğinde, uygulama bir dahaki açılışta oturumu
  otomatik açmak yerine önce Face ID ister (`src/screens/LockScreen.tsx`).
- **Apple ile giriş** — henüz eklenmedi; basılınca bunu açıkça söyleyen bir
  uyarı çıkar.
- **Misafir olarak devam et** — tam çalışır durumda, kayıtlar yalnızca cihazda tutulur.

## Sonradan eklenen özellikler

İlk teslimattan sonra istek üzerine eklenen özellikler:

- **Evcil hayvan fotoğrafı/portresi yükleme** — Karşılama akışında "Portre ekle" ve
  Profil → evcil hayvan düzenleme ekranında fotoğraf değiştirme artık gerçek galeri
  seçiciyi açar (`expo-image-picker`), fotoğrafı 640px genişliğe/%50 JPEG kalitesine
  sıkıştırır (`expo-image-manipulator`) ve base64 `data:` URI olarak kaydeder — bu demo
  gerçek bir dosya depolama servisine (S3 vb.) bağlı olmadığı için resim doğrudan
  kayda gömülür. Daha önce her yeni hayvan otomatik olarak aynı stok görseli
  alıyordu; bu artık düzeltildi.
- **Bildirim sesi seçimi ve hatırlatma saatlerini düzenleme** — Profil → Bildirimler
  ve tercihler altındaki "Bildirim sesi" ve "Varsayılan hatırlatma saatleri"
  satırları artık gerçek modaller açar ve `PATCH /api/users/me/preferences`'a
  kaydeder (önceden "Yakında" uyarısı gösteriyorlardı).
- **Gerçek yerel bildirimler** (`expo-notifications`) — Takvim'de bir hatırlatıcı
  oluşturduğunda, eğer "İlaç hatırlatıcıları" tercihi açıksa ve bildirim izni
  verilmişse, o hatırlatıcının saatinde telefona gerçek bir yerel bildirim
  planlanır. Bir görev tamamlandığında/atlandığında bildirimi otomatik iptal
  edilir; "geri al" ile tekrar planlanır. "İlaç hatırlatıcıları" tercihi
  kapatıldığında bekleyen tüm bildirimler iptal edilir.
- **Gelişmiş ayarlar** (Profil sağ üstteki dişli/ayar ikonu) — artık uygulama
  sürümünü, backend adresini, bildirim izni durumunu gösteren ve izin isteme /
  test bildirimi gönderme butonları içeren gerçek bir modal açıyor (önceden
  "Yakında" uyarısı gösteriyordu).
- **"Fiyatları karşılaştır" → Fiyat notları** — Bu demoda gerçek bir fiyat
  karşılaştırma verisi (rakip mağaza API'si, ortaklık/affiliate entegrasyonu)
  yok; olmayan verileri var gibi göstermek yerine dürüst bir alternatif
  eklendi: kullanıcı bir ürünü bir mağazada gördüğü/ödediği fiyatı kendisi
  kaydedebiliyor (mağaza, fiyat, tarih, not) ve zaman içindeki kendi fiyat
  geçmişini görebiliyor. Backend'de `GET/POST/DELETE
  /api/products/:id/price-notes` uç noktaları olarak saklanıyor.
- **Hakkında / Gizlilik ve verilerim / Hesap silme** — Profil → Hesap ve
  gizlilik altına, uygulama sürümünü gösteren gerçek bir "Hakkında" modalı ve
  hangi verilerin tutulduğunu/kiminle paylaşıldığını açıklayan bir "Gizlilik
  ve verilerim" modalı eklendi. Her ikisinden de hesap silme akışına
  ulaşılabiliyor. Bu iş sırasında gerçek bir hata da bulunup düzeltildi:
  `DELETE /api/users/me` kullanıcının fiyat notlarını (`priceNotes`)
  silmiyordu, yani "hesabını ve tüm verilerini sil" tam olarak doğru değildi
  — artık siliniyor.
- **PatiCare Plus — aylık/yıllık abonelik, 7 gün ücretsiz deneme** — Profil →
  Plus kartından açılan yeni bir ekranda aylık/yıllık plan seçilip 7 günlük
  ücretsiz deneme başlatılabiliyor, durum (kalan gün, bitiş tarihi)
  görülebiliyor ve deneme istenildiğinde iptal edilebiliyor (iptal, erişimi
  hemen kesmiyor — denemenin orijinal bitiş tarihine kadar sürüyor). Deneme
  hakkı kullanıcı başına bir kez kullanılabiliyor; backend bunu
  `subscription.trialUsed`/`status` alanlarıyla ve her okumada tembel (lazy)
  bir son kullanma kontrolüyle takip ediyor (şifre sıfırlama kodundaki TTL
  deseniyle aynı yaklaşım). **Bu demoda gerçek bir ödeme sağlayıcısı (App
  Store/Play Store içi satın alma, Stripe, RevenueCat vb.) bağlı değil** —
  deneme başlatmak kart bilgisi istemiyor ve deneme sonunda otomatik
  ücretlendirme yapılmıyor; ekran bunu "DEMO MODU" notuyla açıkça belirtiyor.
  Plus'ın somut, gerçekten çalışan tek ayrıcalığı: ücretsiz hesaplarda son
  taramalar 3'le sınırlıyken (Tara sekmesi), aktif/iptal edilmiş bir denemesi
  olan hesaplarda bu sınır kalkıyor.
  Gerçek Google Play üzerinden ödeme almaya geçmenin ilk adımı olarak
  `react-native-purchases` (RevenueCat SDK) ve `expo-dev-client` bağımlılıkları
  eklendi, `mobile/eas.json` gerçek bir `.apk`/`.aab` derlemek için hazır (bkz.
  "Gerçek bir APK/AAB derlemek" bölümü) — ancak RevenueCat/Play Console hesap
  kurulumu ve satın alma akışının koda bağlanması henüz tamamlanmadı.

## Backend API özeti

| Uç nokta | Açıklama |
| --- | --- |
| `POST /api/auth/{register,login,guest}` | Kayıt / giriş / misafir girişi (JWT) |
| `POST /api/auth/forgot-password` | Sıfırlama kodu oluşturur (demo: kodu da döner) |
| `POST /api/auth/reset-password` | Kod ile yeni şifre belirler, otomatik giriş yapar |
| `POST /api/auth/social` | Google ID token'ını doğrular, giriş yapar/hesap oluşturur |
| `GET/POST/PATCH/DELETE /api/pets` | Evcil hayvan CRUD |
| `GET/POST/PATCH/DELETE /api/care-items` | Görevler & takvim kayıtları, `/complete` `/skip` `/undo` |
| `GET /api/pets/:id/health`, `.../vaccines`, `.../weight`, `.../export` | Sağlık karnesi |
| `GET /api/products/search?q=` | **Arama** |
| `POST /api/products/scan` | Kamera taramasını simüle eder |
| `POST /api/products/analyze-safety` | Kombine doz/etkileşim analizi |
| `GET/POST/DELETE /api/products/:id/price-notes` | Kullanıcının kendi fiyat notları |
| `PATCH /api/users/me` | Profil bilgileri |
| `PATCH /api/users/me/preferences` | Bildirim tercihleri (ses, saat, hatırlatıcı aç/kapa) |
| `DELETE /api/users/me` | Hesabı ve tüm verilerini sil |
| `GET /api/subscription/plans` | Aylık/yıllık plan fiyatları ve deneme süresi |
| `POST /api/subscription/start-trial` | 7 günlük ücretsiz denemeyi başlatır (kullanıcı başına bir kez) |
| `POST /api/subscription/cancel` | Aktif denemeyi iptal eder (erişim, bitiş tarihine kadar sürer) |

## Backend'i deploy etmek (Render)

Backend, herhangi bir Dockerfile çalıştırabilen platformda çalışacak şekilde
hazırlandı (`backend/Dockerfile`), ama Render için özel olarak bir
`render.yaml` "Blueprint" dosyası da eklendi (proje kökünde). Adımlar:

1. **GitHub'a it (push et).** Proje zaten yerel bir git deposu olarak
   başlatıldı ve ilk commit atıldı. GitHub'da (veya GitLab/Bitbucket) boş bir
   repo oluştur, sonra:
   ```
   git remote add origin https://github.com/<kullanıcı-adın>/paticare-app.git
   git push -u origin main
   ```
2. **Render'da hesap aç / giriş yap** → render.com → "New" → **"Blueprint"**
   seç → GitHub reponu bağla. Render, kökteki `render.yaml`'ı otomatik bulup
   servis ayarlarını (Dockerfile yolu, health check, kalıcı disk) oradan
   okuyacak.
3. **Planı Starter'a yükselt.** ⚠️ Render'ın ücretsiz (Free) planında **kalıcı
   disk desteği yok** — `backend/src/db.js`'nin kullandığı JSON dosya
   veritabanı her redeploy'da (ve ücretsiz planda servis uykuya
   geçip uyandığında) sıfırlanır. `render.yaml`'daki `disk` bloğunun işe
   yaraması için servisi **Starter plana** (şu an ~7$/ay) yükseltmen gerekiyor
   — Render Dashboard'da servis ayarlarından yapılabiliyor.
4. **Gizli environment değişkenlerini gir.** `render.yaml`'da `sync: false`
   olarak işaretlenenler (JWT_SECRET, CORS_ORIGIN, GOOGLE_CLIENT_ID,
   RESEND_API_KEY, RESEND_FROM_EMAIL, GOOGLE_VISION_API_KEY,
   REVENUECAT_WEBHOOK_AUTH_HEADER) Render Dashboard'da servis kurulumu
   sırasında senden tek tek istenecek — hiçbiri git'e/`render.yaml`'a
   yazılmadı. `JWT_SECRET` için gerçek/rastgele bir değer üretmeyi unutma:
   `openssl rand -hex 32`. Diğerleri boş bırakılabilir (her biri `.env.example`
   içinde ne işe yaradığı ve boş bırakılırsa ne olacağı açıklanmış durumda) —
   ama GOOGLE_CLIENT_ID/RESEND_API_KEY gibi görev #45/#46'daki kurulumları
   tamamladığında buraya da eklemen gerekecek.
5. **Deploy'u bekle**, sonra tarayıcıdan
   `https://<servis-adı>.onrender.com/api/health-check` adresini aç —
   `{"ok":true,...}` dönüyorsa backend ayakta demektir.
6. **Mobil uygulamayı gerçek backend'e yönlendir.** `mobile/eas.json`'daki
   `preview` ve `production` profillerine, adres henüz bilinmediği için
   `EXPO_PUBLIC_API_URL` için bir yer tutucu (`REPLACE-WITH-RENDER-URL`)
   eklendi — Render sana gerçek adresi verdiğinde bu iki yerdeki değeri
   gerçek adresle (sonuna `/api` eklemeyi unutma, örn.
   `https://paticare-backend.onrender.com/api`) değiştir. Bu değişiklik
   olmadan derlenen build'ler backend'e ulaşamaz (Android emülatöründe
   `10.0.2.2`'ye, gerçek cihazda ise hiç bağlanamayan `localhost`'a
   düşerler).

## Genel belgeleri GitHub Pages'te yayınlamak

Hesap silme sayfası artık `docs/hesap-silme.html` olarak da repoda duruyor
(Artifact üzerinde yayınlanan sürüm hâlâ geçerli, ama o link paylaşılana
kadar özel — `docs/` altındaki bu kopya GitHub Pages ile kalıcı, herkese açık
bir URL verir). Bunu gerçekten yayına almak — yani "GitHub'a yükleme" — için
gereken adımlar tamamen senin GitHub hesabında olduğundan (buradan doğrudan
push edecek bir kimlik bilgim yok), sırasıyla:

1. Yukarıdaki "Backend'i deploy etmek (Render)" bölümündeki 1. adımı
   uygula: GitHub'da bir repo oluştur, `git remote add origin ...` ve
   `git push -u origin main` ile bu projeyi (docs/ klasörü dahil) it.
2. GitHub'da repo sayfasında **Settings → Pages**'e git.
3. "Build and deployment" altında Source olarak **"Deploy from a branch"**,
   Branch olarak **`main`** ve klasör olarak **`/docs`** seç, Save'e bas.
4. Birkaç dakika içinde sayfa şu adreste yayınlanır:
   `https://<kullanıcı-adın>.github.io/<repo-adı>/hesap-silme.html`
   (kök adres `.../index.html`'e, oradan da bu sayfaya bağlantı verir).
5. Bu URL'yi Play Console'da "Hesap silme" alanına ve mağaza listesindeki
   ilgili yere gir.

Not: Play Store için ayrıca **herkese açık bir gizlilik politikası URL'si**
de gerekiyor — şu an KVKK Aydınlatma Metni yalnızca uygulama içinde
(`mobile/src/components/PrivacyConsent.tsx`) gösteriliyor, `docs/` altında
buna karşılık gelen bir sayfa yok. İstersen aynı yöntemle
`docs/gizlilik-politikasi.html` olarak bir sayfa da hazırlayabilirim.

## Google Play'de yayınlama: kalan adımlar

Bu üç adım hesap/cihaz gerektirdiği için burada sadece hazırlanabildi — fiilen
yapılması kullanıcı tarafında. Sırayla:

### 1. Gerçek cihaz/emülatörden ekran görüntüleri

Bu sandbox'ta gerçek bir Android cihaz/emülatör çalıştırılamadığından ekran
görüntüleri alınamadı — `eas build --profile preview` ile bir APK üretip
kendi cihazına/emülatörüne kurman gerekiyor. Play Console'un güncel
gereksinimleri (support.google.com, Ağustos 2026):
- **En az 2 ekran görüntüsü** zorunlu (mağazada listelenebilmek için); öne
  çıkarma/promosyon uygunluğu için en az 4 önerilir.
- Boyut: 320px – 3840px arası herhangi bir kenar, JPEG veya 24-bit PNG
  (alfa kanalı **olmadan**).
- Tablet için ayrıca en az 4 ekran görüntüsü, 1080px–7680px arası.
- Önerilen ekranlar: BaşlaSayfa/AnaSayfa (bakım listesi), Takvim, Karnem
  (sağlık karnesi), Tara (ürün analizi) — uygulamanın asıl değerini gösteren
  4 ekran.

### 2. `eas submit` için Google Service Account anahtarı

(expo.fyi/creating-google-service-account'a göre, Ağustos 2026)
1. [Google Cloud Console](https://console.cloud.google.com/projectcreate)'da
   bir proje oluştur (veya mevcut birini kullan).
2. "IAM & Admin" → "Service Accounts" → "Create Service Account" ile bir
   servis hesabı oluştur.
3. Servis hesabının "Manage keys" → "Create new key" → JSON adımıyla anahtar
   dosyasını indir ve **güvenli bir yerde sakla** (bu dosya asla git'e
   eklenmemeli).
4. [Google Play Android Developer API](https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com)'yi
   aynı Cloud projesinde etkinleştir.
5. Play Console'da "Users and permissions" → "Invite new users" ile servis
   hesabının e-posta adresini davet et; şu izinleri ver: "View app
   information (read-only)", "Edit and delete draft apps", Releases altında
   yayın yönetimi izinleri, "Manage store presence".
6. `eas submit` çalıştırırken (veya EAS Dashboard'da proje → Credentials →
   Android → Service Credentials → "Add a Google Service Account Key")
   indirdiğin JSON dosyasını yükle.

### 3. Play Console: içerik anketi, kapalı test, gönderim (EN SON)

Play Console hesabın zaten var, yani bu tamamen Console arayüzünde:
1. **İçerik anketi** doldur (hedef kitle yaşı, reklam var mı — yok, veri
   güvenliği formu — taslağı `mobile/assets/store/data-safety-taslagi.md`'de
   hazır).
2. **Kapalı test** aşamasından geç — hesabın 13 Kasım 2023'ten sonra
   açıldıysa (support.google.com/googleplay'e göre) production'a geçmeden
   önce **en az 12 test kullanıcısının kesintisiz 14 gün boyunca** teste
   kayıtlı kalması zorunlu. Bu yüzden bu adımı mümkün olduğunca erken
   başlatmak faydalı — 14 günlük süre backend/eas submit hazır olur olmaz
   işletilebilir.
3. Mağaza listesi metinleri (`mobile/assets/store/play-store-metni.md`),
   feature graphic (`mobile/assets/store/feature-graphic.png`) ve ekran
   görüntüleri (adım 1) yüklenir.
4. Hesap silme bağlantısı olarak yayınlanan sayfanın URL'si ilgili alana
   girilir (Artifact linki — paylaşılmadıysa önce paylaşılmalı, reviewer
   erişebilsin diye).
5. Son inceleme ve **gönder**.

## Production'a taşımadan önce göz önünde bulundurulması gerekenler

Bu proje bir demo/prototip olarak tasarlandı; gerçek kullanıcı trafiği almadan önce:

- **Veritabanı** — şu an tek bir JSON dosyası (`backend/data/db.json`). Eşzamanlı
  yazmalarda veri bütünlüğü garantisi yok ve büyük veri hacminde performanslı
  değil. Gerçek kullanım için Postgres/SQLite gibi gerçek bir veritabanına
  geçirilmeli.
- **`JWT_SECRET`** — `.env.example`'daki varsayılan değer herkese açık. Backend,
  `NODE_ENV=production` ile ve varsayılan değerle başlatılmaya çalışılırsa
  kasıtlı olarak açılmayı reddeder (`backend/src/middleware/auth.js`) — ama yine
  de production'a geçmeden `openssl rand -hex 32` ile üretilmiş gerçek, gizli bir
  değer `.env`'e yazılmalı.
- **HTTPS / gerçek hosting yok** — bu ortamda backend yalnızca yerel ağda düz
  HTTP ile çalışıyor. Gerçek bir sunucuya deploy adımları için yukarıdaki
  "Backend'i deploy etmek (Render)" bölümüne bak — Render kendi HTTPS'ini
  otomatik sağlıyor, ama `CORS_ORIGIN`'in gerçek mobil/uygulama origin'lerine
  daraltılması yine de ayrıca yapılmalı.
- **Şifre sıfırlama kodu** — gerçek bir e-posta/SMS sağlayıcısı olmadığından kod
  doğrudan API yanıtında (`devCode`) dönüyor; production'a taşırken bu alan
  kaldırılıp gerçek bir e-posta/SMS sağlayıcısı bağlanmalı (bkz. yukarıdaki
  "Giriş yöntemleri" bölümü).
- **Fotoğraflar base64 olarak DB'de tutuluyor** — küçük ölçekte çalışır ama
  gerçek bir dosya depolama servisine (S3, Cloudinary vb.) taşınması, hem DB
  boyutunu hem de API yanıt sürelerini önemli ölçüde iyileştirir.
- **Google Play yayın hazırlığı** — `mobile/`, Google Play'in 31 Ağustos 2026
  itibarıyla zorunlu kıldığı `targetSdkVersion` 36 (Android 16) gereksinimini
  karşılamak için Expo SDK 52'den **SDK 54**'e yükseltildi (React Native
  0.76 → 0.81, React 18.3 → 19.1, `@testing-library/react-native` 12 → 14 —
  bu sürümde `render()`/`fireEvent()` artık asenkron, tüm testler buna göre
  güncellendi). `tsc --noEmit` temiz, 112 test yeşil. Mağaza listesi için
  `mobile/assets/store/` altına feature graphic (1024×500), mağaza metni
  taslağı ve Data Safety formu taslağı eklendi; Play'in zorunlu tuttuğu
  bağımsız hesap-silme web sayfası da yayınlandı. Backend'i Render'a deploy
  etmek için proje köküne `render.yaml` eklendi ve proje bir git deposu olarak
  başlatıldı (bkz. yukarıdaki "Backend'i deploy etmek (Render)" bölümü) —
  gerçek deploy'un tamamlanması (GitHub'a push, Render hesabı/plan seçimi,
  gizli env değerlerinin girilmesi) kullanıcı tarafında. Hâlâ eksik olanlar:
  yukarıdaki deploy adımlarının fiilen tamamlanması, `eas init`, gerçek
  cihazdan alınmış ekran görüntüleri ve Play Console'daki içerik anketi/kapalı
  test adımları.
- **PatiCare Plus'ın ödeme altyapısı (RevenueCat) yazıldı ama yapılandırılmadı
  ve test edilemedi** — `react-native-purchases` (RevenueCat) üzerinden gerçek
  App Store/Play Store satın alma akışı eklendi (`mobile/src/purchases.ts`,
  `backend/src/routes/subscription.js`'teki `/revenuecat-webhook`), ama
  `REVENUECAT_IOS_API_KEY`/`REVENUECAT_ANDROID_API_KEY` boş bırakıldığı sürece
  (varsayılan) hiçbir şey değişmez — `start-trial`/`cancel` hâlâ eski demo
  deneme akışını kullanır. Gerçek satın alma test edilebilmesi için: (1) EAS
  dev build (Expo Go'da native IAP çalışmaz — RevenueCat SDK'sı orada otomatik
  mock moduna düşer, çökmez ama gerçek satın alma da yapmaz), (2) App Store
  Connect/Play Console'da eşleşen abonelik ürünleri, (3) RevenueCat panelinde
  bir Offering + `plus` Entitlement'ı, (4) backend'de
  `REVENUECAT_WEBHOOK_AUTH_HEADER` ve RevenueCat panelinde ona işaret eden bir
  webhook kurulumu gerekiyor.

## Bilinen sınırlar

- Google ile giriş, kendi Google OAuth istemci kimliğini ayarlamadan çalışmaz (yukarıdaki
  "Giriş yöntemleri" bölümüne bakın) — ayarlanmadan basılırsa kullanıcıya bunu açıkça
  söyleyen bir uyarı çıkar, sessizce başarısız olmaz.
- Apple ile giriş butonu gerçek OAuth yapmıyor; basılınca kullanıcıya bunu açıkça söyleyen
  bir uyarı çıkar (bilinçli olarak demo bırakıldı — Apple Developer hesabı gerektiriyor).
- Face ID, gerçek biyometrik donanım gerektirir — simülatör/emülatörde veya donanımı
  olmayan bir cihazda seçenek otomatik olarak gizlenir, hataya yol açmaz.
- Kamera taraması artık gerçek bir fotoğraf çekiyor ve backend'e gönderiyor; backend'de
  `GOOGLE_VISION_API_KEY` yapılandırıldıysa (`backend/src/vision.js`) Google Cloud Vision
  ile gerçek etiket/metin tanıma denenip demo ürün veritabanıyla eşleştiriliyor — ama bu
  ortamda gerçek bir Vision anahtarı olmadığı için uçtan uca doğrulanamadı, sadece
  dokümante edilen REST sözleşmesine göre yazıldı. Anahtar yokken ya da eşleşme
  bulunamadığında eski demo davranışına (örnek ürün) dönüyor. Ürün veritabanının kendisi
  hâlâ gerçek bir katalog değil, sınırlı sayıda örnek üründen oluşuyor.
- Bu ortamda gerçek bir telefon/emülatör bulunmadığından ekranlar görsel olarak test
  edilemedi; ancak tüm proje `tsc --noEmit` ile tip hatasız, Jest ile 112 fonksiyonel test
  yeşil, ve backend uç noktaları curl ile uçtan uca doğrulandı.
- Bildirim sesi seçimi artık gerçek ses dosyalarına bağlı (`mobile/assets/sounds/`,
  `mobile/src/notifications.ts` — iOS'ta `content.sound`, Android'de tercihe özel
  bildirim kanalları üzerinden). Ancak Expo Go'da özel bildirim sesi çalma
  desteği yok — Expo Go her zaman sistem varsayılan sesini çalar; seçilen sesin
  gerçekten farklı çalması için `eas build --profile development` ile alınan bir
  gerçek EAS development build gerekiyor.
- KVKK Aydınlatma Metni (`mobile/src/components/PrivacyConsent.tsx`) bir TASLAK —
  gerçek kullanıcı verisi toplanmadan önce bir avukat tarafından incelenip
  onaylanması gerekiyor.
- `backend/.env.example`'daki şu değerler doldurulmadıkça ilgili özellik demo/uyarı
  modunda kalır: `GOOGLE_CLIENT_ID` (Google girişi), `RESEND_API_KEY` (gerçek
  e-posta), `GOOGLE_VISION_API_KEY` (gerçek görüntü tanıma),
  `REVENUECAT_WEBHOOK_AUTH_HEADER` (gerçek abonelik senkronizasyonu). Mobil
  tarafta ayrıca `mobile/src/purchases.ts`'teki `REVENUECAT_IOS_API_KEY` /
  `REVENUECAT_ANDROID_API_KEY` ve `mobile/app.json`'daki EAS `projectId`
  (`eas init` ile üretilir) doldurulması gerekiyor.
