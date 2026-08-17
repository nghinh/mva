# Build & upload TestFlight

## Yêu cầu máy build (cứng)

- **Mac Apple Silicon + Xcode 26+**. Từ 2026 Apple từ chối mọi bản upload build
  bằng SDK < iOS 26; Xcode 26 **không chạy trên Mac Intel**. (Máy Intel vẫn
  dev/chạy simulator bình thường — chỉ không upload ASC được.)
- Xcode → Settings → Accounts: đăng nhập account thuộc team VNPT `9AK576J4RE`
  (vd `mobilesi.vnpt@gmail.com`).
- Node hoạt động được trong PATH. Nếu node không nằm ở `/opt/homebrew/bin/node`
  (đường dẫn trong `.xcode.env`), tạo `ios/.xcode.env.local`:
  `export NODE_BINARY="$(command -v node)"`

## Kiểm tra trước khi build (làm một lần, tiết kiệm 30 phút)

```bash
# 1. Máy phải là Apple Silicon + Xcode 26+
uname -m                      # phải ra arm64
xcodebuild -version           # phải ≥ 26

# 2. Phải có cert Distribution của team
security find-identity -v -p codesigning | grep 9AK576J4RE
# cần thấy: "Apple Distribution: Vietnam Posts and Telecommunications Group (9AK576J4RE)"

# 3. Phải có provisioning profile cho đúng bundle ID
for f in ~/Library/MobileDevice/Provisioning\ Profiles/*.mobileprovision; do
  security cms -D -i "$f" 2>/dev/null | plutil -extract Entitlements.application-identifier raw -
done | grep vnteki
# KHÔNG ra gì = chưa có profile, phải để Xcode tự tạo (cần account, xem dưới)

# 4. Default keychain KHÔNG được là fastlane_tmp_keychain
security default-keychain
# nếu ra fastlane_tmp_keychain-db thì trả lại:
security default-keychain -s ~/Library/Keychains/login.keychain-db
```

**Bước 3 và 4 là hai chỗ hay chết nhất.** Xem mục "Bẫy đã gặp" ở cuối.

## Các bước

```bash
cd mobile
npm install
cd ios && pod install

# Số build duy nhất (TestFlight yêu cầu tăng dần)
BUILD_NO=$(date +%Y%m%d.%H%M)

xcodebuild -workspace VibeVoiceNative.xcworkspace -scheme VibeVoiceNative \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath build/VibeVoiceNative.xcarchive \
  CURRENT_PROJECT_VERSION=$BUILD_NO \
  -allowProvisioningUpdates archive

# exportOptions có destination=upload → đẩy thẳng lên App Store Connect
xcodebuild -exportArchive -archivePath build/VibeVoiceNative.xcarchive \
  -exportOptionsPlist exportOptions-TestFlight.plist -allowProvisioningUpdates
```

## Build headless bằng App Store Connect API key (không cần đăng nhập Xcode)

Nếu máy build không có account trong Xcode → Settings → Accounts, dùng API key.
Đây là cách duy nhất build được mà không mở Xcode GUI.

```bash
xcodebuild ... -allowProvisioningUpdates \
  -authenticationKeyPath /đường/dẫn/AuthKey_XXXXXXXXXX.p8 \
  -authenticationKeyID XXXXXXXXXX \
  -authenticationKeyIssuerID 69a6de00-xxxx-xxxx-xxxx-xxxxxxxxxxxx archive
```

Truyền cùng bộ cờ đó cho `-exportArchive`. Key cần quyền **App Manager** trở lên
mới tạo được provisioning profile và app record.

Lấy key: ASC → Users and Access → Integrations → App Store Connect API → ➕.
**File `.p8` chỉ tải được đúng một lần** — mất là phải tạo key mới.

## Bẫy đã gặp

- **`error: No Accounts: Add a new account in Accounts settings.`**
  Xcode chưa đăng nhập Apple ID nào. Không có account thì automatic signing
  không tạo được provisioning profile, và bundle `vnpt.com.vnteki.mva` hiện
  **chưa có profile nào** trên máy. Cách sửa không cần mở Xcode: dùng API key
  (mục trên).

- **`error: ... has conflicting provisioning settings. VibeVoiceNative is
  automatically signed for development, but a conflicting code signing identity
  Apple Distribution has been manually specified.`**
  Xảy ra khi truyền `CODE_SIGN_IDENTITY="Apple Distribution"` như xcargs trong
  lúc project vẫn để `CODE_SIGN_STYLE = Automatic`. **Đừng override
  `CODE_SIGN_IDENTITY` khi còn automatic signing** — hoặc để automatic tự lo,
  hoặc chuyển hẳn sang manual kèm `PROVISIONING_PROFILE_SPECIFIER`.

- **Config Release ghim `CODE_SIGN_IDENTITY[sdk=iphoneos*] = "Apple Development"`**
  (`project.pbxproj`), trong khi team `9AK576J4RE` trên máy này chỉ có cert
  **Apple Distribution**. Với automatic signing + account hợp lệ thì Xcode tự
  chọn đúng identity lúc archive; nhưng nếu chuyển sang manual thì phải sửa
  dòng này, nếu không sẽ đi tìm cert Development không tồn tại.

- **`fastlane` chiếm default keychain.** `security default-keychain` ra
  `fastlane_tmp_keychain-db` → codesign bật hộp thoại hỏi mật khẩu giữa chừng,
  treo build chạy nền. Trả lại bằng
  `security default-keychain -s ~/Library/Keychains/login.keychain-db`.
  Đây là di chứng của `fastlane run setup_ci` ở dự án khác, nó không tự dọn.

- **Lần ký đầu trên máy mới**: popup keychain "codesign wants to sign…" →
  bấm **Always Allow**. Popup này sẽ treo mọi build chạy nền/qua SSH.

## Lưu ý
- **Model tự tải khi build**: script `scripts/copy-required-model-assets.js`
  tải SenseVoice (228MB) + Zipformer-VI (74MB) nếu `assets/models/` chưa có.
- Upload báo *"no application records found"* → app bundle
  `vnpt.com.vnteki.mva` chưa được tạo trên App Store Connect team VNPT:
  vào ASC → My Apps → ➕ tạo app với bundle ID đó, rồi chạy lại riêng bước
  `-exportArchive` (không cần archive lại).
- Warning `Upload Symbols Failed ... dSYM for React.framework` là vô hại
  (framework prebuilt của RN không kèm dSYM).
