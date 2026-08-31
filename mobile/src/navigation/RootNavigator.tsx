import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api';
import { registerForPushNotifications } from '../notifications';
import { colors } from '../theme';
import BottomNav from '../components/BottomNav';
import type { MainTabParamList, RootStackParamList } from './types';

import OnboardingScreen from '../screens/OnboardingScreen';
import LockScreen from '../screens/LockScreen';
import HomeScreen from '../screens/HomeScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ScanScreen from '../screens/ScanScreen';
import HealthRecordScreen from '../screens/HealthRecordScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProductAnalysisScreen from '../screens/ProductAnalysisScreen';
import PlusScreen from '../screens/PlusScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomNav {...props} />}
    >
      <Tab.Screen name="AnaSayfa" component={HomeScreen} />
      <Tab.Screen name="Takvim" component={CalendarScreen} />
      <Tab.Screen name="Tara" component={ScanScreen} />
      <Tab.Screen name="Karnem" component={HealthRecordScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user, loading, locked } = useAuth();

  // Registers this device's Expo push token once per login (id-keyed, so a
  // refreshUser()-triggered re-render with a new `user` object reference
  // doesn't fire this again) — and only once the user is actually past the
  // Face ID gate, so we're not asking for notification permission before
  // they've even unlocked the app. Best-effort throughout: a user who denies
  // permission, is offline, or has no EAS project id configured still gets
  // every other feature — see notifications.ts's registerForPushNotifications().
  const registeredForUserId = useRef<string | null>(null);
  useEffect(() => {
    if (!user || locked) return;
    if (registeredForUserId.current === user.id) return;
    registeredForUserId.current = user.id;
    (async () => {
      const token = await registerForPushNotifications().catch(() => null);
      if (token) await usersApi.registerPushToken(token).catch(() => {});
    })();
  }, [user, locked]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (locked) {
    return <LockScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="BaLang" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
              name="RNAnalizi"
              component={ProductAnalysisScreen}
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="PatiCarePlus"
              component={PlusScreen}
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
