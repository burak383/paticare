// PatiCare Tara — gerçek görüntü tanıma (Google Cloud Vision REST API).
//
// Görev #50 kapsamında eklendi. GOOGLE_VISION_API_KEY boş bırakıldığı sürece
// (varsayılan) isVisionConfigured() false döner ve routes/products.js'teki
// /scan uç noktası eski demo davranışına (barkod/isim eşleşmesi, yoksa örnek
// ürün) aynen devam eder — bu dosya doldurulana kadar hiçbir mevcut davranışı
// değiştirmez.
//
// UYARI: bu YAZILDI ama gerçek bir Google Cloud Vision anahtarıyla UÇTAN UCA
// TEST EDİLEMEDİ (bu ortamda böyle bir anahtar yok) — sadece dokümante
// edilen REST API sözleşmesine göre yazıldı.

const VISION_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

function isVisionConfigured() {
  return Boolean(process.env.GOOGLE_VISION_API_KEY);
}

// imageDataUri: "data:image/jpeg;base64,...." formatında (mobile/src/media.ts
// bu formatta üretiyor). TEXT_DETECTION etiket üzerindeki marka/ürün adını
// okumak için en güvenilir sinyal; LABEL_DETECTION ve LOGO_DETECTION ek bağlam
// için isteniyor.
async function detectProductLabels(imageDataUri) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_VISION_API_KEY ayarlanmadan Vision API çağrılamaz.');

  const base64 = String(imageDataUri || '').replace(/^data:image\/\w+;base64,/, '');
  if (!base64) throw new Error('Geçersiz görsel verisi.');

  const response = await fetch(`${VISION_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64 },
          features: [
            { type: 'TEXT_DETECTION', maxResults: 1 },
            { type: 'LABEL_DETECTION', maxResults: 10 },
            { type: 'LOGO_DETECTION', maxResults: 5 },
          ],
        },
      ],
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    const message = (json && json.error && json.error.message) || `Vision API hatası (HTTP ${response.status}).`;
    throw new Error(message);
  }

  const result = json.responses && json.responses[0];
  if (!result) return { text: '', labels: [], logos: [] };
  if (result.error) throw new Error(result.error.message || 'Vision API yanıt hatası.');

  return {
    // fullTextAnnotation.text (varsa) satır satır tüm okunan metni verir —
    // textAnnotations[0].description ile aynı ama daha güvenilir.
    text: (result.fullTextAnnotation && result.fullTextAnnotation.text) || '',
    labels: (result.labelAnnotations || []).map((l) => l.description),
    logos: (result.logoAnnotations || []).map((l) => l.description),
  };
}

module.exports = { isVisionConfigured, detectProductLabels };
