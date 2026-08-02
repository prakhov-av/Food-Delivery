## v1.0.8

### Added
- Full unit test coverage for `UsersService`.
- Unit tests for:
    - `setRole()`
    - `register()`
    - `confirmRegistration()`
    - `getConfirmedByEmail()`
- Unit tests for `ConfirmationCodesService`.

### Changed
- `UsersService.restoreById()` is now idempotent.
- Removed unnecessary database update during restore.
- Confirmation code generation now guarantees only one active confirmation code per user.

### Quality
- Completed full audit of `UsersService`.
- Completed full audit of `ConfirmationCodesService`.
- Registration workflow is fully covered by unit tests.
- Business rules are verified by automated tests.

---

## RFC Status

RFC-0001
Title: Single Active Confirmation Code
Priority: P1
Status: ✅ Done

------------------------------------------------

RFC-0002
Title: UsersService Test Audit
Priority: P2
Status: ✅ Done

Completed:
- create()
- getAllActiveUsers()
- getActiveUserById()
- update()
- deleteById()
- restoreById()
- setRole()
- register()
- confirmRegistration()
- getConfirmedByEmail()

------------------------------------------------

RFC-0003
Title: Idempotent User Restore
Priority: P2
Status: ✅ Done

------------------------------------------------

### Roadmap
- Added Roadmap-001: **Resend Confirmation Email**.

------------------------------------------------

RFC-0004 — Auth & Tokens Services Test Audit

Статус: ✅ Completed

Полностью протестированы публичные методы:
AuthService
getAuthenticatedUser()
login()
refreshAccessToken()
revokeRefreshToken()
TokensService
generateAccessToken()
generateRefreshToken()
validateAccessTokenAndGetEmail()
validateRefreshTokenAndGetEmail()
getTokenFromCookies()

------------------------------------------------

RFC-0005 - Normalize Invalid JWT Handling

Исправлено:

JsonWebTokenError
↓
UnauthorizedException
↓
HTTP 401

------------------------------------------------

Roadmap

Следующие улучшения остаются в Roadmap.

Roadmap-001

Resend Confirmation Email

Roadmap-002

Refresh Token Rotation

Roadmap-003

Store Refresh Token Hash

Roadmap-004

Logout From All Devices

Roadmap-005

Authentication Rate Limiting

Roadmap-006

Normalize Authentication Responses

(унификация 401/403/404)