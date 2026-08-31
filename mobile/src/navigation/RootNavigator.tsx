import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { DrawerContext } from '../context/DrawerContext';
import { getSupabase } from '../services/supabase';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import {
  HomeIcon,
  AlertTriangleIcon,
  QrCodeIcon,
  ReceiptIcon,
  MenuIcon,
  ShieldCheckIcon,
  UserIcon,
  SearchIcon,
  FileTextIcon,
  ActivityIcon,
  UsersIcon,
  LogOutIcon,
  XIcon,
  HelpCircleIcon,
  BellIcon,
} from '../components/icons/Icons';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import IncidentListScreen from '../screens/incidents/IncidentListScreen';
import IncidentDetailScreen from '../screens/incidents/IncidentDetailScreen';
import ScannerScreen from '../screens/scan/ScannerScreen';
import ScanResultScreen from '../screens/scan/ScanResultScreen';
import FinesListScreen from '../screens/fines/FinesListScreen';
import FineDetailScreen from '../screens/fines/FineDetailScreen';
import IssueFineScreen from '../screens/fines/IssueFineScreen';
import MoreMenuScreen from '../screens/more/MoreMenuScreen';
import ProfileScreen from '../screens/more/ProfileScreen';
import SearchScreen from '../screens/more/SearchScreen';
import VerifyDocumentsScreen from '../screens/more/VerifyDocumentsScreen';
import OfficersScreen from '../screens/more/OfficersScreen';
import ActivityLogScreen from '../screens/more/ActivityLogScreen';
import HelpScreen from '../screens/more/HelpScreen';
import SearchBikeScreen from '../screens/more/search/SearchBikeScreen';
import SearchRiderScreen from '../screens/more/search/SearchRiderScreen';
import SearchOfficerScreen from '../screens/more/search/SearchOfficerScreen';
import SearchStationScreen from '../screens/more/search/SearchStationScreen';
import LiveTrackingScreen from '../screens/more/search/LiveTrackingScreen';

const Tab = createBottomTabNavigator();
const DashboardStack = createNativeStackNavigator();
const IncidentsStackNav = createNativeStackNavigator();
const ScanStackNav = createNativeStackNavigator();
const FinesStackNav = createNativeStackNavigator();
const MoreStackNav = createNativeStackNavigator();
const HelpStackNav = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

const stackScreenOptions = { headerShown: false } as const;

const DRAWER_WIDTH = Math.min(320, Dimensions.get('window').width * 0.82);
const SCAN_BUTTON_SIZE = 68;

// ─── Stack Navigators ────────────────────────────────────────────────────────

function DashboardStackScreen() {
  return (
    <DashboardStack.Navigator screenOptions={stackScreenOptions}>
      <DashboardStack.Screen name="Dashboard" component={DashboardScreen} />
    </DashboardStack.Navigator>
  );
}

function IncidentsStack() {
  return (
    <IncidentsStackNav.Navigator screenOptions={stackScreenOptions}>
      <IncidentsStackNav.Screen name="IncidentList" component={IncidentListScreen} />
      <IncidentsStackNav.Screen name="IncidentDetail" component={IncidentDetailScreen} />
    </IncidentsStackNav.Navigator>
  );
}

function ScanStack() {
  return (
    <ScanStackNav.Navigator screenOptions={stackScreenOptions}>
      <ScanStackNav.Screen name="Scanner" component={ScannerScreen} />
      <ScanStackNav.Screen name="ScanResult" component={ScanResultScreen} />
      <ScanStackNav.Screen name="SearchBike" component={SearchBikeScreen} />
      <ScanStackNav.Screen name="SearchRider" component={SearchRiderScreen} />
      <ScanStackNav.Screen name="LiveTracking" component={LiveTrackingScreen} />
    </ScanStackNav.Navigator>
  );
}

function FinesStack() {
  return (
    <FinesStackNav.Navigator screenOptions={stackScreenOptions}>
      <FinesStackNav.Screen name="FinesList" component={FinesListScreen} />
      <FinesStackNav.Screen name="FineDetail" component={FineDetailScreen} />
      <FinesStackNav.Screen name="IssueFine" component={IssueFineScreen} />
    </FinesStackNav.Navigator>
  );
}

