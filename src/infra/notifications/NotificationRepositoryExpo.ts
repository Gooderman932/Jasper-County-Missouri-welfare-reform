import * as Notifications from 'expo-notifications';
import { NotificationRepository } from '@domain/repositories';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationRepositoryExpo implements NotificationRepository {
  async scheduleReminder(input: { caseId?: string; title: string; body: string; whenISO: string }): Promise<string> {
    const fireDate = new Date(input.whenISO);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        data: { caseId: input.caseId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
    });
    return id;
  }
  async cancelReminder(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
  async listReminders() {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.map((s) => ({
      id: s.identifier,
      title: s.content.title ?? '',
      whenISO: (s.trigger as any)?.date ? new Date((s.trigger as any).date).toISOString() : '',
    }));
  }
}
