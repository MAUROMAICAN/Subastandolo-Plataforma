package com.subastandolo.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // ── Channel IDs — MUST match server-side (notify-push, send-push) ──
    // Bump version suffix when changing channel settings (Android caches them)
    static final String CH_BIDS = "subastandolo_bids_v4";
    static final String CH_WINS = "subastandolo_wins_v4";
    static final String CH_ADMIN = "subastandolo_admin_v4";
    private static final int REQ_NOTIF = 1001;

    // Old channel IDs to delete (Android caches channel settings forever)
    private static final String[] OLD_CHANNELS = {
            "subastandolo_bids", "subastandolo_wins", "subastandolo_admin",
            "subastandolo_bids_v2", "subastandolo_wins_v2", "subastandolo_admin_v2",
            "subastandolo_bids_v3", "subastandolo_wins_v3", "subastandolo_admin_v3",
            "sobrepuja_v5", "pujando_v5", "ganador_v5", "campanita_v5", "administrador_v5",
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Set dark background BEFORE super to avoid any flash
        Window window = getWindow();
        if (window != null) {
            window.getDecorView().setBackgroundColor(Color.parseColor("#161625"));
        }

        super.onCreate(savedInstanceState);

        // ── AFTER Capacitor initializes, FORCE our status bar settings ──
        if (window != null) {
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);

            WindowCompat.setDecorFitsSystemWindows(window, false);
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.parseColor("#161625"));

            WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(window,
                    window.getDecorView());
            if (insetsController != null) {
                insetsController.setAppearanceLightStatusBars(false);
                insetsController.setAppearanceLightNavigationBars(false);
            }
        }

        // Force WebView dark background
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setBackgroundColor(Color.parseColor("#161625"));
        }

        // Delete old cached channels, then create fresh ones
        deleteOldChannels();
        createNotificationChannels();
        requestAllPermissions();

        // Re-enforce edge-to-edge after delayed init
        if (window != null) {
            final Window w = window;
            w.getDecorView().post(() -> {
                WindowCompat.setDecorFitsSystemWindows(w, false);
                w.setStatusBarColor(Color.TRANSPARENT);
                WindowInsetsControllerCompat ic = WindowCompat.getInsetsController(w, w.getDecorView());
                if (ic != null) {
                    ic.setAppearanceLightStatusBars(false);
                }
            });
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        Window window = getWindow();
        if (window != null) {
            window.getDecorView().setBackgroundColor(Color.parseColor("#161625"));
            WindowCompat.setDecorFitsSystemWindows(window, false);
            window.setStatusBarColor(Color.TRANSPARENT);
            WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(window,
                    window.getDecorView());
            if (insetsController != null) {
                insetsController.setAppearanceLightStatusBars(false);
            }
        }
    }

    /**
     * Delete ALL old notification channels so Android doesn't use cached settings.
     * This is critical — Android NEVER updates channel settings after creation,
     * so we must delete old channels and recreate with new IDs.
     */
    private void deleteOldChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O)
            return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null)
            return;

        for (String id : OLD_CHANNELS) {
            nm.deleteNotificationChannel(id);
        }
    }

    private void requestAllPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this,
                    Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                        new String[] { Manifest.permission.POST_NOTIFICATIONS },
                        REQ_NOTIF);
            }
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O)
            return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null)
            return;

        AudioAttributes audioAttrs = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();

        // ── Bids channel (outbid, new_bid, urgent) ──
        Uri soundBid = Uri.parse("android.resource://" + getPackageName() + "/raw/sobrepuja");
        NotificationChannel bidsChannel = new NotificationChannel(
                CH_BIDS, "Pujas en Subastas", NotificationManager.IMPORTANCE_HIGH);
        bidsChannel.setDescription("Avisos cuando alguien supera tu puja");
        bidsChannel.setSound(soundBid, audioAttrs);
        bidsChannel.enableVibration(true);
        bidsChannel.setVibrationPattern(new long[] { 0, 200, 100, 200, 100, 400 });
        bidsChannel.enableLights(true);
        bidsChannel.setLightColor(Color.parseColor("#c8f135"));
        bidsChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        bidsChannel.setBypassDnd(false);
        nm.createNotificationChannel(bidsChannel);

        // ── Wins channel (auction_won, auction_finalized, payment_verified) ──
        Uri soundWin = Uri.parse("android.resource://" + getPackageName() + "/raw/campanita");
        NotificationChannel winsChannel = new NotificationChannel(
                CH_WINS, "Subastas Ganadas", NotificationManager.IMPORTANCE_HIGH);
        winsChannel.setDescription("Cuando ganas una subasta o confirman tu pago");
        winsChannel.setSound(soundWin, audioAttrs);
        winsChannel.enableVibration(true);
        winsChannel.setVibrationPattern(new long[] { 0, 100, 50, 100, 50, 600 });
        winsChannel.enableLights(true);
        winsChannel.setLightColor(Color.parseColor("#c8f135"));
        winsChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(winsChannel);

        // ── Admin channel (admin_custom, promo, announcements, maintenance) ──
        Uri soundAdmin = Uri.parse("android.resource://" + getPackageName() + "/raw/administrador");
        NotificationChannel adminChannel = new NotificationChannel(
                CH_ADMIN, "Avisos del Sistema", NotificationManager.IMPORTANCE_HIGH);
        adminChannel.setDescription("Anuncios, promociones y avisos del equipo de Subastándolo");
        adminChannel.setSound(soundAdmin, audioAttrs);
        adminChannel.enableVibration(true);
        adminChannel.setVibrationPattern(new long[] { 0, 150, 100, 300 });
        adminChannel.enableLights(true);
        adminChannel.setLightColor(Color.parseColor("#c8f135"));
        adminChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(adminChannel);
    }
}
