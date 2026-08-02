## v1.0.8

### Added
- RFC-0001: Single Active Confirmation Code per User.
- Unit test for ConfirmationCodesService.

### Changed
- ConfirmationCodesService now removes existing confirmation codes before generating a new one.

### Quality
- Business invariant "one active confirmation code per user" is now enforced by automated tests.


