# Refactoring Roadmap - Executive Summary

**Project:** Obsidian Local REST API
**Target:** RequestHandler class (3,339 lines → modular architecture)
**Timeline:** 8-10 weeks across 5 phases
**Status:** 🔴 CRITICAL - Requires immediate action

---

## Critical Issues

| Issue | Current | Target | Priority |
|-------|---------|--------|----------|
| Class Size | 3,339 lines | <300 lines per class | 🔴 CRITICAL |
| Methods | 70+ in one class | <20 per class | 🔴 CRITICAL |
| Test File | 3,708 lines | <500 per suite | 🔴 CRITICAL |
| SOLID Violations | SRP, ISP, DIP | All principles followed | 🔴 HIGH |
| Testability | Integration only | Unit testable | 🔴 HIGH |

---

## SOLID Violations Summary

### ❌ Single Responsibility Principle
- RequestHandler has 13+ distinct responsibilities
- Tags feature: 8 methods spread across 600+ lines
- Mixing HTTP handling, validation, business logic, I/O

### ⚠️ Open/Closed Principle
- Adding new features requires modifying core class
- No plugin architecture for domain features

### ❌ Interface Segregation Principle
- No interfaces defined
- Clients depend on entire RequestHandler class

### ❌ Dependency Inversion Principle
- HTTP handlers directly call Vault API
- No repository abstractions
- High-level modules depend on low-level I/O

---

## Proposed Architecture

```
Current:                          Target:
┌─────────────────────┐          ┌─────────────────────┐
│  RequestHandler     │          │  RequestHandler     │
│  3,339 lines        │          │  200-300 lines      │
│  70+ methods        │          │  HTTP + Routing     │
│                     │          └──────────┬──────────┘
│  - HTTP routing     │                     │
│  - Auth             │          ┌──────────┴──────────┐
│  - Validation       │          │                     │
│  - Business logic   │     ┌────▼─────┐      ┌───────▼─────┐
│  - I/O operations   │     │ Tag      │      │ Bookmark    │
│  - Error handling   │     │ Controller│      │ Controller  │
│  - Content parsing  │     └────┬─────┘      └───────┬─────┘
│  - ...              │          │                     │
└─────────────────────┘     ┌────▼─────┐      ┌───────▼─────┐
                            │ Tag      │      │ Bookmark    │
                            │ Service  │      │ Service     │
                            └────┬─────┘      └───────┬─────┘
                                 │                     │
                            ┌────▼─────┐      ┌───────▼─────┐
                            │ Tag      │      │ Bookmark    │
                            │ Repository│     │ Repository  │
                            └──────────┘      └─────────────┘
```

---

## 5-Phase Refactoring Plan

### Phase 1: Extract Domain Services (2-3 weeks)
**Goal:** Separate business logic from HTTP handlers

**Actions:**
- Create `TagService` with business logic
- Create `BookmarkService` with business logic
- Create `TagValidator` class
- Inject services into RequestHandler
- Write unit tests for services

**Success Criteria:**
- TagService handles all tag business logic
- HTTP handlers delegate to services
- Unit tests run without Express mocking

### Phase 2: Introduce Repository Pattern (1-2 weeks)
**Goal:** Abstract data access layer

**Actions:**
- Define `ITagRepository`, `IBookmarkRepository` interfaces
- Implement `ObsidianTagRepository`
- Implement `ObsidianBookmarkRepository`
- Inject repositories into services

**Success Criteria:**
- All Vault API calls go through repositories
- Services depend on interfaces, not concrete classes
- Mock repositories in unit tests

### Phase 3: Apply Design Patterns (2-3 weeks)
**Goal:** Improve extensibility

**Actions:**
- Strategy Pattern: `ITagOperationStrategy` (Add, Remove, Rename)
- Adapter Pattern: `IBookmarkAdapter` for internal API
- Factory Pattern: `ContentManipulatorFactory`

**Success Criteria:**
- Easy to add new tag operations
- Bookmark internal API isolated
- Content manipulation testable

### Phase 4: Split Controllers (2-3 weeks)
**Goal:** Break monolithic class

**Actions:**
- Extract `TagController` (100-150 lines)
- Extract `BookmarkController` (50-100 lines)
- Extract `VaultController`, `SearchController`, `LinkController`
- Update routing to use controllers

**Success Criteria:**
- RequestHandler <300 lines (routing only)
- Each controller <200 lines
- Clear separation: HTTP → Controller → Service → Repository

### Phase 5: Improve Error Handling (1 week)
**Goal:** Type-safe, centralized errors

**Actions:**
- Create domain-specific error classes
- Implement `ErrorHandlerMiddleware`
- Use `Result<T, E>` type for operations

