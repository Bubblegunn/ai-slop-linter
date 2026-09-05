## Summary

This PR introduces a comprehensive refactoring of the authentication module, enhancing both security and maintainability. The changes underscore our commitment to robust, production-grade code.

## What Changed

- **Refactored `AuthService`**: Extracted the token validation logic into a dedicated, reusable utility.
- **Enhanced Error Handling**: Improved error messages to provide more actionable feedback to users.
- **Added Tests**: Comprehensive test coverage ensures the new implementation is battle-tested.

## Why This Matters

The previous implementation was tightly coupled, making it difficult to test in isolation. By decoupling these concerns, we've unlocked a more modular architecture that will serve us well as the codebase continues to evolve.

It's important to note that these changes are fully backward compatible. No migration is required.

## Testing

All existing tests pass, and new tests have been added to cover the refactored paths. I've also manually verified the login flow in a local environment.

Let me know if you have any questions or if there's anything else you'd like me to address!
