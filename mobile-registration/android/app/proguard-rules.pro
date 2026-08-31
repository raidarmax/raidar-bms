# Don't warn about missing annotations
-dontwarn javax.annotation.**
-dontwarn sun.misc.**

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-dontwarn com.facebook.react.**

# Vision Camera
-keep class com.mrousavy.camera.** { *; }
