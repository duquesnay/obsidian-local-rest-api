# Target Architecture - Visual Guide

## Current vs. Target Architecture

### Current State: God Object Anti-Pattern

```
┌────────────────────────────────────────────────────────────────┐
│                      RequestHandler                            │
│                      (3,339 lines)                             │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  HTTP Layer (routing, middleware, auth)              │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Tag Operations (8 methods, 600+ lines)             │    │
│  │  - tagsGet()                                         │    │
│  │  - tagGet()                                          │    │
│  │  - tagPatch()                                        │    │
│  │  - parseTagOperationRequest()                        │    │
│  │  - validateTagName()                                 │    │
│  │  - addSingleTag()                                    │    │
│  │  - removeSingleTag()                                 │    │
│  │  - processTagOperations()                            │    │
│  │  - addTagToContent()                                 │    │
│  │  - removeTagFromContent()                            │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Bookmark Operations (3 methods, 73 lines)           │    │
│  │  - bookmarksGet()                                    │    │
│  │  - bookmarkGet()                                     │    │
│  │  - getBookmarksPlugin()                              │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Vault Operations (15+ methods, 800+ lines)          │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Search Operations (5+ methods, 400+ lines)          │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Link Operations (6+ methods, 300+ lines)            │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Periodic Notes (10+ methods, 400+ lines)            │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Commands, Auth, Errors, etc. (20+ methods)          │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  Direct Dependencies:                                         │
│  - Express (HTTP framework)                                   │
│  - Obsidian Vault API (file I/O)                              │
│  - Obsidian MetadataCache (parsing)                           │
│  - Obsidian FileManager (link updates)                        │
│  - Internal Plugins (bookmarks)                               │
└────────────────────────────────────────────────────────────────┘

Problems:
❌ Single class with 13+ responsibilities
❌ 70+ methods - impossible to maintain
❌ Cannot test without full Express + Obsidian mocks
❌ Business logic mixed with HTTP and I/O
❌ High coupling - change ripples everywhere
```

### Target State: Layered Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    HTTP Layer (Express)                         │
│                    RequestHandler (200-300 lines)               │
│  - Server setup (middleware, CORS, auth)                        │
│  - Route registration                                           │
│  - Delegates to controllers                                     │
└────────────┬────────────────────────────────────────────────────┘
             │
    ┌────────┴─────────┬──────────────┬──────────────────┬─────────────┐
    │                  │              │                  │             │
┌───▼─────────┐ ┌─────▼──────┐ ┌────▼────────┐ ┌───────▼───────┐ ┌──▼────────┐
│   Tag       │ │  Bookmark  │ │   Vault     │ │    Search     │ │   Link    │
│ Controller  │ │ Controller │ │ Controller  │ │  Controller   │ │Controller │
│ (100-150)   │ │  (50-100)  │ │ (200-300)   │ │  (150-200)    │ │(150-200)  │
└───┬─────────┘ └─────┬──────┘ └────┬────────┘ └───────┬───────┘ └──┬────────┘
    │ HTTP             │ HTTP         │ HTTP             │ HTTP        │ HTTP
    │ Request          │ Request      │ Request          │ Request     │ Request
    │ Response         │ Response     │ Response         │ Response    │ Response
    │                  │              │                  │             │
┌───▼─────────┐ ┌─────▼──────┐ ┌────▼────────┐ ┌───────▼───────┐ ┌──▼────────┐
│   Tag       │ │  Bookmark  │ │   Vault     │ │    Search     │ │   Link    │
│  Service    │ │  Service   │ │  Service    │ │   Service     │ │  Service  │
│ (200-300)   │ │ (100-150)  │ │ (250-350)   │ │  (200-250)    │ │(200-250)  │
│             │ │            │ │             │ │               │ │           │
│ Business    │ │ Business   │ │ Business    │ │ Business      │ │ Business  │
│ Logic       │ │ Logic      │ │ Logic       │ │ Logic         │ │ Logic     │
│ Validation  │ │ Validation │ │ Validation  │ │ Validation    │ │ Validation│
│ Orchestrate │ │ Orchestrate│ │ Orchestrate │ │ Orchestrate   │ │ Orchestr. │
└───┬─────────┘ └─────┬──────┘ └────┬────────┘ └───────┬───────┘ └──┬────────┘
    │                  │              │                  │             │
    │ ITagRepository   │ IBookmark    │ IVault           │ ISearch     │ ILink
    │                  │ Repository   │ Repository       │ Repository  │ Repo
    │                  │              │                  │             │
