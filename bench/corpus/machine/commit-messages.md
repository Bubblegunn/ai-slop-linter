feat: implement comprehensive caching layer for API responses

This commit introduces a robust caching mechanism that significantly enhances
the performance of our API layer. By leveraging an LRU eviction strategy, we
ensure optimal memory utilisation while delivering blazing-fast response times.

Key improvements:
- **Reduced latency**: Cached responses are served in under a millisecond.
- **Lower load**: Backend queries have been dramatically reduced.
- **Configurable**: Users can tailor the cache to their specific needs.

It's worth noting that this change is fully backward compatible.

---

fix: resolve edge case in date parsing logic

This fix addresses a subtle yet crucial issue in our date parsing implementation.
Previously, dates spanning timezone boundaries could be misinterpreted, leading
to incorrect results in certain scenarios. The updated logic now handles these
cases seamlessly.

---

refactor: streamline the configuration module for improved maintainability

The configuration module has been refactored to be more modular and testable.
This change underscores our ongoing commitment to code quality and paves the
way for future enhancements. The new structure isn't just cleaner — it's a
foundation we can build upon.

---

docs: enhance README with comprehensive getting-started guide

Let's make onboarding easier! This commit adds a detailed guide that walks new
users through installation, configuration, and their first pipeline. The guide
showcases best practices and highlights common pitfalls to avoid.

I hope this helps new contributors get up to speed quickly!
