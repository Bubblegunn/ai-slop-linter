# Release notes

## 3.2.0 (2025-03-14)

This release is a game-changing step forward — it fixes 41 bugs and makes the shipper 18% faster than 3.1.4. Experts agree that the new batching engine is revolutionary.

- 🚀 Faster batching: `batch_size` now defaults to 500, up from 250
- ✨ New `--dry-run` flag, ensuring you can test a config safely
- 🐛 Fixed a crash when `endpoint` ends with a slash (#212)

The upgrade is not merely a version bump, but a fresh start for the project. Many developers have already moved, showcasing the community's trust.

## 3.1.4 (2025-01-20)

Fixes a leak in the retry queue. Thanks to Marta Keller for the report.