function MoreStack() {
  return (
    <MoreStackNav.Navigator screenOptions={stackScreenOptions}>
      <MoreStackNav.Screen name="MoreMenu" component={MoreMenuScreen} />
      <MoreStackNav.Screen name="Profile" component={ProfileScreen} />
      <MoreStackNav.Screen name="Search" component={SearchScreen} />
      <MoreStackNav.Screen name="VerifyDocuments" component={VerifyDocumentsScreen} />
      <MoreStackNav.Screen name="Officers" component={OfficersScreen} />
      <MoreStackNav.Screen name="ActivityLog" component={ActivityLogScreen} />
      <MoreStackNav.Screen name="SearchBike" component={SearchBikeScreen} />
      <MoreStackNav.Screen name="SearchRider" component={SearchRiderScreen} />
      <MoreStackNav.Screen name="SearchOfficer" component={SearchOfficerScreen} />
      <MoreStackNav.Screen name="SearchStation" component={SearchStationScreen} />
      <MoreStackNav.Screen name="LiveTracking" component={LiveTrackingScreen} />
    </MoreStackNav.Navigator>
  );
}

function HelpStack() {
  return (
    <HelpStackNav.Navigator screenOptions={stackScreenOptions}>
      <HelpStackNav.Screen name="Help" component={HelpScreen} />
    </HelpStackNav.Navigator>
  );
}

// ─── BMS Header ──────────────────────────────────────────────────────────────

