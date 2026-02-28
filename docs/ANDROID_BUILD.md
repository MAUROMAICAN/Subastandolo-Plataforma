# Build de Android para producción

## Requisitos

- Android Studio (Arctic Fox o superior)
- JDK 17
- Node.js 18+
- Cuenta de Google Play (para publicar)

## Pasos para generar APK/AAB

### 1. Build web de producción

```sh
npm run build
```

### 2. Sincronizar con Capacitor

```sh
npx cap sync android
```

### 3. Abrir en Android Studio

```sh
npx cap open android
```

### 4. Configurar firma (release)

En Android Studio:
1. **Build > Generate Signed Bundle / APK**
2. Selecciona **Android App Bundle (AAB)** para Google Play
3. O **APK** para instalación directa
4. Crea o selecciona un keystore
5. Genera el bundle

### 5. Versión de la app

Edita `android/app/build.gradle`:

```gradle
versionCode 1        // Incrementar en cada release
versionName "1.0.0"  // Versión visible
```

### 6. Proguard (minificación)

Para producción, habilita minify en `android/app/build.gradle`:

```gradle
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

## Script rápido

```sh
npm run cap:android
```

Esto ejecuta `npm run build`, `npx cap sync` y abre Android Studio.
