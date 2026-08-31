import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../../theme';

type Props = { children: React.ReactNode; label?: string };
type State = { error: Error | null; info: string | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.label || '', error, info?.componentStack);
    this.setState({ error, info: info?.componentStack || null });
  }

  reset = () => this.setState({ error: null, info: null });

  render() {
    if (!this.state.error) return this.props.children;
    const message = this.state.error.message || String(this.state.error);
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Screen crashed</Text>
        {this.props.label ? <Text style={styles.label}>{this.props.label}</Text> : null}
        <View style={styles.card}>
          <Text style={styles.errText} selectable>
            {message}
          </Text>
        </View>
        {this.state.info ? (
          <View style={styles.card}>
            <Text style={styles.small} selectable>
              {this.state.info}
            </Text>
          </View>
        ) : null}
        <TouchableOpacity style={styles.button} onPress={this.reset}>
          <Text style={styles.buttonText}>Reload screen</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },
  content: { padding: spacing.xl, gap: spacing.md },
  title: { ...typography.h2, color: colors.red[600] },
  label: { ...typography.bodySmall, color: colors.gray[500] },
  card: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: colors.white,
  },
  errText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.gray[800],
    lineHeight: 18,
  },
  small: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: colors.gray[600],
    lineHeight: 14,
  },
  button: {
    backgroundColor: colors.brand[500],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  buttonText: { color: colors.white, fontWeight: '700' },
});
