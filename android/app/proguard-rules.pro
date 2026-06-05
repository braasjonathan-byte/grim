# Add project specific ProGuard rules here.

# Keep line numbers for crash reports & hide original source file name
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# --- Capacitor / Cordova ---
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod <methods>;
}
-keep class org.apache.cordova.** { *; }

# Keep classes annotated with @JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- Firebase / Google Play services ---
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# --- AndroidX ---
-dontwarn androidx.**

# --- Kotlin (used by some Capacitor plugins) ---
-dontwarn kotlin.**
-dontwarn kotlinx.**

# --- App entry ---
-keep class se.grim.app.** { *; }
