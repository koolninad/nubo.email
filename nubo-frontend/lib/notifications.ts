declare global {
  interface Window {
    OneSignal: any;
    OneSignalDeferred: Array<(OneSignal: any) => void>;
  }
}

export class NotificationService {
  private static instance: NotificationService;
  private oneSignalReady = false;
  private userId: string | null = null;

  private constructor() {
    this.initializeOneSignal();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async initializeOneSignal() {
    if (typeof window === 'undefined') return;

    try {
      // Wait for OneSignal to be ready
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        this.oneSignalReady = true;
        
        // OneSignal v16 API - Get user ID after initialization
        OneSignal.User.PushSubscription.addEventListener('change', (event: any) => {
          if (event.current.id) {
            this.userId = event.current.id;
            console.log('OneSignal User ID:', this.userId);
          }
        });

        // Listen for notification clicks  
        OneSignal.Notifications.addEventListener('click', (event: any) => {
          console.log('OneSignal notification clicked:', event);
          
          // Handle email notification clicks
          if (event.notification.additionalData?.emailId) {
            const emailId = event.notification.additionalData.emailId;
            window.location.href = `/inbox?email=${emailId}`;
          }
        });
        
        // Check initial subscription status
        const pushSubscription = await OneSignal.User.PushSubscription.optedIn;
        if (pushSubscription) {
          this.userId = await OneSignal.User.PushSubscription.id;
          console.log('Already subscribed, User ID:', this.userId);
        }
      });
    } catch (error) {
      console.error('OneSignal initialization failed:', error);
    }
  }

  public async subscribeToNotifications(): Promise<boolean> {
    if (!this.oneSignalReady || typeof window === 'undefined') {
      console.warn('OneSignal not ready');
      return false;
    }

    try {
      // OneSignal v16 API
      await window.OneSignal.Notifications.requestPermission();
      await window.OneSignal.User.PushSubscription.optIn();
      return true;
    } catch (error) {
      console.error('Failed to subscribe to notifications:', error);
      return false;
    }
  }

  public async unsubscribeFromNotifications(): Promise<boolean> {
    if (!this.oneSignalReady || typeof window === 'undefined') {
      return false;
    }

    try {
      // OneSignal v16 API
      await window.OneSignal.User.PushSubscription.optOut();
      return true;
    } catch (error) {
      console.error('Failed to unsubscribe from notifications:', error);
      return false;
    }
  }

  public async isSubscribed(): Promise<boolean> {
    if (!this.oneSignalReady || typeof window === 'undefined') {
      return false;
    }

    try {
      // OneSignal v16 API
      return await window.OneSignal.User.PushSubscription.optedIn;
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      return false;
    }
  }

  public getUserId(): string | null {
    return this.userId;
  }

  public async setUserTags(tags: Record<string, string>): Promise<void> {
    if (!this.oneSignalReady || typeof window === 'undefined') {
      return;
    }

    try {
      await window.OneSignal.User.addTags(tags);
    } catch (error) {
      console.error('Failed to set user tags:', error);
    }
  }

  public async setExternalUserId(userId: string): Promise<void> {
    if (!this.oneSignalReady || typeof window === 'undefined') {
      return;
    }

    try {
      await window.OneSignal.User.addAlias('external_id', userId);
      console.log('OneSignal external user ID set:', userId);
    } catch (error) {
      console.error('Failed to set external user ID:', error);
    }
  }

  public async removeExternalUserId(): Promise<void> {
    if (!this.oneSignalReady || typeof window === 'undefined') {
      return;
    }

    try {
      await window.OneSignal.User.removeAlias('external_id');
    } catch (error) {
      console.error('Failed to remove external user ID:', error);
    }
  }

  // Method to send test notification (for debugging)
  public async sendTestNotification(title: string, message: string): Promise<void> {
    if (!this.oneSignalReady || typeof window === 'undefined') {
      return;
    }

    console.log('Test notification would be sent:', { title, message });
    // Note: Actual sending is done from backend
  }
}

export const notificationService = NotificationService.getInstance();