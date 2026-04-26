# iOS Build & Install

This folder is isolated for iOS native configuration, provisioning, and release assets.

Use these commands from `mobile/`:

- `npm run ios` to run in iOS simulator.
- `npm run ios:pods` to install CocoaPods dependencies.
- `npm run ios:archive` to create release archive.

After archiving, open Xcode Organizer and export:

- TestFlight/App Store build upload
- Ad Hoc `.ipa` for registered devices

Keep all provisioning profile and signing changes within this `mobile/ios` tree.