function BMSHeader() {
  const insets = useSafeAreaInsets();
  const { officer } = useAuth();
  const { open } = React.useContext(DrawerContext);
  const navigation = useNavigation<any>();
  const [unread, setUnread] = useState(0);

  const officerId = officer?.id ?? null;
  const stationId = officer?.station_id ?? officer?.station?.id ?? null;

  useEffect(() => {
    if (!stationId) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    const supabase = getSupabase();

    const loadCount = async () => {
      const query = supabase
        .from('incident_police_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('station_id', stationId)
        .eq('is_read', false);
      const { count, error } = officerId
        ? await query.or(`officer_id.is.null,officer_id.eq.${officerId}`)
        : await query;
      if (cancelled) return;
      if (error) {
        setUnread(0);
        return;
      }
      setUnread(typeof count === 'number' ? count : 0);
    };

    loadCount();

    const channel = supabase
      .channel(`police-notif-${stationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incident_police_notifications',
          filter: `station_id=eq.${stationId}`,
        },
        () => loadCount(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [stationId, officerId]);

  const photoUrl = officer?.profile_photo_url || null;
  const initials = (officer?.full_name || 'Officer')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  const goProfile = () => navigation.navigate('MoreTab', { screen: 'Profile' });
  const goNotifications = () => navigation.navigate('IncidentsTab');

  const badgeText = unread > 9 ? '9+' : String(unread);

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <TouchableOpacity
        onPress={open}
        style={styles.headerSide}
        hitSlop={8}
        activeOpacity={0.7}
      >
        <MenuIcon size={24} color={colors.brand[800]} strokeWidth={2.4} />
      </TouchableOpacity>

      <View style={styles.headerCenter} pointerEvents="none">
        <Image
          source={require('../../assets/bms_f_logo.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={styles.headerTagline}>Boda Management System</Text>
      </View>

      <View style={styles.headerRight}>
        <TouchableOpacity
          onPress={goNotifications}
          style={styles.bellButton}
          hitSlop={8}
          activeOpacity={0.75}
        >
          <BellIcon size={22} color={colors.brand[800]} strokeWidth={2.4} />
          {unread > 0 && (
            <View
              style={[
                styles.bellBadge,
                unread > 9 && styles.bellBadgeWide,
              ]}
            >
              <Text style={styles.bellBadgeText}>{badgeText}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goProfile}
          style={styles.avatarButton}
          activeOpacity={0.8}
        >
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarPhoto} />
          ) : (
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarText}>{initials || 'O'}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Side Drawer ─────────────────────────────────────────────────────────────

type DrawerItemProps = {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
};

function DrawerItem({ icon, label, onPress, danger }: DrawerItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.drawerItem}
      activeOpacity={0.75}
    >
      <View style={[styles.drawerItemIcon, danger && styles.drawerItemIconDanger]}>
        {icon}
      </View>
      <Text style={[styles.drawerItemLabel, danger && styles.drawerItemLabelDanger]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SideDrawer({
  visible,
  translateX,
  overlayOpacity,
  onClose,
}: {
  visible: boolean;
  translateX: Animated.Value;
  overlayOpacity: Animated.Value;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { officer, logout } = useAuth();
  const navigation = useNavigation<any>();

  const go = useCallback(
    (tab: string, screen?: string) => {
      onClose();
      setTimeout(() => {
        if (screen) navigation.navigate(tab, { screen });
        else navigation.navigate(tab);
      }, 180);
    },
    [navigation, onClose],
  );

  const doLogout = useCallback(() => {
    onClose();
    setTimeout(() => logout(), 180);
  }, [logout, onClose]);

  if (!visible) return null;

  const photoUrl = officer?.profile_photo_url || null;
  const initials = (officer?.full_name || 'Officer')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');

  const iconColor = colors.brand[100];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[styles.drawerBackdrop, { opacity: overlayOpacity }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.drawerPanel,
          {
            paddingBottom: insets.bottom + spacing.md,
            transform: [{ translateX }],
          },
        ]}
      >
        <LinearGradient
          colors={[colors.brand[800], colors.brand[900]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.drawerHeader, { paddingTop: insets.top + spacing.md }]}
        >
          <TouchableOpacity onPress={onClose} style={styles.drawerClose} hitSlop={8}>
            <XIcon size={18} color={colors.brand[100]} strokeWidth={2.6} />
          </TouchableOpacity>

          <View style={styles.drawerUser}>
            <View style={styles.drawerAvatarRing}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.drawerAvatar} />
              ) : (
                <View style={styles.drawerAvatarFallback}>
                  <Text style={styles.drawerAvatarText}>{initials || 'O'}</Text>
                </View>
              )}
            </View>
            <Text style={styles.drawerName} numberOfLines={1}>
              {officer?.full_name || 'Officer'}
            </Text>
            <View style={styles.drawerMeta}>
              <View style={styles.drawerRankPill}>
                <Text style={styles.drawerRankPillText}>
                  {(officer as any)?.rank || 'Police Officer'}
                </Text>
              </View>
              {officer?.station?.station_name ? (
                <Text style={styles.drawerStation} numberOfLines={1}>
                  {officer.station.station_name}
                </Text>
              ) : null}
            </View>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.drawerScroll}
          contentContainerStyle={styles.drawerContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.drawerSection}>Workspace</Text>
          <DrawerItem
            icon={<HomeIcon size={20} color={iconColor} strokeWidth={2.4} />}
            label="Dashboard"
            onPress={() => go('HomeTab')}
          />
          <DrawerItem
            icon={<AlertTriangleIcon size={20} color={iconColor} strokeWidth={2.4} />}
            label="Incidents"
            onPress={() => go('IncidentsTab')}
          />
          <DrawerItem
            icon={<ReceiptIcon size={20} color={iconColor} strokeWidth={2.4} />}
            label="Fines"
            onPress={() => go('FinesTab')}
          />
          <DrawerItem
            icon={<QrCodeIcon size={20} color={iconColor} strokeWidth={2.4} />}
            label="Scan"
            onPress={() => go('ScanTab')}
          />

          <Text style={styles.drawerSection}>Tools</Text>
          <DrawerItem
            icon={<FileTextIcon size={20} color={iconColor} strokeWidth={2.4} />}
            label="Verify Documents"
            onPress={() => go('MoreTab', 'VerifyDocuments')}
          />
          <DrawerItem
            icon={<SearchIcon size={20} color={iconColor} strokeWidth={2.4} />}
            label="Search"
            onPress={() => go('MoreTab', 'Search')}
          />
          <DrawerItem
            icon={<UsersIcon size={20} color={iconColor} strokeWidth={2.4} />}
            label="Officers"
            onPress={() => go('MoreTab', 'Officers')}
          />
          <DrawerItem
            icon={<ActivityIcon size={20} color={iconColor} strokeWidth={2.4} />}
            label="Activity Log"
            onPress={() => go('MoreTab', 'ActivityLog')}
          />

          <Text style={styles.drawerSection}>Support</Text>
          <DrawerItem
            icon={<HelpCircleIcon size={20} color={iconColor} strokeWidth={2.4} />}
            label="Help & Guides"
            onPress={() => go('HelpTab')}
          />

          <Text style={styles.drawerSection}>Account</Text>
          <DrawerItem
            icon={<UserIcon size={20} color={iconColor} strokeWidth={2.4} />}
            label="My Profile"
            onPress={() => go('MoreTab', 'Profile')}
          />
          <DrawerItem
            icon={<LogOutIcon size={20} color="#FCA5A5" strokeWidth={2.4} />}
            label="Sign Out"
            onPress={doLogout}
            danger
          />
        </ScrollView>

        <View style={styles.drawerFooter}>
          <Text style={styles.drawerFooterBrand}>BMS</Text>
          <Text style={styles.drawerFooterTag}>Boda Management System</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Custom Tab Bar ──────────────────────────────────────────────────────────

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'ios' ? insets.bottom : 12;

  const visibleTabs: { name: string; label: string; icon: any; isScan?: boolean }[] = [
    { name: 'HomeTab', label: 'Home', icon: HomeIcon },
    { name: 'ScanTab', label: 'Scan', icon: QrCodeIcon, isScan: true },
    { name: 'HelpTab', label: 'Help', icon: HelpCircleIcon },
  ];

  const onPress = (routeName: string) => {
    const routeIndex = state.routes.findIndex((r: any) => r.name === routeName);
    if (routeIndex < 0) return;
    const route = state.routes[routeIndex];
    const isFocused = state.index === routeIndex;
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  const isFocused = (routeName: string) => {
    const idx = state.routes.findIndex((r: any) => r.name === routeName);
    return idx >= 0 && state.index === idx;
  };

  return (
    <View style={[styles.tabBarWrap, { paddingBottom: bottomPad }]}>
      <LinearGradient
        colors={['#0F172A', '#1E293B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.tabBar}
      >
        <View style={styles.tabBarHighlight} pointerEvents="none" />

        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const focused = isFocused(tab.name);

          if (tab.isScan) {
            return (
              <TouchableOpacity
                key={tab.name}
                activeOpacity={0.9}
                onPress={() => onPress(tab.name)}
                style={styles.scanSlot}
              >
                <View style={styles.scanRing}>
                  <LinearGradient
                    colors={['#22D3AA', '#0D9E75']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.scanButton}
                  >
                    <Icon size={30} color={colors.white} strokeWidth={2.8} />
                  </LinearGradient>
                </View>
                <Text style={styles.scanLabel}>Scan</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={tab.name}
              activeOpacity={0.8}
              onPress={() => onPress(tab.name)}
              style={styles.tabSlot}
            >
              <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
                {focused ? (
                  <LinearGradient
                    colors={['#22D3AA', '#0D9E75']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.tabActiveDot}
                  />
                ) : null}
                <Icon
                  size={22}
                  color={focused ? '#22D3AA' : 'rgba(203, 213, 225, 0.65)'}
                  strokeWidth={focused ? 2.8 : 2.2}
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  { color: focused ? colors.white : 'rgba(203, 213, 225, 0.65)' },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </LinearGradient>
    </View>
  );
}

// ─── Main Tabs (with drawer) ─────────────────────────────────────────────────

function MainTabs() {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const openDrawer = useCallback(() => {
    setDrawerVisible(true);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [overlayOpacity, translateX]);

  const closeDrawer = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -DRAWER_WIDTH,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => setDrawerVisible(false));
  }, [overlayOpacity, translateX]);

  const drawerCtx = useMemo(
    () => ({ open: openDrawer, close: closeDrawer }),
    [openDrawer, closeDrawer],
  );

  return (
    <DrawerContext.Provider value={drawerCtx}>
      <View style={styles.container}>
        <BMSHeader />
        <Tab.Navigator
          tabBar={(props: any) => <CustomTabBar {...props} />}
          screenOptions={{ headerShown: false }}
        >
          <Tab.Screen name="HomeTab" component={DashboardStackScreen} />
          <Tab.Screen name="ScanTab" component={ScanStack} />
          <Tab.Screen name="HelpTab" component={HelpStack} />
          <Tab.Screen name="IncidentsTab" component={IncidentsStack} />
          <Tab.Screen name="FinesTab" component={FinesStack} />
          <Tab.Screen name="MoreTab" component={MoreStack} />
        </Tab.Navigator>

        <SideDrawer
          visible={drawerVisible}
          translateX={translateX}
          overlayOpacity={overlayOpacity}
          onClose={closeDrawer}
        />
      </View>
    </DrawerContext.Provider>
  );
}

// ─── Branded Splash ──────────────────────────────────────────────────────────

function BrandedSplash() {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(16)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [fade, glow, rise, scale]);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <LinearGradient
      colors={['#F5FBF7', '#EAF5EE', '#DDEEE1']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.splash}
    >
      {/* Layered artistic graphic that merges with the background */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.splashBlob, styles.splashBlobA]} />
        <View style={[styles.splashBlob, styles.splashBlobB]} />
        <View style={[styles.splashBlob, styles.splashBlobC]} />
        <View style={[styles.splashRing, styles.splashRingLg]} />
        <View style={[styles.splashRing, styles.splashRingMd]} />
        <View style={[styles.splashRing, styles.splashRingSm]} />
      </View>

      <Animated.View
        style={[
          styles.splashCenter,
          { opacity: fade, transform: [{ translateY: rise }, { scale }] },
        ]}
      >
        <View style={styles.splashLogoWrap}>
          <Animated.View
            style={[
              styles.splashLogoGlow,
              { opacity: glowOpacity, transform: [{ scale: glowScale }] },
            ]}
          />
          <View style={styles.splashLogoDisc}>
            <Image
              source={require('../../assets/bms_f_logo.png')}
              style={styles.splashLogo}
              resizeMode="contain"
            />
          </View>
        </View>

        <View style={styles.splashDivider} />

        <Text style={styles.splashTagline}>BODA MANAGEMENT SYSTEM</Text>
      </Animated.View>
    </LinearGradient>
  );
}

// ─── Root Navigator ──────────────────────────────────────────────────────────

export default function RootNavigator() {
  const { status, isAuthenticated } = useAuth();

  if (status === 'loading') {
    return <BrandedSplash />;
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={stackScreenOptions}>
        {isAuthenticated ? (
          <RootStack.Screen name="Main" component={MainTabs} />
        ) : (
          <RootStack.Screen name="Auth" component={LoginScreen} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const SIDE_WIDTH = 44;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    position: 'relative',
  },
  headerSide: {
    width: SIDE_WIDTH,
    height: SIDE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  headerCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.md,
    gap: 2,
  },
  headerLogo: {
    width: 104,
    height: 35,
  },
  headerTagline: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.gray[500],
    textTransform: 'uppercase',
  },
  avatarBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.brand[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand[700],
  },
  avatarPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.brand[200],
    backgroundColor: colors.brand[50],
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    zIndex: 2,
  },
  bellButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.brand[100],
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.red[500],
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeWide: {
    minWidth: 22,
  },
  bellBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.2,
    lineHeight: 12,
  },
  avatarButton: {
    marginLeft: spacing.xs,
  },

  // Tab bar
  tabBarWrap: {
    backgroundColor: '#0F172A',
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingBottom: 6,
    minHeight: 72,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'visible',
  },
  tabBarHighlight: {
    position: 'absolute',
    top: 0,
    left: 30,
    right: 30,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  tabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    gap: 3,
  },
  tabIconWrap: {
    width: 44,
    height: 34,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabIconWrapActive: {
    backgroundColor: 'rgba(34, 211, 170, 0.12)',
  },
  tabActiveDot: {
    position: 'absolute',
    top: -6,
    width: 24,
    height: 3,
    borderRadius: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Scan slot / button
  scanSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  scanRing: {
    marginTop: -28,
    width: SCAN_BUTTON_SIZE + 8,
    height: SCAN_BUTTON_SIZE + 8,
    borderRadius: (SCAN_BUTTON_SIZE + 8) / 2,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#0FBF8F',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.55,
          shadowRadius: 16,
        }
      : { elevation: 12 }),
  },
  scanButton: {
    width: SCAN_BUTTON_SIZE,
    height: SCAN_BUTTON_SIZE,
    borderRadius: SCAN_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  scanLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: colors.white,
  },

  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  splashBlob: {
    position: 'absolute',
    borderRadius: 999,
  },
  splashBlobA: {
    top: -140,
    right: -110,
    width: 360,
    height: 360,
    backgroundColor: colors.brand[100],
    opacity: 0.55,
  },
  splashBlobB: {
    bottom: -160,
    left: -120,
    width: 380,
    height: 380,
    backgroundColor: colors.brand[200],
    opacity: 0.35,
  },
  splashBlobC: {
    top: '35%',
    left: '55%',
    width: 220,
    height: 220,
    backgroundColor: colors.brand[50],
    opacity: 0.7,
  },
  splashRing: {
    position: 'absolute',
    borderRadius: 999,
    borderColor: colors.brand[300],
    alignSelf: 'center',
    top: '50%',
    left: '50%',
  },
  splashRingLg: {
    width: 420,
    height: 420,
    marginLeft: -210,
    marginTop: -210,
    borderWidth: 1,
    opacity: 0.18,
  },
  splashRingMd: {
    width: 320,
    height: 320,
    marginLeft: -160,
    marginTop: -160,
    borderWidth: 1,
    opacity: 0.28,
  },
  splashRingSm: {
    width: 240,
    height: 240,
    marginLeft: -120,
    marginTop: -120,
    borderWidth: 1,
    opacity: 0.4,
  },
  splashCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  splashLogoWrap: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogoGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.brand[200],
    shadowColor: colors.brand[500],
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  splashLogoDisc: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brand[800],
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  splashLogo: {
    width: 168,
    height: 168,
  },
  splashDivider: {
    width: 44,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.brand[400],
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
    opacity: 0.85,
  },
  splashTagline: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3.5,
    color: colors.brand[700],
    textAlign: 'center',
    fontFamily: typography.h3.fontFamily,
  },

  // Drawer
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 42, 30, 0.55)',
  },
  drawerPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.brand[900],
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 24,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
  },
  drawerHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(154, 212, 191, 0.14)',
  },
  drawerClose: {
    alignSelf: 'flex-end',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginBottom: spacing.md,
  },
  drawerUser: {
    alignItems: 'flex-start',
    gap: 4,
  },
  drawerAvatarRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(154, 212, 191, 0.25)',
  },
  drawerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.brand[900],
  },
  drawerAvatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brand[700],
    borderWidth: 2,
    borderColor: colors.brand[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerAvatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.brand[100],
    letterSpacing: 0.5,
  },
  drawerName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.2,
  },
  drawerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  drawerRankPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(154, 212, 191, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(154, 212, 191, 0.25)',
  },
  drawerRankPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.brand[100],
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  drawerStation: {
    fontSize: 12,
    color: 'rgba(200, 230, 219, 0.75)',
    fontWeight: '500',
  },
  drawerScroll: { flex: 1 },
  drawerContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  drawerSection: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(200, 230, 219, 0.55)',
    marginTop: spacing.md,
    marginBottom: 4,
    paddingHorizontal: spacing.sm,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  drawerItemIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(154, 212, 191, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(154, 212, 191, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerItemIconDanger: {
    backgroundColor: 'rgba(252, 165, 165, 0.12)',
    borderColor: 'rgba(252, 165, 165, 0.24)',
  },
  drawerItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
    letterSpacing: -0.1,
  },
  drawerItemLabelDanger: {
    color: '#FCA5A5',
  },
  drawerFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(154, 212, 191, 0.14)',
  },
  drawerFooterBrand: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.brand[200],
    letterSpacing: 2,
  },
  drawerFooterTag: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(200, 230, 219, 0.55)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
