import axios from 'axios';

interface PushNotification {
  title: string;
  message: string;
  userId?: string;
  userEmail?: string;
  data?: Record<string, any>;
  url?: string;
  icon?: string;
  image?: string;
}

export class PushNotificationService {
  private static readonly APP_ID = 'fe4fe7fa-55cd-4d38-8ce7-2e8648879bbf';
  private static readonly REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || 'YOUR_ONESIGNAL_REST_API_KEY';
  private static readonly API_URL = 'https://onesignal.com/api/v1/notifications';

  /**
   * Send push notification to specific user by external ID (user ID or email)
   */
  static async sendToUser(
    userId: string,
    notification: PushNotification
  ): Promise<boolean> {
    try {
      const payload = {
        app_id: this.APP_ID,
        include_external_user_ids: [userId],
        headings: { en: notification.title },
        contents: { en: notification.message },
        data: notification.data || {},
        url: notification.url,
        chrome_web_icon: notification.icon || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/icon.png`,
        chrome_web_image: notification.image,
        web_buttons: notification.url ? [{
          id: 'view-email',
          text: 'View Email',
          url: notification.url
        }] : undefined
      };

      const response = await axios.post(this.API_URL, payload, {
        headers: {
          'Authorization': `Basic ${this.REST_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Push notification sent successfully:', {
        userId,
        title: notification.title,
        recipients: response.data.recipients
      });

      return response.data.recipients > 0;
    } catch (error: any) {
      console.error('❌ Failed to send push notification:', {
        userId,
        title: notification.title,
        error: error.response?.data || error.message
      });
      return false;
    }
  }

  /**
   * Send push notification to multiple users
   */
  static async sendToUsers(
    userIds: string[],
    notification: PushNotification
  ): Promise<boolean> {
    try {
      const payload = {
        app_id: this.APP_ID,
        include_external_user_ids: userIds,
        headings: { en: notification.title },
        contents: { en: notification.message },
        data: notification.data || {},
        url: notification.url,
        chrome_web_icon: notification.icon || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/icon.png`,
        chrome_web_image: notification.image,
        web_buttons: notification.url ? [{
          id: 'view-email',
          text: 'View Email',
          url: notification.url
        }] : undefined
      };

      const response = await axios.post(this.API_URL, payload, {
        headers: {
          'Authorization': `Basic ${this.REST_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Push notification sent to multiple users:', {
        userCount: userIds.length,
        title: notification.title,
        recipients: response.data.recipients
      });

      return response.data.recipients > 0;
    } catch (error: any) {
      console.error('❌ Failed to send push notification to users:', {
        userCount: userIds.length,
        title: notification.title,
        error: error.response?.data || error.message
      });
      return false;
    }
  }

  /**
   * Send email-specific push notifications
   */
  static async sendNewEmailNotification(
    userId: string,
    emailData: {
      id: number;
      subject: string;
      fromName: string;
      fromAddress: string;
      accountEmail: string;
    }
  ): Promise<boolean> {
    const notification: PushNotification = {
      title: `New email from ${emailData.fromName || emailData.fromAddress}`,
      message: `${emailData.subject || '(No subject)'} - ${emailData.accountEmail}`,
      data: {
        emailId: emailData.id,
        type: 'new_email',
        fromAddress: emailData.fromAddress,
        accountEmail: emailData.accountEmail
      },
      url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/inbox?email=${emailData.id}`,
      icon: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/icon.png`
    };

    return this.sendToUser(userId, notification);
  }

  /**
   * Send email sent confirmation notification
   */
  static async sendEmailSentNotification(
    userId: string,
    emailData: {
      to: string;
      subject: string;
      accountEmail: string;
    }
  ): Promise<boolean> {
    const notification: PushNotification = {
      title: 'Email sent successfully',
      message: `To: ${emailData.to} - "${emailData.subject || '(No subject)'}"`,
      data: {
        type: 'email_sent',
        to: emailData.to,
        subject: emailData.subject,
        accountEmail: emailData.accountEmail
      },
      url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/inbox`,
      icon: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/icon.png`
    };

    return this.sendToUser(userId, notification);
  }

  /**
   * Send sync error notification
   */
  static async sendSyncErrorNotification(
    userId: string,
    errorData: {
      accountEmail: string;
      errorMessage: string;
    }
  ): Promise<boolean> {
    const notification: PushNotification = {
      title: 'Email sync error',
      message: `Failed to sync ${errorData.accountEmail}: ${errorData.errorMessage}`,
      data: {
        type: 'sync_error',
        accountEmail: errorData.accountEmail,
        error: errorData.errorMessage
      },
      url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/accounts`,
      icon: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/icon.png`
    };

    return this.sendToUser(userId, notification);
  }

  /**
   * Send test notification
   */
  static async sendTestNotification(userId: string): Promise<boolean> {
    const notification: PushNotification = {
      title: 'Test Notification from Nubo',
      message: 'Your push notifications are working correctly! 🎉',
      data: {
        type: 'test'
      },
      url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings`,
      icon: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/icon.png`
    };

    return this.sendToUser(userId, notification);
  }
}