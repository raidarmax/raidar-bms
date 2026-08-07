import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ScanScreen from '../screens/ScanScreen';
import VerifyResultScreen from '../screens/VerifyResultScreen';
import DocumentValidationScreen from '../screens/DocumentValidationScreen';
import ManualLookupScreen from '../screens/ManualLookupScreen';
import IncidentsScreen from '../screens/IncidentsScreen';
import FinesScreen from '../screens/FinesScreen';
import SearchScreen from '../screens/SearchScreen';
import { theme } from '../theme';
import type { LookupResult } from '../lib/lookup';

export type RootStackParamList = {
  Dashboard: undefined;
  Scan: undefined;
  ManualLookup: undefined;
  VerifyResult: { lookup: LookupResult; source: 'qr' | 'manual' };
  DocumentValidation: undefined;
  Incidents: undefined;
  Fines: undefined;
  Search: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.background,
    card: theme.colors.background,
    text: theme.colors.textPrimary,
    border: theme.colors.border,
    primary: theme.colors.accent,
    notification: theme.colors.accent,
  },
};

export function AppNavigator() {
  const { officer, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  if (!officer) return <LoginScreen />;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.textPrimary,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Scan" component={ScanScreen} options={{ headerShown: false }} />
        <Stack.Screen name="VerifyResult" component={VerifyResultScreen} options={{ title: 'Result' }} />
        <Stack.Screen
          name="DocumentValidation"
          component={DocumentValidationScreen}
          options={{ title: 'Document validation' }}
        />
        <Stack.Screen name="ManualLookup" component={ManualLookupScreen} options={{ title: 'Manual lookup' }} />
        <Stack.Screen name="Incidents" component={IncidentsScreen} options={{ title: 'Incidents' }} />
        <Stack.Screen name="Fines" component={FinesScreen} options={{ title: 'Fines' }} />
        <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
});
