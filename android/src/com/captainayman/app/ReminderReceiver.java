package com.captainayman.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

/** Shows the reminder for one meal, then schedules the next day's. */
public class ReminderReceiver extends BroadcastReceiver {
    private static final String CHANNEL = "meals";

    @Override
    public void onReceive(Context c, Intent intent) {
        int index = intent.getIntExtra("index", -1);
        JSONArray meals = MealReminders.schedule(c).optJSONArray("meals");
        JSONObject meal = meals != null && index >= 0 ? meals.optJSONObject(index) : null;
        if (meal != null) show(c, index, meal.optString("title", c.getString(R.string.app_name)), meal.optString("body", ""));
        MealReminders.scheduleAll(c);
    }

    private static void show(Context c, int index, String title, String body) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, c.getString(R.string.channel_meals), NotificationManager.IMPORTANCE_HIGH);
            nm.createNotificationChannel(ch);
            b = new Notification.Builder(c, CHANNEL);
        } else {
            b = new Notification.Builder(c).setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        }
        Intent open = new Intent(c, MainActivity.class)
                .putExtra(MainActivity.EXTRA_PATH, "/client/nutrition")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(c, 2000 + index, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        b.setSmallIcon(R.drawable.ic_stat)
                .setColor(0xFFC4F042)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setCategory(Notification.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(tap);
        try {
            nm.notify(3000 + index, b.build());
        } catch (SecurityException ignored) {
            // notifications not allowed on this phone
        }
    }
}
