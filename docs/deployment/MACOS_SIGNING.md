# macOS Signing Setup

This one-time setup enables official direct distribution of Band Office Desktop outside the Mac App Store. It is not App Store submission or App Review. Apple requires a Developer ID Application certificate and notarization for this distribution path.

> **Current release:** Desktop `v0.1.0-alpha.16` uses this path for both Apple Silicon and Intel downloads. Each published application is Developer ID-signed, Apple-notarized, stapled, and Gatekeeper-validated. This guide remains the maintainer setup and credential-rotation reference.

## 1. Create a Developer ID Application certificate

1. Sign in as the Apple Developer Program Account Holder at [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/certificates/list).
2. Create a **Developer ID Application** certificate. Do not create a Mac App Distribution, Apple Development, or Developer ID Installer certificate.
3. Download and install the resulting `.cer` on the Mac that created the certificate signing request.
4. In Keychain Access, export the matching certificate and private key as a password-protected `.p12` file.

Verify the installation locally:

```bash
security find-identity -v -p codesigning
```

The output must include `Developer ID Application` for the Band Office publisher identity.

## 2. Create a notarization API key

1. In [App Store Connect](https://appstoreconnect.apple.com/), open **Users and Access**, then **Integrations**.
2. Request App Store Connect API access if the account has not already approved it.
3. Under **Team Keys**, generate a new key named `Band Office Notarization` with only the role needed for notarization.
4. Download the `.p8` file immediately. Apple makes the private key available only once.
5. Record its key ID and the account issuer ID.

Use a **team** key, not an individual key. Individual keys cannot authenticate `notarytool`.

## 3. Add GitHub Actions secrets

In the `band-office/band-office` repository, open **Settings > Secrets and variables > Actions** and create:

| Secret | Value |
| --- | --- |
| `APPLE_DEVELOPER_ID_APPLICATION_P12_BASE64` | Base64 of the protected Developer ID Application `.p12` export |
| `APPLE_DEVELOPER_ID_APPLICATION_P12_PASSWORD` | `.p12` export password |
| `APPLE_NOTARY_KEY_P8_BASE64` | Base64 of the downloaded team API key `.p8` file |
| `APPLE_NOTARY_KEY_ID` | Team API key ID |
| `APPLE_NOTARY_ISSUER_ID` | App Store Connect issuer ID |

Never paste these values into an issue, pull request, release notes, chat, repository file, or shell history. Revoke and replace the API key immediately if it is exposed.

On the Mac holding the downloaded files, these commands copy the base64 values without printing them:

```bash
base64 < ~/Downloads/BandOffice-DeveloperID.p12 | tr -d '\n' | pbcopy
base64 < ~/Downloads/AuthKey_XXXXXXXXXX.p8 | tr -d '\n' | pbcopy
```

Paste each copied value directly into its matching GitHub secret. Replace the file names with the actual downloaded names.

## 4. Release and verify

Merge the signing workflow through normal review, then create the next Desktop alpha tag. The preparation workflow builds each Mac architecture on native GitHub-hosted hardware, validates its Developer ID signature, and submits the exact signed ZIP to Apple without waiting for processing. After Apple accepts both tickets, a maintainer runs the documented finalizer. It staples those exact applications and fails unless Gatekeeper reports `Notarized Developer ID`; only then can the protected publication job create a release.

After publication, verify the released DMG on a separate clean Apple Silicon Mac and a separate clean Intel Mac. The application should identify the Band Office developer and must not require the manual **Open Anyway** bypass.
