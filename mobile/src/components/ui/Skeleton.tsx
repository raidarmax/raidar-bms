import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors, borderRadius, spacing } from '../../theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadiusVal?: number;
  style?: any;
}

export function Skeleton({ width = '100%', height = 16, borderRadiusVal = 8, style }: SkeletonProps) {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(animatedValue, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: borderRadiusVal,
          backgroundColor: colors.gray[200],
          opacity,
        },
        style,
      ]}
    />
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Skeleton width={40} height={40} borderRadiusVal={10} />
        <View style={styles.cardHeaderText}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={10} style={{ marginTop: 8 }} />
        </View>
      </View>
      <Skeleton width="100%" height={12} style={{ marginTop: 12 }} />
      <Skeleton width="80%" height={12} style={{ marginTop: 8 }} />
    </View>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, idx) => (
        <CardSkeleton key={idx} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  list: {
    padding: spacing.xl,
  },
});
