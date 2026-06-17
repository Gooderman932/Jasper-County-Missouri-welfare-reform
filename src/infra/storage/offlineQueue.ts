// Lightweight FIFO queue for actions that fail while offline.
// Persistence via AsyncStorage. The queue is a fallback; primary writes go straight to Appwrite.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'frc.offlineQueue.v1';

export interface QueuedAction {
  id: string;
  kind: string;
  payload: unknown;
  enqueuedAt: string;
  attempts: number;
}

export const offlineQueue = {
  async list(): Promise<QueuedAction[]> {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
  },
  async enqueue(action: Omit<QueuedAction, 'enqueuedAt' | 'attempts'>) {
    const current = await this.list();
    current.push({ ...action, enqueuedAt: new Date().toISOString(), attempts: 0 });
    await AsyncStorage.setItem(KEY, JSON.stringify(current));
  },
  async remove(id: string) {
    const current = await this.list();
    await AsyncStorage.setItem(KEY, JSON.stringify(current.filter((a) => a.id !== id)));
  },
  async clear() {
    await AsyncStorage.removeItem(KEY);
  },
  async drain(handler: (a: QueuedAction) => Promise<void>) {
    const items = await this.list();
    const remaining: QueuedAction[] = [];
    for (const a of items) {
      try {
        await handler(a);
      } catch {
        remaining.push({ ...a, attempts: a.attempts + 1 });
      }
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(remaining));
  },
};