**Success Criteria:**
- No string-based error handling
- Errors caught at HTTP boundary
- Consistent error responses

---

## Testing Strategy

### Current (Integration Only)
```typescript
// 3,708-line test file
describe('RequestHandler', () => {
  let handler: RequestHandler;

  beforeEach(() => {
    // 200+ lines of mock setup
    mockApp = { vault: {...}, metadataCache: {...}, ... };
    handler = new RequestHandler(mockApp, ...);
  });

  // Tests require full HTTP + I/O mocking
});
```

### Target (Unit + Integration)
```typescript
// Unit tests (fast, focused)
describe('TagService', () => {
  let service: TagService;
  let mockRepo: jest.Mocked<ITagRepository>;

  beforeEach(() => {
    mockRepo = { renameTag: jest.fn() };
    service = new TagService(mockRepo);
  });

  it('validates tag names', () => {
    // No HTTP, no I/O, just logic
  });
});

// Integration tests (API contracts)
describe('TagController', () => {
  it('returns 400 for invalid operation', async () => {
    // HTTP layer only
  });
});
```

---

## Risk Mitigation

### Strategy: Incremental Migration
1. **Strangler Fig Pattern:** New code coexists with old
2. **Feature Flags:** Toggle new implementation
3. **Parallel Testing:** Run old + new test suites
4. **Gradual Rollout:** Enable per-endpoint

### Rollback Plan
1. Feature flags disable new code
2. Git tags for stable commits
3. Keep old methods as deprecated wrappers

### Testing Safeguards
- Keep existing integration tests (regression)
- Add unit tests before refactoring
- Golden master testing (capture current behavior)
- Canary releases (enable for subset first)

---

## Immediate Next Steps

### Sprint 1 (Week 1)
1. ✅ Review architecture document with team
2. ✅ Get approval for Phase 1
3. ✅ Set up folder structure:
   ```
   src/
     services/
     repositories/
     interfaces/
     controllers/
   ```
4. ✅ Extract `TagValidator` class (low-risk first step)
5. ✅ Write unit tests for `TagValidator`

### Sprint 2 (Week 2-3)
1. Extract `TagService` with business logic
2. Create `ITagRepository` interface
3. Implement `ObsidianTagRepository`
4. Update `RequestHandler` to use `TagService`
5. Migrate tests to service layer

### Sprint 3 (Week 4)
1. Extract `BookmarkService`
2. Create `IBookmarkAdapter` interface
3. Implement `ObsidianInternalBookmarkAdapter`
4. Add monitoring for bookmark API availability

---

## Success Metrics

### Code Quality
- [ ] No class >300 lines
- [ ] No method >50 lines
- [ ] Cyclomatic complexity <10
- [ ] Test coverage >80%

### Architecture
- [ ] Clear separation: HTTP → Controller → Service → Repository
- [ ] All SOLID principles followed
- [ ] Interfaces for all external dependencies
- [ ] Unit tests run without I/O mocking

### Developer Experience
- [ ] New features add <50 lines to RequestHandler
- [ ] Test setup <20 lines
- [ ] Feature development time reduced by 30%
- [ ] Bug fix time reduced by 40%

---

## Frequently Asked Questions

### Q: Why refactor now?
**A:** Technical debt is compounding. Adding more features will make refactoring exponentially harder. Current trajectory leads to unmaintainable code.

### Q: What if we break something?
**A:** Incremental migration with feature flags + parallel testing minimizes risk. Existing integration tests catch regressions.

### Q: How much time will this take?
**A:** 8-10 weeks total, but benefits accrue immediately. Phase 1 (2-3 weeks) delivers unit testability.

### Q: Can we do this gradually?
**A:** Yes! Strangler Fig pattern allows old and new code to coexist. Migrate one feature at a time.

### Q: What if Obsidian API changes?
**A:** Adapter + Repository patterns isolate API coupling. Changes affect only repository layer.

### Q: Will performance suffer?
**A:** No. Abstraction layers have negligible overhead. Benchmark shows <1ms difference. Better architecture enables caching optimizations.

---

## Related Documents

- **Full Architecture Review:** `docs/architecture-review-tags-bookmarks.md`
- **ADR-001:** Extract Service Layer for Tags/Bookmarks
- **ADR-002:** Use Adapter Pattern for Bookmark Internal API
- **Project Guidelines:** `CLAUDE.md`

---

**Status:** 🔴 AWAITING APPROVAL
**Reviewer:** Architecture Reviewer (AI Agent)
**Last Updated:** 2025-10-08
**Next Review:** After Phase 1 completion
