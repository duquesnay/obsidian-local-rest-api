# Project Framing: Obsidian Local REST API

## Project Motives & Problem Statement

**Core Problem:**
Obsidian is a standalone application that requires manual user interaction. Without this REST API, there is no way to automate or programmatically interact with Obsidian vaults from third-party applications.

**Current Workarounds:**
The only alternatives are robot-clicking systems (UI automation tools) which are cumbersome, unreliable, and complex to set up.

**Solution Value:**
This plugin opens up Obsidian to external automation, enabling third-party applications to interact with vaults programmatically through a REST API instead of requiring manual clicking or hacky UI automation.

### Target Users

**Primary User: Developers Building Custom Integrations**
- Use case: Building MCP servers, custom tools, scripts, applications that read/write Obsidian notes
- Needs: Comprehensive CRUD operations, advanced search, tag management, directory operations
- Priority: Highest - all API design decisions prioritize developer experience and integration flexibility

**Secondary User: Data Scientists**
- Use case: Extracting structured data from notes for analysis, batch processing note content, generating reports from vault data
- Needs: Bulk operations, advanced filtering, content format options (plain text, HTML), search capabilities
- Priority: Secondary - features should support data extraction and batch operations

**Note on Event-Driven Workflows:**
The API currently does not support webhooks, event notifications, or real-time push mechanisms. Directory watching via WebSocket is listed as a future enhancement with no timeline. The API is pull-based (applications query for data) rather than push-based (API notifies of changes), which limits workflow automation use cases that require real-time change detection.

### Success Criteria & Metrics

**Primary Success Metrics:**

1. **Stability** (Primary Metric)

   **Critical Requirements:**
   - **Data Integrity** (CRITICAL): No data corruption, no partial writes, no inconsistent state
   - **Uptime** (CRITICAL): API must remain available during Obsidian session, no crashes
   - **Consistency** (CRITICAL): Same inputs produce same outputs reliably across all operations

   **Fail-Fast Philosophy:**
   - MUST fail immediately on error detection - NO graceful degradation
   - NEVER mask underlying errors with fallback mechanisms
   - Clear, actionable error messages on failure
   - Atomic operations - complete success or complete rollback (no partial states)

   **Backward Compatibility:**
   - Currently flexible - breaking changes allowed as needed
   - MAY become strict if project goes public with extension system
   - For now, prioritize correctness over compatibility preservation

   **Measurement:**
   - Zero data corruption incidents
   - Zero silent failures (all errors must be explicit and loud)
   - Zero inconsistent states across operations
   - API crashes require immediate investigation and fix

2. **Performance** (Primary Metric)

   **Current Status: NOT A CONCERN**

   Performance is not currently a priority or active issue for this project. The architectural understanding below is documented for reference but represents principles rather than active monitoring requirements.

   **Architectural Reality:**
   The REST API is a plugin running INSIDE the Obsidian application. Obsidian itself handles caching, memory management, and performance optimization. The plugin's role is to expose Obsidian's capabilities via REST, not to re-implement them.

   **Performance Responsibility Layers:**
   - **Obsidian's Responsibility**: File caching, metadata indexing, search optimization, memory management, vault-wide operations
   - **API's Responsibility**: Minimize overhead on top of Obsidian, leverage Obsidian's systems properly, avoid bypassing or duplicating Obsidian's optimizations

   **API Layer Performance Principles:**
   - **Leverage, don't replace**: Use Obsidian's FileManager, MetadataCache, and search APIs rather than implementing custom solutions
   - **Avoid overhead**: API operations should add minimal processing on top of Obsidian's native operations
   - **No redundant caching**: Don't implement API-level caching that duplicates Obsidian's built-in systems
   - **Respect Obsidian's patterns**: File operations through FileManager (preserves links), search through existing APIs, metadata through MetadataCache

   **Performance Concerns for API Layer:**
   - **Response serialization**: Converting Obsidian objects to JSON responses efficiently
   - **Request processing**: Express middleware overhead should be minimal
   - **Batch operations**: When iterating over multiple files, ensure efficient use of Obsidian's APIs
   - **Error handling**: Fast failure detection without expensive validation

   **What We DON'T Worry About:**
   - File system caching (Obsidian handles this)
   - Memory management for vault data (Obsidian handles this)
   - Metadata indexing performance (Obsidian handles this)
   - Large vault scalability at the storage level (Obsidian handles this)

   **Performance Monitoring Focus (if it becomes relevant):**
   - API endpoint response times (overhead added by API layer)
   - Request processing efficiency (Express middleware impact)
   - Serialization performance (converting data to JSON)
   - API-specific operations that don't delegate to Obsidian (identify and optimize these)

