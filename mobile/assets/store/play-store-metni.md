# PatiCare — Play Store Mağaza Listesi Metinleri

Play Console > Mağaza varlığı (Store presence) > Ana mağaza listesi (Main store listing) bölümüne
doğrudan yapıştırılabilecek taslak metinler. Karakter sayıları Play'in sınırlarına göre kontrol edildi.

## Kategori

**Lifestyle** — Play'de ayrı bir "Pets/Evcil Hayvan" kategorisi yok; karşılaştırılabilir pet-bakım
uygulamaları (örn. PawTrack) bu kategoride listeleniyor.

## Kısa açıklama (Short description) — sınır 80 karakter

```
Evcil dostunun ilaç, aşı ve sağlık takibini tek yerden kolayca yönet.
```
(69 karakter)

## Tam açıklama (Full description) — sınır 4000 karakter

```
PatiCare, kedinin veya köpeğinin günlük bakımını unutmadan, dağınık notlar
olmadan takip etmeni sağlayan bir uygulama.

Ne yapabilirsin:

— Bakım hatırlatıcıları
İlaç, aşı, kilo kontrolü ve diğer görevler için tek seferlik ya da tekrarlayan
(günlük/haftalık/aylık) hatırlatıcılar kur. Görevi zamanında telefonuna bildirim
olarak gelsin, tamamla ya da ertele.

— Takvim ve günlük plan
Bugün ne yapman gerektiğini ana ekranda gör, haftalık takvimde ileriye bak.

— Sağlık karnesi
Aşı geçmişini, sağlık durumlarını ve veteriner notlarını tek bir yerde tut;
kilo değişimini zaman içinde takip et.

— Ürün tarama ve güvenlik kontrolü
Mama veya bakım ürününün etiketini kameranla tara ya da adıyla ara; evcil
hayvanının mevcut ilaçlarıyla etkileşime girip girmediğini kontrol et.

— Fiyat notları
Gördüğün fiyatları kaydet, zaman içindeki değişimi takip et — gerçek olmayan
"rakip fiyatı" iddiaları değil, kendi notların.

— Birden fazla evcil hayvan
Her biri için ayrı profil, fotoğraf ve geçmiş.

— Misafir modu
Hesap oluşturmadan hemen dene; istediğin zaman e-posta ile gerçek bir hesaba
yükselt, verilerini kaybetme.

PatiCare Plus ile sınırsız tarama geçmişi ve ek özellikler açılır.

Verilerin sana ait: hesabını ve tüm verilerini istediğin an, uygulama
içinden kalıcı olarak silebilirsin.
```

## Sürüm notları (What's new) — v1.0.0, sınır 500 karakter

Play Console'da her sürüm yüklemesinde (kapalı test dahil) istenen ayrı bir alan —
"Mağaza listesi" metninden farklı, "bu sürümde ne değişti" metni. İlk sürüm
olduğu için bir değişiklik listesi değil, kısa bir karşılama/özet:

```
PatiCare'e hoş geldin! İlk sürümde neler var:

• İlaç, aşı ve bakım için tek seferlik veya tekrarlayan hatırlatıcılar
• Takvim ve günlük bakım planı
• Sağlık karnesi: aşı geçmişi, sağlık durumları, veteriner notları
• Ürün tarama ve güvenlik kontrolü
• Birden fazla evcil hayvan, ayrı profil ve geçmiş
• Hesap oluşturmadan misafir modunda deneme
```
(≈340 karakter)

Bir sonraki sürümlerde bu alanı gerçekten o sürümde değişenlerle
(ör. "Bu sürümde: X hatası düzeltildi, Y özelliği eklendi") güncellemek
gerekiyor — aynı karşılama metnini tekrar tekrar kullanma.

## Uygulama adı

PatiCare (mevcut isim korunuyor — değişiklik gerekmiyor)

## Notlar

- Metinler yalnızca gerçekten var olan özellikleri anlatıyor — "yapay zekâ" gibi
  abartılı/doğrulanamaz iddialar bilinçli olarak kullanılmadı (bkz. proje genelindeki
  "dürüst kopya" prensibi, README'deki "Bilinen sınırlar" bölümü).
- Ürün tarama/güvenlik kontrolü cümlesi, backend'de `GOOGLE_VISION_API_KEY`
  girilmiş olmasını varsayıyor (task #50/#45'e bağlı) — key girilmeden yayına
  çıkılırsa bu cümleyi "adıyla ara" ile sınırlamak daha doğru olur.
- İngilizce bir mağaza listesi de eklemek istersen (Play çok dilli listelemeyi
  destekliyor), ayrıca isteyebilirsin — şimdilik uygulama tamamen Türkçe
  olduğu için tek dilli bıraktım.
