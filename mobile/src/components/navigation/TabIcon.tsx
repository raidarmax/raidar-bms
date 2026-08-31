import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  HomeIcon,
  AlertTriangleIcon,
  ScanIcon,
  FileTextIcon,
  MenuIcon,
  SearchIcon,
  ShieldCheckIcon,
  UserIcon,
  ClockIcon,
  UsersIcon,
  LogOutIcon,
} from '../icons/Icons';

interface TabIconProps {
  name: string;
  color: string;
  focused?: boolean;
  size?: number;
}

export function TabIcon({ name, color, focused, size = 22 }: TabIconProps) {
  const renderIcon = () => {
    switch (name) {
      case 'home':
        return <HomeIcon size={size} color={color} />;
      case 'alert-triangle':
        return <AlertTriangleIcon size={size} color={color} />;
      case 'scan':
        return <ScanIcon size={size} color={color} />;
      case 'file-text':
        return <FileTextIcon size={size} color={color} />;
      case 'menu':
        return <MenuIcon size={size} color={color} />;
      case 'search':
        return <SearchIcon size={size} color={color} />;
      case 'shield':
        return <ShieldCheckIcon size={size} color={color} />;
      case 'user':
        return <UserIcon size={size} color={color} />;
      case 'users':
        return <UsersIcon size={size} color={color} />;
      case 'clock':
        return <ClockIcon size={size} color={color} />;
      case 'log-out':
        return <LogOutIcon size={size} color={color} />;
      default:
        return <HomeIcon size={size} color={color} />;
    }
  };

  return (
    <View style={styles.container}>
      {renderIcon()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
  },
});
