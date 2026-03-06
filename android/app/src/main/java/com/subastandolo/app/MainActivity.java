package com.subastandolo.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Fondo oscuro ANTES de que cargue el WebView (elimina flash blanco / página
        // vieja)
        if (getWindow() != null) {
            getWindow().setBackgroundDrawable(null);
            getWindow().getDecorView().setBackgroundColor(Color.parseColor("#1a1a2e"));
        }

        super.onCreate(savedInstanceState);

        // Limpiar caché del WebView para evitar rastros de contenido viejo
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
        // Asegurarse de que el fondo siga siendo oscuro al volver a la app
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
                "subastandolo_bids",
                "Pujas en Subastas",
                NotificationManager.IMPORTANCE_HIGH);
        bidsChannel.setDescription("Avisos cuando alguien supera tu puja");
        bidsChannel.setSound(soundBid, audioAttrs);
        bidsChannel.enableVibration(true);
        bidsChannel.setVibrationPattern(new long[] { 0, 200, 100, 200, 100, 400 });
        nm.createNotificationChannel(bidsChannel);

        // ── Canal 2: Victorias (campanita) ──
        Uri soundWin = Uri.parse("android.resource://" + getPackageName() + "/raw/campanita");
        NotificationChannel winsChannel = new NotificationChannel(
                "subastandolo_wins",
                "Subastas Ganadas",
                NotificationManager.IMPORTANCE_HIGH);
        winsChannel.setDescription("Cuando ganas una subasta o confirman tu pago");
        winsChannel.setSound(soundWin, audioAttrs);
        winsChannel.enableVibration(true);
        winsChannel.setVibrationPattern(new long[] { 0, 100, 50, 100, 50, 600 });
        nm.createNotificationChannel(winsChannel);

        // ── Canal 3: Admin / Avisos (administrador) ──
        Uri soundAdmin = Uri.parse("android.resource://" + getPackageName() + "/raw/administrador");
        NotificationChannel adminChannel = new NotificationChannel(
                "subastandolo_admin",
                "Avisos del Sistema",
                NotificationManager.IMPORTANCE_DEFAULT);
        adminChannel.setDescription("Anuncios, promociones y avisos del equipo de Subastándolo");
        adminChannel.setSound(soundAdmin, audioAttrs);
        nm.createNotificationChannel(adminChannel);
    }
}
