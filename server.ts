import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, Firestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import cron from 'node-cron';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const projectID = process.env.PROJECT_ID || "ai-studio-kudokudoattendan-839c77d2-2360-43bc-8a31-47e7e530e50e";

const app = !getApps().length ? initializeApp({
  projectId: projectID,
}) : getApps()[0];

// In this environment, the PROJECT_ID often points to a project where the database is (default)
const db = getFirestore(app);
const fcm = getMessaging(app);

console.log(`Firebase Admin initialized with Project ID: ${projectID}`);

// Debug route to check DB connection
async function testConnection() {
  try {
    const snap = await db.collection('users').limit(1).get();
    console.log(`DB Connection Test: Success. Found ${snap.size} users.`);
  } catch (err: any) {
    console.error(`DB Connection Test: Failed. ${err.message}`);
  }
}
testConnection();

async function sendPushNotification(userId: string, title: string, body: string, data = {}) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const token = userData?.fcmToken;

    if (!token) return;

    const message = {
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      token: token
    };

    await fcm.send(message);
    console.log(`Notification sent to ${userId}: ${title}`);
  } catch (error) {
    console.error(`Error sending message to ${userId}:`, error);
  }
}

// 1. Every Minute: Attendance & Departure Reminders
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const schedulesSnap = await db.collection('schedules')
      .where('date', '==', todayStr)
      .where('status', '==', 'scheduled')
      .get();

    for (const doc of schedulesSnap.docs) {
      const schedule = doc.data();
      const sent = schedule.notificationsSent || {};
      const updates: any = {};

      // Attendance
      const [startH, startM] = schedule.startTime.split(':').map(Number);
      const schedStart = new Date(now);
      schedStart.setHours(startH, startM, 0, 0);
      const diffMins = (schedStart.getTime() - now.getTime()) / (1000 * 60);

      if (diffMins <= 10.5 && diffMins > 9.5 && !sent.tenMin) {
        await sendPushNotification(schedule.userId, 'تنبيه: 10 دقائق للبدء', 'يرجى التوجه إلى موقع العمل، موعد بدأ دوانك خلال 10 دقائق.');
        updates['notificationsSent.tenMin'] = true;
      }
      if (diffMins <= 5.5 && diffMins > 4.5 && !sent.fiveMin) {
        await sendPushNotification(schedule.userId, 'استعداد: 5 دقائق للبدء', 'استعد لتسجيل الحضور، بقي 5 دقائق فقط.');
        updates['notificationsSent.fiveMin'] = true;
      }
      if (diffMins <= 0.5 && diffMins > -0.5 && !sent.start) {
        await sendPushNotification(schedule.userId, 'بدء العمل الآن', 'تسجيل الحضور متاح الآن. يرجى تسجيل حضورك فور وصولك.');
        updates['notificationsSent.start'] = true;
      }
      if (diffMins <= -9.5 && diffMins > -10.5 && !sent.tenMinLate) {
        await sendPushNotification(schedule.userId, 'تنبيه تأخير', 'لقد مضى 10 دقائق على موعد بدأ عملك ولم تسجل حضورك بعد.');
        updates['notificationsSent.tenMinLate'] = true;
      }
      if (diffMins <= -19.5 && diffMins > -20.5 && !sent.twentyMinLate) {
        await sendPushNotification(schedule.userId, 'تنبيه: أنت متأخر رسمياً', 'لقد تجاوزت مهلة الـ 20 دقيقة. سيتم تسجيلك كمتأخر.');
        updates['notificationsSent.twentyMinLate'] = true;
      }

      // Departure
      const [endH, endM] = schedule.endTime.split(':').map(Number);
      const schedEnd = new Date(now);
      schedEnd.setHours(endH, endM, 0, 0);
      const diffEndMins = (schedEnd.getTime() - now.getTime()) / (1000 * 60);

      if (diffEndMins <= 10.5 && diffEndMins > 9.5 && !sent.endTenMin) {
        await sendPushNotification(schedule.userId, 'تنبيه انصراف', 'بقي 10 دقائق على نهاية موعد دوانك.');
        updates['notificationsSent.endTenMin'] = true;
      }
      if (diffEndMins <= 5.5 && diffEndMins > 4.5 && !sent.endFiveMin) {
        await sendPushNotification(schedule.userId, 'تنبيه انصراف', 'بقي 5 دقائق على نهاية موعد دوانك.');
        updates['notificationsSent.endFiveMin'] = true;
      }
      if (diffEndMins <= 0.5 && diffEndMins > -0.5 && !sent.endStart) {
        await sendPushNotification(schedule.userId, 'نهاية الدوام', 'حان موعد الانصراف. يرجى تسجيل الانصراف قبل المغادرة.');
        updates['notificationsSent.endStart'] = true;
      }

      if (Object.keys(updates).length > 0) {
        await doc.ref.update(updates);
      }
    }
  } catch (err) {
    console.error('Error in attendance cron:', err);
  }
});

