package com.captainayman.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import java.util.Calendar;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Daily meal reminders, scheduled on the phone itself (no server push needed, works offline).
 * The site sends {"tz": "Africa/Cairo", "meals": [{"time": "14:00", "title": "…", "body": "…"}]}
 * every time a client page opens; an empty list (signed out / no nutrition plan) clears them.
 */
final class MealReminders {
    static final String PREFS = "meal_reminders";
    private static final String ACTION = "com.captainayman.app.MEAL_REMINDER";
    private static final int BASE_REQUEST = 1000;
    private static final int MAX = 30;

    private MealReminders() {}

    /** Saves the schedule if it changed and (re)schedules it. Returns true when any reminder is set. */
    static boolean update(Context c, String json) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (json == null) json = "";
        if (!json.equals(p.getString("json", ""))) {
            p.edit().putString("json", json).apply();
            scheduleAll(c);
        }
        JSONArray meals = meals(json);
        return meals != null && meals.length() > 0;
    }

    static JSONArray meals(String json) {
        try {
            return new JSONObject(json).optJSONArray("meals");
        } catch (Exception e) {
            return null;
        }
    }

    static JSONObject schedule(Context c) {
        try {
            return new JSONObject(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("json", "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    /** Cancels everything, then sets one alarm per meal at its next occurrence. */
    static void scheduleAll(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        for (int i = 0; i < MAX; i++) am.cancel(pending(c, i));
        JSONObject s = schedule(c);
        JSONArray meals = s.optJSONArray("meals");
        if (meals == null) return;
        String tz = s.optString("tz", "Africa/Cairo");
        for (int i = 0; i < Math.min(meals.length(), MAX); i++) {
            JSONObject m = meals.optJSONObject(i);
            if (m == null) continue;
            long at = nextTime(tz, m.optString("time", ""));
            if (at > 0) set(am, at, pending(c, i));
        }
    }

    /** Next moment the wall clock in `tz` shows HH:MM (today if still ahead, else tomorrow). */
    static long nextTime(String tz, String hhmm) {
        String[] parts = hhmm.split(":");
        if (parts.length < 2) return -1;
        try {
            int h = Integer.parseInt(parts[0].trim());
            int min = Integer.parseInt(parts[1].trim());
            Calendar cal = Calendar.getInstance(TimeZone.getTimeZone(tz));
            long now = cal.getTimeInMillis();
            cal.set(Calendar.HOUR_OF_DAY, h);
            cal.set(Calendar.MINUTE, min);
            cal.set(Calendar.SECOND, 0);
            cal.set(Calendar.MILLISECOND, 0);
            if (cal.getTimeInMillis() <= now + 30_000) cal.add(Calendar.DAY_OF_MONTH, 1);
            return cal.getTimeInMillis();
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    private static void set(AlarmManager am, long at, PendingIntent pi) {
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        try {
            if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    static PendingIntent pending(Context c, int index) {
        Intent i = new Intent(c, ReminderReceiver.class).setAction(ACTION).putExtra("index", index);
        return PendingIntent.getBroadcast(c, BASE_REQUEST + index, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
