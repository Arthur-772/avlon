package com.booking.court;

import android.app.Activity;
import android.app.AlarmManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.text.method.ScrollingMovementMethod;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;
import java.util.Calendar;

public class MainActivity extends Activity {

    private Switch enableSwitch;
    private TextView accStatus, alarmStatus, notifStatus, batteryStatus;
    private EditText logText;
    private Button submitOnlyButton;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        BookingConfig.init(this);
        NotificationHelper.createChannel(this);

        if (BookingConfig.isEnabled()) {
            AlarmReceiver.setAlarm(this);
        }
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);
        }

        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int p = dp(16);
        root.setPadding(p, p, p, p);

        // --- Title ---
        TextView title = new TextView(this);
        title.setText("\u62a2\u573a\u5730");
        title.setTextSize(24);
        title.setTypeface(title.getTypeface(), Typeface.BOLD);
        root.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("\u7fbd\u6bdb\u7403\u573a\u5730\u81ea\u52a8\u9884\u5b9a\u5de5\u5177");
        subtitle.setTextSize(13);
        subtitle.setTextColor(0xFF888888);
        subtitle.setPadding(0, dp(4), 0, dp(20));
        root.addView(subtitle);

        // --- Enable switch ---
        enableSwitch = new Switch(this);
        enableSwitch.setText("\u6bcf\u65e5\u81ea\u52a8\u9884\u5b9a");
        enableSwitch.setChecked(BookingConfig.isEnabled());
        enableSwitch.setOnCheckedChangeListener((v, checked) -> {
            BookingConfig.setEnabled(checked);
            if (checked) {
                AlarmReceiver.setAlarm(this);
                toast("\u5df2\u5f00\u542f\uff0c\u5c06\u5728 " + BookingConfig.getTriggerHour() + ":" +
                      String.format("%02d", BookingConfig.getTriggerMinute()) + " \u6267\u884c");
            } else {
                AlarmReceiver.cancelAlarm(this);
                toast("\u5df2\u5173\u95ed\u81ea\u52a8\u9884\u5b9a");
            }
        });
        root.addView(enableSwitch);
        root.addView(spacer(dp(20)));

        // --- Permission status ---
        root.addView(sectionHeader("\u6743\u9650\u72b6\u6001"));

        accStatus = new TextView(this);
        root.addView(statusRow(accStatus, "\u5f00\u542f", () ->
            startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))));

        alarmStatus = new TextView(this);
        root.addView(statusRow(alarmStatus, "\u8bbe\u7b2e", () -> {
            if (Build.VERSION.SDK_INT >= 31) {
                startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                    .setData(Uri.parse("package:" + getPackageName()))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            }
        }));

        notifStatus = new TextView(this);
        root.addView(statusRow(notifStatus, "\u5f00\u542f", () -> {
            if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);
            } else {
                startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            }
        }));

        batteryStatus = new TextView(this);
        root.addView(statusRow(batteryStatus, "\u8bbe\u7b2e", () ->
            startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                .setData(Uri.parse("package:" + getPackageName()))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))));

        root.addView(spacer(dp(20)));

        // --- Config display ---
        root.addView(sectionHeader("\u9884\u5b9a\u914d\u7f6e"));
        final EditText timeInput = labeledEdit(root, "\u89e6\u53d1\u65f6\u95f4 (\u59827:59)",
            BookingConfig.getTriggerHour() + ":" + String.format("%02d", BookingConfig.getTriggerMinute()),
            InputType.TYPE_CLASS_NUMBER);

        final EditText courtInput = labeledEdit(root, "\u573a\u5730\u4f18\u5148\u7ea7 (\u7528\u9017\u53f7\u5206\u9694)",
            String.join(",", BookingConfig.getCourtPriority()),
            InputType.TYPE_CLASS_TEXT);

        final EditText slotInput = labeledEdit(root, "\u76ee\u6807\u65f6\u6bb5 (\u7528\u9017\u53f7\u5206\u9694)",
            String.join(",", BookingConfig.getTargetSlots()),
            InputType.TYPE_CLASS_TEXT);

        Button saveBtn = new Button(this);
        saveBtn.setText("\u4fdd\u5b58\u914d\u7f6e");
        saveBtn.setOnClickListener(v -> {
            String timeStr = timeInput.getText().toString().trim();
            String[] parts = timeStr.split(":");
            if (parts.length == 2) {
                try {
                    int h = Integer.parseInt(parts[0].trim());
                    int m = Integer.parseInt(parts[1].trim());
                    BookingConfig.setTriggerTime(h, m);
                } catch (NumberFormatException e) {
                    toast("\u89e6\u53d1\u65f6\u95f4\u683c\u5f0f\u9519\u8bef");
                    return;
                }
            } else {
                toast("\u89e6\u53d1\u65f6\u95f4\u683c\u5f0f\u9519\u8bef");
                return;
            }
            String courtsStr = courtInput.getText().toString().trim();
            if (courtsStr.isEmpty()) {
                toast("\u573a\u5730\u4f18\u5148\u7ea7\u4e0d\u80fd\u4e3a\u7a7a");
                return;
            }
            BookingConfig.setCourtPriority(courtsStr);
            String slotsStr = slotInput.getText().toString().trim();
            if (slotsStr.isEmpty()) {
                toast("\u76ee\u6807\u65f6\u6bb5\u4e0d\u80fd\u4e3a\u7a7a");
                return;
            }
            BookingConfig.setTargetSlots(slotsStr);
            AlarmReceiver.setAlarm(this);
            toast("\u914d\u7f6e\u5df2\u4fdd\u5b58");
        });
        root.addView(saveBtn);
        root.addView(spacer(dp(20)));

        // --- Submit only mode ---
        root.addView(sectionHeader("\u4ec5\u51c6\u70b9\u63d0\u4ea4"));

        final EditText submitTimeInput = labeledEdit(root,
            "\u63d0\u4ea4\u65f6\u95f4 (\u59828:00:00)",
            BookingConfig.getSubmitOnlyTimeText(),
            InputType.TYPE_CLASS_TEXT);

        submitOnlyButton = new Button(this);
        submitOnlyButton.setText("\u4ec5\u51c6\u70b9\u63d0\u4ea4");
        submitOnlyButton.setOnClickListener(v -> {
            if (!isAccessibilityEnabled()) {
                toast("\u8bf7\u5148\u5f00\u542f\u65e0\u969c\u788d\u670d\u52a1");
                return;
            }
            if (BookingService.submitOnlyActive) {
                BookingService.cancelSubmitOnly();
                submitOnlyButton.setText("\u4ec5\u51c6\u70b9\u63d0\u4ea4");
                toast("\u5df2\u53d6\u6d88\u51c6\u70b9\u63d0\u4ea4");
                return;
            }

            String timeStr = submitTimeInput.getText().toString().trim();
            long target = parseSubmitTarget(timeStr);
            if (target <= 0) {
                toast("\u63d0\u4ea4\u65f6\u95f4\u683c\u5f0f\u5e94\u4e3a 8:00 \u6216 8:00:00");
                return;
            }

            BookingConfig.setSubmitOnlyTimeText(timeStr);
            BookingService.submitOnlyTarget = target;
            BookingService.shouldSubmitOnly = true;
            submitOnlyButton.setText("\u53d6\u6d88\u51c6\u70b9\u63d0\u4ea4");
            java.text.SimpleDateFormat fmt = new java.text.SimpleDateFormat("HH:mm:ss");
            toast("\u5c06\u5728 " + fmt.format(target) + " \u51c6\u70b9\u63d0\u4ea4");
        });
        root.addView(submitOnlyButton);

        root.addView(spacer(dp(20)));

        // --- Manual execute ---
        Button manualBtn = new Button(this);
        manualBtn.setText("\u7acb\u5373\u6267\u884c\u9884\u5b9a");
        manualBtn.setOnClickListener(v -> {
            if (!isAccessibilityEnabled()) {
                toast("\u8bf7\u5148\u5f00\u542f\u65e0\u969c\u788d\u670d\u52a1");
                return;
            }
            BookingService.shouldStartBooking = true;
            toast("\u5f00\u59cb\u6267\u884c\u9884\u5b9a\u6d41\u7a0b");
        });
        root.addView(manualBtn);

        Button debugBtn = new Button(this);
        debugBtn.setText("\u5c4f\u5e55\u8c03\u8bd5(60\u79d2\u6301\u7eed\u6293\u53d6)");
        debugBtn.setOnClickListener(v -> {
            if (!isAccessibilityEnabled()) {
                toast("\u8bf7\u5148\u5f00\u542f\u65e0\u969c\u788d\u670d\u52a1");
                return;
            }
            BookingService.debugContinuous = true;
            BookingService.debugUntil = System.currentTimeMillis() + 60000;
            toast("\u8c03\u8bd5\u5df2\u5f00\u542f\uff0c60\u79d2\u5185\u6bcf2\u79d2\u8f93\u51fa\u5c4f\u5e55\u4fe1\u606f\u5230\u65e5\u5fd7");
        });
        root.addView(debugBtn);
        root.addView(spacer(dp(20)));

        // --- Log ---
        LinearLayout logHeader = rowLayout();
        TextView logTitle = new TextView(this);
        logTitle.setText("\u6267\u884c\u65e5\u5fd7");
        logTitle.setTextSize(16);
        logTitle.setTypeface(logTitle.getTypeface(), Typeface.BOLD);
        logTitle.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        logHeader.addView(logTitle);
        Button clearBtn = new Button(this);
        clearBtn.setText("\u6e05\u9664");
        clearBtn.setOnClickListener(v -> {
            BookingConfig.clearLog();
            updateLog();
        });
        logHeader.addView(clearBtn);
        Button copyBtn = new Button(this);
        copyBtn.setText("\u590d\u5236");
        copyBtn.setOnClickListener(v -> {
            ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            if (cm != null) {
                String log = BookingConfig.getLog();
                if (log == null || log.isEmpty()) log = "\u6682\u65e0\u65e5\u5fd7";
                cm.setPrimaryClip(ClipData.newPlainText("log", log));
                toast("\u65e5\u5fd7\u5df2\u590d\u5236\u5230\u526a\u8d34\u677f");
            }
        });
        logHeader.addView(copyBtn);
        root.addView(logHeader);

        logText = new EditText(this);
        logText.setTextSize(11);
        logText.setTypeface(Typeface.MONOSPACE);
        logText.setPadding(dp(8), dp(8), dp(8), dp(8));
        logText.setBackgroundColor(0xFFF5F5F5);
        logText.setMovementMethod(ScrollingMovementMethod.getInstance());
        logText.setKeyListener(null);
        logText.setLongClickable(true);
        logText.setTextIsSelectable(true);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(300));
        lp.topMargin = dp(8);
        logText.setLayoutParams(lp);
        root.addView(logText);

        scroll.addView(root);
        setContentView(scroll);
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateStatus();
        updateLog();
        if (submitOnlyButton != null) {
            submitOnlyButton.setText(BookingService.submitOnlyActive
                ? "\u53d6\u6d88\u51c6\u70b9\u63d0\u4ea4" : "\u4ec5\u51c6\u70b9\u63d0\u4ea4");
        }
    }

    private void updateStatus() {
        setStatus(accStatus, "\u65e0\u969c\u788d\u670d\u52a1", isAccessibilityEnabled());
        setStatus(alarmStatus, "\u7cbe\u786e\u95f9\u949f", canScheduleExactAlarms());
        setStatus(notifStatus, "\u901a\u77e5\u6743\u9650", hasNotificationPermission());
        setStatus(batteryStatus, "\u7535\u6c60\u4f18\u5316", isIgnoringBatteryOptimizations());
    }

    private void setStatus(TextView tv, String label, boolean ok) {
        tv.setText(label + ": " + (ok ? "\u2713 \u5df2\u5f00\u542f" : "\u2715 \u672a\u5f00\u542f"));
        tv.setTextColor(ok ? 0xFF2E7D32 : 0xFFD32F2F);
    }

    private void updateLog() {
        String log = BookingConfig.getLog();
        if (log == null || log.isEmpty()) {
            logText.setText("\u6682\u65e0\u65e5\u5fd7");
        } else {
            if (log.length() > 30000) {
                log = "...(\u66f4\u65e9\u65e5\u5fd7\u5df2\u7701\u7565)\n" + log.substring(log.length() - 30000);
            }
            logText.setText(log);
        }
    }

    // --- Permission checks ---

    private boolean isAccessibilityEnabled() {
        String s = Settings.Secure.getString(getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        return s != null && s.contains("com.booking.court");
    }

    private boolean canScheduleExactAlarms() {
        if (Build.VERSION.SDK_INT >= 31) {
            AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
            return am != null && am.canScheduleExactAlarms();
        }
        return true;
    }

    private boolean hasNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            return checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    private boolean isIgnoringBatteryOptimizations() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
    }

    private long parseSubmitTarget(String input) {
        if (input == null || input.isEmpty()) return 0;
        String[] parts = input.split(":");
        if (parts.length < 2 || parts.length > 3) return 0;
        try {
            int h = Integer.parseInt(parts[0].trim());
            int m = Integer.parseInt(parts[1].trim());
            int s = parts.length == 3 ? Integer.parseInt(parts[2].trim()) : 0;
            if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return 0;
            Calendar target = Calendar.getInstance();
            target.set(Calendar.HOUR_OF_DAY, h);
            target.set(Calendar.MINUTE, m);
            target.set(Calendar.SECOND, s);
            target.set(Calendar.MILLISECOND, 0);
            if (target.getTimeInMillis() <= System.currentTimeMillis()) target.add(Calendar.DAY_OF_MONTH, 1);
            return target.getTimeInMillis();
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    // --- Layout helpers ---

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density);
    }

    private View spacer(int h) {
        View s = new View(this);
        s.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, h));
        return s;
    }

    private TextView sectionHeader(String text) {
        TextView tv = new TextView(this);
        tv.setText(text);
        tv.setTextSize(16);
        tv.setTypeface(tv.getTypeface(), Typeface.BOLD);
        tv.setPadding(0, dp(8), 0, dp(8));
        return tv;
    }

    private TextView infoLine(String text) {
        TextView tv = new TextView(this);
        tv.setText(text);
        tv.setPadding(0, dp(4), 0, dp(4));
        return tv;
    }

    private EditText labeledEdit(LinearLayout parent, String label, String initial, int inputType) {
        TextView tv = new TextView(this);
        tv.setText(label);
        tv.setTextSize(13);
        tv.setTextColor(0xFF666666);
        tv.setPadding(0, dp(4), 0, dp(2));
        parent.addView(tv);

        EditText et = new EditText(this);
        et.setText(initial);
        et.setInputType(inputType);
        et.setTextSize(13);
        et.setSingleLine(false);
        parent.addView(et);
        return et;
    }

    private LinearLayout rowLayout() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(4);
        lp.bottomMargin = dp(4);
        row.setLayoutParams(lp);
        return row;
    }

    private LinearLayout statusRow(TextView statusTv, String btnText, Runnable action) {
        LinearLayout row = rowLayout();
        statusTv.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        row.addView(statusTv);
        Button btn = new Button(this);
        btn.setText(btnText);
        btn.setOnClickListener(v -> action.run());
        row.addView(btn);
        return row;
    }

    private String joinCourts(String[] courts) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < courts.length; i++) {
            if (i > 0) sb.append(" \u2192 ");
            sb.append(courts[i]);
        }
        return sb.toString();
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
    }
}
