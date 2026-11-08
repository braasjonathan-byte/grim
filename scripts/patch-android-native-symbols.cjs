#!/usr/bin/env node
// Independent of signing credentials. AGP 8.13 defaults to this NDK; install
// the exact same version in CI so objcopy/strip can extract prebuilt .so metadata.
const fs = require("fs");
const path = require("path");
const NDK_VERSION = "27.0.12077973";
const START = "// GRIM_NATIVE_SYMBOLS_START";
const END = "// GRIM_NATIVE_SYMBOLS_END";

function patchNativeSymbols(source) {
  const block = `${START}
// https://developer.android.com/build/include-native-symbols
// Already-stripped third-party binaries cannot have their debug info restored.
android {
    ndkVersion '${NDK_VERSION}'
    buildTypes {
        release {
            ndk {
                debugSymbolLevel 'FULL'
            }
        }
    }
}
${END}`;
  const oldBlock = new RegExp(`${START}[\\s\\S]*?${END}`, "g");
  return source.replace(oldBlock, "").trimEnd() + "\n\n" + block + "\n";
}

function patchNativeSymbolsFile(file = path.join(__dirname, "..", "android/app/build.gradle")) {
  if (!fs.existsSync(file)) throw new Error("Android app/build.gradle missing; sync Android first.");
  fs.writeFileSync(file, patchNativeSymbols(fs.readFileSync(file, "utf8")));
  console.log(`[native-symbols] Release FULL metadata enabled with NDK ${NDK_VERSION}.`);
}

module.exports = { NDK_VERSION, patchNativeSymbols, patchNativeSymbolsFile };
if (require.main === module) patchNativeSymbolsFile();
