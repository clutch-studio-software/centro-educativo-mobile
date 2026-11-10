# Guía Práctica: Exportar Aplicación Expo (React Native) a formato APK para Android

Instructivo genérico paso a paso para compilar y generar un instalador `.apk` independiente que cualquier persona pueda instalar en su dispositivo Android para pruebas, sin necesidad de descargar ni utilizar Expo Go.

---

## Requisitos Previos

1. Tener el proyecto de React Native funcionando localmente con Expo.
2. Contar con una cuenta gratuita creada en [expo.dev](https://expo.dev).
3. Tener Node.js instalado en la computadora.

---

## Paso 1: Instalar la herramienta EAS CLI

EAS (Expo Application Services) es la infraestructura oficial de Expo para compilar aplicaciones en la nube sin necesidad de tener Android Studio ni SDKs pesados configurados localmente.

Abre la terminal y ejecuta:

```bash
npm install -g eas-cli
```

Luego inicia sesión con las credenciales de tu cuenta de Expo:

```bash
eas login
```

---

## Paso 2: Configurar el archivo `app.json`

En el archivo `app.json` de la raíz del proyecto, debes asegurarte de definir el nombre del paquete Android (`package`) y los plugins necesarios:

```json
{
  "expo": {
    "name": "Nombre De Tu App",
    "slug": "nombre-de-tu-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "android": {
      "package": "com.tuorganizacion.tuapp",
      "googleServicesFile": "./google-services.json",
      "adaptiveIcon": {
        "backgroundColor": "#FFFFFF",
        "foregroundImage": "./assets/adaptive-icon.png"
      }
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/icon.png",
          "color": "#EA580C"
        }
      ]
    ]
  }
}
```

> **Nota:** Si tu aplicación no utiliza Firebase Cloud Messaging para notificaciones push con la app cerrada, puedes omitir temporalmente la línea `"googleServicesFile": "./google-services.json"`.

---

## Paso 3: Descargar `google-services.json` (Solo si usas Firebase)

Si tu proyecto utiliza Firebase:

1. Ingresa a la consola de Firebase del proyecto.
2. Ve a **Configuración del proyecto** (icono de engranaje) > pestaña **General**.
3. En la sección **Tus apps**, pulsa **Agregar app** y selecciona el icono de **Android**.
4. En el campo **Nombre de paquete de Android**, escribe exactamente el mismo valor que pusiste en `app.json` (por ejemplo: `com.tuorganizacion.tuapp`).
5. Descarga el archivo generado **`google-services.json`**.
6. Coloca ese archivo en la raíz del proyecto (junto a `package.json` y `app.json`).
7. En el asistente web de Firebase, pulsa **"Siguiente"** omitiendo las instrucciones de código Gradle/Kotlin y pulsa **"Continuar a la consola"** (Expo se encarga internamente de esas configuraciones).

---

## Paso 4: Crear el archivo `eas.json`

En la raíz del proyecto crea un archivo llamado `eas.json` con la siguiente estructura. Esto le indica a Expo que genere un archivo instalable directo `.apk` (en vez del formato `.aab` que se usa únicamente para publicar en Google Play Store):

```json
{
  "cli": {
    "version": ">= 15.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

---

## Paso 5: Generar el archivo `.apk` en la nube

Ejecuta el siguiente comando en la terminal:

```bash
eas build --platform android --profile preview
```

### Qué sucederá durante este comando:
1. Si es la primera vez que compilas, te preguntará si deseas generar un nuevo **Android Keystore** (clave de firma de la app). Presiona `Y` (Yes) para que Expo la genere y administre automáticamente en la nube.
2. El proyecto se empaquetará y se enviará a los servidores de compilación de Expo.
3. La terminal te mostrará un enlace web para ver el progreso en tiempo real.
4. El proceso de compilación toma habitualmente entre 5 y 10 minutos.

---

## Paso 6: Instalación y prueba en dispositivos Android

Al finalizar la compilación con éxito:
1. La terminal mostrará un código QR y una URL directa de descarga.
2. Abre ese enlace desde cualquier navegador en el teléfono Android o escanea el QR.
3. Descarga el archivo `.apk`.
4. Al abrirlo, Android solicitará permiso para **"Instalar aplicaciones de fuentes desconocidas"** (o del navegador utilizado). Acéptalo para completar la instalación.
5. La aplicación quedará instalada de forma nativa e independiente, sin requerir Expo Go.