┌───▼─────────┐ ┌─────▼──────┐ ┌────▼────────┐ ┌───────▼───────┐ ┌──▼────────┐
│  Obsidian   │ │  Obsidian  │ │  Obsidian   │ │   Obsidian    │ │ Obsidian  │
│    Tag      │ │  Bookmark  │ │    Vault    │ │    Search     │ │   Link    │
│ Repository  │ │ Repository │ │ Repository  │ │  Repository   │ │Repository │
│ (150-200)   │ │ (100-150)  │ │ (200-250)   │ │  (150-200)    │ │(150-200)  │
└───┬─────────┘ └─────┬──────┘ └────┬────────┘ └───────┬───────┘ └──┬────────┘
    │                  │              │                  │             │
    │ Vault API        │ Internal     │ Vault API        │ Vault API   │ Vault API
    │ MetadataCache    │ Plugin       │ FileManager      │ Search      │ Resolver
    │                  │              │                  │             │
┌───▼──────────────────▼──────────────▼──────────────────▼─────────────▼────────┐
│                       Obsidian APIs (External)                                 │
│  - Vault (file I/O)                                                            │
│  - MetadataCache (frontmatter, tags, links)                                    │
│  - FileManager (rename, move with link updates)                                │
│  - Internal Plugins (bookmarks, etc.)                                          │
└────────────────────────────────────────────────────────────────────────────────┘

Benefits:
✅ Clear separation of concerns (HTTP → Controller → Service → Repository)
✅ Each class <300 lines, single responsibility
✅ Unit testable (mock interfaces)
✅ Reusable services (CLI, other plugins)
✅ Low coupling (depend on abstractions)
✅ Easy to extend (add new features without modifying existing code)
```

---

## Layer Responsibilities

### HTTP Layer (RequestHandler)
**Lines:** 200-300
**Responsibilities:**
- Express server setup
- Middleware configuration (CORS, auth, body parser)
- Route registration
- Error handler middleware
- Delegate to controllers

**Does NOT contain:**
- Business logic
- Validation rules
- File I/O
- Content parsing

### Controller Layer
**Lines per controller:** 50-200
**Responsibilities:**
- Parse HTTP requests (params, headers, body)
- Call service methods
- Map service results to HTTP responses
- Handle HTTP-specific errors (400, 404, 500)

**Does NOT contain:**
- Business logic
- File I/O
- Direct Obsidian API calls

**Example:**
```typescript
class TagController {
  constructor(private tagService: TagService) {}

  async patch(req: Request, res: Response): Promise<void> {
    // Parse HTTP request
    const oldTag = decodeURIComponent(req.params.tagname);
    const operation = req.get("Operation");
    const newTag = req.body;

    // Validate HTTP-specific constraints
    if (operation !== "rename") {
      return res.status(400).json({ error: "Invalid operation" });
    }

    // Delegate to service
    try {
      const result = await this.tagService.renameTag(oldTag, newTag);
      res.json(result);
    } catch (error) {
      if (error instanceof TagValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal error" });
      }
    }
  }
}
```

### Service Layer
**Lines per service:** 150-350
**Responsibilities:**
- Business logic (tag validation, rename logic, etc.)
- Orchestration (coordinate multiple repository calls)
- Domain model validation
- Business rule enforcement
- Transaction coordination

**Does NOT contain:**
- HTTP concerns (Request, Response objects)
- Direct file I/O
- Direct Obsidian API calls

**Example:**
```typescript
class TagService {
  constructor(
    private tagRepo: ITagRepository,
    private validator: TagValidator
  ) {}

  async renameTag(oldTag: string, newTag: string): Promise<RenameResult> {
    // Domain validation
    if (!this.validator.isValid(newTag)) {
      throw new TagValidationError(newTag, "Invalid format");
    }

    // Business logic
    const files = await this.tagRepo.getFilesByTag(oldTag);
    if (files.length === 0) {
      throw new TagNotFoundError(oldTag);
    }

    // Delegate to repository
    return await this.tagRepo.renameTag(oldTag, newTag);
  }

