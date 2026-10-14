package com.booking.court;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.graphics.Rect;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import android.widget.Toast;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class BookingService extends AccessibilityService {
    private static final String TAG = "BookingService";

   static volatile boolean shouldStartBooking = false;
   static volatile boolean shouldSubmitOnly = false;
   static volatile boolean submitOnlyActive = false;
   static volatile long submitOnlyTarget = 0;
    static volatile boolean debugDump = false;
    static volatile boolean debugContinuous = false;
    static volatile long debugUntil = 0;
   static volatile String foregroundPackage = "";
   private volatile boolean isBooking = false;
   private volatile boolean isSubmitOnly = false;
    private volatile boolean isRunning = false;
    private Thread bookingThread;
    private Thread submitOnlyThread;
    private Thread watchThread;
    private PowerManager.WakeLock wakeLock;
    private PowerManager.WakeLock screenWakeLock;

    private String targetPackage = "";
    private final Set<String> bookedSlots = new HashSet<>();
    private int courtIndex = 0;
    private int submitRetry = 0;
    private long startTime = 0;
    private long lastClickTime = 0;
    private String lastClickedText = "";
    private int backCount = 0;
   private String[] courts;
   private String[] slots;
   private final Set<String> selectedSlots = new HashSet<>();

   private enum State {
        GO_HOME, FIND_APP, SPLASH, HOME_PAGE,
        COURT_LIST, DATE_PICKER, SELECT_COURT,
        COURT_DETAIL, WAIT_FOR_SUBMIT, SUBMITTING, BACK_TO_LIST, DONE
    }

    private State state = State.GO_HOME;

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        BookingConfig.init(this);
       NotificationHelper.createChannel(this);
        log("\u65e0\u969c\u788d\u670d\u52a1\u5df2\u8fde\u63a5");
       watchThread = new Thread(() -> {
           while (!Thread.currentThread().isInterrupted()) {
               try {
                   tryStartBooking();
                    Thread.sleep(debugContinuous ? 2000 : 500);
               } catch (InterruptedException e) { break; }
           }
       }, "BookingWatch");
        watchThread.start();
    }

    private synchronized void tryStartBooking() {
        if (shouldSubmitOnly) {
            debugContinuous = false;
            debugUntil = 0;
            if (isBooking || isRunning) {
                log("\u505c\u6b62\u4e4b\u524d\u7684\u9884\u5b9a\u6d41\u7a0b");
                isRunning = false;
                if (bookingThread != null) {
                    try { bookingThread.join(5000); } catch (InterruptedException e) { }
                }
                isBooking = false;
            }
            shouldSubmitOnly = false;
            startSubmitOnly();
            return;
        }
        if (shouldStartBooking) {
            debugContinuous = false;
            debugUntil = 0;
            if (isBooking || isRunning) {
                log("\u505c\u6b62\u4e4b\u524d\u7684\u9884\u5b9a\u6d41\u7a0b");
                isRunning = false;
                if (bookingThread != null) {
                    try { bookingThread.join(5000); } catch (InterruptedException e) { }
                }
                isBooking = false;
            }
            isBooking = true;
            shouldStartBooking = false;
            stopSubmitOnly();
            startBooking();
            return;
        }
        if (debugContinuous && System.currentTimeMillis() < debugUntil) {
            dumpScreen();
            return;
        }
        if (debugContinuous && System.currentTimeMillis() >= debugUntil) {
            debugContinuous = false;
            log("\u8c03\u8bd5\u6a21\u5f0f\u5df2\u81ea\u52a8\u7ed3\u675f");
            return;
        }
        if (debugDump) {
            debugDump = false;
            dumpScreen();
            return;
        }
        if (shouldStartBooking && !isBooking) {
            isBooking = true;
            shouldStartBooking = false;
            startBooking();
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event != null && event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            CharSequence pkg = event.getPackageName();
            if (pkg != null && pkg.length() > 0) {
                String newPkg = pkg.toString();
                if (!newPkg.equals(foregroundPackage)) {
                    foregroundPackage = newPkg;
                    BookingConfig.appendLog("[\u524d\u53f0\u5207\u6362] " + newPkg);
                }
            }
        }
        tryStartBooking();
    }

    @Override
    public void onInterrupt() {
        log("Service interrupted");
        isRunning = false;
        stopSubmitOnly();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isRunning = false;
        stopSubmitOnly();
    }

    public void startBooking() {
        stopSubmitOnly();
        if (isRunning) return;
        isRunning = true;
        courts = BookingConfig.getCourtPriority();
        slots = BookingConfig.getTargetSlots();
        bookedSlots.clear();
        courtIndex = 0;
        submitRetry = 0;
        backCount = 0;
        startTime = System.currentTimeMillis();
        state = State.GO_HOME;

        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "booking:run");
            wakeLock.acquire(180000);
        }

        log("=== \u9884\u5b9a\u5f00\u59cb ===");
        bookingThread = new Thread(this::runBookingLoop, "BookingThread");
        bookingThread.start();
    }

    public void stopBooking() {
        isRunning = false;
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        log("=== \u9884\u5b9a\u505c\u6b62 ===");
    }

    private void runBookingLoop() {
        sleep(1000);
        while (isRunning && state != State.DONE) {
            try {
                AccessibilityNodeInfo root = getRootInActiveWindow();
                if (root == null) {
                    sleep(500);
                    continue;
                }

                String pkg = String.valueOf(root.getPackageName());
                if (!"com.deppon.app.addressbook".equals(pkg)) {
                    if ("com.deppon.app.addressbook".equals(foregroundPackage)) {
                        AccessibilityNodeInfo depponRoot = findRootForPackage("com.deppon.app.addressbook");
                        if (depponRoot != null) {
                            log("\u524d\u53f0\u4e0e\u6d3b\u52a8\u7a97\u53e3\u4e0d\u4e00\u81f4\uff0c\u4f7f\u7528\u5fb7\u90a6\u7a97\u53e3\u5185\u5bb9");
                            root = depponRoot;
                            pkg = String.valueOf(root.getPackageName());
                        } else {
                            log("\u524d\u53f0\u5df2\u8fdb\u5165\u5fb7\u90a6\uff0c\u7b49\u5f85\u7a97\u53e3\u5185\u5bb9\u540c\u6b65...");
                            sleep(500);
                            continue;
                        }
                    } else {
                        log("\u6839\u7a97\u53e3\u4e0d\u662f\u5fb7\u90a6\u5e94\u7528(" + pkg + ")\uff0c\u8f6c\u5230\u542f\u52a8\u6d41\u7a0b");
                        state = State.FIND_APP;
                        handleFindApp(root);
                        sleep(500);
                        continue;
                    }
                }
                if (targetPackage.isEmpty() && containsText(root, "\u573a\u5730\u9884\u5b9a")) {
                    targetPackage = pkg;
                    log("\u68c0\u6d4b\u5230\u76ee\u6807\u5e94\u7528: " + pkg);
                }

                handleState(root);
            } catch (Exception e) {
                log("\u5f02\u5e38: " + e.getMessage());
            }
            sleep(500);
        }
        finishBooking();
    }

    private AccessibilityNodeInfo findRootForPackage(String packageName) {
        try {
            List<AccessibilityWindowInfo> windows = getWindows();
            if (windows == null) return null;
            for (AccessibilityWindowInfo window : windows) {
                if (window == null) continue;
                AccessibilityNodeInfo windowRoot = window.getRoot();
                if (windowRoot != null && packageName.equals(String.valueOf(windowRoot.getPackageName()))) {
                    return windowRoot;
                }
            }
        } catch (Exception e) {
            log("\u83b7\u53d6\u7a97\u53e3\u5217\u8868\u5f02\u5e38: " + e.getMessage());
        }
        return null;
    }

    private void handleState(AccessibilityNodeInfo root) {
        long elapsed = (System.currentTimeMillis() - startTime) / 1000;
        if (elapsed > 600 && state != State.WAIT_FOR_SUBMIT) {
            log("\u603b\u8d85\u65f6 10\u5206\u949f\uff0c\u7ec8\u6b62");
            state = State.DONE;
            return;
        }

        switch (state) {
            case GO_HOME:
                handleGoHome(root);
                break;
            case FIND_APP:
                handleFindApp(root);
                break;
            case SPLASH:
                handleSplash(root);
                break;
            case HOME_PAGE:
                handleHomePage(root);
                break;
            case COURT_LIST:
                handleCourtList(root);
                break;
            case DATE_PICKER:
                handleDatePicker(root);
                break;
            case SELECT_COURT:
                handleSelectCourt(root);
                break;
            case COURT_DETAIL:
                handleCourtDetail(root);
                break;
            case WAIT_FOR_SUBMIT:
                handleWaitForSubmit(root);
                break;
            case SUBMITTING:
                handleSubmitting(root);
                break;
            case BACK_TO_LIST:
                handleBackToList(root);
                break;
        }
    }

    // === State Handlers ===

    private void handleGoHome(AccessibilityNodeInfo root) {
        String pkg = foregroundPackage.isEmpty() ? String.valueOf(root.getPackageName()) : foregroundPackage;
        boolean inDeppon = "com.deppon.app.addressbook".equals(pkg);
        log("\u68c0\u67e5\u9875\u9762\u72b6\u6001 pkg=" + pkg + " rootPkg=" + root.getPackageName());
        if (!inDeppon) {
            long sinceLaunch = System.currentTimeMillis() - lastClickTime;
            if ("launch".equals(lastClickedText) && sinceLaunch < 30000) {
                log("\u521a\u542f\u52a8\u5fb7\u90a6\uff0c\u7b49\u5f85\u52a0\u8f7d... pkg=" + pkg + " rootPkg=" + root.getPackageName());
                sleep(2000);
                return;
            }
            log("\u4e0d\u5728\u5fb7\u90a6\u5e94\u7528\u5185\uff0c\u8f6c\u5230\u542f\u52a8\u6d41\u7a0b");
            backCount = 0;
            state = State.FIND_APP;
            return;
        }
        if (containsText(root, "\u8df3\u8fc7")) {
            log("\u5feb\u901f\u9875\u9762");
            state = State.SPLASH;
            return;
        }
        if (containsText(root, "\u6d3b\u52a8\u573a\u5730") || containsText(root, "\u7fbd\u6bdb\u7403\u5ba4")) {
            log("\u5df2\u5728\u573a\u5730\u5217\u8868");
            state = State.COURT_LIST;
            return;
        }
        if (containsText(root, "\u573a\u5730\u8be6\u60c5")) {
            log("\u5df2\u5728\u573a\u5730\u8be6\u60c5");
            state = State.COURT_DETAIL;
            return;
        }
        if (containsText(root, "\u573a\u5730\u9884\u5b9a") || containsText(root, "\u5feb\u6377\u670d\u52a1") || containsText(root, "\u5e94\u7528\u5e02\u573a")) {
            log("\u5df2\u5728\u5e94\u7528\u9996\u9875");
            state = State.HOME_PAGE;
            return;
        }
        if (inDeppon) {
            log("\u5728\u5fb7\u90a6\u5e94\u7528\u4e2d\u4f46\u672a\u8bc6\u522b\u9875\u9762\uff0c\u7b49\u5f85WebView\u52a0\u8f7d...");
            dumpVisibleText(root);
            backCount++;
            if (backCount <= 2) {
                sleep(3000);
                return;
            }
            if (backCount > 5) {
                log("\u8fde\u7eed\u672a\u8bc6\u522b\u8d85\u9650\uff0c\u91cd\u65b0\u542f\u52a8\u5e94\u7528");
                backCount = 0;
                state = State.FIND_APP;
                return;
            }
            log("\u5c1d\u8bd5\u6309\u8fd4\u56de\u952e (" + backCount + ")");
            performGlobalAction(GLOBAL_ACTION_BACK);
            sleep(1500);
            return;
        }
        backCount = 0;
        state = State.FIND_APP;
    }

    private void handleFindApp(AccessibilityNodeInfo root) {
        log("\u542f\u52a8\u5fb7\u90a6\u529e\u516c\u5e94\u7528...");
        String eventPkg = foregroundPackage;
        String rootPkg = String.valueOf(root.getPackageName());
        log("  eventPkg=" + eventPkg + " rootPkg=" + rootPkg);
        if ("com.deppon.app.addressbook".equals(eventPkg) || "com.deppon.app.addressbook".equals(rootPkg)) {
            log("\u5df2\u5728\u5fb7\u90a6\u5e94\u7528\u4e2d\uff0c\u8f6c\u5230\u9875\u9762\u8bc6\u522b");
            state = State.GO_HOME;
            return;
        }
        if (containsText(root, "\u573a\u5730\u9884\u5b9a") || containsText(root, "\u5feb\u6377\u670d\u52a1")) {
            state = State.HOME_PAGE;
            return;
        }
        if (containsText(root, "\u8df3\u8fc7")) {
            state = State.SPLASH;
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastClickTime < 20000 && "launch".equals(lastClickedText)) {
            log("\u7b49\u5f85\u5fb7\u90a6\u5e94\u7528\u52a0\u8f7d... (" + (20000 - (now - lastClickTime)) / 1000 + "s)");
            sleep(1000);
            return;
        }
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage("com.deppon.app.addressbook");
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(launchIntent);
            log("\u5df2\u53d1\u9001\u542f\u52a8\u610f\u56fe");
            lastClickTime = System.currentTimeMillis();
            lastClickedText = "launch";
            sleep(1000);
        } else {
            log("getLaunchIntentForPackage\u8fd4\u56denull\uff0c\u5c1d\u8bd5\u663e\u5f0fIntent\u542f\u52a8");
            Intent explicitIntent = new Intent();
            explicitIntent.setPackage("com.deppon.app.addressbook");
            explicitIntent.setAction(Intent.ACTION_MAIN);
            explicitIntent.addCategory(Intent.CATEGORY_LAUNCHER);
            explicitIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                startActivity(explicitIntent);
                log("\u663e\u5f0fIntent\u542f\u52a8\u6210\u529f");
                lastClickTime = System.currentTimeMillis();
                lastClickedText = "launch";
                sleep(1000);
            } catch (Exception e) {
                log("\u663e\u5f0fIntent\u542f\u52a8\u5931\u8d25: " + e.getMessage());
                if (findAndClickText(root, "\u529e\u516c")) {
                    log("\u70b9\u51fb\u4e86\u529e\u516c");
                    lastClickTime = System.currentTimeMillis();
                    lastClickedText = "launch";
                    sleep(1000);
                }
            }
        }
    }

    private void handleSplash(AccessibilityNodeInfo root) {
        log("\u5904\u7406\u542f\u52a8\u9875...");
        if (containsText(root, "\u573a\u5730\u9884\u5b9a") || containsText(root, "\u5feb\u6377\u670d\u52a1")) {
            state = State.HOME_PAGE;
            return;
        }
        if (findAndClickText(root, "\u8df3\u8fc7")) {
            log("\u70b9\u51fb\u8df3\u8fc7");
            state = State.GO_HOME;
            sleep(1000);
            return;
        }
        long elapsed = (System.currentTimeMillis() - startTime) / 1000;
        if (elapsed > 15) {
            log("\u542f\u52a8\u9875\u8d85\u65f6\uff0c\u91cd\u8bd5");
            performGlobalAction(GLOBAL_ACTION_BACK);
            sleep(1000);
            state = State.GO_HOME;
        }
    }

    private void handleHomePage(AccessibilityNodeInfo root) {
        log("\u9996\u9875\uff0c\u67e5\u627e\u573a\u5730\u9884\u5b9a...");
        String pkg = String.valueOf(root.getPackageName());
        if (!"com.deppon.app.addressbook".equals(pkg)) {
            log("\u4e0d\u5728\u5fb7\u90a6\u5e94\u7528\u5185\uff0c\u8f6c\u5230\u9875\u9762\u8bc6\u522b");
            state = State.GO_HOME;
            return;
        }
        if (containsText(root, "\u6d3b\u52a8\u573a\u5730") || containsText(root, "\u7fbd\u6bdb\u7403\u5ba4")) {
            state = State.COURT_LIST;
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastClickTime < 5000 && "\u573a\u5730\u9884\u5b9a".equals(lastClickedText)) {
            log("\u7b49\u5f85\u9875\u9762\u52a0\u8f7d...");
            sleep(1000);
            return;
        }
        if (findAndClickText(root, "\u573a\u5730\u9884\u5b9a")) {
            log("\u70b9\u51fb\u573a\u5730\u9884\u5b9a");
            lastClickTime = System.currentTimeMillis();
            lastClickedText = "\u573a\u5730\u9884\u5b9a";
            sleep(3000);
            return;
        }
        if (findAndClickText(root, "\u573a\u5730")) {
            log("\u70b9\u51fb\u573a\u5730");
            lastClickTime = System.currentTimeMillis();
            lastClickedText = "\u573a\u5730";
            sleep(3000);
            return;
        }
        long elapsed = (System.currentTimeMillis() - startTime) / 1000;
        if (elapsed > 40) {
            log("\u9996\u9875\u672a\u627e\u5230\u573a\u5730\u9884\u5b9a\uff0c\u8f6c\u5230\u684c\u9762\u91cd\u8bd5");
            state = State.GO_HOME;
        }
    }

    private void handleCourtList(AccessibilityNodeInfo root) {
        log("\u573a\u5730\u5217\u8868\u9875\uff0c\u68c0\u67e5\u65e5\u671f...");
        if (containsText(root, "\u786e\u5b9a") && containsText(root, "\u53d6\u6d88")) {
            log("\u65e5\u671f\u9009\u62e9\u5668\u5df2\u6253\u5f00");
            state = State.DATE_PICKER;
            return;
        }
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DAY_OF_MONTH, 1);
        String tomorrowStr = String.format("%04d-%02d-%02d",
            cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH));
        String tomorrowShort = String.format("%02d-%02d",
            cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH));
        String tomorrowCN = (cal.get(Calendar.MONTH) + 1) + "\u6708" + cal.get(Calendar.DAY_OF_MONTH) + "\u65e5";
        String tomorrowDay = String.valueOf(cal.get(Calendar.DAY_OF_MONTH));
        if (containsText(root, tomorrowStr)) {
            log("\u5df2\u662f\u660e\u5929\u65e5\u671f: " + tomorrowStr);
            state = State.SELECT_COURT;
            return;
        }
        if (containsText(root, tomorrowCN) || containsText(root, tomorrowShort)) {
            log("\u5df2\u662f\u660e\u5929\u65e5\u671f: " + tomorrowCN);
            state = State.SELECT_COURT;
            return;
        }
        if (findAndClickText(root, tomorrowStr)) {
            log("\u70b9\u51fb\u660e\u5929\u65e5\u671f");
            sleep(1500);
            return;
        }
        if (findAndClickText(root, tomorrowCN)) {
            log("\u70b9\u51fb\u660e\u5929\u65e5\u671f: " + tomorrowCN);
            sleep(1500);
            return;
        }
        if (findAndClickText(root, tomorrowShort)) {
            log("\u70b9\u51fb\u660e\u5929\u65e5\u671f: " + tomorrowShort);
            sleep(1500);
            return;
        }
        if (findAndClickText(root, "\u65e5\u671f")) {
            log("\u70b9\u51fb\u65e5\u671f\u680f");
            sleep(1500);
            return;
        }
        log("\u672a\u627e\u5230\u660e\u5929\u65e5\u671f\uff0c\u5c1d\u8bd5\u5de6\u6ed1");
        swipeLeft();
        sleep(1000);
        long elapsed = (System.currentTimeMillis() - startTime) / 1000;
        if (elapsed > 45) {
            log("\u573a\u5730\u5217\u8868\u8d85\u65f6\uff0c\u5c1d\u8bd5\u9009\u62e9\u573a\u5730");
            state = State.SELECT_COURT;
        }
    }

    private void handleDatePicker(AccessibilityNodeInfo root) {
        log("\u65e5\u671f\u9009\u62e9\u5668...");
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DAY_OF_MONTH, 1);
        int tomorrowDay = cal.get(Calendar.DAY_OF_MONTH);

        if (!containsText(root, "\u786e\u5b9a")) {
            log("\u65e5\u671f\u9009\u62e9\u5668\u672a\u51fa\u73b0");
            state = State.COURT_LIST;
            return;
        }

        if (!containsText(root, String.valueOf(tomorrowDay))) {
            String tomorrowStr = String.format("%04d-%02d-%02d",
                cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH));
            if (findAndClickText(root, tomorrowStr)) {
                log("\u70b9\u51fb\u660e\u5929\u65e5\u671f\u5b57\u7b26\u4e32");
                sleep(1000);
                return;
            }
        }

        if (findAndClickExactText(root, String.valueOf(tomorrowDay))) {
            log("\u70b9\u51fb\u660e\u5929\u65e5\u671f: " + tomorrowDay);
            sleep(1000);
        }

        if (findAndClickText(root, "\u786e\u5b9a")) {
            log("\u70b9\u51fb\u786e\u5b9a");
            sleep(1500);
            state = State.COURT_LIST;
        }
    }

    private void handleSelectCourt(AccessibilityNodeInfo root) {
        if (courtIndex >= courts.length) {
            log("\u6240\u6709\u573a\u5730\u5df2\u5c1d\u8bd5\u5b8c\u6bd5");
            state = State.DONE;
            return;
        }
        if (bookedSlots.size() >= slots.length) {
            log("\u6240\u6709\u65f6\u6bb5\u5df2\u9884\u5b9a");
            state = State.DONE;
            return;
        }

        String court = courts[courtIndex];
        log("\u9009\u62e9\u573a\u5730: " + court + " (\u7b2c" + (courtIndex + 1) + "/" + courts.length + ")");

       if (containsText(root, "\u573a\u5730\u8be6\u60c5") && containsText(root, court)) {
           log("\u5df2\u8fdb\u5165\u573a\u5730\u8be6\u60c5: " + court);
           selectedSlots.clear();
           state = State.COURT_DETAIL;
           submitRetry = 0;
           return;
       }

        if (containsText(root, "\u8be5\u5929\u9884\u5b9a\u603b\u6570\u65f6\u95f4\u5df2\u7ecf\u8d85\u8fc7\u4e24\u5c0f\u65f6")) {
            log("\u68c0\u6d4b\u5230\u8d85\u8fc7\u4e24\u5c0f\u65f6\u9650\u5236");
            state = State.DONE;
            return;
        }

        if (findCourtAndClickBook(root, court)) {
            log("\u70b9\u51fb\u4e86 " + court + " \u7684\u9884\u5b9a\u6309\u94ae");
            sleep(2000);
            return;
        }

        List<AccessibilityNodeInfo> bookBtns = root.findAccessibilityNodeInfosByText("\u9884\u5b9a");
        if (bookBtns != null && !bookBtns.isEmpty()) {
            int idx = courtIndex;
            if (idx < bookBtns.size()) {
                AccessibilityNodeInfo btn = findClickableParent(bookBtns.get(idx));
                if (btn != null && btn.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                    log("\u70b9\u51fb\u7b2c" + (idx + 1) + "\u4e2a\u9884\u5b9a\u6309\u94ae");
                    sleep(2000);
                    return;
                }
            }
        }

        log("\u672a\u627e\u5230 " + court + " \u7684\u9884\u5b9a\u6309\u94ae\uff0c\u5c1d\u8bd5\u6ed1\u52a8");
        AccessibilityNodeInfo scrollable = findScrollable(root);
        if (scrollable != null) {
            boolean scrolled = scrollable.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD);
            if (!scrolled) {
                log("  ACTION_SCROLL \u5931\u8d25\uff0c\u6539\u7528\u624b\u52bf\u4e0a\u6ed1");
                swipeUp();
            }
            sleep(1000);
            return;
        }

        log("\u672a\u627e\u5230\u53ef\u6ed1\u52a8\u63a7\u4ef6\uff0c\u6539\u7528\u624b\u52bf\u4e0a\u6ed1");
        swipeUp();
        sleep(1000);
    }

    private long getSubmitTarget() {
        Calendar cal = Calendar.getInstance();
        int h = BookingConfig.getTriggerHour() + 1;
        if (h >= 24) h = 0;
        cal.set(Calendar.HOUR_OF_DAY, h);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        return cal.getTimeInMillis();
    }

    private void handleWaitForSubmit(AccessibilityNodeInfo root) {
        long target = getSubmitTarget();
        long now = System.currentTimeMillis();
        long remainingMs = target - now;

        if (remainingMs <= 0) {
            log("\u63d0\u4ea4\u65f6\u95f4\u5230\uff01\u70b9\u51fb\u9884\u5b9a");
            if (!findAndClickText(root, "\u9884\u5b9a")) {
                findAndClickText(root, "\u63d0\u4ea4");
            }
            sleep(1500);
            state = State.SUBMITTING;
            submitRetry = 0;
            return;
        }

        long remainingSec = remainingMs / 1000;
        if (!containsText(root, "\u573a\u5730\u8be6\u60c5") && !containsText(root, "\u7fbd\u6bdb\u7403\u5ba4")) {
            log("\u7b49\u5f85\u4e2d\u4f46\u9875\u9762\u5df2\u79bb\u5f00\u573a\u5730\u8be6\u60c5\uff0c\u56de\u5230\u5217\u8868");
            state = State.COURT_LIST;
            return;
        }

        if (remainingSec % 10 == 0 || remainingSec <= 5) {
            log("\u7b49\u5f85\u63d0\u4ea4... \u5269\u4f59 " + remainingSec + " \u79d2");
        }
        sleep(Math.min(1000, Math.max(200, (int)remainingMs)));
    }

    private void handleCourtDetail(AccessibilityNodeInfo root) {
        log("\u573a\u5730\u8be6\u60c5\u9875\uff0c\u9009\u62e9\u65f6\u6bb5...");

        if (containsText(root, "\u8be5\u5929\u9884\u5b9a\u603b\u6570\u65f6\u95f4\u5df2\u7ecf\u8d85\u8fc7\u4e24\u5c0f\u65f6")) {
            log("\u68c0\u6d4b\u5230\u8d85\u8fc7\u4e24\u5c0f\u65f6\u9650\u5236");
            state = State.DONE;
            return;
        }

        if (!containsText(root, "\u573a\u5730\u8be6\u60c5") && !containsText(root, "\u7fbd\u6bdb\u7403\u5ba4")) {
            log("\u4e0d\u5728\u573a\u5730\u8be6\u60c5\u9875");
            long elapsed = (System.currentTimeMillis() - startTime) / 1000;
            if (elapsed > 30) {
                state = State.COURT_LIST;
            }
            return;
        }

        boolean anySelected = false;
        for (String slot : slots) {
            if (bookedSlots.contains(slot)) continue;
           if (selectedSlots.contains(slot)) continue;
            if (findAndClickText(root, slot)) {
               log("\u9009\u62e9\u65f6\u6bb5: " + slot);
               selectedSlots.add(slot);
               anySelected = true;
               sleep(500);
           } else {
                log("\u65f6\u6bb5\u4e0d\u53ef\u9009: " + slot);
            }
        }

        if (anySelected) {
            long target = getSubmitTarget();
            if (System.currentTimeMillis() < target) {
                log("\u65f6\u6bb5\u5df2\u9009\u597d\uff0c\u7b49\u5f858:00\u63d0\u4ea4");
                state = State.WAIT_FOR_SUBMIT;
            } else {
                log("\u70b9\u51fb\u63d0\u4ea4");
                if (!findAndClickText(root, "\u9884\u5b9a")) {
                    findAndClickText(root, "\u63d0\u4ea4");
                }
                sleep(1500);
                state = State.SUBMITTING;
                submitRetry = 0;
            }
        } else {
            log("\u672a\u9009\u5230\u4efb\u4f55\u65f6\u6bb5\uff0c\u8fd4\u56de\u5217\u8868");
            courtIndex++;
            state = State.BACK_TO_LIST;
        }
    }

    private void handleSubmitting(AccessibilityNodeInfo root) {
        log("\u7b49\u5f85\u63d0\u4ea4\u7ed3\u679c... (\u91cd\u8bd5 " + submitRetry + ")");

        if (containsText(root, "\u9884\u5b9a\u6210\u529f") || containsText(root, "\u9884\u7ea6\u6210\u529f")) {
           log("\u9884\u5b9a\u6210\u529f! \u5df2\u9009\u65f6\u6bb5: " + selectedSlots.toString());
           bookedSlots.addAll(selectedSlots);
           selectedSlots.clear();
           findAndClickText(root, "\u786e\u5b9a");
           sleep(1000);
           if (bookedSlots.size() >= slots.length) {
               state = State.DONE;
           } else {
               courtIndex++;
               state = State.BACK_TO_LIST;
           }
           return;
       }

        if (containsText(root, "\u8d85\u8fc7\u4e24\u5c0f\u65f6") || containsText(root, "\u8bf7\u4f11\u606f")) {
            log("\u8d85\u8fc7\u4e24\u5c0f\u65f6\u9650\u5236\uff0c\u7ec8\u6b62");
            state = State.DONE;
            return;
        }

        if (containsText(root, "\u672a\u5230") || containsText(root, "\u4e0d\u5230\u65f6\u95f4") || containsText(root, "\u6682\u672a\u5f00\u653e")) {
            log("\u672a\u5230\u9884\u5b9a\u65f6\u95f4\uff0c\u5173\u95ed\u5f39\u7a97\u7b49\u5f853\u79d2\u540e\u91cd\u8bd5");
            findAndClickText(root, "\u786e\u5b9a");
            sleep(3000);
            return;
        }

        if (containsText(root, "\u5931\u8d25") || containsText(root, "\u9519\u8bef") || containsText(root, "\u5df2\u88ab\u9884\u5b9a")) {
            log("\u63d0\u4ea4\u5931\u8d25");
            findAndClickText(root, "\u786e\u5b9a");
            sleep(500);
            courtIndex++;
            state = State.BACK_TO_LIST;
            return;
        }

        if (containsText(root, "\u573a\u5730\u8be6\u60c5")) {
            submitRetry++;
            if (submitRetry <= 45) {
                log("\u91cd\u8bd5\u63d0\u4ea4 (" + submitRetry + "/45)");
                findAndClickText(root, "\u63d0\u4ea4");
                sleep(2000);
            } else {
                log("\u91cd\u8bd5\u8d85\u9650\uff0c\u8df3\u5230\u4e0b\u4e00\u573a\u5730");
                courtIndex++;
                state = State.BACK_TO_LIST;
            }
        } else if (!containsText(root, "\u63d0\u4ea4")) {
            submitRetry++;
            if (submitRetry <= 5) {
                sleep(1000);
            } else {
                log("\u65e0\u54cd\u5e94\uff0c\u8fd4\u56de\u5217\u8868");
                courtIndex++;
                state = State.BACK_TO_LIST;
            }
        }
    }

    private void handleBackToList(AccessibilityNodeInfo root) {
        log("\u8fd4\u56de\u5217\u8868...");
        if (containsText(root, "\u6d3b\u52a8\u573a\u5730") || containsText(root, "\u53ef\u9884\u8ba2\u573a\u5730")) {
            log("\u5df2\u8fd4\u56de\u5217\u8868");
            state = State.SELECT_COURT;
            return;
        }
        performGlobalAction(GLOBAL_ACTION_BACK);
        sleep(1500);
    }

    // === Helper Methods ===

    private boolean findAndClickText(AccessibilityNodeInfo root, String text) {
        if (root == null || text == null) return false;
        List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(text);
        if (nodes == null || nodes.isEmpty()) {
            log("\u672a\u627e\u5230\u6587\u672c: " + text);
            return false;
        }
        log("\u627e\u5230 " + nodes.size() + " \u4e2a\u8282\u70b9\u542b: " + text);
        for (AccessibilityNodeInfo node : nodes) {
            Rect b = new Rect();
            node.getBoundsInScreen(b);
            log("  \u8282\u70b9 bounds=" + b + " clickable=" + node.isClickable() + " class=" + node.getClassName());
            if (b.isEmpty() || b.left > b.right || b.top > b.bottom || b.left < 0 || b.top < 0) {
                log("  \u5ffd\u7565\u65e0\u6548\u5750\u6807\u8282\u70b9");
                continue;
            }
            if (clickNode(node)) return true;
        }
        return false;
    }

    private boolean findAndClickExactText(AccessibilityNodeInfo root, String text) {
        if (root == null || text == null) return false;
        List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(text);
        if (nodes == null) return false;
        for (AccessibilityNodeInfo node : nodes) {
            CharSequence t = node.getText();
            if (t != null && t.toString().trim().equals(text)) {
                if (clickNode(node)) return true;
            }
        }
        return false;
    }

    private boolean findCourtAndClickBook(AccessibilityNodeInfo root, String courtName) {
        List<AccessibilityNodeInfo> courtNodes = root.findAccessibilityNodeInfosByText(courtName);
        if (courtNodes == null || courtNodes.isEmpty()) {
            String numPart = courtName.replaceAll("[^0-9]", "");
            if (!numPart.isEmpty()) {
                courtNodes = root.findAccessibilityNodeInfosByText(numPart + "\u53f7");
            }
        }
        if (courtNodes == null || courtNodes.isEmpty()) return false;

        for (AccessibilityNodeInfo courtNode : courtNodes) {
            AccessibilityNodeInfo container = findContainer(courtNode);
            if (container == null) continue;
            AccessibilityNodeInfo bookBtn = findTextInSubtree(container, "\u9884\u5b9a");
            if (bookBtn != null) {
                AccessibilityNodeInfo clickable = findClickableParent(bookBtn);
                if (clickable != null && clickable.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                    return true;
                }
            }
        }
        return false;
    }

    private AccessibilityNodeInfo findTextInSubtree(AccessibilityNodeInfo node, String text) {
        if (node == null) return null;
        CharSequence t = node.getText();
        if (t != null && t.toString().contains(text)) return node;
        CharSequence d = node.getContentDescription();
        if (d != null && d.toString().contains(text)) return node;
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo result = findTextInSubtree(node.getChild(i), text);
            if (result != null) return result;
        }
        return null;
    }

    private AccessibilityNodeInfo findContainer(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo current = node;
        for (int i = 0; i < 10 && current != null; i++) {
            if (current.getChildCount() > 3) return current;
            current = current.getParent();
        }
        return node != null ? node.getParent() : null;
    }

    private AccessibilityNodeInfo findClickableParent(AccessibilityNodeInfo node) {
        AccessibilityNodeInfo current = node;
        while (current != null) {
            if (current.isClickable()) return current;
            current = current.getParent();
        }
        return node;
    }

    private AccessibilityNodeInfo findScrollable(AccessibilityNodeInfo root) {
        if (root == null) return null;
        if (root.isScrollable()) return root;
        for (int i = 0; i < root.getChildCount(); i++) {
            AccessibilityNodeInfo result = findScrollable(root.getChild(i));
            if (result != null) return result;
        }
        return null;
    }

    private boolean clickNode(AccessibilityNodeInfo node) {
        if (node == null) return false;
        if (node.isClickable() && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
            return true;
        }
        AccessibilityNodeInfo parent = node.getParent();
        if (parent != null && parent.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
            return true;
        }
        // WebView fallback: tap at node's screen coordinates
        Rect bounds = new Rect();
        node.getBoundsInScreen(bounds);
        int cx = bounds.centerX();
        int cy = bounds.centerY();
        if (!bounds.isEmpty() && bounds.left <= bounds.right && bounds.top <= bounds.bottom
                && cx > 0 && cy > 0) {
            return tapScreen(cx, cy);
        }
        return false;
    }

    private boolean swipeLeft() {
        int w = getResources().getDisplayMetrics().widthPixels;
        int h = getResources().getDisplayMetrics().heightPixels;
        int cy = h / 2;
        int x1 = (int)(w * 0.8);
        int x2 = (int)(w * 0.2);
        Path path = new Path();
        path.moveTo(x1, cy);
        path.lineTo(x2, cy);
        GestureDescription.StrokeDescription stroke = new GestureDescription.StrokeDescription(path, 0, 400);
        GestureDescription gesture = new GestureDescription.Builder().addStroke(stroke).build();
        log("  \u624b\u52bf\u5de6\u6ed1 (" + x1 + "," + cy + ")->(" + x2 + "," + cy + ")");
        boolean ok = dispatchGesture(gesture, null, null);
        try { Thread.sleep(500); } catch (InterruptedException e) { }
        return ok;
    }

    private boolean tapScreen(int x, int y) {
        log("  \u624b\u52bf\u70b9\u51fb (" + x + "," + y + ")");
        Path path = new Path();
        path.moveTo(x, y);
        GestureDescription.StrokeDescription stroke = new GestureDescription.StrokeDescription(path, 0, 50);
        GestureDescription gesture = new GestureDescription.Builder().addStroke(stroke).build();
        boolean ok = dispatchGesture(gesture, null, null);
        try { Thread.sleep(200); } catch (InterruptedException e) { }
        return ok;
    }

    private boolean swipeUp() {
        int w = getResources().getDisplayMetrics().widthPixels;
        int h = getResources().getDisplayMetrics().heightPixels;
        int cx = w / 2;
        int y1 = (int)(h * 0.7);
        int y2 = (int)(h * 0.3);
        Path path = new Path();
        path.moveTo(cx, y1);
        path.lineTo(cx, y2);
        GestureDescription.StrokeDescription stroke = new GestureDescription.StrokeDescription(path, 0, 400);
        GestureDescription gesture = new GestureDescription.Builder().addStroke(stroke).build();
        log("  \u624b\u52bf\u4e0a\u6ed1 (" + cx + "," + y1 + ")->(" + cx + "," + y2 + ")");
        boolean ok = dispatchGesture(gesture, null, null);
        try { Thread.sleep(500); } catch (InterruptedException e) { }
        return ok;
    }

    private boolean containsText(AccessibilityNodeInfo root, String text) {
       if (root == null || text == null) return false;
       List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(text);
       return nodes != null && !nodes.isEmpty();
    }

    private void dumpVisibleText(AccessibilityNodeInfo node) {
        if (node == null) return;
        StringBuilder texts = new StringBuilder();
        collectTexts(node, texts, 0);
        String result = texts.toString().trim();
        if (result.isEmpty()) {
            log("  \u5f53\u524d\u9875\u9762\u65e0\u53ef\u8bfb\u6587\u672c\uff08WebView\u672a\u66b4\u9732\u5185\u5bb9\uff09");
        } else {
            log("  \u5f53\u524d\u9875\u9762\u6587\u672c: " + result);
        }
    }

    private void collectTexts(AccessibilityNodeInfo node, StringBuilder sb, int depth) {
        if (node == null || depth > 15) return;
        CharSequence t = node.getText();
        CharSequence d = node.getContentDescription();
        if (t != null && t.length() > 0 && t.length() < 50) {
            sb.append(t).append(" | ");
        }
        if (d != null && d.length() > 0 && d.length() < 50) {
            sb.append(d).append(" | ");
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            collectTexts(node.getChild(i), sb, depth + 1);
        }
    }

    private void dumpScreen() {
        log("=== \u5c4f\u5e55\u8c03\u8bd5 dump \u5f00\u59cb ===");
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            log("root == null\uff0c\u65e0\u6cd5\u83b7\u53d6\u7a97\u53e3\u5185\u5bb9");
            return;
        }
        String pkg = String.valueOf(root.getPackageName());
        log("\u5305\u540d: " + pkg);
        StringBuilder sb = new StringBuilder();
        dumpNode(root, 0, sb);
        log(sb.toString());
        log("=== dump \u7ed3\u675f ===");
    }

    private void dumpNode(AccessibilityNodeInfo node, int depth, StringBuilder sb) {
        if (node == null) return;
        StringBuilder indent = new StringBuilder();
        for (int i = 0; i < depth; i++) indent.append("  ");
        String cls = node.getClassName() != null ? node.getClassName().toString() : "?";
        String text = node.getText() != null ? node.getText().toString() : "";
        String desc = node.getContentDescription() != null ? node.getContentDescription().toString() : "";
        String id = node.getViewIdResourceName() != null ? node.getViewIdResourceName() : "";
        boolean click = node.isClickable();
        boolean scroll = node.isScrollable();

        StringBuilder line = new StringBuilder(indent);
        line.append(cls);
        if (!text.isEmpty()) line.append(" text=").append(text);
        if (!desc.isEmpty()) line.append(" desc=").append(desc);
        if (!id.isEmpty()) line.append(" id=").append(id);
        if (click) line.append(" [click]");
        if (scroll) line.append(" [scroll]");
        sb.append(line).append("\n");

        for (int i = 0; i < node.getChildCount(); i++) {
            dumpNode(node.getChild(i), depth + 1, sb);
        }
    }

    private void finishBooking() {
        String result;
        if (bookedSlots.isEmpty()) {
            result = "\u9884\u5b9a\u5931\u8d25\uff0c\u672a\u6210\u529f\u9884\u5b9a\u4efb\u4f55\u65f6\u6bb5";
        } else if (bookedSlots.size() >= slots.length) {
            result = "\u9884\u5b9a\u6210\u529f\uff01\u5df2\u9884\u5b9a " + bookedSlots.size() + " \u4e2a\u65f6\u6bb5";
        } else {
            result = "\u90e8\u5206\u6210\u529f\uff0c\u5df2\u9884\u5b9a " + bookedSlots.size() + "/" + slots.length + " \u4e2a\u65f6\u6bb5";
        }

        StringBuilder detail = new StringBuilder(result);
        detail.append("\n\u5df2\u9884\u5b9a: ").append(bookedSlots.toString());
        detail.append("\n\u5c1d\u8bd5\u573a\u5730: ").append(courtIndex).append("/").append(courts.length);

        log("\u9884\u5b9a\u5b8c\u6210: " + result);
        BookingConfig.setLastResult(result);
        BookingConfig.setLastRunTime(System.currentTimeMillis());

        NotificationHelper.notify(this, "\u62a2\u573a\u5730\u7ed3\u679c", detail.toString());
        showToast(result);

        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        isBooking = false;
        isRunning = false;
        AlarmReceiver.setAlarm(this);
    }

    private void startSubmitOnly() {
        if (submitOnlyTarget <= 0) {
            log("\u63d0\u4ea4\u65f6\u95f4\u65e0\u6548\uff0c\u65e0\u6cd5\u4ec5\u51c6\u70b9\u63d0\u4ea4");
            return;
        }
        if (isSubmitOnly) return;

        isSubmitOnly = true;
        submitOnlyActive = true;
        log("=== \u4ec5\u51c6\u70b9\u63d0\u4ea4\u5f00\u59cb ===");
        log("\u76ee\u6807\u63d0\u4ea4\u65f6\u95f4: " + BookingConfig.getSubmitOnlyTimeText());

        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            long remaining = Math.max(1000, submitOnlyTarget - System.currentTimeMillis() + 120000);
            screenWakeLock = pm.newWakeLock(
                PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "booking:submitOnly");
            screenWakeLock.acquire(remaining);
            log("\u5df2\u5f00\u542f\u5c4f\u5e55\u5e38\u4eae\uff0c\u76f4\u5230\u63d0\u4ea4\u5b8c\u6210");
        }

        submitOnlyThread = new Thread(this::runSubmitOnly, "SubmitOnlyThread");
        submitOnlyThread.start();
    }

    private void runSubmitOnly() {
        long lastLoggedSec = -1;
        while (isSubmitOnly) {
            long remaining = submitOnlyTarget - System.currentTimeMillis();
            if (remaining <= 0) break;

            long sec = remaining / 1000;
            if (sec != lastLoggedSec && (sec <= 10 || sec % 30 == 0)) {
                log("\u7b49\u5f85\u51c6\u70b9\u63d0\u4ea4... \u5269\u4f59 " + sec + " \u79d2");
                lastLoggedSec = sec;
            }
            sleep((int) Math.min(1000, remaining));
        }

        if (!isSubmitOnly) return;

        log("\u63d0\u4ea4\u65f6\u95f4\u5230\uff0c\u5f00\u59cb\u70b9\u51fb\u63d0\u4ea4\u6309\u94ae");
        boolean clicked = false;
        for (int i = 0; i < 20 && isSubmitOnly && !clicked; i++) {
            clicked = clickSubmitButton();
            if (!clicked) sleep(200);
        }

        if (clicked) {
            log("\u5df2\u89e6\u53d1\u63d0\u4ea4\u70b9\u51fb\uff0c\u8bf7\u68c0\u67e5\u9875\u9762\u7ed3\u679c");
        } else {
            log("\u672a\u627e\u5230\u53ef\u70b9\u51fb\u7684\u63d0\u4ea4\u6309\u94ae");
        }
        stopSubmitOnly();
    }

    private AccessibilityNodeInfo getDepponRoot() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return null;
        if ("com.deppon.app.addressbook".equals(String.valueOf(root.getPackageName()))) {
            return root;
        }
        return findRootForPackage("com.deppon.app.addressbook");
    }

    private boolean clickSubmitButton() {
        AccessibilityNodeInfo root = getDepponRoot();
        if (root == null) {
            log("\u5f53\u524d\u672a\u627e\u5230\u5fb7\u90a6\u5e94\u7528\u7a97\u53e3\uff0c\u4e0d\u80fd\u63d0\u4ea4");
            return false;
        }

        String[] exactLabels = {"\u9884\u5b9a", "\u63d0\u4ea4", "\u9884\u7ea6", "\u63d0\u4ea4\u8ba2\u5355", "\u786e\u8ba4\u8ba2\u5355"};
        for (String label : exactLabels) {
            if (findAndClickExactText(root, label)) {
                log("\u70b9\u51fb\u6309\u94ae: " + label);
                return true;
            }
        }

        if (findAndClickText(root, "\u63d0\u4ea4\u8ba2\u5355")) return true;
        if (findAndClickText(root, "\u63d0\u4ea4")) return true;
        if (findAndClickText(root, "\u786e\u8ba4")) return true;
        return false;
    }

    public static void cancelSubmitOnly() {
        submitOnlyActive = false;
        shouldSubmitOnly = false;
        submitOnlyTarget = 0;
        // The service stops through its own volatile flag after the next check.
    }

    private synchronized void stopSubmitOnly() {
        if (!isSubmitOnly && screenWakeLock == null) return;
        isSubmitOnly = false;
        submitOnlyActive = false;
        if (screenWakeLock != null && screenWakeLock.isHeld()) {
            screenWakeLock.release();
        }
        screenWakeLock = null;
    }

    private void log(String msg) {
        android.util.Log.i(TAG, msg);
        BookingConfig.appendLog(msg);
    }

    private void showToast(final String msg) {
        new Handler(Looper.getMainLooper()).post(() -> {
            Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
        });
    }

    private void sleep(int ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
