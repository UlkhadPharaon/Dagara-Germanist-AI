# Comment générer l'application Android (APK)

Ce projet a été pré-configuré avec **Capacitor** pour être transformé en application Android très facilement.

## Prérequis

1. **Node.js** installé sur votre ordinateur.
2. **Java Development Kit (JDK) 17** (ou version compatible avec Android).
3. **Android Studio** (ou au moins les Android SDK Command-line Tools).

## Étapes pour générer l'APK

1. Ouvrez un terminal dans le dossier de ce projet.
2. Installez les dépendances :
   ```bash
   npm install
   ```
3. Lancez la commande magique de compilation :
   ```bash
   npm run build:apk
   ```

*(Note pour les utilisateurs Windows : si la commande échoue à cause de `./gradlew`, allez dans le dossier `android` et tapez `gradlew.bat assembleDebug`)*

## Où trouver le fichier APK ?

Une fois la compilation terminée avec succès, votre fichier APK se trouvera dans le dossier suivant :
`android/app/build/outputs/apk/debug/app-debug.apk`

Vous pouvez transférer ce fichier sur votre téléphone Android et l'installer directement !
