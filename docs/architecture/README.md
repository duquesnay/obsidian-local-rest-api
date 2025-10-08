# Architecture Documentation

This directory contains architecture analysis, refactoring plans, and performance optimization guides for the Obsidian Local REST API plugin.

## Reading Order

For new developers or reviewers, read in this order:

1. **[ROADMAP.md](ROADMAP.md)** - Executive summary (10 min read)
2. **[002-target-state.md](002-target-state.md)** - Visual architecture diagrams (5 min)
3. **[001-tags-bookmarks-review.md](001-tags-bookmarks-review.md)** - Full analysis (45 min read)
4. **[003-performance-analysis.md](003-performance-analysis.md)** - Performance deep-dive (20 min)
5. **[004-performance-fixes.md](004-performance-fixes.md)** - Code examples (15 min)
6. **[005-integration-validation.md](005-integration-validation.md)** - Validation checklist (10 min)

## Quick Links

- **Critical bug fix**: [004-performance-fixes.md - N+1 I/O Bug](004-performance-fixes.md#fix-1-remove-n1-file-io-bug)
- **Refactoring phases**: [ROADMAP.md - 5-Phase Plan](ROADMAP.md#5-phase-refactoring-plan)
- **SOLID violations**: [001-tags-bookmarks-review.md - Violations](001-tags-bookmarks-review.md#2-solid-principle-violations)
- **Performance benchmarks**: [003-performance-analysis.md - Benchmarks](003-performance-analysis.md#benchmarking-recommendations)

## Document Status

| Document | Status | Last Updated | Reviewer |
|----------|--------|--------------|----------|
| ROADMAP.md | 🔴 Awaiting Approval | 2025-10-08 | Architecture Reviewer |
| 001-tags-bookmarks-review.md | ✅ Complete | 2025-10-08 | Code Quality Analyst |
| 002-target-state.md | ✅ Complete | 2025-10-08 | Architecture Reviewer |
| 003-performance-analysis.md | ✅ Complete | 2025-10-08 | Performance Optimizer |
| 004-performance-fixes.md | ✅ Implemented | 2025-10-08 | Developer |
| 005-integration-validation.md | ✅ Complete | 2025-10-08 | Integration Specialist |

## Context

These documents were created during the quality integral review of v4.2.0, analyzing the tags and bookmarks features. The critical N+1 I/O bug identified was fixed in v4.2.1.

## Related Documentation

- [Project Guidelines](../../CLAUDE.md) - Development practices and learnings
- [API Documentation](../openapi.yaml) - REST API specification
- [Main README](../../README.md) - Plugin overview and quick start
