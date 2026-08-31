import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import {
  UserIcon,
  SearchIcon,
  ShieldCheckIcon,
  UsersIcon,
  ActivityIcon,
  LogOutIcon,
  ChevronRightIcon,
} from '../../components/icons/Icons';
import { colors, spacing, typography, borderRadius } from '../../theme';

interface MenuItem {
  label: string;
  description: string;
  screen: string;
  icon: React.ReactNode;
  iconBg: string;
}

export default function MoreMenuScreen({ navigation }: any) {
  const { officer, logout } = useAuth();

  const menuItems: MenuItem[] = [
    {
      label: 'Profile',
      description: 'View your officer details',
      screen: 'Profile',
      icon: <UserIcon size={20} color={colors.brand[600]} />,
      iconBg: colors.brand[50],
    },
    {
      label: 'Search',
      description: 'Look up riders, motorcycles & plates',
      screen: 'Search',
      icon: <SearchIcon size={20} color={colors.blue[600]} />,
      iconBg: colors.blue[50],
    },
    {
      label: 'Verify Documents',
      description: 'Check license and insurance validity',
      screen: 'VerifyDocuments',
      icon: <ShieldCheckIcon size={20} color={colors.green[600]} />,
      iconBg: colors.green[50],
    },
    {
      label: 'Officers',
      description: 'View station officers',
      screen: 'Officers',
      icon: <UsersIcon size={20} color={colors.amber[600]} />,
      iconBg: colors.amber[50],
    },
    {
      label: 'Activity Log',
      description: 'Recent actions and events',
      screen: 'ActivityLog',
      icon: <ActivityIcon size={20} color={colors.gray[600]} />,
      iconBg: colors.gray[100],
    },
  ];

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* App branding */}
        <View style={styles.brandHeader}>
          <Image
            source={require('../../../assets/bms_logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.brandTitle}>BMS Police</Text>
            <Text style={styles.brandSubtitle}>Boda Management System</Text>
          </View>
        </View>

        {/* Officer card */}
        <View style={styles.officerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(officer?.full_name || 'O').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.officerInfo}>
            <Text style={styles.officerName}>{officer?.full_name || 'Officer'}</Text>
            <Text style={styles.officerMeta}>{officer?.rank} • {officer?.service_number}</Text>
            <Text style={styles.stationName}>{officer?.station?.station_name || ''}</Text>
          </View>
        </View>

        {/* Menu items */}
        <View style={styles.menu}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.screen}
              style={styles.menuItem}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.iconBg }]}>
                {item.icon}
              </View>
              <View style={styles.menuText}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuDesc}>{item.description}</Text>
              </View>
              <ChevronRightIcon size={16} color={colors.gray[300]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOutIcon size={18} color={colors.red[600]} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  content: { padding: spacing.xl, paddingBottom: 100 },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  brandLogo: { width: 48, height: 48 },
  brandTitle: { ...typography.h3, color: colors.gray[900], fontWeight: '700' },
  brandSubtitle: { ...typography.caption, color: colors.gray[500] },
  officerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.gray[200],
    gap: spacing.lg,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.h2, color: colors.white },
  officerInfo: { flex: 1 },
  officerName: { ...typography.h3 },
  officerMeta: { ...typography.bodySmall, marginTop: 2 },
  stationName: { ...typography.caption, color: colors.brand[500], marginTop: 2 },
  menu: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    overflow: 'hidden',
    marginBottom: spacing.xxl,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    gap: spacing.md,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1 },
  menuLabel: { ...typography.body, fontWeight: '500', color: colors.gray[800] },
  menuDesc: { ...typography.bodySmall, marginTop: 1 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  logoutText: { ...typography.body, color: colors.red[600], fontWeight: '600' },
});