3. **Developer Experience** (Primary Metric)

   **Primary Concerns:**

   a. **API Intuitiveness** (Primary)
      - Intuitive endpoint design and resource naming
      - Predictable behavior across operations
      - Clear, actionable error messages (part of API intuitiveness, not separate)
      - Discoverable through usage without extensive documentation reading
      - Consistent patterns that feel natural to REST API developers

   b. **API Design Consistency** (Primary)
      - Uniform patterns across all endpoints
      - Consistent authentication mechanisms
      - Standard HTTP method usage (GET/POST/PUT/PATCH/DELETE)
      - Predictable response formats and status codes
      - Consistent header usage and content negotiation

   c. **Onboarding Experience** (OUTCOME, not separate concern)

      Onboarding is NOT a separate metric to define - it's the natural outcome when multiple quality factors work together:

      **Contributing Factors:**
      - **API Intuitiveness** (covered above): Intuitive endpoints, predictable behavior, clear error messages
      - **API Design Consistency** (covered above): Uniform patterns, consistent authentication, standard HTTP usage
      - **Code Quality** (covered in Quality Metrics below): Clean, maintainable code that's easy to understand and modify
      - **Simplicity** (part of code quality): KISS principle, avoiding over-engineering, straightforward implementations
      - **Tests** (covered in Quality Metrics below): Comprehensive test coverage that serves as usage examples
      - **Documentation**: README, OpenAPI docs, code examples, architectural guides

      When these factors are strong, onboarding naturally becomes smooth - developers can understand, integrate, and extend the API efficiently.

   **Note on Error Messages:**
   Good error messages are NOT a separate DX concern - they're part of API intuitiveness (above) and external quality metrics (below). Error messages make the API intuitive by clearly communicating what went wrong and how to fix it.

4. **Quality Metrics** (Primary Metric)

   **Observed Quality Standards from Codebase:**

   The project follows established quality practices rather than explicit quantitative thresholds. Quality is maintained through:

   a. **Code Organization & Simplicity**
      - **KISS Principle**: Simple solutions preferred over complex ones
      - **DRY Principle**: No code repetition tolerated
      - **YAGNI Principle**: Build only what's needed now
      - **Single Responsibility**: Small, focused modules with clear purposes
      - **Readability > Cleverness**: Code clarity prioritized over optimization
      - **No Dead Code**: Prompt removal of unused code

   b. **Testing Practices**
      - **Test-Driven Development (TDD)**: Red-Green-Refactor workflow mandatory
      - **Integration Tests Priority**: Integration tests valued more than unit tests for API validation
      - **Zero Failures Policy**: ANY test failure invalidates "tests pass" - no "minor failures" allowed
      - **Test Matrix for Polymorphic Endpoints**: All operation × entity type combinations tested
      - **Regression Tests**: All bugs must have failing tests before fixes

   c. **Test Coverage Approach**
      - **Coverage is qualitative, not quantitative**: No explicit percentage targets defined
      - **Critical paths must have tests**: Core API operations, security validations, data operations
      - **Edge cases and error scenarios**: Explicitly test "wrong entity type", security attacks, boundary conditions
      - **Tests as documentation**: Test suite serves as usage examples and behavior specification

   d. **Code Quality Gates**
      - **Tests must pass before commits**: Absolute requirement, no exceptions
      - **Security validation at multiple levels**: Input validation, path validation, file system validation, cross-platform validation
      - **Incremental improvements**: Address technical debt systematically as patterns emerge
      - **Atomic commits**: One concern per commit, clear commit message format (feat:/fix:/refactor:/docs:)

   e. **Technical Debt Management**
      - **Address incrementally**: Refactor when patterns emerge, not preemptively
      - **No over-engineering**: Avoid adding complexity for hypothetical future needs
      - **Mock evolution strategy**: Enhance mocks incrementally as features grow
      - **Research-driven validation**: Validate approaches through research before implementation

   f. **Documentation Standards**
      - **OpenAPI Specification**: All endpoints must be documented in OpenAPI spec
      - **Code Comments**: Document the "why", not the "what"
      - **Project Learnings**: Capture methodological and technical insights in CLAUDE.md
      - **README Maintenance**: Keep usage examples and setup instructions current

   g. **Error Handling Philosophy**
      - **Fail Fast**: Immediate failure on error detection, NO graceful degradation
      - **Clear Error Messages**: Actionable feedback on what went wrong and how to fix
      - **Never Mask Errors**: No fallback mechanisms that hide underlying issues
      - **Atomic Operations**: Complete success or complete rollback, no partial states

   h. **Code Review Focus Areas**
      - **SOLID Principles**: Single responsibility, Open/closed, Liskov substitution, Interface segregation, Dependency inversion
      - **Security First**: All file operations validated for path traversal, proper authentication
      - **API Design Consistency**: Uniform patterns, standard HTTP methods, predictable responses
      - **Performance Awareness**: Factor out magic numbers, document optimizations, consider algorithmic complexity

   **Quality Philosophy:**
   Quality is maintained through disciplined practices (TDD, atomic commits, fail-fast error handling) rather than enforced thresholds. The focus is on sustainable development patterns that prevent quality degradation over time.

