```bash
./gradlew clean                                         
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk


adb logcat | grep -E "SmsMmsReceiver|WebhookService|SmsDataExtractor"
```