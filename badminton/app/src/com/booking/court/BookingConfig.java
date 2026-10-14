package com.booking.court;

import android.content.Context;
import android.content.SharedPreferences;

public class BookingConfig {
    private static final String PREFS = "booking_config";
    private static SharedPreferences sp;

    public static void init(Context ctx) {
        sp = ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static SharedPreferences p() {
        if (sp == null) throw new IllegalStateException("BookingConfig not init");
        return sp;
    }

    public static boolean isEnabled() { return p().getBoolean("enabled", true); }
    public static void setEnabled(boolean v) { p().edit().putBoolean("enabled", v).apply(); }

    public static int getTriggerHour() { return p().getInt("trig_h", 7); }
    public static int getTriggerMinute() { return p().getInt("trig_m", 59); }
    public static void setTriggerTime(int h, int m) {
        p().edit().putInt("trig_h", h).putInt("trig_m", m).apply();
    }

    public static String[] getCourtPriority() {
        return p().getString("courts", "D\u533a3\u53f7,D\u533a2\u53f7,D\u533a1\u53f7,D\u533a4\u53f7,D\u533a9\u53f7,D\u533a7\u53f7,D\u533a8\u53f7,D\u533a6\u53f7").split(",");
    }

    public static String[] getTargetSlots() {
        return p().getString("slots", "18:00-18:30,18:30-19:00,19:00-19:30,19:30-20:00").split(",");
    }

    public static String getLastResult() { return p().getString("last_result", ""); }
    public static void setLastResult(String v) { p().edit().putString("last_result", v).apply(); }

    public static long getLastRunTime() { return p().getLong("last_run", 0); }
    public static void setLastRunTime(long v) { p().edit().putLong("last_run", v).apply(); }

    public static String getLog() { return p().getString("log", ""); }
   public static void appendLog(String line) {
       String old = getLog();
        if (old.length() > 100000) old = old.substring(old.length() - 100000);
       p().edit().putString("log", old + line + "\n").apply();
   }
    public static void clearLog() { p().edit().putString("log", "").apply(); }

    public static void setCourtPriority(String v) { p().edit().putString("courts", v).apply(); }
    public static void setTargetSlots(String v) { p().edit().putString("slots", v).apply(); }

    public static String getSubmitOnlyTimeText() {
        return p().getString("submit_only_time", "8:00:00");
    }

    public static void setSubmitOnlyTimeText(String v) {
        p().edit().putString("submit_only_time", v).apply();
    }
}