**Long-Term Success Vision:**

This project IS ALREADY a fork and extension of coddingtonbear's open source project (inspired by Vinzent03's advanced-uri plugin). The user has been augmenting and extending it with additional features (advanced search, tag management, directory operations, content negotiation).

**Long-term success for this fork means achieving ONE of these outcomes:**

1. **Stable, feature-complete API for specific integration needs**
   - API reaches stable state with all needed features implemented
   - Maintained at quality level sufficient for user's integration workflows
   - No longer requires active feature development, only maintenance
   - Serves as reliable foundation for MCP server and custom tool integrations

2. **Contributing back upstream**
   - Features stabilized and polished to upstream project standards
   - Code quality, documentation, and tests meet upstream contribution requirements
   - Submitted as PR to coddingtonbear's repository for broader community benefit
   - Fork becomes obsolete as features merge into main project

3. **Contributing back to community for someone else to maintain**
   - Fork reaches stable state but user no longer needs to maintain it
   - Documentation and code quality sufficient for community handoff
   - Published with clear handoff notes for new maintainer
   - Enables community to continue evolution if there's interest

**Success means**: The fork reaches a defined "done" state where it either serves its integration purpose reliably, gets merged upstream, or gets handed off to community. It does NOT mean indefinite active development.

**Measurement Approach:**
Success criteria need concrete, measurable definitions to establish quality gates and performance benchmarks. Specific thresholds and targets to be defined through further clarification.

---

## Vision/Objective

Turn Obsidian vaults into powerful REST API servers with secure HTTPS access. Enable automation, external integrations, and programmatic vault management through a comprehensive REST API.

**Domain**: Backend REST API / Obsidian Plugin Development
**Tech Stack**: TypeScript, Express.js, Node.js, Jest, OpenAPI

---

## Organization & Methodology

### Project Team

#### Core Team (Systematic Consultation)

**developer** - Implementation Partner
- **Responsibility**: Feature implementation, bug fixes, test writing, code maintenance
- **When to consult**: All coding tasks, debugging, feature additions, test implementation
- **Deliverables**: Working code, unit tests, integration tests, bug fixes

**solution-architect** - Architecture & API Design
- **Responsibility**: API contract design, system architecture, endpoint design, technical decision-making
- **When to consult**: New endpoints, major refactoring, architectural decisions, complex features, API design choices
- **Deliverables**: API contracts, architecture decision records, implementation plans, design documents

**integration-specialist** - API Compatibility & Integration
- **Responsibility**: API compatibility validation, breaking change identification, integration testing, backward compatibility
- **When to consult**: API modifications, endpoint changes, version upgrades, external integration points
- **Deliverables**: Compatibility matrices, integration tests, migration guides, breaking change analysis

