import * as SecureStore from 'expo-secure-store';

export const secureStorage = {
  async get(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string) {
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string) {
    await SecureStore.deleteItemAsync(key);
  },
};

export const STORAGE_KEYS = {
  onboardingComplete: 'frc.onboardingComplete',
  consentAccepted: 'frc.consentAccepted',
  seedRan: 'frc.seedRan.sd38180',
} as const;
