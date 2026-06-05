// Injects a release signingConfig into android/app/build.gradle that reads
// from gradle.properties (RELEASE_STORE_FILE / RELEASE_STORE_PASSWORD /
// RELEASE_KEY_ALIAS / RELEASE_KEY_PASSWORD). Safe to run multiple times.
const fs = require("fs");
const path = "android/app/build.gradle";

let s = fs.readFileSync(path, "utf8");

if (s.includes("signingConfigs.release") && s.includes("RELEASE_STORE_FILE")) {
  console.log("Signing config already present, skipping.");
  process.exit(0);
}

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

// Insert signingConfigs right after `android {`
s = s.replace(/android\s*\{/, (m) => m + signingBlock);

// Ensure release buildType uses the signingConfig
if (/buildTypes\s*\{[\s\S]*?release\s*\{/.test(s)) {
  s = s.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{)/,
    `$1\n            signingConfig signingConfigs.release`
  );
} else {
  // Add a buildTypes block before the closing of android { }
  s = s.replace(
    /\n\}\s*$/m,
    `\n    buildTypes {\n        release {\n            signingConfig signingConfigs.release\n        }\n    }\n}\n`
  );
}

fs.writeFileSync(path, s);
console.log("Patched android/app/build.gradle with release signingConfig.");
