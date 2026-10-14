package com.booking.court;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import java.util.Calendar;

public class AlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "AlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.i(TAG, "Alarm triggered");
        BookingConfig.init(context);
        NotificationHelper.createChannel(context);

        if (!BookingConfig.isEnabled()) {
            Log.i(TAG, "Disabled, skip");
            return;
        }

        // Wake the device
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            PowerManager.WakeLock wl = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK |
                PowerManager.ACQUIRE_CAUSES_WAKEUP |
                PowerManager.ON_AFTER_RELEASE,
                "booking:court");
            wl.acquire(60000);
        }

        // Signal the accessibility service
        BookingService.shouldStartBooking = true;
        BookingConfig.appendLog(getTimestamp() + " \u89e6\u53d1\u9884\u5b9a\u6d41\u7a0b");

        // Go to home screen to start navigation
        Intent home = new Intent(Intent.ACTION_MAIN);
        home.addCategory(Intent.CATEGORY_HOME);
        home.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(home);

        // Reschedule for tomorrow
        setAlarm(context);
    }

    public static void setAlarm(Context ctx) {
        BookingConfig.init(ctx);
        int hour = BookingConfig.getTriggerHour();
        int minute = BookingConfig.getTriggerMinute();

        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, hour);
        cal.set(Calendar.MINUTE, minute);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis()) {
            cal.add(Calendar.DAY_OF_MONTH, 1);
        }

        Intent intent = new Intent(ctx, AlarmReceiver.class);
        intent.setAction("com.booking.court.ALARM_TRIGGER");
        PendingIntent pi = PendingIntent.getBroadcast(ctx, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        boolean canExact = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            canExact = am.canScheduleExactAlarms();
        }

        if (canExact && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), pi);
            Log.i(TAG, "Alarm set with setExactAndAllowWhileIdle for " + cal.getTime());
        } else {
            AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(cal.getTimeInMillis(), pi);
            am.setAlarmClock(info, pi);
            Log.i(TAG, "Alarm set with setAlarmClock for " + cal.getTime());
        }
    }

    public static void cancelAlarm(Context ctx) {
        Intent intent = new Intent(ctx, AlarmReceiver.class);
        intent.setAction("com.booking.court.ALARM_TRIGGER");
        PendingIntent pi = PendingIntent.getBroadcast(ctx, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pi);
    }

    private static String getTimestamp() {
        return java.text.DateFormat.getTimeInstance(java.text.DateFormat.MEDIUM).format(new java.util.Date());
    }
}