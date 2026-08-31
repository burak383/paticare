import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, fonts } from '../theme';

// A single, real, functioning bottom bar shared by every tab screen.
// The original files each hand-rolled their own copy of this (AnaSayfa,
// Takvim, Tara, Karnem, Profil all had a near-identical but slightly
// different, non-navigating <View> for it) — none of them called
// navigation.navigate anywhere. This one actually switches tabs.

const ICONS: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  AnaSayfa: 'home',
  Takvim: 'calendar',
  Tara: 'camera',
  Karnem: 'bar-chart-2',
  Profil: 'user',
};

const LABELS: Record<string, string> = {
  AnaSayfa: 'Ana Sayfa',
  Takvim: 'Takvim',
  Tara: 'Tara',
  Karnem: 'Karnem',
  Profil: 'Profil',
};

export default function BottomNav({ state, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.bar} pointerEvents="box-none">
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const icon = ICONS[route.name] ?? 'circle';
          const label = LABELS[route.name] ?? route.name;
          const isScan = route.name === 'Tara';

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (isScan) {
            return (
              <View key={route.key} style={styles.scanItem}>
                <Pressable
                  onPress={onPress}
                  accessibilityRole="button"
                  accessibilityLabel="Tara"
                  style={styles.scanButton}
                >
                  <Feather name={icon} size={24} color={colors.primaryForeground} />
                </Pressable>
                <Text style={styles.scanLabel}>{label}</Text>
              </View>
            );
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={styles.navItem}
            >
              <View style={[styles.navIcon, isFocused && styles.activeNavIcon]}>
                <Feather name={icon} size={20} color={isFocused ? colors.primary : colors.mutedForeground} />
              </View>
              <Text style={[styles.navLabel, isFocused && styles.activeNavLabel]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  pill: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    left: 16,
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    shadowColor: colors.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  navItem: {
    minWidth: 48,
    alignItems: 'center',
    gap: 4,
  },
  navIcon: {
    height: 28,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeNavIcon: {
    borderRadius: 20,
    backgroundColor: colors.muted,
  },
  navLabel: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '700',
  },
  activeNavLabel: {
    color: colors.primary,
    fontWeight: '800',
  },
  scanItem: {
    alignItems: 'center',
    gap: 4,
    marginTop: -34,
  },
  scanButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: `${colors.accent}8C`,
    borderRadius: 28,
    backgroundColor: colors.primary,
  },
  scanLabel: {
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '800',
  },
});