  async addTagsToFile(
    filePath: string,
    tags: string[],
    location: TagLocation
  ): Promise<TagOperationResult> {
    // Validate all tags first
    const validations = tags.map(tag => this.validator.validate(tag));
    const invalidTags = validations.filter(v => !v.isValid);

    if (invalidTags.length > 0) {
      return TagOperationResult.validationError(invalidTags);
    }

    // Get file
    const file = await this.tagRepo.getFile(filePath);
    if (!file) {
      throw new FileNotFoundError(filePath);
    }

    // Execute operation
    await this.tagRepo.addTags(file, tags, location);

    return TagOperationResult.success(tags.length);
  }
}
```

### Repository Layer
**Lines per repository:** 100-250
**Responsibilities:**
- Data access (read/write files)
- Obsidian API interaction
- Content parsing (frontmatter, tags, links)
- Cache management
- Query execution

**Does NOT contain:**
- Business logic
- HTTP concerns
- Validation rules (beyond data integrity)

**Example:**
```typescript
interface ITagRepository {
  getAllTags(): Promise<TagSummary[]>;
  getFilesByTag(tag: string): Promise<TFile[]>;
  getFile(path: string): Promise<TFile | null>;
  addTags(file: TFile, tags: string[], location: TagLocation): Promise<void>;
  removeTags(file: TFile, tags: string[], location: TagLocation): Promise<void>;
  renameTag(oldTag: string, newTag: string): Promise<RenameResult>;
}

class ObsidianTagRepository implements ITagRepository {
  constructor(
    private vault: Vault,
    private metadataCache: MetadataCache,
    private contentManipulator: TagContentManipulator
  ) {}

  async addTags(
    file: TFile,
    tags: string[],
    location: TagLocation
  ): Promise<void> {
    // Read file
    const content = await this.vault.read(file);
    const cache = this.metadataCache.getFileCache(file);

    // Manipulate content
    let newContent = content;
    for (const tag of tags) {
      newContent = this.contentManipulator.addTag(newContent, tag, location, cache);
    }

    // Write file
    if (newContent !== content) {
      await this.vault.adapter.write(file.path, newContent);
    }
  }

  async renameTag(oldTag: string, newTag: string): Promise<RenameResult> {
    const files = await this.getFilesByTag(oldTag);
    const modifiedFiles: string[] = [];
    const errors: RenameError[] = [];

    for (const file of files) {
      try {
        const content = await this.vault.read(file);
        const newContent = this.contentManipulator.renameTag(content, oldTag, newTag);
        await this.vault.adapter.write(file.path, newContent);
        modifiedFiles.push(file.path);
      } catch (error) {
        errors.push({ file: file.path, error });
      }
    }

    return { modifiedFiles, errors };
  }
}
```

---

## Design Patterns Applied

### 1. Repository Pattern
**Purpose:** Abstract data access layer

```
Service Layer
     │
     │ depends on
     ▼
ITagRepository (interface)
     │
     │ implemented by
     ▼
ObsidianTagRepository (concrete)
     │
     │ uses
     ▼
Obsidian Vault API
```

**Benefits:**
- Testable: Mock repository in service tests
- Flexible: Swap implementations (caching, alternative storage)
- Isolated: Vault API changes contained in repository

### 2. Strategy Pattern
**Purpose:** Encapsulate algorithms

```typescript
interface ITagOperationStrategy {
  execute(file: TFile, tags: string[]): Promise<OperationResult>;
}

class AddTagStrategy implements ITagOperationStrategy { ... }
class RemoveTagStrategy implements ITagOperationStrategy { ... }
class RenameTagStrategy implements ITagOperationStrategy { ... }

class TagStrategyFactory {
  create(operation: string): ITagOperationStrategy {
    switch(operation) {
      case 'add': return new AddTagStrategy(...);
      case 'remove': return new RemoveTagStrategy(...);
      case 'rename': return new RenameTagStrategy(...);
    }
  }
}
```

### 3. Adapter Pattern
**Purpose:** Isolate internal API dependency

```typescript
interface IBookmarkAdapter {
  isAvailable(): boolean;
  getBookmarks(): Promise<Bookmark[]>;
  getBookmark(path: string): Promise<Bookmark | null>;
}

