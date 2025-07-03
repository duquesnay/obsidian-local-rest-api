import {
  apiVersion,
  App,
  CachedMetadata,
  Command,
  PluginManifest,
  prepareSimpleSearch,
  TFile,
} from "obsidian";
import periodicNotes from "obsidian-daily-notes-interface";
import { getAPI as getDataviewAPI } from "obsidian-dataview";
import forge from "node-forge";

import express from "express";
import http from "http";
import cors from "cors";
import mime from "mime-types";
import bodyParser from "body-parser";
import jsonLogic from "json-logic-js";
import responseTime from "response-time";
import queryString from "query-string";
import WildcardRegexp from "glob-to-regexp";
import path from "path";
import {
  applyPatch,
  ContentType,
  PatchFailed,
  PatchInstruction,
  PatchOperation,
  PatchTargetType,
} from "markdown-patch";

import {
  CannedResponse,
  ErrorCode,
  ErrorResponseDescriptor,
  FileMetadataObject,
  LocalRestApiSettings,
  PeriodicNoteInterface,
  SearchContext,
  SearchJsonResponseItem,
  SearchResponseItem,
} from "./types";
import {
  findHeadingBoundary,
  getCertificateIsUptoStandards,
  getCertificateValidityDays,
  getSplicePosition,
  toArrayBuffer,
} from "./utils";
import {
  CERT_NAME,
  ContentTypes,
  ERROR_CODE_MESSAGES,
  MaximumRequestSize,
} from "./constants";
import LocalRestApiPublicApi from "./api";

// Import openapi.yaml as a string
import openapiYaml from "../docs/openapi.yaml";

export default class RequestHandler {
  app: App;
  api: express.Express;
  manifest: PluginManifest;
  settings: LocalRestApiSettings;

  apiExtensionRouter: express.Router;
  apiExtensions: {
    manifest: PluginManifest;
    api: LocalRestApiPublicApi;
  }[] = [];

  constructor(
    app: App,
    manifest: PluginManifest,
    settings: LocalRestApiSettings
  ) {
    this.app = app;
    this.manifest = manifest;
    this.api = express();
    this.settings = settings;

    this.apiExtensionRouter = express.Router();

    this.api.set("json spaces", 2);

    jsonLogic.add_operation(
      "glob",
      (pattern: string | undefined, field: string | undefined) => {
        if (typeof field === "string" && typeof pattern === "string") {
          const glob = WildcardRegexp(pattern);
          return glob.test(field);
        }
        return false;
      }
    );
    jsonLogic.add_operation(
      "regexp",
      (pattern: string | undefined, field: string | undefined) => {
        if (typeof field === "string" && typeof pattern === "string") {
          const rex = new RegExp(pattern);
          return rex.test(field);
        }
        return false;
      }
    );
  }

  registerApiExtension(manifest: PluginManifest): LocalRestApiPublicApi {
    let api: LocalRestApiPublicApi | undefined = undefined;
    for (const { manifest: existingManifest, api: existingApi } of this
      .apiExtensions) {
      if (JSON.stringify(existingManifest) === JSON.stringify(manifest)) {
        api = existingApi;
        break;
      }
    }
    if (!api) {
      const router = express.Router();
      this.apiExtensionRouter.use(router);
      api = new LocalRestApiPublicApi(router, () => {
        const idx = this.apiExtensions.findIndex(
          ({ manifest: storedManifest }) =>
            JSON.stringify(manifest) === JSON.stringify(storedManifest)
        );
        if (idx !== -1) {
          this.apiExtensions.splice(idx, 1);
          this.apiExtensionRouter.stack.splice(idx, 1);
        }
      });
      this.apiExtensions.push({
        manifest,
        api,
      });
    }

    return api;
  }

  requestIsAuthenticated(req: express.Request): boolean {
    const authorizationHeader = req.get(
      this.settings.authorizationHeaderName ?? "Authorization"
    );
    if (authorizationHeader === `Bearer ${this.settings.apiKey}`) {
      return true;
    }

    return false;
  }

  async authenticationMiddleware(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> {
    const authenticationExemptRoutes: string[] = [
      "/",
      `/${CERT_NAME}`,
      "/openapi.yaml",
    ];

    if (
      !authenticationExemptRoutes.includes(req.path) &&
      !this.requestIsAuthenticated(req)
    ) {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.ApiKeyAuthorizationRequired,
      });
      return;
    }

