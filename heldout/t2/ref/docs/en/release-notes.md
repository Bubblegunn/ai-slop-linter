# Release notes

## 3.2.0 (2025-03-14)

This release fixes 41 bugs and makes the shipper 18% faster than 3.1.4. It also adds a new batching engine.

- Faster batching: `batch_size` now defaults to 500, up from 250
- New `--dry-run` flag to test a config safely
- Fixed a crash when `endpoint` ends with a slash (#212)

## 3.1.4 (2025-01-20)

Fixes a leak in the retry queue. Thanks to Marta Keller for the report.
