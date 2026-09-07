#!/usr/bin/env python3
"""Patches the `android/app/build.gradle` that `expo prebuild` generates
fresh on every run (it's not checked into git — see mobile/.gitignore) so
the `release` build type signs with our own release keystore instead of
falling back to the debug keystore, which is what Expo's default template
does and which Google Play refuses to accept ("Yüklenen tüm paketler
imzalanmış olmalıdır").

Run from the `mobile/` directory, after `expo prebuild` and after the
release keystore has been restored to android/app/release.keystore — see
.github/workflows/build-android-release.yml, which is the only caller.

The two asserts are deliberate: if a future Expo/RN template changes the
generated build.gradle's shape, this must fail loudly (CI red) rather than
silently leave the release build signed with the debug key again, which
would just fail at Play upload time with a much more confusing error.
"""
import pathlib

p = pathlib.Path("android/app/build.gradle")
content = p.read_text()

marker = "            keyPassword 'android'\n        }\n    }"
count = content.count(marker)
assert count == 1, f"beklenen imzalama bloğu bulunamadı ({count} eşleşme) — expo prebuild çıktısı değişmiş olabilir, bu scripti güncellemek gerekiyor"

release_block = (
    "            keyPassword 'android'\n"
    "        }\n"
    "        release {\n"
    "            storeFile file(\"release.keystore\")\n"
    "            storePassword System.getenv(\"ANDROID_KEYSTORE_PASSWORD\")\n"
    "            keyAlias System.getenv(\"ANDROID_KEY_ALIAS\")\n"
    "            keyPassword System.getenv(\"ANDROID_KEY_PASSWORD\")\n"
    "        }\n"
    "    }"
)
content = content.replace(marker, release_block, 1)

old_release_line = "            signingConfig signingConfigs.debug\n            def enableShrinkResources"
count2 = content.count(old_release_line)
assert count2 == 1, f"release buildType satırı beklenmedik sayıda bulundu ({count2})"
content = content.replace(
    old_release_line,
    "            signingConfig signingConfigs.release\n            def enableShrinkResources",
    1,
)

p.write_text(content)
print("build.gradle release imzalama için yamalandı.")
