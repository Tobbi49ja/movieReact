import { isApp } from "./platform";
import { LocalNotifications } from "@capacitor/local-notifications";

export async function initNotifications() {
  if (!isApp) return;
  try {
    await LocalNotifications.requestPermissions();
  } catch (err) {
    console.warn("Notification permission request failed", err);
  }
  try {
    await LocalNotifications.createChannel({
      id: "downloads",
      name: "Downloads",
      importance: 4,
      sound: "default",
      vibration: true,
    });
  } catch (err) {
    console.warn("Downloads channel creation failed", err);
  }
  try {
    await LocalNotifications.createChannel({
      id: "announcements",
      name: "Announcements",
      importance: 4,
      sound: "default",
      vibration: true,
    });
  } catch (err) {
    console.warn("Announcements channel creation failed", err);
  }
}

export async function notifyDownloadDone(title) {
  if (!isApp) return;
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 2147483647),
          title: "Download complete",
          body: title,
          channelId: "downloads",
        },
      ],
    });
  } catch (err) {
    console.warn("Download notification failed", err);
  }
}
