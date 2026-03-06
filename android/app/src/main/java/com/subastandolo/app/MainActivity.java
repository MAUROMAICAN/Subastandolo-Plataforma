package com.subastandolo.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Use versioned channel IDs — increment version suffix to force recreation
    // when sound/vibration settings change (Android caches channels permanently)
    static final String CH_BIDS = "subastandolo_bids_v3";
    static final String CH_WINS = "subastandolo_wins_v3";
    static final String CH_ADMIN = "subastandolo_admin_v3";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        if (getWindow() != null) {
            getWindow().getDecorView().setBackgroundColor(Color.parseColor("#1a1a2e"));
        }
        super.onCreate(savedInstanceState);
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView wv = getBridge().getWebView();
            wv.clearCache(true);
            wv.setBackgroundColor(Color.parseColor("#1a1a2e"));
        }
        createNotificationChannels();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (getWindow() != null) {
            getWindow().getDecorView().setBackgroundColor(Color.parseColor("#1a1a2e"));
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

        // ── Canal 1: Pujas (sobrepuja) ──
        Uri soundBid = Uri.parse("android.resource://" + getPackageName() + "/raw/sobrepuja");
        NotificationChannel bidsChannel = new NotificationChannel(
                CH_BIDS,
                "Pujas en Subastas",
                NotificationManager.IMPORTANCE_HIGH);
        bidsChannel.setDescription("Avisos cuando alguien supera tu puja");
        bidsChannel.setSound(soundBid, audioAttrs);
        bidsChannel.enableVibration(true);
        bidsChannel.setVibrationPattern(new long[] { 0, 200, 100, 200, 100, 400 });
        bidsChannel.enableLights(true);
        bidsChannel.setLightColor(Color.parseColor("#c8f135"));
        nm.createNotificationChannel(bidsChannel);

        // ── Canal 2: Victorias (campanita) ──
        Uri soundWin = Uri.parse("android.resource://" + getPackageName() + "/raw/campanita");
        NotificationChannel winsChannel = new NotificationChannel(
                CH_WINS,
                "Subastas Ganadas",
                NotificationManager.IMPORTANCE_HIGH);
        winsChannel.setDescription("Cuando ganas una subasta o confirman tu pago");
        winsChannel.setSound(soundWin, audioAttrs);
        winsChannel.enableVibration(true);
        winsChannel.setVibrationPattern(new long[] { 0, 100, 50, 100, 50, 600 });
        winsChannel.enableLights(true);
        winsChannel.setLightColor(Color.parseColor("#c8f135"));
        nm.createNotificationChannel(winsChannel);

        // ── Canal 3: Admin / Avisos (administrador) ──
        Uri soundAdmin = Uri.parse("android.resource://" + getPackageName() + "/raw/administrador");
        NotificationChannel adminChannel = new NotificationChannel(
                CH_ADMIN,
                "Avisos del Sistema",
                NotificationManager.IMPORTANCE_HIGH);
        adminChannel.setDescription("Anuncios, promociones y avisos del equipo de Subastándolo");
        adminChannel.setSound(soundAdmin, audioAttrs);
        adminChannel.enableVibration(true);
        adminChannel.setVibrationPattern(new long[] { 0, 150, 100, 300 });
        adminChannel.enableLights(true);
        adminChannel.setLightColor(Color.parseColor("#c8f135"));
        nm.createNotificationChannel(adminChannel);
    }
}
