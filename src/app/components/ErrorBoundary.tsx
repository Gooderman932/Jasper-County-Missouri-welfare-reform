import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Button } from 'react-native-paper';
import { theme } from '@app/theme';
import { captureException } from '../../lib/crashReporter';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. Without this, any render-time exception unmounts
 * the whole React tree and the user sees a blank screen with no report. Here we
 * forward the error to the crash reporter and show a recoverable fallback.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureException(error, { componentStack: info.componentStack });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View
        style={{
          flex: 1,
          padding: 24,
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '600', color: theme.colors.text, marginBottom: 8 }}>
          Something went wrong
        </Text>
        <Text style={{ color: theme.colors.textMuted, marginBottom: 16 }}>
          The app hit an unexpected error. Your data is safe. You can try again.
        </Text>
        <ScrollView style={{ maxHeight: 160, marginBottom: 16 }}>
          <Text style={{ color: theme.colors.danger, fontSize: 12 }}>{this.state.error.message}</Text>
        </ScrollView>
        <Button mode="contained" onPress={this.reset}>
          Try again
        </Button>
      </View>
    );
  }
}
