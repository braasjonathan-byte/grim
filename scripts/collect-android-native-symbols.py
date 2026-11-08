#!/usr/bin/env python3
"""Collect real AGP metadata (including AAB-embedded symbols) for the CI artifact.
Never fabricate a symbols archive from stripped .so files.
"""
import pathlib
import sys
import zipfile

PREFIX = "BUNDLE-METADATA/com.android.tools.build.debugsymbols/"

def collect(aab_path, outputs=pathlib.Path("android/app/build/outputs")):
    existing = sorted(outputs.glob("**/native-debug-symbols.zip"))
    with zipfile.ZipFile(aab_path) as aab:
        names = aab.namelist()
        symbols = [n for n in names if n.startswith(PREFIX) and n.endswith((".dbg", ".sym"))]
        native = [n for n in names if n.startswith("base/lib/") and n.endswith(".so")]
        if not symbols and native:
            print("::warning::AAB has native libraries but no embedded symbols. Check Gradle --info for already-stripped third-party libraries; obtain unstripped libraries/vendor symbols. FULL cannot restore removed metadata.", file=sys.stderr)
        if existing:
            return existing[0]
        if not symbols:
            return None
        target = outputs / "native-debug-symbols/release/native-debug-symbols.zip"
        target.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
            for name in symbols:
                archive.writestr(name[len(PREFIX):], aab.read(name))
        return target

if __name__ == "__main__":
    result = collect(pathlib.Path(sys.argv[1]))
    print(f"symbols_path={result or ''}")
