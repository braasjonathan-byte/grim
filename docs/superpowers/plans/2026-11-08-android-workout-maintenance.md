# Android release and WorkoutView maintenance plan

Goal: restore native symbol extraction, use a transparent notification mark, and reduce WorkoutView without changing workout behavior.

Constraints: build on origin/main; preserve HC/theme fixes; do not publish Lovable or run/tag an AAB release. No Android SDK is installed in this workspace.

1. Android symbols: add an unconditional/idempotent release Gradle patch with FULL symbols and pinned AGP-8.13-compatible NDK 27.0.12077973. Run after Capacitor sync locally and in CI, independently of signing secrets. Install that NDK in CI. Keep symbol artifact upload and report absent/stripped metadata rather than fabricate symbols. Cover patch idempotence with Vitest fixtures.
2. Notifications: source-controlled white/transparent hood-and-barbell vector, copied by the existing icon installer. Wire FCM icon/color metadata, LocalNotifications plugin/config and explicit ongoing/rest payloads, and both native foreground services. Verify generated files, configuration and all small-icon calls with tests.
3. WorkoutView: mechanically extract focused import/completion/schedule dialogs and shared history helpers where self-contained. Keep state and all persistence effects/callback order unchanged. Add rendering/interaction tests for extracted components, remove duplicated import UI, preserve HC weekday grouping.
4. Flaky test: replace assertions about randomly selected prose with stable numeric improvement assertions and fixed random input for the text-specific case. Run focused tests, entire Vitest suite, application typecheck and npm run build.
5. Review diff/line counts, fetch latest main, commit and fast-forward push only. Report native verification limits; notification/symbol changes require a new AAB, web refactoring requires Publish for the live web app.

Reference: https://developer.android.com/build/include-native-symbols (AGP cannot restore symbols stripped by upstream libraries).
