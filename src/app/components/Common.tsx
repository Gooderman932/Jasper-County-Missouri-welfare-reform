import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, TextStyle } from 'react-native';
import { theme } from '@app/theme';

export const Screen: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({ children, style }) => (
  <View style={[styles.screen, style]}>{children}</View>
);

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const H1: React.FC<{ children: React.ReactNode; style?: TextStyle }> = ({ children, style }) => (
  <Text style={[styles.h1, style]}>{children}</Text>
);
export const H2: React.FC<{ children: React.ReactNode; style?: TextStyle }> = ({ children, style }) => (
  <Text style={[styles.h2, style]}>{children}</Text>
);
export const Body: React.FC<{ children: React.ReactNode; style?: TextStyle; muted?: boolean }> = ({
  children,
  style,
  muted,
}) => <Text style={[styles.body, muted && { color: theme.colors.textMuted }, style]}>{children}</Text>;

export const Button: React.FC<{
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
}> = ({ label, onPress, variant = 'primary', disabled }) => {
  const bg = {
    primary: theme.colors.primary,
    secondary: theme.colors.primaryAccent,
    ghost: 'transparent',
    danger: theme.colors.danger,
  }[variant];
  const fg = variant === 'ghost' ? theme.colors.primary : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: theme.colors.primary },
      ]}
    >
      <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
};

export const SeverityBadge: React.FC<{ severity: 'info' | 'watch' | 'serious' }> = ({ severity }) => (
  <View style={[styles.badge, { backgroundColor: theme.colors.severity[severity] }]}>
    <Text style={styles.badgeText}>{severity.toUpperCase()}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, padding: 16 },
  card: {
    backgroundColor: theme.colors.surface,
    padding: 14,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 10,
  },
  h1: { fontSize: theme.font.h1, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  h2: { fontSize: theme.font.h2, fontWeight: '600', color: theme.colors.text, marginBottom: 6 },
  body: { fontSize: theme.font.body, color: theme.colors.text, lineHeight: 21 },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', marginVertical: 6 },
  btnText: { fontSize: 15, fontWeight: '600' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
});