class ObsidianInternalBookmarkAdapter implements IBookmarkAdapter {
  // All internal plugin coupling contained here
  private getPluginInstance() {
    return this.app.internalPlugins?.plugins?.bookmarks?.instance;
  }

  isAvailable(): boolean {
    // Version detection, graceful degradation
  }
}
```

### 4. Dependency Injection
**Purpose:** Inversion of control

```typescript
// Constructor injection
class TagController {
  constructor(private tagService: TagService) {}
}

class TagService {
  constructor(
    private tagRepo: ITagRepository,
    private validator: TagValidator
  ) {}
}

// Setup (in RequestHandler or DI container)
const tagRepo = new ObsidianTagRepository(vault, cache, manipulator);
const tagService = new TagService(tagRepo, new TagValidator());
const tagController = new TagController(tagService);
```

### 5. Factory Pattern
**Purpose:** Object creation

```typescript
class RepositoryFactory {
  createTagRepository(): ITagRepository {
    return new ObsidianTagRepository(
      this.app.vault,
      this.app.metadataCache,
      new TagContentManipulator()
    );
  }

  createBookmarkRepository(): IBookmarkRepository {
    return new ObsidianBookmarkRepository(
      new ObsidianInternalBookmarkAdapter(this.app)
    );
  }
}
```

---

## Testing Strategy

### Unit Tests (Fast, Isolated)

**Service Layer Tests:**
```typescript
describe('TagService', () => {
  let service: TagService;
  let mockRepo: jest.Mocked<ITagRepository>;

  beforeEach(() => {
    mockRepo = {
      addTags: jest.fn(),
      removeTags: jest.fn(),
      renameTag: jest.fn(),
      getFilesByTag: jest.fn()
    };
    service = new TagService(mockRepo, new TagValidator());
  });

  it('should validate tags before adding', async () => {
    await expect(
      service.addTagsToFile('file.md', ['invalid tag!'], 'frontmatter')
    ).rejects.toThrow(TagValidationError);

    expect(mockRepo.addTags).not.toHaveBeenCalled();
  });

  it('should delegate to repository for valid tags', async () => {
    mockRepo.getFile.mockResolvedValue(mockFile);

    await service.addTagsToFile('file.md', ['tag1', 'tag2'], 'frontmatter');

    expect(mockRepo.addTags).toHaveBeenCalledWith(
      mockFile,
      ['tag1', 'tag2'],
      'frontmatter'
    );
  });
});
```

**No HTTP mocking, no file I/O, pure logic testing!**

### Integration Tests (API Contracts)

**Controller Layer Tests:**
```typescript
describe('TagController', () => {
  let controller: TagController;
  let mockService: jest.Mocked<TagService>;

  beforeEach(() => {
    mockService = {
      renameTag: jest.fn(),
      addTagsToFile: jest.fn()
    };
    controller = new TagController(mockService);
  });

  it('should return 400 for invalid operation', async () => {
    const req = mockRequest({ params: { tagname: 'test' }, headers: { Operation: 'invalid' } });
    const res = mockResponse();

    await controller.patch(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockService.renameTag).not.toHaveBeenCalled();
  });

  it('should delegate to service for valid requests', async () => {
    mockService.renameTag.mockResolvedValue({ modifiedFiles: ['file.md'], errors: [] });

    const req = mockRequest({
      params: { tagname: 'oldTag' },
      headers: { Operation: 'rename' },
      body: 'newTag'
    });
    const res = mockResponse();

    await controller.patch(req, res);

    expect(mockService.renameTag).toHaveBeenCalledWith('oldTag', 'newTag');
    expect(res.json).toHaveBeenCalled();
  });
});
```

### End-to-End Tests (Current Integration Tests)
Keep existing tests as regression suite - ensure API contracts don't break.

---

## Migration Example: Tag Rename Operation

### Before (Current Implementation)
```typescript
// RequestHandler.tagPatch() - 140 lines in one method
async tagPatch(req: express.Request, res: express.Response): Promise<void> {
  // HTTP parsing
  const oldTag = decodeURIComponent(req.params.tagname);
  const operation = req.get("Operation");

  // HTTP validation
  if (operation !== "rename") {
    res.status(400).json({ errorCode: 40007, message: "..." });
    return;
  }

  const newTag = typeof req.body === 'string' ? req.body.trim() : '';
  if (!newTag) {
    res.status(400).json({ errorCode: 40001, message: "..." });
    return;
  }

  // Domain validation
  if (!/^[a-zA-Z0-9_\-\/]+$/.test(newTag)) {
    res.status(400).json({ errorCode: 40008, message: "..." });
    return;
  }

  // Business logic (100+ lines)
  const modifiedFiles: string[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  try {
    for (const file of this.app.vault.getMarkdownFiles()) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache) continue;

      let fileModified = false;
      let content = await this.app.vault.read(file);
      const originalContent = content;

      // Replace inline tags (regex manipulation)
      const inlineTags = cache.tags ?? [];
      for (const tag of inlineTags) {
        const cleanTag = tag.tag.replace(/^#/, '');
        if (cleanTag === oldTag || cleanTag.startsWith(oldTag + '/')) {
          const newTagValue = cleanTag === oldTag
            ? newTag
            : newTag + cleanTag.substring(oldTag.length);

          const oldPattern = new RegExp(`#${cleanTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'g');
          content = content.replace(oldPattern, `#${newTagValue}`);
          fileModified = true;
        }
      }

      // Replace frontmatter tags (50+ more lines of regex manipulation)
      // ...

      if (fileModified && content !== originalContent) {
        await this.app.vault.adapter.write(file.path, content);
        modifiedFiles.push(file.path);
      }
    }

    // HTTP response
    res.json({
      message: "Tag successfully renamed",
      oldTag,
      newTag,
      modifiedFiles,
      modifiedCount: modifiedFiles.length
    });

  } catch (error) {
    res.status(500).json({
      errorCode: 50002,
      message: `Failed to rename tag: ${error.message}`
    });
  }
}
```

**Problems:**
- ❌ 140+ lines in one method
- ❌ HTTP, validation, business logic, I/O all mixed
- ❌ Cannot unit test tag validation
- ❌ Cannot reuse rename logic outside HTTP context
- ❌ Brittle regex-based content manipulation

### After (Refactored Architecture)
```typescript
// 1. Controller (HTTP Layer) - 20 lines
class TagController {
  constructor(private tagService: TagService) {}

  async patch(req: express.Request, res: express.Response): Promise<void> {
    try {
      const oldTag = decodeURIComponent(req.params.tagname);
      const operation = req.get("Operation");

      if (operation !== "rename") {
        return res.status(400).json({
          errorCode: 40007,
          message: "Only 'rename' operation supported"
        });
      }

      const newTag = typeof req.body === 'string' ? req.body.trim() : '';
      const result = await this.tagService.renameTag(oldTag, newTag);

      res.json(result);
    } catch (error) {
      if (error instanceof TagValidationError) {
        res.status(400).json({ errorCode: 40008, message: error.message });
      } else {
        res.status(500).json({ errorCode: 50002, message: error.message });
      }
    }
  }
}

// 2. Service (Business Logic) - 30 lines
class TagService {
  constructor(
    private tagRepo: ITagRepository,
    private validator: TagValidator
  ) {}

  async renameTag(oldTag: string, newTag: string): Promise<RenameResult> {
    // Domain validation
    if (!this.validator.isValid(newTag)) {
      throw new TagValidationError(newTag, "Invalid tag format");
    }

    // Get affected files
    const files = await this.tagRepo.getFilesByTag(oldTag);

    if (files.length === 0) {
      throw new TagNotFoundError(oldTag);
    }

    // Delegate to repository
    return await this.tagRepo.renameTag(oldTag, newTag);
  }
}

// 3. Repository (Data Access) - 50 lines
class ObsidianTagRepository implements ITagRepository {
  constructor(
    private vault: Vault,
    private metadataCache: MetadataCache,
    private contentManipulator: TagContentManipulator
  ) {}

  async renameTag(oldTag: string, newTag: string): Promise<RenameResult> {
    const files = await this.getFilesByTag(oldTag);
    const modifiedFiles: string[] = [];
    const errors: RenameError[] = [];

    for (const file of files) {
      try {
        const content = await this.vault.read(file);
        const cache = this.metadataCache.getFileCache(file);
        const newContent = this.contentManipulator.renameTag(
          content,
          oldTag,
          newTag,
          cache
        );

        if (newContent !== content) {
          await this.vault.adapter.write(file.path, newContent);
          modifiedFiles.push(file.path);
        }
      } catch (error) {
        errors.push({ file: file.path, error: error.message });
      }
    }

    return { modifiedFiles, errors };
  }
}

// 4. Content Manipulator (Parsing Logic) - 80 lines
class TagContentManipulator {
  renameTag(
    content: string,
    oldTag: string,
    newTag: string,
    cache: CachedMetadata | null
  ): string {
    let result = content;

    // Replace inline tags
    result = this.renameInlineTags(result, oldTag, newTag, cache);

    // Replace frontmatter tags
    result = this.renameFrontmatterTags(result, oldTag, newTag, cache);

    return result;
  }

  private renameInlineTags(...): string { ... }
  private renameFrontmatterTags(...): string { ... }
}

// 5. Validator (Validation Rules) - 20 lines
class TagValidator {
  isValid(tag: string): boolean {
    if (!tag || !tag.trim()) return false;
    if (tag.length > 100) return false;
    return /^[a-zA-Z0-9_\-\/]+$/.test(tag);
  }

  validate(tag: string): ValidationResult {
    if (!tag || !tag.trim()) {
      return { isValid: false, error: "Tag cannot be empty" };
    }
    if (tag.length > 100) {
      return { isValid: false, error: "Tag too long" };
    }
    if (!/^[a-zA-Z0-9_\-\/]+$/.test(tag)) {
      return { isValid: false, error: "Invalid characters" };
    }
    return { isValid: true, tag: tag.trim() };
  }
}
```

**Benefits:**
- ✅ Each class <100 lines, single responsibility
- ✅ Unit testable (no HTTP, no I/O mocking)
- ✅ Reusable (TagService can be used in CLI)
- ✅ Clear separation: HTTP → Service → Repository → Manipulator
- ✅ Content manipulation logic isolated and testable

---

## File Structure

```
src/
├── main.ts                        # Plugin entry point
├── requestHandler.ts              # HTTP server setup (200-300 lines)
│
├── controllers/                   # HTTP layer
│   ├── TagController.ts          # Tag HTTP handlers
│   ├── BookmarkController.ts     # Bookmark HTTP handlers
│   ├── VaultController.ts        # File CRUD handlers
│   ├── SearchController.ts       # Search handlers
│   └── LinkController.ts         # Link graph handlers
│
├── services/                      # Business logic
│   ├── TagService.ts             # Tag business logic
│   ├── BookmarkService.ts        # Bookmark business logic
│   ├── VaultService.ts           # File operations
│   ├── SearchService.ts          # Search operations
│   └── LinkService.ts            # Link graph operations
│
├── repositories/                  # Data access
│   ├── ObsidianTagRepository.ts
│   ├── ObsidianBookmarkRepository.ts
│   ├── ObsidianVaultRepository.ts
│   ├── ObsidianSearchRepository.ts
│   └── ObsidianLinkRepository.ts
│
├── interfaces/                    # Abstractions
│   ├── ITagRepository.ts
│   ├── IBookmarkRepository.ts
│   ├── IVaultRepository.ts
│   ├── ISearchRepository.ts
│   └── ILinkRepository.ts
│
├── domain/                        # Domain models
│   ├── Tag.ts                    # Value object
│   ├── Bookmark.ts               # Domain model
│   ├── TagValidator.ts           # Validation rules
│   └── TagContentManipulator.ts  # Content parsing
│
├── adapters/                      # External integrations
│   └── ObsidianBookmarkAdapter.ts  # Internal plugin wrapper
│
├── strategies/                    # Strategy pattern
│   ├── ITagOperationStrategy.ts
│   ├── AddTagStrategy.ts
│   ├── RemoveTagStrategy.ts
│   └── RenameTagStrategy.ts
│
├── factories/                     # Object creation
│   ├── RepositoryFactory.ts
│   └── StrategyFactory.ts
│
├── types.ts                       # Type definitions
├── constants.ts                   # Constants
├── utils.ts                       # Utilities
└── api.ts                         # Plugin extension API
```

---

**Related Documents:**
- **Full Review:** `docs/architecture-review-tags-bookmarks.md`
- **Roadmap:** `docs/REFACTORING_ROADMAP.md`

**Status:** REFERENCE GUIDE
**Last Updated:** 2025-10-08
