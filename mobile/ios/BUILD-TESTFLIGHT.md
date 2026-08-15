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

## Lưu ý

- **Lần ký đầu trên máy mới**: popup keychain "codesign wants to sign…" →
  bấm **Always Allow**. `-allowProvisioningUpdates` tự tạo cert/profile.
- **Model tự tải khi build**: script `scripts/copy-required-model-assets.js`
  tải SenseVoice (228MB) + Zipformer-VI (74MB) nếu `assets/models/` chưa có.
- Upload báo *"no application records found"* → app bundle
  `vnpt.com.vnteki.mva` chưa được tạo trên App Store Connect team VNPT:
  vào ASC → My Apps → ➕ tạo app với bundle ID đó, rồi chạy lại riêng bước
  `-exportArchive` (không cần archive lại).
- Warning `Upload Symbols Failed ... dSYM for React.framework` là vô hại
  (framework prebuilt của RN không kèm dSYM).
