// Katalogdaki her ürünün gerçek bir fotoğrafı yok — sadece ilk birkaç örnek
// ürünün (OmegaPet 3, PatiPlus Adult Salmon, NexGard Combo) gerçek görseli
// var, geri kalanı (görev sonrası eklenen ~50 ürün) marka/kategori bilgisiyle
// birlikte ama fotoğrafsız. Gerçek marka ürünlerinin internetten indirilmiş
// fotoğraflarını izinsiz kullanmak yerine (telif/marka riski), imageUrl boş
// olduğunda kategoriye uygun bir ikonla temiz bir yer tutucu gösteriyoruz —
// PatiCare'in evcil hayvan avatarlarında zaten kullandığı yer tutucu deseniyle
// aynı mantık (bkz. ScanScreen'deki petImageFallback).
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius } from '../theme';

type IconName = React.ComponentProps<typeof Feather>['name'];

function iconForCategory(category?: string): IconName {
  const c = (category || '').toLocaleLowerCase('tr-TR');
  if (c.includes('takviye') || c.includes('vitamin')) return 'droplet';
  if (c.includes('parazit')) return 'shield';
  if (c.includes('ödül') || c.includes('odul')) return 'award';
  if (c.includes('tımar') || c.includes('bakım') || c.includes('bakim')) return 'scissors';
  if (c.includes('mama')) return 'package';
  return 'package';
}

export default function ProductImage({
  imageUrl,
  category,
  style,
  iconSize = 20,
}: {
  imageUrl?: string | null;
  category?: string;
  style?: object;
  iconSize?: number;
}) {
  if (imageUrl) {
    return <Image source={{ uri: imageUrl }} style={style} />;
  }
  return (
    <View style={[styles.fallback, style]} testID="product-image-fallback">
      <Feather name={iconForCategory(category)} size={iconSize} color={colors.mutedForeground} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius / 3,
    justifyContent: 'center',
  },
});