// 2. Midnight Baghdad (UTC+3) -> 9:00 PM UTC
cron.schedule('0 21 * * *', async () => {
  try {
    const adminsSnap = await db.collection('users')
      .where('role', 'in', ['admin', 'manager', 'supervisor'])
      .get();

    for (const doc of adminsSnap.docs) {
      await sendPushNotification(doc.id, 'تذكير: جدول العمل', 'يرجى إعداد جدول العمل لليوم القادم.');
    }
  } catch (err) {
    console.error('Error in midnight cron:', err);
  }
});

// 3. Robust Polling for Events (instead of onSnapshot to avoid gRPC errors)
let lastPollTime = Timestamp.now();

cron.schedule('*/2 * * * *', async () => {
  try {
    const currentPollTime = Timestamp.now();

    // Financials
    const financialSnap = await db.collection('financial_records')
      .where('createdAt', '>', lastPollTime)
      .get();
    
    for (const doc of financialSnap.docs) {
      const data = doc.data();
      let body = '';
      if (data.bonus > 0) body = `تم إضافة مكافأة بقيمة ${data.bonus} إلى حسابك.`;
      if (data.deduction > 0) body = `تم تسجيل خصم بقيمة ${data.deduction} من حسابك.`;
      if (data.overtime > 0) body = `تم إضافة أجر إضافي بقيمة ${data.overtime} إلى حسابك.`;
      if (body) await sendPushNotification(data.userId, 'تحديث مالي', body);
    }

    // Requests (Check modified recently)
    // For requests, we'll look for status changes. This is harder with simple polling 
    // but we can check updatedAt if available. Assuming simple added alerts for now.

    // Notifications (replacing alerts)
    const notificationsSnap = await db.collection('notifications')
      .where('createdAt', '>', lastPollTime)
      .get();
    
    if (!notificationsSnap.empty) {
      const usersSnap = await db.collection('users').get();
      for (const notifDoc of notificationsSnap.docs) {
        const notifData = notifDoc.data();
        if (notifData.type === 'admin_alert' || notifData.type === 'broadcast') {
          for (const userDoc of usersSnap.docs) {
            await sendPushNotification(userDoc.id, 'تنبيه إداري', notifData.message || notifData.title);
          }
        }
      }
    }

    // Chats
    const chatsSnap = await db.collection('chats')
      .where('lastMessageTime', '>', lastPollTime)
      .get();
    
    for (const doc of chatsSnap.docs) {
      const data = doc.data();
      if (data.lastMessage && data.lastMessageSenderId) {
        const participants = data.participants || [];
        const recipientId = participants.find((p: string) => p !== data.lastMessageSenderId);
        if (recipientId) {
          await sendPushNotification(recipientId, 'رسالة جديدة', data.lastMessage);
        }
      }
    }

    lastPollTime = currentPollTime;
  } catch (err) {
    console.error('Error in polling cron:', err);
  }
});

async function startServer() {
  const app = express();
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(3000, "0.0.0.0", () => console.log('Server running on port 3000 with gRPC stability fixes'));
}
startServer();