**performance-optimizer** - Performance & Scalability
- **Responsibility**: Performance profiling, bottleneck identification, query optimization, large-scale operations
- **When to consult**: Large vault operations, search performance issues, scaling concerns, slow endpoints
- **Deliverables**: Performance benchmarks, profiling reports, optimization recommendations, before/after metrics

#### Support Team (On-Demand Consultation)

**code-quality-analyst** - Code Quality & SOLID Principles
- **When to consult**: Code reviews, technical debt analysis, quality improvements, refactoring guidance

**architecture-reviewer** - Post-Implementation Architecture Validation
- **When to consult**: After major features, architecture reviews, design pattern validation

**refactoring-specialist** - Complex Refactoring Operations
- **When to consult**: Large-scale refactoring, interface changes, architectural migrations

**backlog-manager** - Feature Backlog & Technical Debt
- **When to consult**: Backlog prioritization, technical debt management, strategic planning

**documentation-writer** - Technical Documentation
- **When to consult**: API documentation updates, user guides, architectural documentation

**git-workflow-manager** - Git Operations & History Management
- **When to consult**: Complex git operations, commit organization, PR extraction, branch management

**project-framer** - Project Framing & Scope
- **When to consult**: Initial framing, scope definition, project setup

---

### Collaboration Workflows

#### New API Endpoints
1. **solution-architect** → Design API contract, validate REST principles, plan implementation
2. **integration-specialist** → Review compatibility, identify breaking changes, validate contracts
3. **developer** → Implement endpoint with TDD approach, write comprehensive tests
4. **code-quality-analyst** → Review code quality (if complex feature)

**Pattern**: Sequential with quality gates

**Rationale**: API design must be validated before implementation to ensure compatibility and proper REST principles. Integration specialist catches breaking changes early.

#### Performance Issues
1. **performance-optimizer** → Profile operation, identify bottlenecks, analyze algorithmic complexity
2. **developer** → Implement optimizations based on analysis
3. **integration-specialist** → Validate no breaking changes in optimization

**Pattern**: Sequential

**Rationale**: Must identify root cause before optimizing. Integration validation prevents accidental breaking changes.

#### Major Refactoring
1. **solution-architect** → Design refactoring approach, validate architectural improvements
2. **refactoring-specialist** → Analyze ripple effects, create comprehensive refactoring plan
3. **developer** → Execute refactoring incrementally with continuous testing
4. **architecture-reviewer** → Post-implementation validation, SOLID principles check

**Pattern**: Sequential with validation gates

**Rationale**: Large refactorings need upfront planning and ripple-effect analysis. Post-implementation review ensures quality.

#### Feature Addition (Standard)
1. **solution-architect** → Design (if feature is complex or adds new endpoints)
2. **developer** → Implement with TDD, write tests first, implement feature
3. **integration-specialist** → Validate integrations (if API changes)
4. **documentation-writer** → Update OpenAPI docs, README, CLAUDE.md

**Pattern**: Sequential with conditional steps

**Rationale**: Simple features may skip architecture phase. API changes always need integration validation.

#### Bug Fixes
1. **developer** → Write failing test reproducing bug (TDD approach)
2. **developer** → Implement fix until test passes
3. **developer** → Verify fix doesn't break existing tests
4. **integration-specialist** → Validate (if fix touches API contracts)

**Pattern**: TDD workflow, mostly developer-driven

**Rationale**: Bugs should have regression tests. Integration specialist only needed for API-touching fixes.

#### Code Quality Reviews
1. **code-quality-analyst** → Identify code smells, duplication, SOLID violations
2. **developer** → Address issues incrementally
3. **architecture-reviewer** → Validate improvements

**Pattern**: Iterative with validation

**Rationale**: Quality improvements should be systematic and validated.

---

### Delegation Principles

