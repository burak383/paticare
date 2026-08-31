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
- **PatiCare Plus üyeliği** — kasıtlı olarak "yakında" kartı olarak bırakıldı;
  gerçek bir ödeme/abonelik altyapısı bu demonun kapsamında değil.

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
  HTTP ile çalışıyor. Gerçek bir sunucuya (Render, Fly.io, bir VPS vb.) deploy
  edilirken TLS sonlandırma (reverse proxy veya platformun kendi HTTPS'i) ve
  `CORS_ORIGIN`'in gerçek mobil/uygulama origin'lerine daraltılması gerekir.
- **Şifre sıfırlama kodu** — gerçek bir e-posta/SMS sağlayıcısı olmadığından kod
  doğrudan API yanıtında (`devCode`) dönüyor; production'a taşırken bu alan
  kaldırılıp gerçek bir e-posta/SMS sağlayıcısı bağlanmalı (bkz. yukarıdaki
  "Giriş yöntemleri" bölümü).
- **Fotoğraflar base64 olarak DB'de tutuluyor** — küçük ölçekte çalışır ama
  gerçek bir dosya depolama servisine (S3, Cloudinary vb.) taşınması, hem DB
  boyutunu hem de API yanıt sürelerini önemli ölçüde iyileştirir.

## Bilinen sınırlar

- Google ile giriş, kendi Google OAuth istemci kimliğini ayarlamadan çalışmaz (yukarıdaki
  "Giriş yöntemleri" bölümüne bakın) — ayarlanmadan basılırsa kullanıcıya bunu açıkça
  söyleyen bir uyarı çıkar, sessizce başarısız olmaz.
- Apple ile giriş butonu gerçek OAuth yapmıyor; basılınca kullanıcıya bunu açıkça söyleyen
  bir uyarı çıkar.
- Face ID, gerçek biyometrik donanım gerektirir — simülatör/emülatörde veya donanımı
  olmayan bir cihazda seçenek otomatik olarak gizlenir, hataya yol açmaz.
- Kamera taraması gerçek görüntü tanıma yapmıyor; backend'deki örnek ürünlerden birini
  eşleştirip döndürüyor (demo amaçlı).
- Bu ortamda gerçek bir telefon/emülatör bulunmadığından ekranlar görsel olarak test
  edilemedi; ancak tüm proje `tsc --noEmit` ile tip hatasız, Jest ile 29 fonksiyonel test
  (edit/ekle/sil/arama/şifre sıfırlama/Face ID/fotoğraf yükleme/bildirim tercihleri/fiyat
  notları akışları dahil) yeşil, backend'in yeni uç noktaları (`price-notes`,
  `preferences`) curl ile uçtan uca doğrulandı, ve Metro bundler ile sorunsuz paketlendi.
- Bildirim sesi seçimi şu an yalnızca isim/tercih olarak saklanıyor — uygulamada gerçek
  ses dosyaları yok, bu yüzden seçilen "ses" gerçekte hangi telefon bildirim sesinin
  çalınacağını değiştirmiyor (bu, gerçek ses dosyaları eklenip
  `expo-notifications`'ın Android bildirim kanalı / iOS ses yapılandırmasına
  bağlanmasını gerektirir).