    next();
  }

  async getFileMetadataObject(file: TFile): Promise<FileMetadataObject> {
    const cache = this.app.metadataCache.getFileCache(file);

    // Gather frontmatter & strip out positioning information
    const frontmatter = { ...(cache.frontmatter ?? {}) };
    delete frontmatter.position; // This just adds noise

    // Gather both in-line tags (hash'd) & frontmatter tags; strip
    // leading '#' from them if it's there, and remove duplicates
    const directTags =
      (cache.tags ?? []).filter((tag) => tag).map((tag) => tag.tag) ?? [];
    const frontmatterTags = Array.isArray(frontmatter.tags)
      ? frontmatter.tags
      : [];
    const filteredTags: string[] = [...frontmatterTags, ...directTags]
      // Filter out falsy tags
      .filter((tag) => tag)
      // Strip leading hash and get tag's string representation --
      // although it should always be a string, it apparently isn't always!
      .map((tag) => tag.toString().replace(/^#/, ""))
      // Remove duplicates
      .filter((value, index, self) => self.indexOf(value) === index);

    return {
      tags: filteredTags,
      frontmatter: frontmatter,
      stat: file.stat,
      path: file.path,
      content: await this.app.vault.cachedRead(file),
    };
  }

  getResponseMessage({
    statusCode = 400,
    message,
    errorCode,
  }: ErrorResponseDescriptor): string {
    const errorMessages: string[] = [];
    if (errorCode) {
      errorMessages.push(ERROR_CODE_MESSAGES[errorCode]);
    } else {
      errorMessages.push(http.STATUS_CODES[statusCode]);
    }
    if (message) {
      errorMessages.push(message);
    }

    return errorMessages.join("\n");
  }

  getStatusCode({ statusCode, errorCode }: ErrorResponseDescriptor): number {
    if (statusCode) {
      return statusCode;
    }
    return Math.floor(errorCode / 100);
  }

  returnCannedResponse(
    res: express.Response,
    { statusCode, message, errorCode }: ErrorResponseDescriptor
  ): void {
    const response: CannedResponse = {
      message: this.getResponseMessage({ statusCode, message, errorCode }),
      errorCode: errorCode ?? statusCode * 100,
    };

    res.status(this.getStatusCode({ statusCode, errorCode })).json(response);
  }

  root(req: express.Request, res: express.Response): void {
    let certificate: forge.pki.Certificate | undefined;
    try {
      certificate = forge.pki.certificateFromPem(this.settings.crypto.cert);
    } catch (e) {
      // This is fine, we just won't include that in the output
    }

    res.status(200).json({
      status: "OK",
      manifest: this.manifest,
      versions: {
        obsidian: apiVersion,
        self: this.manifest.version,
      },
      service: "Obsidian Local REST API",
      authenticated: this.requestIsAuthenticated(req),
      certificateInfo:
        this.requestIsAuthenticated(req) && certificate
          ? {
              validityDays: getCertificateValidityDays(certificate),
              regenerateRecommended:
                !getCertificateIsUptoStandards(certificate),
            }
          : undefined,
      apiExtensions: this.requestIsAuthenticated(req)
        ? this.apiExtensions.map(({ manifest }) => manifest)
        : undefined,
    });
  }

  async _vaultGet(
    path: string,
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    if (!path || path.endsWith("/")) {
      const files = [
        ...new Set(
          this.app.vault
            .getFiles()
            .map((e) => e.path)
            .filter((filename) => filename.startsWith(path))
            .map((filename) => {
              const subPath = filename.slice(path.length);
              if (subPath.indexOf("/") > -1) {
                return subPath.slice(0, subPath.indexOf("/") + 1);
              }
              return subPath;
            })
        ),
      ];
      files.sort();

      if (files.length === 0) {
        this.returnCannedResponse(res, { statusCode: 404 });
        return;
      }

      res.json({
        files: files,
      });
    } else {
      const exists = await this.app.vault.adapter.exists(path);

      if (exists && (await this.app.vault.adapter.stat(path)).type === "file") {
        const content = await this.app.vault.adapter.readBinary(path);
        const mimeType = mime.lookup(path);

        res.set({
          "Content-Disposition": `attachment; filename="${encodeURI(
            path
          ).replace(",", "%2C")}"`,
          "Content-Type":
            `${mimeType}` +
            (mimeType == ContentTypes.markdown ? "; charset=utf-8" : ""),
        });

        const file = this.app.vault.getAbstractFileByPath(path) as TFile;
        if (!file) {
          this.returnCannedResponse(res, { statusCode: 404 });
          return;
        }

        // Determine the desired format from Accept header or query parameter
        const acceptHeader = req.headers.accept || "";
        const formatParam = req.query.format as string;
        
        // Query parameter takes precedence over Accept header
        let desiredFormat = "";
        if (formatParam) {
          switch (formatParam.toLowerCase()) {
            case "metadata":
              desiredFormat = ContentTypes.olrapiMetadataJson;
              break;
            case "frontmatter":
              desiredFormat = ContentTypes.olrapiFrontmatterJson;
              break;
            case "plain":
              desiredFormat = ContentTypes.plainText;
              break;
            case "html":
              desiredFormat = ContentTypes.html;
              break;
            case "full":
              desiredFormat = ContentTypes.olrapiNoteJson;
              break;
            default:
              desiredFormat = "";
          }
        } else {
          // Check Accept header for specific content types
          if (acceptHeader.includes(ContentTypes.olrapiNoteJson)) {
            desiredFormat = ContentTypes.olrapiNoteJson;
          } else if (acceptHeader.includes(ContentTypes.olrapiMetadataJson)) {
            desiredFormat = ContentTypes.olrapiMetadataJson;
          } else if (acceptHeader.includes(ContentTypes.olrapiFrontmatterJson)) {
            desiredFormat = ContentTypes.olrapiFrontmatterJson;
          } else if (acceptHeader.includes(ContentTypes.plainText)) {
            desiredFormat = ContentTypes.plainText;
          } else if (acceptHeader.includes(ContentTypes.html)) {
            desiredFormat = ContentTypes.html;
          }
        }

        // Handle different content types
        if (desiredFormat === ContentTypes.olrapiNoteJson) {
          // Return full metadata object
          res.setHeader("Content-Type", ContentTypes.olrapiNoteJson);
          res.send(
            JSON.stringify(await this.getFileMetadataObject(file), null, 2)
          );
          return;
        } else if (desiredFormat === ContentTypes.olrapiMetadataJson) {
          // Return metadata only (no content)
          const fullMetadata = await this.getFileMetadataObject(file);
          const metadata = {
            path: fullMetadata.path,
            stat: fullMetadata.stat,
            frontmatter: fullMetadata.frontmatter,
            tags: fullMetadata.tags
          };
          res.setHeader("Content-Type", ContentTypes.olrapiMetadataJson);
          res.send(JSON.stringify(metadata, null, 2));
          return;
        } else if (desiredFormat === ContentTypes.olrapiFrontmatterJson) {
          // Return frontmatter only
          const cache = this.app.metadataCache.getFileCache(file);
          const frontmatter = cache?.frontmatter || {};
          res.setHeader("Content-Type", ContentTypes.olrapiFrontmatterJson);
          res.send(JSON.stringify(frontmatter, null, 2));
          return;
        } else if (path.endsWith(".md") && (desiredFormat === ContentTypes.plainText || desiredFormat === ContentTypes.html)) {
          // For markdown files, handle text/plain and text/html
          const fileContent = await this.app.vault.read(file);
          
          if (desiredFormat === ContentTypes.plainText) {
            // Remove frontmatter for plain text
            const contentWithoutFrontmatter = fileContent.replace(/^---\n[\s\S]*?\n---\n/, "");
            res.setHeader("Content-Type", ContentTypes.plainText + "; charset=utf-8");
            res.send(contentWithoutFrontmatter);
            return;
          } else if (desiredFormat === ContentTypes.html) {
            // Convert markdown to HTML (basic conversion)
            const contentWithoutFrontmatter = fileContent.replace(/^---\n[\s\S]*?\n---\n/, "");
            let html = contentWithoutFrontmatter
              // Headers
              .replace(/^### (.*$)/gim, '<h3>$1</h3>')
              .replace(/^## (.*$)/gim, '<h2>$1</h2>')
              .replace(/^# (.*$)/gim, '<h1>$1</h1>')
              // Bold
              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              // Italic
              .replace(/\*(.+?)\*/g, '<em>$1</em>')
              // Links
              .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
              // Line breaks
              .split('\n\n').map((para: string) => para.trim() ? `<p>${para}</p>` : '').join('\n');
            
            res.setHeader("Content-Type", ContentTypes.html + "; charset=utf-8");
            res.send(html);
            return;
          }
        }

        // Handle links query parameter
        const linksParam = req.query.links as string;
        if (linksParam) {
          const validParams = ['outgoing', 'incoming', 'both'];
          if (!validParams.includes(linksParam)) {
            return this.returnCannedResponse(res, {
              statusCode: 400,
              message: `Invalid links parameter. Valid values: ${validParams.join(', ')}`
            });
          }

          const result: any = {
            path: file.path
          };

          if (linksParam === 'outgoing' || linksParam === 'both') {
            result.outgoingLinks = await this.getOutgoingLinks(file);
          }

          if (linksParam === 'incoming' || linksParam === 'both') {
            result.incomingLinks = await this.getIncomingLinks(file);
          }

          res.setHeader("Content-Type", "application/json");
          res.send(JSON.stringify(result, null, 2));
          return;
        }

        // Default behavior: return raw file content
        res.send(Buffer.from(content));
      } else {
        this.returnCannedResponse(res, {
          statusCode: 404,
        });
        return;
      }
    }
  }

  async vaultGet(req: express.Request, res: express.Response): Promise<void> {
    const path = decodeURIComponent(
      req.path.slice(req.path.indexOf("/", 1) + 1)
    );

    return this._vaultGet(path, req, res);
  }

  async _vaultPut(
    filepath: string,
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    if (!filepath || filepath.endsWith("/")) {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.RequestMethodValidOnlyForFiles,
      });
      return;
    }

    try {
      await this.app.vault.createFolder(path.dirname(filepath));
    } catch {
      // the folder/file already exists, but we don't care
    }

    if (typeof req.body === "string") {
      await this.app.vault.adapter.write(filepath, req.body);
    } else {
      await this.app.vault.adapter.writeBinary(
        filepath,
        toArrayBuffer(req.body)
      );
    }

    this.returnCannedResponse(res, { statusCode: 204 });
    return;
  }

  async vaultPut(req: express.Request, res: express.Response): Promise<void> {
    const path = decodeURIComponent(
      req.path.slice(req.path.indexOf("/", 1) + 1)
    );

    return this._vaultPut(path, req, res);
  }

  async _vaultPatchV2(
    path: string,
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const headingBoundary = req.get("Heading-Boundary") || "::";
    const heading = (req.get("Heading") || "")
      .split(headingBoundary)
      .filter(Boolean);
    const contentPosition = req.get("Content-Insertion-Position");
    let insert = false;
    let aboveNewLine = false;

    if (contentPosition === undefined) {
      insert = false;
    } else if (contentPosition === "beginning") {
      insert = true;
    } else if (contentPosition === "end") {
      insert = false;
    } else {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.InvalidContentInsertionPositionValue,
      });
      return;
    }
    if (typeof req.body != "string") {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.TextContentEncodingRequired,
      });
      return;
    }

    if (typeof req.get("Content-Insertion-Ignore-Newline") == "string") {
      aboveNewLine =
        req.get("Content-Insertion-Ignore-Newline").toLowerCase() == "true";
    }

    if (!heading.length) {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.MissingHeadingHeader,
      });
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      this.returnCannedResponse(res, {
        statusCode: 404,
      });
      return;
    }
    const cache = this.app.metadataCache.getFileCache(file);
    const position = findHeadingBoundary(cache, heading);

    if (!position) {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.InvalidHeadingHeader,
      });
      return;
    }

    const fileContents = await this.app.vault.read(file);
    const fileLines = fileContents.split("\n");

    const splicePosition = getSplicePosition(
      fileLines,
      position,
      insert,
      aboveNewLine
    );

    fileLines.splice(splicePosition, 0, req.body);

    const content = fileLines.join("\n");

    await this.app.vault.adapter.write(path, content);

    console.warn(
      `2.x PATCH implementation is deprecated and will be removed in version 4.0`
    );
    res
      .header("Deprecation", 'true; sunset-version="4.0"')
      .header(
        "Link",
        '<https://github.com/coddingtonbear/obsidian-local-rest-api/wiki/Changes-to-PATCH-requests-between-versions-2.0-and-3.0>; rel="alternate"'
      )
      .status(200)
      .send(content);
  }

  async _vaultPatchV3(
    path: string,
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const operation = req.get("Operation");
    const targetType = req.get("Target-Type");
    const rawTarget = req.get("Target") ? decodeURIComponent(req.get("Target")) : "";
    const contentType = req.get("Content-Type");
    const createTargetIfMissing = req.get("Create-Target-If-Missing") == "true";
    const applyIfContentPreexists =
      req.get("Apply-If-Content-Preexists") == "true";
    const trimTargetWhitespace = req.get("Trim-Target-Whitespace") == "true";
    const targetDelimiter = req.get("Target-Delimiter") || "::";

    const target =
      targetType == "heading" ? rawTarget.split(targetDelimiter) : rawTarget;

    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      this.returnCannedResponse(res, {
        statusCode: 404,
      });
      return;
    }
    const fileContents = await this.app.vault.read(file);

    if (!targetType) {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.MissingTargetTypeHeader,
      });
      return;
    }
    
    // Check for file-level operations BEFORE general validation
    if (targetType === "file") {
      // Handle semantic file operations
      if (operation === "rename") {
        if (rawTarget !== "name") {
          res.status(400).json({
            errorCode: 40004,
            message: "rename operation must use Target: name"
          });
          return;
        }
        return this.handleRenameOperation(path, req, res);
      }
      
      if (operation === "move") {
        if (rawTarget !== "path") {
          res.status(400).json({
            errorCode: 40005,
            message: "move operation must use Target: path"  
          });
          return;
        }
        return this.handleMoveOperation(path, req, res);
      }
      
      // Legacy support for "replace" operation with file target type
      if (operation === "replace" && rawTarget === "name") {
        return this.handleRenameOperation(path, req, res);
      }
    }
    
    // Check for directory-level operations BEFORE general validation
    if (targetType === "directory") {
      if (operation === "move") {
        if (rawTarget !== "path") {
          res.status(400).json({
            errorCode: 40005,
            message: "move operation must use Target: path"  
          });
          return;
        }
        return this.handleDirectoryMoveOperation(path, req, res);
      }
    }
    
    // Check for tag operations
    if (targetType === "tag") {
      if (operation === "add" || operation === "remove") {
        return this.handleTagOperation(path, req, res);
      }
      res.status(400).json({
        errorCode: 40009,
        message: "Only 'add' or 'remove' operations are supported for Target-Type: tag"
      });
      return;
    }
    
    // Validate that file-specific operations are only used with file target type
    if ((operation === "rename" || operation === "move") && !["file", "directory"].includes(targetType)) {
      res.status(400).json({
        errorCode: 40006,
        message: `Operation '${operation}' is only valid for Target-Type: file or directory`
      });
      return;
    }
    
    if (!["heading", "block", "frontmatter", "file", "directory", "tag"].includes(targetType)) {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.InvalidTargetTypeHeader,
      });
      return;
    }
    if (!operation) {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.MissingOperation,
      });
      return;
    }
    if (!["append", "prepend", "replace", "rename", "move", "add", "remove"].includes(operation)) {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.InvalidOperation,
      });
      return;
    }
    if (!path || path.endsWith("/")) {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.RequestMethodValidOnlyForFiles,
      });
      return;
    }

    const instruction: PatchInstruction = {
      operation: operation as PatchOperation,
      targetType: targetType as PatchTargetType,
      target,
      contentType: contentType as ContentType,
      content: req.body,
      applyIfContentPreexists,
      trimTargetWhitespace,
      createTargetIfMissing,
    } as PatchInstruction;

    try {
      const patched = applyPatch(fileContents, instruction);
      await this.app.vault.adapter.write(path, patched);
      res.status(200).send(patched);
    } catch (e) {
      if (e instanceof PatchFailed) {
        this.returnCannedResponse(res, {
          errorCode: ErrorCode.PatchFailed,
          message: e.reason,
        });
      } else {
        this.returnCannedResponse(res, {
          statusCode: 500,
          message: e.message,
        });
      }
    }
  }

  async _vaultPatch(
    path: string,
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    if (!path || path.endsWith("/")) {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.RequestMethodValidOnlyForFiles,
      });
      return;
    }

    if (req.get("Heading") && !req.get("Target-Type")) {
      return this._vaultPatchV2(path, req, res);
    }
    return this._vaultPatchV3(path, req, res);
  }

  async vaultPatch(req: express.Request, res: express.Response): Promise<void> {
    const path = decodeURIComponent(
      req.path.slice(req.path.indexOf("/", 1) + 1)
    );

    return this._vaultPatch(path, req, res);
  }

  async _vaultPost(
    filepath: string,
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    if (!filepath || filepath.endsWith("/")) {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.RequestMethodValidOnlyForFiles,
      });
      return;
    }

    if (typeof req.body != "string") {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.TextContentEncodingRequired,
      });
      return;
    }

    try {
      await this.app.vault.createFolder(path.dirname(filepath));
    } catch {
      // the folder/file already exists, but we don't care
    }

    let fileContents = "";
    const file = this.app.vault.getAbstractFileByPath(filepath);
    if (file instanceof TFile) {
      fileContents = await this.app.vault.read(file);
      if (!fileContents.endsWith("\n")) {
        fileContents += "\n";
      }
    }

    fileContents += req.body;

    await this.app.vault.adapter.write(filepath, fileContents);

    this.returnCannedResponse(res, { statusCode: 204 });
    return;
  }

  async vaultPost(req: express.Request, res: express.Response): Promise<void> {
    const path = decodeURIComponent(
      req.path.slice(req.path.indexOf("/", 1) + 1)
    );

    // Check for directory creation
    const targetType = req.get("Target-Type");
    if (targetType === "directory") {
      return this.handleDirectoryCreateOperation(path, req, res);
    }

    return this._vaultPost(path, req, res);
  }

  async _vaultDelete(
    path: string,
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    if (!path || path.endsWith("/")) {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.RequestMethodValidOnlyForFiles,
      });
      return;
    }

    const pathExists = await this.app.vault.adapter.exists(path);
    if (!pathExists) {
      this.returnCannedResponse(res, { statusCode: 404 });
      return;
    }

    await this.app.vault.adapter.remove(path);
    this.returnCannedResponse(res, { statusCode: 204 });
    return;
  }

  async vaultDelete(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const path = decodeURIComponent(
      req.path.slice(req.path.indexOf("/", 1) + 1)
    );

    // Check for directory deletion
    const targetType = req.get("Target-Type");
    if (targetType === "directory") {
      return this.handleDirectoryDeleteOperation(path, req, res);
    }

    // For backward compatibility, check if path is a directory when Target-Type is not specified
    if (!targetType || targetType === "file") {
      // Check if path exists and is a directory
      const pathExists = await this.app.vault.adapter.exists(path);
      if (pathExists) {
        const allFiles = this.app.vault.getFiles();
        const exactFile = allFiles.find(file => file.path === path);
        
        // If path exists but is not a file, it's a directory
        if (!exactFile) {
          // Return 405 for backward compatibility
          this.returnCannedResponse(res, {
            errorCode: ErrorCode.RequestMethodValidOnlyForFiles,
          });
          return;
        }
      }
    }

    return this._vaultDelete(path, req, res);
  }

  async handleRenameOperation(
    path: string,
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    
    if (!path || path.endsWith("/")) {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.RequestMethodValidOnlyForFiles,
      });
      return;
    }

    // For PATCH operations, the new filename should be in the request body
    const newFilename = typeof req.body === 'string' ? req.body.trim() : '';
    
    if (!newFilename) {
      res.status(400).json({
        errorCode: 40001,
        message: "New filename is required in request body"
      });
      return;
    }

    // Construct the new path by replacing just the filename
    const dirPath = path.substring(0, path.lastIndexOf('/'));
    const newPath = dirPath ? `${dirPath}/${newFilename}` : newFilename;

    // Validate new path
    if (newPath.endsWith("/")) {
      res.status(400).json({
        errorCode: 40002,
        message: "New path must be a file path, not a directory"
      });
      return;
    }

    // Check if source file exists
    const sourceFile = this.app.vault.getAbstractFileByPath(path);
    if (!sourceFile || !(sourceFile instanceof TFile)) {
      this.returnCannedResponse(res, { statusCode: 404 });
      return;
    }

    // Check if destination already exists
    const destExists = await this.app.vault.adapter.exists(newPath);
    if (destExists) {
      res.status(409).json({
        errorCode: 40901,
        message: "Destination file already exists"
      });
      return;
    }

    try {
      // Use FileManager to rename the file (preserves history and updates links)
      // @ts-ignore - fileManager exists at runtime but not in type definitions
      await this.app.fileManager.renameFile(sourceFile, newPath);
      
      res.status(200).json({
        message: "File successfully renamed",
        oldPath: path,
        newPath: newPath
      });
    } catch (error) {
      res.status(500).json({
        errorCode: 50001,
        message: `Failed to rename file: ${error.message}`
      });
    }
  }

  async handleMoveOperation(
    path: string,
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    
    if (!path || path.endsWith("/")) {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.RequestMethodValidOnlyForFiles,
      });
      return;
    }

    // For move operations, the new path should be in the request body
    const newPath = typeof req.body === 'string' ? req.body.trim() : '';
    
    if (!newPath) {
      res.status(400).json({
        errorCode: 40001,
        message: "New path is required in request body"
      });
      return;
    }

    // Validate new path
    if (newPath.endsWith("/")) {
      res.status(400).json({
        errorCode: 40002,
        message: "New path must be a file path, not a directory"
      });
      return;
    }

    // Check if source file exists
    const sourceFile = this.app.vault.getAbstractFileByPath(path);
    if (!sourceFile || !(sourceFile instanceof TFile)) {
      this.returnCannedResponse(res, { statusCode: 404 });
      return;
    }

    // Check if destination already exists
    const destExists = await this.app.vault.adapter.exists(newPath);
    if (destExists) {
      res.status(409).json({
        errorCode: 40901,
        message: "Destination file already exists"
      });
      return;
    }

    try {
      // Ensure parent directory exists
      const parentDir = newPath.substring(0, newPath.lastIndexOf('/'));
      if (parentDir && !(await this.app.vault.adapter.exists(parentDir))) {
        await this.app.vault.createFolder(parentDir);
      }
      
      // Use FileManager to move the file (preserves history and updates links)
      // @ts-ignore - fileManager exists at runtime but not in type definitions
      await this.app.fileManager.renameFile(sourceFile, newPath);
      
      res.status(200).json({
        message: "File successfully moved",
        oldPath: path,
        newPath: newPath
      });
    } catch (error) {
      res.status(500).json({
        errorCode: 50001,
        message: `Failed to move file: ${error.message}`
      });
    }
  }

  async handleDirectoryMoveOperation(
    path: string,
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    
    // Validate directory path (should end with "/" or be a valid directory)
    if (!path) {
      res.status(400).json({
        errorCode: 40001,
        message: "Directory path is required"
      });
      return;
    }

    // Get the new directory path from request body
    const newPath = typeof req.body === 'string' ? req.body.trim() : '';
    
    if (!newPath) {
      res.status(400).json({
        errorCode: 40001,
        message: "New directory path is required in request body"
      });
      return;
    }

    // Check if source directory exists
    const sourceExists = await this.app.vault.adapter.exists(path);
    if (!sourceExists) {
      this.returnCannedResponse(res, { statusCode: 404 });
      return;
    }

    // Check if source is actually a directory
    try {
      const sourceStat = await this.app.vault.adapter.stat(path);
      if (sourceStat && sourceStat.type !== "folder") {
        res.status(400).json({
          errorCode: 40002,
          message: "Source path is not a directory"
        });
        return;
      }
    } catch (error) {
      res.status(400).json({
        errorCode: 40002,
        message: "Source path is not a directory"
      });
      return;
    }

    // Check if destination already exists
    const destExists = await this.app.vault.adapter.exists(newPath);
    if (destExists) {
      res.status(409).json({
        errorCode: 40901,
        message: "Destination directory already exists"
      });
      return;
    }

    // Create parent directories if needed for destination
    const parentDir = newPath.substring(0, newPath.lastIndexOf('/'));
    if (parentDir) {
      try {
        await this.app.vault.createFolder(parentDir);
      } catch {
        // Folder might already exist, continue
      }
    }

    try {
      // Get all files in the source directory recursively
      const allFiles = this.app.vault.getFiles();
      const filesToMove = allFiles.filter(file => file.path.startsWith(path + "/"));
      
      // Track moved files for potential rollback
      const movedFiles: Array<{oldPath: string, newPath: string}> = [];
      
      try {
        // Move each file individually to preserve links
        for (const file of filesToMove) {
          const relativePath = file.path.substring(path.length + 1);
          const newFilePath = `${newPath}/${relativePath}`;
          
          // Create intermediate directories if needed
          const fileParentDir = newFilePath.substring(0, newFilePath.lastIndexOf('/'));
          if (fileParentDir && fileParentDir !== newPath) {
            try {
              await this.app.vault.createFolder(fileParentDir);
            } catch {
              // Directory might already exist
            }
          }
          
          // Use FileManager to move the file (preserves history and updates links)
          // @ts-ignore - fileManager exists at runtime but not in type definitions
          await this.app.fileManager.renameFile(file, newFilePath);
          
          movedFiles.push({oldPath: file.path, newPath: newFilePath});
        }
        
        res.status(200).json({
          message: "Directory successfully moved",
          oldPath: path,
          newPath: newPath,
          filesMovedCount: filesToMove.length
        });
        
      } catch (moveError) {
        // Attempt rollback - this is best effort
        for (const moved of movedFiles.reverse()) {
          try {
            const movedFile = this.app.vault.getAbstractFileByPath(moved.newPath);
            if (movedFile instanceof TFile) {
              // @ts-ignore
              await this.app.fileManager.renameFile(movedFile, moved.oldPath);
            }
          } catch (rollbackError) {
            // Log rollback error but don't fail the main error response
            console.error(`Failed to rollback file ${moved.newPath} to ${moved.oldPath}:`, rollbackError);
          }
        }
        
        throw moveError;
      }
      
    } catch (error) {
      res.status(500).json({
        errorCode: 50001,
        message: `Failed to move directory: ${error.message}`
      });
    }
  }

  async handleDirectoryCreateOperation(
    path: string,
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    if (!path || path.endsWith("/")) {
      res.status(400).json({
        errorCode: 40001,
        message: "Directory path is required and should not end with '/'"
      });
      return;
    }

    // Check if directory already exists
    try {
      const exists = await this.app.vault.adapter.exists(path);
      if (exists) {
        res.status(409).json({
          errorCode: 40901,
          message: "Directory already exists"
        });
        return;
      }
    } catch (error) {
      // If we can't check existence, continue with creation attempt
    }

    // Check if there's a file with the same path
    const allFiles = this.app.vault.getFiles();
    const conflictingFile = allFiles.find(file => file.path === path);
    if (conflictingFile) {
      res.status(409).json({
        errorCode: 40902,
        message: "A file with the same path already exists"
      });
      return;
    }

    try {
      // Create the directory (this will also create parent directories if needed)
      await this.app.vault.createFolder(path);
      
      res.status(201).json({
        message: "Directory successfully created",
        path: path
      });
      
    } catch (error) {
      res.status(500).json({
        errorCode: 50001,
        message: `Failed to create directory: ${error.message}`
      });
    }
  }

  async handleDirectoryDeleteOperation(
    path: string,
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    if (!path || path.endsWith("/")) {
      res.status(400).json({
        errorCode: 40001,
        message: "Directory path is required and should not end with '/'"
      });
      return;
    }

    // Check if directory exists
    try {
      const exists = await this.app.vault.adapter.exists(path);
      if (!exists) {
        this.returnCannedResponse(res, { statusCode: 404 });
        return;
      }
    } catch (error) {
      this.returnCannedResponse(res, { statusCode: 404 });
      return;
    }

    // Check if path is actually a directory (not a file)
    const allFiles = this.app.vault.getFiles();
    const exactFile = allFiles.find(file => file.path === path);
    if (exactFile) {
      res.status(400).json({
        errorCode: 40001,
        message: "Path is a file, not a directory"
      });
      return;
    }

    // Get all files in the directory
    const directoryFiles = allFiles.filter(file => 
      file.path.startsWith(path + "/")
    );

    // Check if we should move to trash or permanently delete
    const permanent = req.get("Permanent") === "true";
    
    try {
      let deletedFilesCount = 0;
      
      if (permanent) {
        // Permanently delete all files in the directory
        for (const file of directoryFiles) {
          await this.app.vault.adapter.remove(file.path);
          deletedFilesCount++;
        }
        
      } else {
        // Move files to trash using Obsidian's trash system
        for (const file of directoryFiles) {
          await this.app.vault.trash(file, false);
          deletedFilesCount++;
        }
        
      }
      
      res.status(200).json({
        message: permanent ? "Directory permanently deleted" : "Directory moved to trash",
        path: path,
        deletedFilesCount: deletedFilesCount,
        permanent: permanent
      });
      
    } catch (error) {
      res.status(500).json({
        errorCode: 50001,
        message: `Failed to delete directory: ${error.message}`
      });
    }
  }

  async tagsGet(req: express.Request, res: express.Response): Promise<void> {
    // Collect all tags from all files in the vault
    const tagCounts: Record<string, number> = {};
    const tagFiles: Record<string, string[]> = {};
    
    for (const file of this.app.vault.getMarkdownFiles()) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache) continue;
      
      // Get inline tags
      const inlineTags = (cache.tags ?? []).map(tag => tag.tag.replace(/^#/, ''));
      
      // Get frontmatter tags
      const frontmatterTags = Array.isArray(cache.frontmatter?.tags) 
        ? cache.frontmatter.tags.map(tag => tag.toString())
        : [];
      
      // Combine and deduplicate tags for this file
      const allTags = [...new Set([...inlineTags, ...frontmatterTags])];
      
      // Count tags and track files
      for (const tag of allTags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        if (!tagFiles[tag]) {
          tagFiles[tag] = [];
        }
        tagFiles[tag].push(file.path);
      }
    }
    
    // Convert to array and sort by count (descending) then name (ascending)
    const tags = Object.entries(tagCounts)
      .map(([tag, count]) => ({
        tag,
        count,
        files: tagFiles[tag].length
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.tag.localeCompare(b.tag);
      });
    
    res.json({
      tags,
      totalTags: tags.length
    });
  }

  async tagGet(req: express.Request, res: express.Response): Promise<void> {
    const tagName = decodeURIComponent(req.params.tagname);
    const files: Array<{ path: string; occurrences: number }> = [];
    
    for (const file of this.app.vault.getMarkdownFiles()) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache) continue;
      
      let occurrences = 0;
      
      // Count inline tag occurrences
      const inlineTags = cache.tags ?? [];
      for (const tag of inlineTags) {
        const cleanTag = tag.tag.replace(/^#/, '');
        if (cleanTag === tagName || cleanTag.startsWith(tagName + '/')) {
          occurrences++;
        }
      }
      
      // Check frontmatter tags
      if (Array.isArray(cache.frontmatter?.tags)) {
        for (const tag of cache.frontmatter.tags) {
          const cleanTag = tag.toString();
          if (cleanTag === tagName || cleanTag.startsWith(tagName + '/')) {
            occurrences++;
          }
        }
      }
      
      if (occurrences > 0) {
        files.push({
          path: file.path,
          occurrences
        });
      }
    }
    
    if (files.length === 0) {
      this.returnCannedResponse(res, { statusCode: 404 });
      return;
    }
    
    // Sort by occurrences (descending) then path (ascending)
    files.sort((a, b) => {
      if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
      return a.path.localeCompare(b.path);
    });
    
    res.json({
      tag: tagName,
      files,
      totalFiles: files.length,
      totalOccurrences: files.reduce((sum, f) => sum + f.occurrences, 0)
    });
  }

  async handleTagOperation(
    path: string,
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const operation = req.get("Operation");
    const tagName = req.get("Target");
    
    if (!tagName) {
      res.status(400).json({
        errorCode: 40001,
        message: "Target header with tag name is required"
      });
      return;
    }
    
    // Validate tag name
    if (!/^[a-zA-Z0-9_\-\/]+$/.test(tagName)) {
      res.status(400).json({
        errorCode: 40008,
        message: "Invalid tag name. Tags can only contain letters, numbers, underscores, hyphens, and forward slashes"
      });
      return;
    }
    
    // Check if file exists
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      this.returnCannedResponse(res, { statusCode: 404 });
      return;
    }
    
    try {
      let content = await this.app.vault.read(file);
      const originalContent = content;
      
      if (operation === "add") {
        // Check if tag already exists
        const cache = this.app.metadataCache.getFileCache(file);
        const existingTags = new Set<string>();
        
        // Collect existing inline tags
        if (cache?.tags) {
          for (const tag of cache.tags) {
            existingTags.add(tag.tag.replace(/^#/, ''));
          }
        }
        
        // Collect existing frontmatter tags
        if (cache?.frontmatter?.tags && Array.isArray(cache.frontmatter.tags)) {
          for (const tag of cache.frontmatter.tags) {
            existingTags.add(tag.toString());
          }
        }
        
        if (existingTags.has(tagName)) {
          res.status(409).json({
            errorCode: 40902,
            message: "Tag already exists in this file"
          });
          return;
        }
        
        // Add tag to frontmatter if it exists, otherwise add as inline tag
        const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
        const frontmatterMatch = content.match(frontmatterRegex);
        
        if (frontmatterMatch && cache?.frontmatter) {
          // Add to frontmatter tags
          const frontmatterContent = frontmatterMatch[1];
          
          if (frontmatterContent.includes('tags:')) {
            // Add to existing tags array
            const updatedFrontmatter = frontmatterContent.replace(
              /tags:\s*\[(.*?)\]/s,
              (match, tagsContent) => {
                const tags = tagsContent ? tagsContent.split(',').map((t: string) => t.trim()) : [];
                tags.push(`"${tagName}"`);
                return `tags: [${tags.join(', ')}]`;
              }
            );
            content = content.replace(frontmatterMatch[0], `---\n${updatedFrontmatter}\n---`);
          } else {
            // Add new tags field
            const updatedFrontmatter = frontmatterContent + `\ntags: ["${tagName}"]`;
            content = content.replace(frontmatterMatch[0], `---\n${updatedFrontmatter}\n---`);
          }
        } else {
          // Add as inline tag at the end of the file
          if (!content.endsWith('\n')) {
            content += '\n';
          }
          content += `\n#${tagName}`;
        }
        
      } else if (operation === "remove") {
        const cache = this.app.metadataCache.getFileCache(file);
        let tagFound = false;
        
        // Remove inline tags
        if (cache?.tags) {
          for (const tag of cache.tags) {
            const cleanTag = tag.tag.replace(/^#/, '');
            if (cleanTag === tagName) {
              const tagPattern = new RegExp(`#${tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'g');
              content = content.replace(tagPattern, '');
              tagFound = true;
            }
          }
        }
        
        // Remove from frontmatter tags
        if (cache?.frontmatter?.tags && Array.isArray(cache.frontmatter.tags)) {
          const hasTag = cache.frontmatter.tags.some(tag => tag.toString() === tagName);
          
          if (hasTag) {
            const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
            const frontmatterMatch = content.match(frontmatterRegex);
            
            if (frontmatterMatch) {
              const frontmatterContent = frontmatterMatch[1];
              const updatedFrontmatter = frontmatterContent.replace(
                /tags:\s*\[(.*?)\]/s,
                (match, tagsContent) => {
                  const tags = tagsContent.split(',').map((t: string) => t.trim());
                  const filteredTags = tags.filter((tag: string) => {
                    const cleanTag = tag.replace(/^["']|["']$/g, '');
                    return cleanTag !== tagName;
                  });
                  
                  if (filteredTags.length === 0) {
                    return ''; // Remove tags field entirely if empty
                  }
                  return `tags: [${filteredTags.join(', ')}]`;
                }
              ).replace(/\n\s*\n/g, '\n'); // Clean up empty lines
              
              content = content.replace(frontmatterMatch[0], `---\n${updatedFrontmatter}\n---`);
              tagFound = true;
            }
          }
        }
        
        if (!tagFound) {
          this.returnCannedResponse(res, { statusCode: 404 });
          return;
        }
        
        // Clean up extra whitespace
        content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
      }
      
      // Write the file if it was modified
      if (content !== originalContent) {
        await this.app.vault.adapter.write(path, content);
        
        res.json({
          message: operation === "add" ? "Tag added successfully" : "Tag removed successfully",
          path,
          tag: tagName,
          operation
        });
      } else {
        res.status(304).json({
          message: "No changes made",
          path,
          tag: tagName,
          operation
        });
      }
      
    } catch (error) {
      res.status(500).json({
        errorCode: 50003,
        message: `Failed to ${operation} tag: ${error.message}`
      });
    }
  }

  async tagPatch(req: express.Request, res: express.Response): Promise<void> {
    const oldTag = decodeURIComponent(req.params.tagname);
    const operation = req.get("Operation");
    
    if (operation !== "rename") {
      res.status(400).json({
        errorCode: 40007,
        message: "Only 'rename' operation is supported for tags"
      });
      return;
    }
    
    const newTag = typeof req.body === 'string' ? req.body.trim() : '';
    if (!newTag) {
      res.status(400).json({
        errorCode: 40001,
        message: "New tag name is required in request body"
      });
      return;
    }
    
    // Validate new tag name (no spaces, special characters)
    if (!/^[a-zA-Z0-9_\-\/]+$/.test(newTag)) {
      res.status(400).json({
        errorCode: 40008,
        message: "Invalid tag name. Tags can only contain letters, numbers, underscores, hyphens, and forward slashes"
      });
      return;
    }
    
    const modifiedFiles: string[] = [];
    const errors: Array<{ file: string; error: string }> = [];
    
    try {
      // Process all files that contain the tag
      for (const file of this.app.vault.getMarkdownFiles()) {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache) continue;
        
        let fileModified = false;
        let content = await this.app.vault.read(file);
        const originalContent = content;
        
        // Replace inline tags
        const inlineTags = cache.tags ?? [];
        for (const tag of inlineTags) {
          const cleanTag = tag.tag.replace(/^#/, '');
          if (cleanTag === oldTag || cleanTag.startsWith(oldTag + '/')) {
            const newTagValue = cleanTag === oldTag 
              ? newTag 
              : newTag + cleanTag.substring(oldTag.length);
            
            // Find and replace the tag in content
            const oldPattern = new RegExp(`#${cleanTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'g');
            content = content.replace(oldPattern, `#${newTagValue}`);
            fileModified = true;
          }
        }
        
        // Update frontmatter tags
        if (cache.frontmatter?.tags && Array.isArray(cache.frontmatter.tags)) {
          const tagIndex = cache.frontmatter.tags.findIndex(tag => {
            const cleanTag = tag.toString();
            return cleanTag === oldTag || cleanTag.startsWith(oldTag + '/');
          });
          
          if (tagIndex !== -1) {
            // Parse frontmatter to update tags array
            const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
            const frontmatterMatch = content.match(frontmatterRegex);
            
            if (frontmatterMatch) {
              try {
                // Simple YAML parsing for tags array
                const frontmatterContent = frontmatterMatch[1];
                const updatedFrontmatter = frontmatterContent.replace(
                  /tags:\s*\[(.*?)\]/s,
                  (match, tagsContent) => {
                    const tags = tagsContent.split(',').map((t: string) => t.trim());
                    const updatedTags = tags.map((tag: string) => {
                      const cleanTag = tag.replace(/^["']|["']$/g, '');
                      if (cleanTag === oldTag || cleanTag.startsWith(oldTag + '/')) {
                        const newTagValue = cleanTag === oldTag 
                          ? newTag 
                          : newTag + cleanTag.substring(oldTag.length);
                        return tag.startsWith('"') ? `"${newTagValue}"` : 
                               tag.startsWith("'") ? `'${newTagValue}'` : newTagValue;
                      }
                      return tag;
                    });
                    return `tags: [${updatedTags.join(', ')}]`;
                  }
                );
                
                content = content.replace(frontmatterMatch[0], `---\n${updatedFrontmatter}\n---`);
                fileModified = true;
              } catch (e) {
                errors.push({ file: file.path, error: `Failed to update frontmatter: ${e.message}` });
              }
            }
          }
        }
        
        // Write the file if it was modified
        if (fileModified && content !== originalContent) {
          try {
            await this.app.vault.adapter.write(file.path, content);
            modifiedFiles.push(file.path);
          } catch (e) {
            errors.push({ file: file.path, error: e.message });
          }
        }
      }
      
      if (errors.length > 0) {
        res.status(207).json({
          message: "Tag rename completed with errors",
          oldTag,
          newTag,
          modifiedFiles,
          modifiedCount: modifiedFiles.length,
          errors
        });
      } else {
        res.json({
          message: "Tag successfully renamed",
          oldTag,
          newTag,
          modifiedFiles,
          modifiedCount: modifiedFiles.length
        });
      }
      
    } catch (error) {
      res.status(500).json({
        errorCode: 50002,
        message: `Failed to rename tag: ${error.message}`
      });
    }
  }

  async handleDirectoryMoveOperation(
    path: string,
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    
    // Validate directory path (should end with "/" or be a valid directory)
    if (!path) {
      res.status(400).json({
        errorCode: 40001,
        message: "Directory path is required"
      });
      return;
    }

    // Get the new directory path from request body
    const newPath = typeof req.body === 'string' ? req.body.trim() : '';
    
    if (!newPath) {
      res.status(400).json({
        errorCode: 40001,
        message: "New directory path is required in request body"
      });
      return;
    }

    // Check if source directory exists
    const sourceExists = await this.app.vault.adapter.exists(path);
    if (!sourceExists) {
      this.returnCannedResponse(res, { statusCode: 404 });
      return;
    }

    // Check if source is actually a directory
    try {
      const sourceStat = await this.app.vault.adapter.stat(path);
      if (sourceStat && sourceStat.type !== "folder") {
        res.status(400).json({
          errorCode: 40002,
          message: "Source path is not a directory"
        });
        return;
      }
    } catch (error) {
      res.status(400).json({
        errorCode: 40002,
        message: "Source path is not a directory"
      });
      return;
    }

    // Check if destination already exists
    const destExists = await this.app.vault.adapter.exists(newPath);
    if (destExists) {
      res.status(409).json({
        errorCode: 40901,
        message: "Destination directory already exists"
      });
      return;
    }

    // Create parent directories if needed for destination
    const parentDir = newPath.substring(0, newPath.lastIndexOf('/'));
    if (parentDir) {
      try {
        await this.app.vault.createFolder(parentDir);
      } catch {
        // Folder might already exist, continue
      }
    }

    try {
      // Get all files in the source directory recursively
      const allFiles = this.app.vault.getFiles();
      const filesToMove = allFiles.filter(file => file.path.startsWith(path + "/"));
      
      // Track moved files for potential rollback
      const movedFiles: Array<{oldPath: string, newPath: string}> = [];
      
      try {
        // Move each file individually to preserve links
        for (const file of filesToMove) {
          const relativePath = file.path.substring(path.length + 1);
          const newFilePath = `${newPath}/${relativePath}`;
          
          // Create intermediate directories if needed
          const fileParentDir = newFilePath.substring(0, newFilePath.lastIndexOf('/'));
          if (fileParentDir && fileParentDir !== newPath) {
            try {
              await this.app.vault.createFolder(fileParentDir);
            } catch {
              // Directory might already exist
            }
          }
          
          // Use FileManager to move the file (preserves history and updates links)
          // @ts-ignore - fileManager exists at runtime but not in type definitions
          await this.app.fileManager.renameFile(file, newFilePath);
          
          movedFiles.push({oldPath: file.path, newPath: newFilePath});
        }
        
        res.status(200).json({
          message: "Directory successfully moved",
          oldPath: path,
          newPath: newPath,
          filesMovedCount: filesToMove.length
        });
        
      } catch (moveError) {
        // Attempt rollback - this is best effort
        for (const moved of movedFiles.reverse()) {
          try {
            const movedFile = this.app.vault.getAbstractFileByPath(moved.newPath);
            if (movedFile instanceof TFile) {
              // @ts-ignore
              await this.app.fileManager.renameFile(movedFile, moved.oldPath);
            }
          } catch (rollbackError) {
            // Log rollback error but don't fail the main error response
            console.error(`Failed to rollback file ${moved.newPath} to ${moved.oldPath}:`, rollbackError);
          }
        }
        
        throw moveError;
      }
      
    } catch (error) {
      res.status(500).json({
        errorCode: 50001,
        message: `Failed to move directory: ${error.message}`
      });
    }
  }

  async removeEmptyDirectoriesRecursively(dirPath: string): Promise<void> {
    try {
      // Check if directory exists and is empty
      const dirExists = await this.app.vault.adapter.exists(dirPath);
      if (!dirExists) {
        return;
      }

      // List contents of directory
      const contents = await (this.app.vault.adapter as any).list(dirPath);
      
      // If directory has files, don't remove it
      if (contents.files.length > 0) {
        return;
      }
      
      // Recursively remove empty subdirectories first
      for (const subDir of contents.folders) {
        await this.removeEmptyDirectoriesRecursively(subDir);
      }
      
      // Check again if directory is now empty after removing subdirectories
      const updatedContents = await (this.app.vault.adapter as any).list(dirPath);
      if (updatedContents.files.length === 0 && updatedContents.folders.length === 0) {
        await (this.app.vault.adapter as any).rmdir(dirPath, false);
      }
      
    } catch (error) {
      // If we can't remove a directory, that's not necessarily fatal
      console.warn(`Could not remove directory ${dirPath}:`, error);
    }
  }

  getPeriodicNoteInterface(): Record<string, PeriodicNoteInterface> {
    return {
      daily: {
        settings: periodicNotes.getDailyNoteSettings(),
        loaded: periodicNotes.appHasDailyNotesPluginLoaded(),
        create: periodicNotes.createDailyNote,
        get: periodicNotes.getDailyNote,
        getAll: periodicNotes.getAllDailyNotes,
      },
      weekly: {
        settings: periodicNotes.getWeeklyNoteSettings(),
        loaded: periodicNotes.appHasWeeklyNotesPluginLoaded(),
        create: periodicNotes.createWeeklyNote,
        get: periodicNotes.getWeeklyNote,
        getAll: periodicNotes.getAllWeeklyNotes,
      },
      monthly: {
        settings: periodicNotes.getMonthlyNoteSettings(),
        loaded: periodicNotes.appHasMonthlyNotesPluginLoaded(),
        create: periodicNotes.createMonthlyNote,
        get: periodicNotes.getMonthlyNote,
        getAll: periodicNotes.getAllMonthlyNotes,
      },
      quarterly: {
        settings: periodicNotes.getQuarterlyNoteSettings(),
        loaded: periodicNotes.appHasQuarterlyNotesPluginLoaded(),
        create: periodicNotes.createQuarterlyNote,
        get: periodicNotes.getQuarterlyNote,
        getAll: periodicNotes.getAllQuarterlyNotes,
      },
      yearly: {
        settings: periodicNotes.getYearlyNoteSettings(),
        loaded: periodicNotes.appHasYearlyNotesPluginLoaded(),
        create: periodicNotes.createYearlyNote,
        get: periodicNotes.getYearlyNote,
        getAll: periodicNotes.getAllYearlyNotes,
      },
    };
  }

  periodicGetInterface(
    period: string
  ): [PeriodicNoteInterface | null, ErrorCode | null] {
    const periodic = this.getPeriodicNoteInterface();
    if (!periodic[period]) {
      return [null, ErrorCode.PeriodDoesNotExist];
    }
    if (!periodic[period].loaded) {
      return [null, ErrorCode.PeriodIsNotEnabled];
    }

    return [periodic[period], null];
  }

  periodicGetNote(
    periodName: string,
    timestamp: number
  ): [TFile | null, ErrorCode | null] {
    const [period, err] = this.periodicGetInterface(periodName);
    if (err) {
      return [null, err];
    }

    const now = (window as any).moment(timestamp);
    const all = period.getAll();

    const file = period.get(now, all);
    if (!file) {
      return [null, ErrorCode.PeriodicNoteDoesNotExist];
    }

    return [file, null];
  }

  async periodicGetOrCreateNote(
    periodName: string,
    timestamp: number
  ): Promise<[TFile | null, ErrorCode | null]> {
    const [gottenFile, err] = this.periodicGetNote(periodName, timestamp);
    let file = gottenFile;
    if (err === ErrorCode.PeriodicNoteDoesNotExist) {
      const [period] = this.periodicGetInterface(periodName);
      const now = (window as any).moment(Date.now());

      file = await period.create(now);

      const metadataCachePromise = new Promise<CachedMetadata>((resolve) => {
        let cache: CachedMetadata = null;

        const interval: ReturnType<typeof setInterval> = setInterval(() => {
          cache = this.app.metadataCache.getFileCache(file);
          if (cache) {
            clearInterval(interval);
            resolve(cache);
          }
        }, 100);
      });
      await metadataCachePromise;
    } else if (err) {
      return [null, err];
    }

    return [file, null];
  }

  redirectToVaultPath(
    file: TFile,
    req: express.Request,
    res: express.Response,
    handler: (path: string, req: express.Request, res: express.Response) => void
  ): void {
    const path = file.path;
    res.set("Content-Location", encodeURI(path));

    return handler(path, req, res);
  }

  getPeriodicDateFromParams(params: any): number {
    const { year, month, day } = params;

    if (year && month && day) {
      const date = new Date(year, month - 1, day);
      return date.getTime();
    }

    return Date.now();
  }

  async periodicGet(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const date = this.getPeriodicDateFromParams(req.params);
    const [file, err] = this.periodicGetNote(req.params.period, date);
    if (err) {
      this.returnCannedResponse(res, { errorCode: err });
      return;
    }

    return this.redirectToVaultPath(file, req, res, this._vaultGet.bind(this));
  }

  async periodicPut(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const date = this.getPeriodicDateFromParams(req.params);
    const [file, err] = await this.periodicGetOrCreateNote(
      req.params.period,
      date
    );
    if (err) {
      this.returnCannedResponse(res, { errorCode: err });
      return;
    }

    return this.redirectToVaultPath(file, req, res, this._vaultPut.bind(this));
  }

  async periodicPost(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const date = this.getPeriodicDateFromParams(req.params);
    const [file, err] = await this.periodicGetOrCreateNote(
      req.params.period,
      date
    );
    if (err) {
      this.returnCannedResponse(res, { errorCode: err });
      return;
    }

    return this.redirectToVaultPath(file, req, res, this._vaultPost.bind(this));
  }

  async periodicPatch(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const date = this.getPeriodicDateFromParams(req.params);
    const [file, err] = await this.periodicGetOrCreateNote(
      req.params.period,
      date
    );
    if (err) {
      this.returnCannedResponse(res, { errorCode: err });
      return;
    }

    return this.redirectToVaultPath(
      file,
      req,
      res,
      this._vaultPatch.bind(this)
    );
  }

  async periodicDelete(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const date = this.getPeriodicDateFromParams(req.params);
    const [file, err] = this.periodicGetNote(req.params.period, date);
    if (err) {
      this.returnCannedResponse(res, { errorCode: err });
      return;
    }

    return this.redirectToVaultPath(
      file,
      req,
      res,
      this._vaultDelete.bind(this)
    );
  }

  async activeFileGet(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const file = this.app.workspace.getActiveFile();

    return this.redirectToVaultPath(file, req, res, this._vaultGet.bind(this));
  }

  async activeFilePut(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const file = this.app.workspace.getActiveFile();

    return this.redirectToVaultPath(file, req, res, this._vaultPut.bind(this));
  }

  async activeFilePost(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const file = this.app.workspace.getActiveFile();

    return this.redirectToVaultPath(file, req, res, this._vaultPost.bind(this));
  }

  async activeFilePatch(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const file = this.app.workspace.getActiveFile();

    return this.redirectToVaultPath(
      file,
      req,
      res,
      this._vaultPatch.bind(this)
    );
  }

  async activeFileDelete(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const file = this.app.workspace.getActiveFile();

    return this.redirectToVaultPath(
      file,
      req,
      res,
      this._vaultDelete.bind(this)
    );
  }

  async commandGet(req: express.Request, res: express.Response): Promise<void> {
    const commands: Command[] = [];
    for (const commandName in this.app.commands.commands) {
      commands.push({
        id: commandName,
        name: this.app.commands.commands[commandName].name,
      });
    }

    const commandResponse = {
      commands: commands,
    };

    res.json(commandResponse);
  }

  async commandPost(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const cmd = this.app.commands.commands[req.params.commandId];

    if (!cmd) {
      this.returnCannedResponse(res, { statusCode: 404 });
      return;
    }

    try {
      this.app.commands.executeCommandById(req.params.commandId);
    } catch (e) {
      this.returnCannedResponse(res, { statusCode: 500, message: e.message });
      return;
    }

    this.returnCannedResponse(res, { statusCode: 204 });
    return;
  }

  async searchSimplePost(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const results: SearchResponseItem[] = [];

    const query: string = req.query.query as string;
    const contextLength: number =
      parseInt(req.query.contextLength as string, 10) ?? 100;
    const search = prepareSimpleSearch(query);

    for (const file of this.app.vault.getMarkdownFiles()) {
      const cachedContents = await this.app.vault.cachedRead(file);
      const result = search(cachedContents);
      if (result) {
        const contextMatches: SearchContext[] = [];
        for (const match of result.matches) {
          contextMatches.push({
            match: {
              start: match[0],
              end: match[1],
            },
            context: cachedContents.slice(
              Math.max(match[0] - contextLength, 0),
              match[1] + contextLength
            ),
          });
        }

        results.push({
          filename: file.path,
          score: result.score,
          matches: contextMatches,
        });
      }
    }

    results.sort((a, b) => (a.score > b.score ? 1 : -1));
    res.json(results);
  }

  valueIsSaneTruthy(value: unknown): boolean {
    if (value === undefined || value === null) {
      return false;
    } else if (Array.isArray(value)) {
      return value.length > 0;
    } else if (typeof value === "object") {
      return Object.keys(value).length > 0;
    }
    return Boolean(value);
  }

  async getOutgoingLinks(file: TFile): Promise<any[]> {
    const cache = this.app.metadataCache.getFileCache(file);
    const links = cache?.links || [];
    
    return links.map(link => ({
      target: link.link,
      original: link.original,
      displayText: link.displayText || link.link,
      position: link.position
    }));
  }

  async getIncomingLinks(targetFile: TFile): Promise<any[]> {
    const incomingLinks: any[] = [];
    
    // Search through all files to find links to this file
    for (const file of this.app.vault.getMarkdownFiles()) {
      const cache = this.app.metadataCache.getFileCache(file);
      const links = cache?.links || [];
      
      for (const link of links) {
        // Check if this link points to our target file
        if (this.resolveLinkTarget(link.link, file.path) === targetFile.path) {
          incomingLinks.push({
            source: file.path,
            original: link.original,
            displayText: link.displayText || link.link,
            position: link.position
          });
        }
      }
    }
    
    return incomingLinks;
  }

  resolveLinkTarget(linkText: string, sourcePath: string): string {
    // Simple link resolution - in a real implementation this would be more sophisticated
    // Handle relative paths, aliases, etc.
    
    // If link contains path separator, treat as relative to vault root
    if (linkText.includes('/')) {
      return linkText + '.md';
    }
    
    // If link is just a filename, look for it in the same directory as source
    const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
    if (sourceDir) {
      return sourceDir + '/' + linkText + '.md';
    }
    
    return linkText + '.md';
  }

  async searchAdvancedPost(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    interface AdvancedSearchQuery {
      // Content search
      content?: {
        query?: string;           // Simple text search
        regex?: string;           // Regex pattern
        caseSensitive?: boolean;  // Case sensitivity for searches
      };
      // Frontmatter filters
      frontmatter?: Record<string, any>; // Frontmatter field queries
      // File metadata filters
      metadata?: {
        path?: string;            // Path glob pattern
        extension?: string;       // File extension filter
        sizeMin?: number;         // Minimum file size in bytes
        sizeMax?: number;         // Maximum file size in bytes
        createdAfter?: string;    // ISO date string
        createdBefore?: string;   // ISO date string
        modifiedAfter?: string;   // ISO date string
        modifiedBefore?: string;  // ISO date string
      };
      // Tag filters
      tags?: {
        include?: string[];       // Must have all these tags
        exclude?: string[];       // Must not have any of these tags
        any?: string[];          // Must have at least one of these tags
      };
      // Pagination
      pagination?: {
        page?: number;           // Page number (0-based)
        limit?: number;          // Results per page (default 50, max 200)
      };
      // Options
      options?: {
        contextLength?: number;  // Context length for matches (default 100)
        includeContent?: boolean; // Include full content in results
        sortBy?: 'score' | 'path' | 'modified' | 'created' | 'size';
        sortOrder?: 'asc' | 'desc';
      };
    }

    try {
      const query = req.body as AdvancedSearchQuery;
      const results: Array<any> = [];
      
      // Validate regex early if provided
      if (query.content?.regex) {
        try {
          new RegExp(query.content.regex);
        } catch (e) {
          res.status(400).json({
            errorCode: 40009,
            message: `Invalid regex pattern: ${e.message}`
          });
          return;
        }
      }
      
      // Pagination defaults
      const page = query.pagination?.page ?? 0;
      const limit = Math.min(query.pagination?.limit ?? 50, 200);
      const contextLength = query.options?.contextLength ?? 100;
      
      // Process each file
      for (const file of this.app.vault.getMarkdownFiles()) {
        let matches = true;
        const fileResult: any = {
          path: file.path,
          matches: []
        };
        
        // Content search
        if (query.content) {
          const content = await this.app.vault.cachedRead(file);
          let contentMatches = false;
          
          if (query.content.query) {
            // Simple text search
            if (query.content.caseSensitive === false) {
              // Case insensitive search
              const searchQuery = query.content.query.toLowerCase();
              const contentLower = content.toLowerCase();
              let index = contentLower.indexOf(searchQuery);
              
              while (index !== -1) {
                contentMatches = true;
                fileResult.matches.push({
                  type: 'text',
                  match: { start: index, end: index + query.content.query.length },
                  context: content.slice(
                    Math.max(index - contextLength, 0),
                    index + query.content.query.length + contextLength
                  )
                });
                index = contentLower.indexOf(searchQuery, index + 1);
              }
            } else {
              // Use Obsidian's search function (case sensitive by default)
              const searchFunc = prepareSimpleSearch(query.content.query);
              const result = searchFunc(content);
              if (result) {
                contentMatches = true;
                fileResult.score = result.score;
                for (const match of result.matches) {
                  fileResult.matches.push({
                    type: 'text',
                    match: { start: match[0], end: match[1] },
                    context: content.slice(
                      Math.max(match[0] - contextLength, 0),
                      match[1] + contextLength
                    )
                  });
                }
              }
            }
          }
          
          if (query.content.regex) {
            // Regex search
            try {
              const flags = query.content.caseSensitive ? 'g' : 'gi';
              const regex = new RegExp(query.content.regex, flags);
              let match;
              while ((match = regex.exec(content)) !== null) {
                contentMatches = true;
                fileResult.matches.push({
                  type: 'regex',
                  match: { start: match.index, end: match.index + match[0].length },
                  context: content.slice(
                    Math.max(match.index - contextLength, 0),
                    match.index + match[0].length + contextLength
                  )
                });
              }
            } catch (e) {
              res.status(400).json({
                errorCode: 40009,
                message: `Invalid regex pattern: ${e.message}`
              });
              return;
            }
          }
          
          if (!contentMatches) {
            matches = false;
          }
        }
        
        // Frontmatter filters
        if (query.frontmatter && matches) {
          const cache = this.app.metadataCache.getFileCache(file);
          const frontmatter = cache?.frontmatter || {};
          
          // Check each frontmatter condition
          for (const [field, expectedValue] of Object.entries(query.frontmatter)) {
            const actualValue = frontmatter[field];
            
            // Handle special comparison operators
            if (expectedValue && typeof expectedValue === 'object' && expectedValue.contains) {
              // Array contains check
              if (!Array.isArray(actualValue) || !actualValue.includes(expectedValue.contains)) {
                matches = false;
                break;
              }
            } else {
              // Use json-logic for direct comparisons
              const result = jsonLogic.apply(
                { "==": [{ var: "actual" }, { var: "expected" }] },
                { actual: actualValue, expected: expectedValue }
              );
              
              if (!result) {
                matches = false;
                break;
              }
            }
          }
        }
        
        // File metadata filters
        if (query.metadata && matches) {
          // Path filter
          if (query.metadata.path) {
            const pathRegex = WildcardRegexp(query.metadata.path);
            if (!pathRegex.test(file.path)) {
              matches = false;
            }
          }
          
          // Extension filter
          if (query.metadata.extension && matches) {
            if (!file.path.endsWith(query.metadata.extension)) {
              matches = false;
            }
          }
          
          // Size filters
          if ((query.metadata.sizeMin !== undefined || query.metadata.sizeMax !== undefined) && matches) {
            const stat = file.stat;
            if (query.metadata.sizeMin !== undefined && stat.size < query.metadata.sizeMin) {
              matches = false;
            }
            if (query.metadata.sizeMax !== undefined && stat.size > query.metadata.sizeMax) {
              matches = false;
            }
          }
          
          // Date filters
          if (matches) {
            const stat = file.stat;
            
            if (query.metadata.createdAfter) {
              const afterDate = new Date(query.metadata.createdAfter).getTime();
              if (stat.ctime < afterDate) matches = false;
            }
            
            if (query.metadata.createdBefore) {
              const beforeDate = new Date(query.metadata.createdBefore).getTime();
              if (stat.ctime > beforeDate) matches = false;
            }
            
            if (query.metadata.modifiedAfter) {
              const afterDate = new Date(query.metadata.modifiedAfter).getTime();
              if (stat.mtime < afterDate) matches = false;
            }
            
            if (query.metadata.modifiedBefore) {
              const beforeDate = new Date(query.metadata.modifiedBefore).getTime();
              if (stat.mtime > beforeDate) matches = false;
            }
          }
        }
        
        // Tag filters
        if (query.tags && matches) {
          const cache = this.app.metadataCache.getFileCache(file);
          const fileTags = new Set<string>();
          
          // Collect all tags
          if (cache?.tags) {
            for (const tag of cache.tags) {
              fileTags.add(tag.tag.replace(/^#/, ''));
            }
          }
          if (cache?.frontmatter?.tags && Array.isArray(cache.frontmatter.tags)) {
            for (const tag of cache.frontmatter.tags) {
              fileTags.add(tag.toString());
            }
          }
          
          // Check include tags (must have all)
          if (query.tags.include) {
            for (const tag of query.tags.include) {
              if (!fileTags.has(tag)) {
                matches = false;
                break;
              }
            }
          }
          
          // Check exclude tags (must not have any)
          if (query.tags.exclude && matches) {
            for (const tag of query.tags.exclude) {
              if (fileTags.has(tag)) {
                matches = false;
                break;
              }
            }
          }
          
          // Check any tags (must have at least one)
          if (query.tags.any && matches) {
            let hasAny = false;
            for (const tag of query.tags.any) {
              if (fileTags.has(tag)) {
                hasAny = true;
                break;
              }
            }
            if (!hasAny) matches = false;
          }
        }
        
        // Add to results if matches
        if (matches) {
          // Add file metadata
          fileResult.metadata = {
            size: file.stat.size,
            created: file.stat.ctime,
            modified: file.stat.mtime
          };
          
          // Add frontmatter if requested
          const cache = this.app.metadataCache.getFileCache(file);
          if (cache?.frontmatter) {
            fileResult.frontmatter = cache.frontmatter;
          }
          
          // Add tags
          const tags = new Set<string>();
          if (cache?.tags) {
            for (const tag of cache.tags) {
              tags.add(tag.tag.replace(/^#/, ''));
            }
          }
          if (cache?.frontmatter?.tags && Array.isArray(cache.frontmatter.tags)) {
            for (const tag of cache.frontmatter.tags) {
              tags.add(tag.toString());
            }
          }
          if (tags.size > 0) {
            fileResult.tags = Array.from(tags);
          }
          
          // Add content if requested
          if (query.options?.includeContent) {
            fileResult.content = await this.app.vault.cachedRead(file);
          }
          
          // Add context from first match if available
          if (fileResult.matches.length > 0) {
            fileResult.context = fileResult.matches[0].context;
          }
          
          results.push(fileResult);
        }
      }
      
      // Sort results
      const sortBy = query.options?.sortBy ?? 'score';
      const sortOrder = query.options?.sortOrder ?? 'desc';
      
      results.sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'score':
            comparison = (a.score ?? 0) - (b.score ?? 0);
            break;
          case 'path':
            comparison = a.path.localeCompare(b.path);
            break;
          case 'modified':
            comparison = a.metadata.modified - b.metadata.modified;
            break;
          case 'created':
            comparison = a.metadata.created - b.metadata.created;
            break;
          case 'size':
            comparison = a.metadata.size - b.metadata.size;
            break;
        }
        
        return sortOrder === 'asc' ? comparison : -comparison;
      });
      
      // Apply pagination
      const totalResults = results.length;
      const totalPages = Math.ceil(totalResults / limit);
      const paginatedResults = results.slice(page * limit, (page + 1) * limit);
      
      res.json({
        results: paginatedResults,
        total: totalResults,
        page,
        limit,
        totalPages,
        pagination: {
          page,
          limit,
          totalResults,
          totalPages,
          hasNext: page < totalPages - 1,
          hasPrevious: page > 0
        }
      });
      
    } catch (error) {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.InvalidFilterQuery,
        message: error.message
      });
    }
  }

  async searchQueryPost(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    const dataviewApi = getDataviewAPI();

    const handlers: Record<string, () => Promise<SearchJsonResponseItem[]>> = {
      [ContentTypes.dataviewDql]: async () => {
        const results: SearchJsonResponseItem[] = [];
        const dataviewResults = await dataviewApi.tryQuery(req.body);

        const fileColumn =
          dataviewApi.evaluationContext.settings.tableIdColumnName;

        if (dataviewResults.type !== "table") {
          throw new Error("Only TABLE dataview queries are supported.");
        }
        if (!dataviewResults.headers.includes(fileColumn)) {
          throw new Error("TABLE WITHOUT ID queries are not supported.");
        }

        for (const dataviewResult of dataviewResults.values) {
          const fieldValues: Record<string, any> = {};

          dataviewResults.headers.forEach((value: string, index: number) => {
            if (value !== fileColumn) {
              fieldValues[value] = dataviewResult[index];
            }
          });

          results.push({
            filename: dataviewResult[0].path,
            result: fieldValues,
          });
        }

        return results;
      },
      [ContentTypes.jsonLogic]: async () => {
        const results: SearchJsonResponseItem[] = [];

        for (const file of this.app.vault.getMarkdownFiles()) {
          const fileContext = await this.getFileMetadataObject(file);

          try {
            const fileResult = jsonLogic.apply(req.body, fileContext);

            if (this.valueIsSaneTruthy(fileResult)) {
              results.push({
                filename: file.path,
                result: fileResult,
              });
            }
          } catch (e) {
            throw new Error(`${e.message} (while processing ${file.path})`);
          }
        }

        return results;
      },
    };
    const contentType = req.headers["content-type"];

    if (!handlers[contentType]) {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.ContentTypeSpecificationRequired,
      });
      return;
    }

    try {
      const results = await handlers[contentType]();
      res.json(results);
    } catch (e) {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.InvalidFilterQuery,
        message: `${e.message}`,
      });
      return;
    }
  }

  async openPost(req: express.Request, res: express.Response): Promise<void> {
    const path = decodeURIComponent(
      req.path.slice(req.path.indexOf("/", 1) + 1)
    );

    const query = queryString.parseUrl(req.originalUrl, {
      parseBooleans: true,
    }).query;
    const newLeaf = Boolean(query.newLeaf);

    this.app.workspace.openLinkText(path, "/", newLeaf);

    res.json();
  }

  async certificateGet(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    res.set(
      "Content-type",
      `application/octet-stream; filename="${CERT_NAME}"`
    );
    res.status(200).send(this.settings.crypto.cert);
  }

  async openapiYamlGet(
    req: express.Request,
    res: express.Response
  ): Promise<void> {
    res.setHeader("Content-Type", "application/yaml; charset=utf-8");
    res.status(200).send(openapiYaml);
  }

  async notFoundHandler(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> {
    this.returnCannedResponse(res, {
      statusCode: 404,
    });
    return;
  }

  async errorHandler(
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): Promise<void> {
    if (err.stack) {
      console.error(err.stack);
    } else {
      console.error("No stack available!");
    }
    if (err instanceof SyntaxError) {
      this.returnCannedResponse(res, {
        errorCode: ErrorCode.InvalidContentForContentType,
      });
      return;
    }
    this.returnCannedResponse(res, {
      statusCode: 500,
      message: err.message,
    });
    return;
  }

  setupRouter() {
    this.api.use((req, res, next) => {
      const originalSend = res.send;
      res.send = function (body, ...args) {
        console.log(`[REST API] ${req.method} ${req.url} => ${res.statusCode}`);

        return originalSend.apply(res, [body, ...args]);
      };
      next();
    });
    this.api.use(responseTime());
    this.api.use(cors());
    this.api.use(this.authenticationMiddleware.bind(this));
    this.api.use(
      bodyParser.text({
        type: ContentTypes.dataviewDql,
        limit: MaximumRequestSize,
      })
    );
    this.api.use(
      bodyParser.json({
        type: ContentTypes.json,
        strict: false,
        limit: MaximumRequestSize,
      })
    );
    this.api.use(
      bodyParser.json({
        type: ContentTypes.olrapiNoteJson,
        strict: false,
        limit: MaximumRequestSize,
      })
    );
    this.api.use(
      bodyParser.json({
        type: ContentTypes.jsonLogic,
        strict: false,
        limit: MaximumRequestSize,
      })
    );
    this.api.use(
      bodyParser.text({ type: "text/*", limit: MaximumRequestSize })
    );
    this.api.use(bodyParser.raw({ type: "*/*", limit: MaximumRequestSize }));

    this.api
      .route("/active/")
      .get(this.activeFileGet.bind(this))
      .put(this.activeFilePut.bind(this))
      .patch(this.activeFilePatch.bind(this))
      .post(this.activeFilePost.bind(this))
      .delete(this.activeFileDelete.bind(this));

    this.api
      .route("/vault/*")
      .get(this.vaultGet.bind(this))
      .put(this.vaultPut.bind(this))
      .patch(this.vaultPatch.bind(this))
      .post(this.vaultPost.bind(this))
      .delete(this.vaultDelete.bind(this));

    this.api
      .route("/periodic/:period/")
      .get(this.periodicGet.bind(this))
      .put(this.periodicPut.bind(this))
      .patch(this.periodicPatch.bind(this))
      .post(this.periodicPost.bind(this))
      .delete(this.periodicDelete.bind(this));
    this.api
      .route("/periodic/:period/:year/:month/:day/")
      .get(this.periodicGet.bind(this))
      .put(this.periodicPut.bind(this))
      .patch(this.periodicPatch.bind(this))
      .post(this.periodicPost.bind(this))
      .delete(this.periodicDelete.bind(this));

    this.api.route("/commands/").get(this.commandGet.bind(this));
    this.api.route("/commands/:commandId/").post(this.commandPost.bind(this));

    this.api.route("/search/").post(this.searchQueryPost.bind(this));
    this.api.route("/search/simple/").post(this.searchSimplePost.bind(this));
    this.api.route("/search/advanced/").post(this.searchAdvancedPost.bind(this));

    this.api.route("/tags/").get(this.tagsGet.bind(this));
    this.api.route("/tags/:tagname/").get(this.tagGet.bind(this)).patch(this.tagPatch.bind(this));

    this.api.route("/open/*").post(this.openPost.bind(this));

    this.api.get(`/${CERT_NAME}`, this.certificateGet.bind(this));
    this.api.get("/openapi.yaml", this.openapiYamlGet.bind(this));
    this.api.get("/", this.root.bind(this));

    this.api.use(this.apiExtensionRouter);

    this.api.use(this.notFoundHandler.bind(this));
    this.api.use(this.errorHandler.bind(this));
  }
}