- **Defer to expertise**: Specialists are more expert than generalist agent - trust their domain knowledge
- **Right agent for job**: Match task complexity to agent capability (don't use generalist for specialized work)
- **Parallel consultation**: For cross-domain decisions, consult multiple specialists concurrently
- **Escalation not iteration**: When stuck, escalate to specialist rather than retry with generalist approach
- **Challenge depth**: Don't accept superficial analyses - specialists should provide detailed, actionable guidance

---

### Domain-Specific Considerations

#### REST API Design
- Follow REST principles strictly (resource-oriented, proper HTTP methods)
- Maintain backward compatibility unless major version bump
- Polymorphic endpoints need careful routing architecture (route by operation type first)

#### Obsidian Plugin Development
- Use Obsidian FileManager for file operations to preserve links
- Mock Obsidian API comprehensively in tests
- Hot Reload plugin for development (manual trigger via Command Palette)

#### Security First
- All file operations need path traversal validation
- API key authentication with SHA-256 hashing
- HTTPS by default with self-signed certificates

#### Testing Strategy
- TDD approach for all features and bug fixes
- Integration tests are critical (more valuable than unit tests for API validation)
- Test matrix for polymorphic endpoints (operation × entity type combinations)

---

### Technical Constraints

- **Node.js/TypeScript**: Type safety critical for API reliability
- **Express.js**: Middleware-based architecture, route order matters
- **Jest**: Mocked Obsidian API, careful mock evolution strategy
- **OpenAPI/Swagger**: All endpoints must be documented in OpenAPI spec
- **Hot Reload limitations**: Manual trigger required, Obsidian filters startup logs

---

### Project History Context

This project follows Feature Branch Workflow with atomic commits. Recent major features include:
- Advanced search with multi-criteria filtering
- Tag management operations
- Directory operations (move, copy, delete, create)
- Content negotiation for multiple output formats

See `CLAUDE.md` for detailed project learnings and technical patterns discovered during development.

---

## Risk Management

**Status**: In Progress

### Primary Technical Risks

The project has three primary technical risks that require ongoing attention and mitigation:

1. **Data Integrity Risk** (CRITICAL)
   - **Concern**: Operations that corrupt vault data, leave inconsistent state, or cause data loss
   - **Impact**: User trust, vault reliability, potential data recovery requirements
   - **Current Status**: Specific scenarios identified, mitigation strategies to be defined

   **Priority Scenarios (in order of concern):**
   1. **Directory Move/Copy Operations**
      - Risk: File-by-file operations failing mid-process leaving incomplete state
      - Risk: Link preservation failing during bulk operations
      - Risk: Rollback mechanism incomplete or failing

   2. **Link Preservation**
      - Risk: Links breaking when files/folders are moved or renamed
      - Risk: Obsidian's FileManager not being used consistently
      - Risk: Links not updated when targets are moved/renamed

   3. **History Preservation** (Git + Obsidian Note History)
      - Risk: File operations using delete/recreate pattern instead of proper move/rename
      - Risk: Git sees operations as file deletion + new file creation, breaking git history connection
      - Risk: Obsidian's note history feature loses file version tracking when files are deleted/recreated
      - Risk: File identity and version history lost across both systems when files are moved/renamed
      - Risk: Backlinks break when delete/recreate pattern is used (related to Link Preservation risk below)
      - **Historical Incident**: This was encountered during directory move implementation - delete/recreate approach broke BOTH git history AND Obsidian note history, AND backlinks were breaking too, requiring refactor to proper move operations
      - **Connected Risk**: This risk is closely related to Link Preservation (#2) - delete/recreate pattern breaks both history tracking AND link integrity
      - Mitigation: Always use proper move/rename operations that preserve file identity in both git and Obsidian's internal history tracking

   4. **Partial Writes**
      - Risk: File write operations interrupted mid-write
      - Risk: Frontmatter updates leaving malformed YAML
      - Risk: Content operations leaving incomplete/corrupted markdown

   5. **Metadata Corruption**
      - Risk: Frontmatter YAML becoming invalid
      - Risk: Tags added/removed incorrectly
      - Risk: File metadata (dates, properties) being corrupted

   6. **Concurrency** (FUTURE CONCERN - not immediate priority)
      - Risk: Multiple operations modifying same file simultaneously
      - Risk: Race conditions in batch operations
      - **Note**: Explicitly marked as "someday" concern, not current focus

2. **Security Risk** (ADEQUATE - NO EXPANSION NEEDED)
   - **Concern**: Unauthorized access, path traversal attacks, API key compromise, malicious inputs
   - **Impact**: Vault exposure, data theft, system compromise
   - **Current Status**: Security features in place and considered sufficient

   **User Position:**
   "Until the API KEY check - which is implemented, is there, and the protocol not too pervasive, I'm sticking to the existing security features. They're must have and we have them"

   **Current Security Features (Must-Have & Present):**
   - API key authentication (Bearer token with SHA-256 hashing) - IMPLEMENTED
   - Path traversal validation for file operations - IMPLEMENTED
   - HTTPS by default with self-signed certificates - IMPLEMENTED
   - Input sanitization and validation - IMPLEMENTED
   - Cross-platform path validation (reserved names, length limits) - IMPLEMENTED

   **Security Philosophy:**
   Current security features are considered adequate and complete for project needs. These are "must have" features that ARE present. No plans to expand security beyond current implementation unless protocol becomes "too pervasive" (overly complex).

   **Not Pursuing:**
   - Additional authentication layers
   - Enhanced authorization mechanisms
   - Advanced threat detection
   - Security hardening beyond current implementation

   **Future Consideration:**
   Security expansion would only be reconsidered if:
   - Current API key authentication proves insufficient
   - Security protocol complexity becomes necessary for specific use case
   - Project scope changes significantly (public release, broader user base)

   For now, focus remains on stability, functionality, and developer experience with existing security features maintained.

3. **Maintenance Burden Risk** (MEDIUM)
   - **Concern**: Making debug or new feature development difficult
   - **Impact**: Development velocity (hard to add features), debugging difficulty when issues arise, technical debt making changes harder
   - **Current Reality**: Plugin is stable - "So far, the plugin never breaks"

   **What This Risk IS About:**
   - Development velocity impact when adding new features
   - Debugging difficulty when issues do arise
   - Technical debt making changes progressively harder
   - Code complexity slowing down feature work
   - **Dependency management**: Keeping dependencies updated (Express, TypeScript, Obsidian API, npm packages)
   - **Breaking changes**: Dealing with breaking changes in dependencies across updates
   - **Security patches**: Maintaining dependency security with timely updates

   **What This Risk is NOT About:**
   - Actual breakage (plugin is currently stable)
   - Runtime stability issues (those are covered under Data Integrity Risk)
   - Production incidents (plugin doesn't have those)

   **Current Status**: Maintenance burden is a concern for future development, NOT current stability

### Risk Analysis Framework

For each risk, we need to establish:
- **Specific Scenarios**: What concrete situations manifest this risk?
- **Assumptions**: What are we assuming about system behavior or constraints?
- **Detection**: How do we identify when this risk occurs?
- **Mitigation**: What strategies prevent or reduce this risk?
- **Monitoring**: How do we track this risk over time?

---

## Scope Boundaries

**Purpose**: This section explicitly defines what is OUT of scope for this project to maintain focus and prevent scope creep.

### What This Project IS
- **REST API Plugin for Obsidian**: Exposes Obsidian vault operations via HTTPS REST endpoints
- **Single-User Automation**: Enables programmatic interaction with individual Obsidian vaults
- **Developer Integration Tool**: Built for developers creating MCP servers, scripts, and custom tools
- **Local-First Architecture**: Plugin runs inside Obsidian, operates on local vaults

### Explicitly OUT of Scope

#### 1. Multi-User Collaboration Features
**Examples**: Real-time co-editing, user permissions, presence awareness, conflict resolution, commenting systems

**Why Out of Scope**:
- **Architecture**: Plugin architecture is single-user (runs inside one Obsidian instance)
- **Complexity**: Multi-user requires synchronization, conflict resolution, state management beyond project scope
- **Focus**: Project focuses on automation and integration, not collaboration

**In-Scope Alternative**: Single-user programmatic vault access and automation

---

#### 2. Version Control Integration Beyond Basic File Operations
**Examples**: Git commit/push from API, branch management, merge operations, version history via API, diff/patch operations

**Why Out of Scope**:
- **Architecture**: Obsidian already provides git integration via community plugins
- **Complexity**: Full version control system integration requires extensive git API wrapping
- **Focus**: File operations (move, rename, delete) preserve git history, but git operations themselves are out of scope

**In-Scope Alternative**: File operations that preserve file identity for git history, basic CRUD operations

**Note**: "History Preservation" is IN scope (ensuring file moves don't break git history), but git operations themselves are OUT of scope.

---

#### 3. Complex Workflow Orchestration Within the API
**Examples**: Multi-step workflows, conditional logic, scheduled tasks, workflow state management, task dependencies

**Why Out of Scope**:
- **Architecture**: REST APIs are stateless, workflow orchestration belongs in client applications
- **Complexity**: Workflow engines require state management, scheduling, complex error handling
- **Focus**: API provides building blocks (CRUD, search, tag operations), clients orchestrate workflows

**In-Scope Alternative**: Comprehensive REST endpoints that clients can compose into workflows externally

---

#### 4. UI/Visual Components
**Examples**: Custom editors, visual file browsers, preview panes, settings dashboards, interactive widgets

**Why Out of Scope**:
- **Architecture**: This is a REST API, not a UI plugin
- **Focus**: Backend operations only, clients provide their own UI

**In-Scope Alternative**: Settings UI for API configuration (API keys, ports, SSL), but no operational UI

---

#### 5. Data Transformation Pipelines
**Examples**: Content format conversion (Markdown to PDF/Word), batch processing workflows, templating engines, data migration tools

**Why Out of Scope**:
- **Architecture**: API exposes vault data, transformation logic belongs in clients
- **Complexity**: Transformation pipelines require extensive format support, templating, error handling
- **Focus**: Provide raw data access, let clients transform as needed

**In-Scope Alternative**: Content negotiation (plain text, HTML, markdown formats) for flexible client consumption

---

#### 6. Third-Party Service Integrations
**Examples**: Notion sync, Evernote import/export, Dropbox integration, cloud storage, external database connections

**Why Out of Scope**:
- **Architecture**: Local-first design focuses on Obsidian vault operations
- **Complexity**: Each service requires unique authentication, API integration, data mapping
- **Focus**: Obsidian vault automation, not external service bridging

**In-Scope Alternative**: REST API that clients can use to build their own integrations

---

#### 7. Plugin Marketplace / Extension Discovery
**Examples**: Plugin directory, extension search, plugin ratings/reviews, automatic updates, dependency management

**Why Out of Scope**:
- **Architecture**: Single plugin, not a platform for hosting other plugins
- **Focus**: API extension system allows other plugins to add endpoints, but no marketplace infrastructure

**In-Scope Alternative**: API extension system for programmatic endpoint registration by other plugins

---

#### 8. Authentication Beyond API Keys
**Examples**: OAuth flows, SSO integration, JWT tokens, multi-factor authentication, user management systems

**Why Out of Scope**:
- **Architecture**: Single-user local application, complex auth unnecessary
- **Complexity**: OAuth/SSO requires external identity providers, session management, token refresh
- **Focus**: Simple API key authentication sufficient for local automation use case

**In-Scope Alternative**: Bearer token authentication with SHA-256 hashed API keys, HTTPS by default

---

### Potentially IN Scope (Not Explicitly Excluded)

These features were NOT mentioned as out of scope and may be considered for implementation:

1. **Multi-Vault Management**
   - Operating on multiple vaults from single API instance
   - Vault switching/selection capabilities
   - Cross-vault operations

2. **Real-Time Events** (Already documented as future enhancement)
   - WebSocket support for directory watching
   - Change notifications
   - Event-driven workflows

   **Note**: Currently documented in Feature Backlog as "LOW PRIORITY" future enhancement

3. **Performance Monitoring**
   - API metrics collection
   - Performance profiling endpoints
   - Health check endpoints

---

### Scope Decision Framework

When evaluating new feature requests, ask:

1. **Does it serve single-user automation needs?** (Yes = potential fit)
2. **Does it expose Obsidian functionality via REST?** (Yes = potential fit)
3. **Does it require complex state management or external services?** (Yes = likely out of scope)
4. **Can clients implement it themselves using existing endpoints?** (Yes = probably out of scope)
5. **Does it align with local-first architecture?** (No = out of scope)

---
