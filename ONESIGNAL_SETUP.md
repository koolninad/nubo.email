# OneSignal Push Notifications Setup

## Overview
Nubo now supports OneSignal push notifications for real-time email notifications even when the app is closed.

## Features Implemented
- ✅ **New Email Notifications**: Get notified when new emails arrive in INBOX
- ✅ **Email Sent Confirmations**: Get notified when emails are sent successfully  
- ✅ **Sync Error Alerts**: Get notified of email sync failures
- ✅ **User Preferences**: Toggle push notifications in Settings
- ✅ **Test Notifications**: Send test notifications from settings

## Configuration Required

### 1. OneSignal App Setup
1. Go to [OneSignal Dashboard](https://onesignal.com)
2. Your app is already configured with:
   - **App ID**: `fe4fe7fa-55cd-4d38-8ce7-2e8648879bbf`
   - **Safari Web ID**: `web.onesignal.auto.4e6ae055-7872-4c1f-b42a-6c60bed16bbe`

### 2. Get REST API Key
1. In OneSignal Dashboard, go to Settings > Keys & IDs
2. Copy the **REST API Key** 
3. Update `/var/www/nubo/.env`:
```bash
ONESIGNAL_REST_API_KEY=YOUR_ACTUAL_REST_API_KEY_HERE
```

### 3. Service Worker Setup
✅ Already completed:
- OneSignal service worker copied to `/public/OneSignalSDKWorker.js`
- SDK integrated in `app/layout.tsx`

## How It Works

### Frontend Integration
1. **OneSignal SDK**: Loaded in `app/layout.tsx` with your App ID
2. **Service Wrapper**: `lib/notifications.ts` provides TypeScript interface
3. **Settings UI**: Push notification toggle in Settings > Notifications
4. **User Management**: External user IDs set for targeting

### Backend Integration
1. **Push Service**: `services/pushNotifications.ts` handles all notifications
2. **Email Sync**: Sends notifications for new emails in INBOX
3. **Email Sending**: Sends confirmation when emails are sent
4. **Error Handling**: Graceful fallback if notifications fail

### Notification Types
- **New Email**: "New email from [sender]" with email subject
- **Email Sent**: "Email sent successfully" with recipient info  
- **Sync Error**: "Email sync error" with account details
- **Test**: "Test Notification from Nubo" for testing

## User Experience

### Setup Flow
1. User visits Settings > Notifications
2. Toggles "Enable Push Notifications"
3. Browser prompts for notification permission
4. OneSignal subscribes user and gets push token
5. Backend can now send targeted notifications

### Notification Flow  
1. New email arrives via IMAP sync
2. Backend detects new email in INBOX
3. Calls `PushNotificationService.sendNewEmailNotification()`
4. OneSignal delivers push notification
5. User clicks notification → opens email in Nubo

## API Endpoints

### Test Notification
```http
POST /api/mail/test-notification
Authorization: Bearer <jwt-token>
```

Sends a test push notification to verify setup.

## Debugging

### Check Integration
1. Open browser developer tools
2. Check for OneSignal logs in console
3. Verify service worker registration
4. Test notification permission status

### Backend Logs
```bash
pm2 logs nubo-backend | grep -i "push\|notification"
```

### Common Issues
- **No REST API Key**: Notifications silently fail
- **Browser Permissions**: User must grant notification permission
- **Service Worker**: Must be served over HTTPS in production

## Security & Privacy
- External user IDs use Nubo user IDs for targeting
- No sensitive email content sent in notifications
- Users can disable notifications anytime
- OneSignal handles subscription management

## Production Deployment
1. ✅ Update `.env` with real OneSignal REST API Key
2. ✅ Ensure HTTPS for service worker functionality
3. ✅ Test notification delivery in production
4. ✅ Monitor OneSignal dashboard for delivery metrics

## Files Modified
- ✅ `app/layout.tsx` - OneSignal SDK integration
- ✅ `lib/notifications.ts` - Frontend service wrapper
- ✅ `app/settings/page.tsx` - Settings UI
- ✅ `services/pushNotifications.ts` - Backend service
- ✅ `services/emailCacheOAuth.ts` - New email notifications
- ✅ `routes/mail.ts` - Email sent notifications + test endpoint
- ✅ `public/OneSignalSDKWorker.js` - Service worker
- ✅ `.env` - OneSignal configuration

The integration is complete and ready for testing!