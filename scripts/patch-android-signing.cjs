// Injects a release signingConfig into android/app/build.gradle that reads
// from gradle.properties (RELEASE_STORE_FILE / RELEASE_STORE_PASSWORD /
// RELEASE_KEY_ALIAS / RELEASE_KEY_PASSWORD). Safe to run multiple times.
// Also enables R8/proguard minification (produces mapping.txt) and full
// native debug symbols (produces native-debug-symbols.zip) so Google Play
// stops warning about missing deobfuscation/symbol files.
const fs = require("fs");
const path = "android/app/build.gradle";

let s = fs.readFileSync(path, "utf8");

// ---- 1. signingConfigs ----
if (!(s.includes("signingConfigs.release") && s.includes("RELEASE_STORE_FILE"))) {
  const signingBlock = `
    signingConfigs {
        release {
            if (project.hasProperty('RELEASE_STORE_FILE')) {
                storeFile file(RELEASE_STORE_FILE)
                storePassword RELEASE_STORE_PASSWORD
                keyAlias RELEASE_KEY_ALIAS
                keyPassword RELEASE_KEY_PASSWORD
            }
        }
    }
`;
  s = s.replace(/android\s*\{/, (m) => m + signingBlock);

  if (/buildTypes\s*\{[\s\S]*?release\s*\{/.test(s)) {
    s = s.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{)/,
      `$1\n            signingConfig signingConfigs.release`
    );
  } else {
    s = s.replace(
      /\n\}\s*$/m,
      `\n    buildTypes {\n        release {\n            signingConfig signingConfigs.release\n        }\n    }\n}\n`
    );
  }
}

// ---- 2. Enable R8/proguard so mapping.txt is generated ----
if (/minifyEnabled\s+false/.test(s)) {
  s = s.replace(/minifyEnabled\s+false/, "minifyEnabled true");
} else if (!/minifyEnabled\s+true/.test(s)) {
  s = s.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{)/,
    `$1\n            minifyEnabled true\n            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'`
  );
}

// ---- 3. Native debug symbols (FULL) so Play has symbol files for crashes ----
if (!/debugSymbolLevel/.test(s)) {
  s = s.replace(
    /(defaultConfig\s*\{)/,
    `$1\n        ndk {\n            debugSymbolLevel 'FULL'\n        }`
  );
}

fs.writeFileSync(path, s);
console.log("Patched android/app/build.gradle: signing + R8 + native debug symbols.");
