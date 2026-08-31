import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

// This demo has no real file storage (S3/Cloudinary/etc.) to upload to, so a
// photo is compressed down and embedded directly as a base64 data URI on the
// pet record — that's what the backend's `avatarUrl` field already expects
// (see backend/src/routes/pets.js). Capped at 640px wide / JPEG quality 0.5
// so a photo stays a few hundred KB instead of multiple MB, which matters
// because it gets stored inline in the JSON "database" and sent over the
// wire on every screen that shows the pet.
export async function pickAndPreparePetPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Fotoğraflara erişim izni verilmedi. Ayarlar'dan PatiCare için fotoğraf erişimini açabilirsin.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const manipulated = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: 640 } }],
    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (!manipulated.base64) return null;
  return `data:image/jpeg;base64,${manipulated.base64}`;
}

// Tara ekranındaki "gerçek kamera fotoğrafı" akışı için (görev #50) — pet
// avatarının aksine burada 1024px genişlik kullanılıyor çünkü backend'deki
// Google Cloud Vision (yapılandırıldıysa, bkz. backend/src/vision.js)
// etiketteki yazıyı okumaya çalışıyor; düşük çözünürlük OCR doğruluğunu
// düşürür. İptal edilirse (kullanıcı kamerayı kapatırsa) null döner, hata
// fırlatmaz — sadece izin reddedilirse hata fırlatılır.
export async function captureProductPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Kameraya erişim izni verilmedi. Ayarlar'dan PatiCare için kamera erişimini açabilirsin.");
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const manipulated = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (!manipulated.base64) return null;
  return `data:image/jpeg;base64,${manipulated.base64}`;
}
