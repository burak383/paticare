import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  AnaSayfa: undefined;
  Takvim: undefined;
  // Optional so a plain tab-bar press (no params) still type-checks —
  // ScanScreen defaults to the "camera" segment when it's absent.
  Tara: { initialTab?: 'camera' | 'security' } | undefined;
  Karnem: undefined;
  Profil: undefined;
};

export type RootStackParamList = {
  BaLang: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  RNAnalizi: { productId: string };
  PatiCarePlus: undefined;
};

declare global {
  // Lets useNavigation() infer types without passing generics everywhere.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
