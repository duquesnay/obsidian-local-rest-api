# Bookmarks API - Story Map

Strategic overview showing capability relationships and decomposition.

---

## Feature Vision

**Epic**: Obsidian Bookmark Management via REST API

Enable external tools to programmatically manage Obsidian bookmarks with full feature parity to the UI, supporting all 8 bookmark types and hierarchical organization.

---

## Capability Tree

```
Bookmarks API Feature
│
├── Investigation & Foundation
│   ├── BKM-INV1: Developer understands integration risks in <30min
│   └── BKM-TECH1: Developer accesses bookmark data without crashes
│
├── Read Capabilities (Phase 1 - MVP)
│   ├── BKM-R1: API consumer retrieves bookmark list with hierarchy
│   ├── BKM-R2: API consumer distinguishes 8 bookmark types
│   └── BKM-TECH2: System handles missing plugin gracefully
│
├── Write Capabilities (Phase 2)
│   ├── BKM-W1: API consumer creates file/folder bookmarks
│   ├── BKM-W2: API consumer organizes into nested groups
│   ├── BKM-W3: API consumer bookmarks special content
│   └── BKM-TECH3: System validates data before API calls
│
├── Modification Capabilities (Phase 3)
│   ├── BKM-M1: API consumer renames bookmarks
│   ├── BKM-M2: API consumer reorganizes structure
│   ├── BKM-M3: API consumer removes bookmarks/groups
│   └── BKM-TECH4: System prevents orphaned bookmarks
│
└── Quality & Production (Phase 4)
    ├── BKM-Q1: Developer catches regressions through tests
    ├── BKM-Q2: API consumer understands endpoints through docs
    └── BKM-TECH5: Team deploys without breaking existing endpoints
```

---

## Dependency Graph

**Sequential Dependencies**:
1. **Foundation MUST complete before Phase 1**: BKM-INV1 → BKM-TECH1 → Read Capabilities
2. **Phase 1 MUST complete before Phase 2**: Read operations validate before Write operations
3. **Phase 2 MUST complete before Phase 3**: Can't update/delete until creation works

**Parallel Work Opportunities**:
- BKM-Q1 (tests) can start during Phase 1 implementation (TDD approach)
- BKM-Q2 (docs) can start during Phase 2 (document as you build)
- Investigation phase items (BKM-INV1, BKM-TECH1) can run in parallel

---

## Value Delivery Milestones

### Milestone 1: Read-Only Bookmark Access (MVP)
**Value Delivered**: External tools can read bookmark data
**Items**: BKM-INV1, BKM-TECH1, BKM-R1, BKM-R2, BKM-TECH2
**Risk**: Low - no data modification
**Effort**: 2-3 days

### Milestone 2: Bookmark Creation
**Value Delivered**: External tools can add bookmarks programmatically
**Items**: BKM-W1, BKM-W2, BKM-W3, BKM-TECH3
**Risk**: Medium - writes to Obsidian data
**Effort**: 3-4 days

### Milestone 3: Full Bookmark Management
**Value Delivered**: Complete bookmark lifecycle via API
**Items**: BKM-M1, BKM-M2, BKM-M3, BKM-TECH4
**Risk**: Medium - complex hierarchy operations
**Effort**: 2-3 days

### Milestone 4: Production Ready
**Value Delivered**: Feature ready for release
**Items**: BKM-Q1, BKM-Q2, BKM-TECH5
**Risk**: Low - quality assurance
**Effort**: 2-3 days

**Total Estimated Effort**: 9-13 days (depends on unknowns from investigation)

---

## Risk & Unknown Analysis

### High-Risk Items
1. **BKM-INV1**: Unknown bookmark plugin API stability
   - Mitigation: Time-boxed spike, document limitations early
   - Impact: May constrain feature scope

2. **BKM-W3**: Special bookmark types (heading/block/search/graph) may have complex requirements
   - Mitigation: Implement file/folder types first (simpler), learn pattern
   - Impact: May need to defer some types to future release

3. **BKM-M2**: Hierarchy manipulation (moving groups) has circular reference risks
   - Mitigation: Comprehensive validation logic, extensive edge case testing
   - Impact: May need additional iteration to get right

### Medium-Risk Items
1. **BKM-TECH4**: Orphaned bookmark prevention requires understanding plugin's internal state management
2. **BKM-R2**: All 8 bookmark types may not be fully documented
3. **BKM-TECH3**: Validation complexity increases with each bookmark type

### Low-Risk Items
- Read operations (BKM-R1, BKM-R2): Following proven patterns from tags/commands endpoints
- Documentation (BKM-Q2): Standard OpenAPI generation process
- Testing (BKM-Q1): Established TDD workflow

---

## Technical Investment Analysis

**Total Backlog Items**: 11
**Technical Capabilities**: 5 (BKM-TECH1 through BKM-TECH5)
**User/API Capabilities**: 6 (BKM-INV1, BKM-R1, BKM-R2, BKM-W1-W3, BKM-M1-M3, BKM-Q1-Q2)
**Technical Investment Ratio**: 45% (5/11)

**Analysis**: HIGH technical investment ratio justified because:
1. **New plugin integration**: First time accessing bookmark plugin (needs foundation)
2. **Complex domain**: 8 bookmark types, hierarchical structure, data integrity concerns
3. **Reliability critical**: Write operations affect user data (need robust validation)

**Expected ratio evolution**:
- Investigation phase: 100% technical (2 items) - SPIKE work
- Phase 1 (Read): 33% technical (1/3 items) - drops to normal
- Phase 2 (Write): 25% technical (1/4 items) - continues dropping
- Phase 3 (Modify): 25% technical (1/4 items) - stabilizes
- Phase 4 (Quality): 33% technical (1/3 items) - quality work

**Post-implementation**: Future bookmark enhancements should target 20-30% technical ratio.

---

## Bookmark Type Complexity Matrix

Ranked by implementation complexity (simple → complex):

| Rank | Type    | Complexity | Reason |
|------|---------|------------|--------|
| 1    | file    | Simple     | Just path + title |
| 2    | folder  | Simple     | Same as file |
| 3    | url     | Simple     | URL + title, no vault dependency |
| 4    | group   | Medium     | Hierarchical structure |
| 5    | heading | Medium     | File + heading reference |
| 6    | block   | Medium     | File + block ID reference |
| 7    | search  | Complex    | Query syntax, result handling |
| 8    | graph   | Complex    | Graph settings, state management |

**Implementation Strategy**: Start with ranks 1-2 (file/folder), validate pattern, then expand to ranks 3-6, defer 7-8 if time-constrained.

---

## Related Features (Future)

Not in current scope, but natural extensions:

- **BKM-SEARCH**: Filter bookmarks by type, path pattern, date range
- **BKM-BULK**: Batch operations (create multiple, bulk move, bulk delete)
- **BKM-EXPORT**: Export bookmarks as JSON/HTML
- **BKM-IMPORT**: Import bookmarks from JSON/browser bookmarks
- **BKM-STATS**: Bookmark usage analytics (most accessed, unused, etc.)
- **BKM-WEBHOOK**: Notifications when bookmarks change

These would add ~30-40% more work, defer to v2 based on user demand.
