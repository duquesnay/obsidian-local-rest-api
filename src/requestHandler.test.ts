import http from "http";
import request from "supertest";

import RequestHandler from "./requestHandler";
import { LocalRestApiSettings } from "./types";
import { CERT_NAME } from "./constants";
import {
  App,
  TFile,
  Command,
  HeadingCache,
  PluginManifest,
  CachedMetadata,
} from "../mocks/obsidian";

describe("requestHandler", () => {
  const API_KEY = "my api key";

  let settings: LocalRestApiSettings;
  let app: App;
  let manifest: PluginManifest;
  let handler: RequestHandler;
  let server: http.Server;

  beforeEach(() => {
    settings = getMockSettings();
    // This 'App' instance is actually a mock, and it doesn't define
    // quite a perfectly-matching interface for the actual Obsidian
    // App interface.
    app = new App();
    manifest = new PluginManifest();
    // @ts-ignore: Ignore missing App properties
    handler = new RequestHandler(app, manifest, settings);
    handler.setupRouter();
    server = http.createServer(handler.api);
  });

  afterEach(() => {
    server.close();
  });

  function getMockSettings(): LocalRestApiSettings {
    return {
      apiKey: API_KEY,
      crypto: {
        cert: "cert",
        privateKey: "privateKey",
        publicKey: "publicKey",
      },
      port: 1,
      insecurePort: 2,
      enableInsecureServer: false,
    };
  }
  describe("requestIsAuthenticated", () => {
    const arbitraryAuthenticatedRoute = "/vault/";

    test("missing header", async () => {
      await request(server).get(arbitraryAuthenticatedRoute).expect(401);
    });
    test("incorrect header", async () => {
      await request(server)
        .get(arbitraryAuthenticatedRoute)
        .set("Authorization", "Bearer of good tidings")
        .expect(401);
    });
    test("correct header", async () => {
      await request(server)
        .get(arbitraryAuthenticatedRoute)
        .set("Authorization", `Bearer ${API_KEY}`)
        .expect(200);
    });
  });

  describe("root", () => {
    test("withhout auth", async () => {
      const result = await request(server).get("/").expect(200);

      expect(result.body.status).toEqual("OK");
      expect(result.body.authenticated).toBeFalsy();
    });

    test("with auth", async () => {
      const result = await request(server)
        .get("/")
        .set("Authorization", `Bearer ${API_KEY}`)
        .expect(200);

      expect(result.body.status).toEqual("OK");
      expect(result.body.authenticated).toBeTruthy();
    });
  });

  describe("certificateGet", () => {
    const certPath = `/${CERT_NAME}`;

    test("withhout auth", async () => {
      const result = await request(server).get(certPath).expect(200);

      expect(result.body.toString()).toEqual(settings.crypto?.cert);
    });

    test("with auth", async () => {
      const result = await request(server)
        .get(certPath)
        .set("Authorization", `Bearer ${API_KEY}`)
        .expect(200);

      expect(result.body.toString()).toEqual(settings.crypto.cert);
    });
  });

  describe("vaultGet", () => {
    test("directory empty", async () => {
      app.vault._files = [];

      await request(server)
        .get("/vault/")
        .set("Authorization", `Bearer ${API_KEY}`)
        .expect(404);
    });

    test("directory with files", async () => {
      const arbitraryDirectory = "somewhere";

      const rootFile = new TFile();
      rootFile.path = "rootFile.md";

      const notRootFile = new TFile();
      notRootFile.path = `${arbitraryDirectory}/anotherFile.md`;

      app.vault._files = [rootFile, notRootFile];

      const result = await request(server)
        .get("/vault/")
        .set("Authorization", `Bearer ${API_KEY}`)
        .expect(200);

      expect(result.body.files).toEqual([
        rootFile.path,
        `${arbitraryDirectory}/`,
      ]);
    });

    test("unauthorized", async () => {
      const arbitraryFilename = "somefile.md";
      const arbitraryFileContent = "Beep boop";

      app.vault.adapter._read = arbitraryFileContent;

      await request(server).get(`/vault/${arbitraryFilename}`).expect(401);
    });

    test("file content", async () => {
      const arbitraryFilename = "somefile.md";
      const arbitraryFileContent = "Beep boop";
      const fileContentBuffer = new ArrayBuffer(arbitraryFileContent.length);
      const fileContentBufferView = new Uint8Array(fileContentBuffer);
      for (let i = 0; i < arbitraryFileContent.length; i++) {
        fileContentBufferView[i] = arbitraryFileContent.charCodeAt(i);
      }

      app.vault.adapter._readBinary = fileContentBuffer;

      const result = await request(server)
        .get(`/vault/${arbitraryFilename}`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .expect(200);

      expect(result.header["content-disposition"]).toEqual(
        `attachment; filename="${arbitraryFilename}"`
      );
      expect(result.header["content-type"]).toEqual(
        "text/markdown; charset=utf-8"
      );
      expect(result.text).toEqual(arbitraryFileContent);
    });

    test("file does not exist", async () => {
      const arbitraryFilename = "somefile.md";

      app.vault.adapter._exists = false;

      await request(server)
        .get(`/vault/${arbitraryFilename}`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .expect(404);
    });
  });

  describe("vaultPut", () => {
    test("directory", async () => {
      await request(server)
        .put("/vault/")
        .set("Authorization", `Bearer ${API_KEY}`)
        .expect(405);
    });

    test("unauthorized", async () => {
      const arbitraryFilePath = "somefile.md";
      const arbitraryBytes = "bytes";

      await request(server)
        .put(`/vault/${arbitraryFilePath}`)
        .set("Content-Type", "text/markdown")
        .send(arbitraryBytes)
        .expect(401);
    });

    test("acceptable content", async () => {
      const arbitraryFilePath = "somefile.md";
      const arbitraryBytes = "bytes";

      await request(server)
        .put(`/vault/${arbitraryFilePath}`)
        .set("Content-Type", "text/markdown")
        .set("Authorization", `Bearer ${API_KEY}`)
        .send(arbitraryBytes)
        .expect(204);

      expect(app.vault.adapter._write).toEqual([
        arbitraryFilePath,
        arbitraryBytes,
      ]);
    });

    test("acceptable binary content", async () => {
      const arbitraryFilePath = "test.png";
      const arbitraryBytes = "bytes"; // mock a picture binary

      await request(server)
        .put(`/vault/${arbitraryFilePath}`)
        .set("Content-Type", "image/jpeg")
        .set("Authorization", `Bearer ${API_KEY}`)
        .send(arbitraryBytes)
        .expect(204);

      expect(app.vault.adapter._writeBinary[0]).toEqual(arbitraryFilePath);
      const data = app.vault.adapter._writeBinary[1];
      expect(Buffer.isBuffer(data) || data instanceof ArrayBuffer).toEqual(
        true
      );
      // We won't be able to convert the incoming data
      // to bytes with this mechanism in a _normal_
      // situation because those bytes won't be encodable
      // as ASCII, but we can do this here because we're
      // lying about the incoming content type above
      const decoder = new TextDecoder();
      expect(decoder.decode(data)).toEqual(arbitraryBytes);
    });

    test("non-bytes content", async () => {
      const arbitraryFilePath = "somefile.md";
      const arbitraryBytes = "bytes";

      await request(server)
        .put(`/vault/${arbitraryFilePath}`)
        .set("Content-Type", "application/json")
        .set("Authorization", `Bearer ${API_KEY}`)
        .send(arbitraryBytes)
        .expect(400);

      expect(app.vault.adapter._write).toBeUndefined();
    });
  });

  describe("vaultPost", () => {
    test("directory", async () => {
      await request(server)
        .post("/vault/")
        .set("Authorization", `Bearer ${API_KEY}`)
        .expect(405);
    });

    test("unauthorized", async () => {
      const arbitraryFilePath = "somefile.md";
      const arbitraryBytes = "bytes";

      const arbitraryExistingBytes = "something\nsomething\n";

      app.vault._read = arbitraryExistingBytes;

      await request(server)
        .post(`/vault/${arbitraryFilePath}`)
        .set("Content-Type", "text/markdown")
        .send(arbitraryBytes)
        .expect(401);
    });

    describe("acceptable content", () => {
      test("existing with trailing newline", async () => {
        const arbitraryFilePath = "somefile.md";
        const arbitraryBytes = "bytes";

        const arbitraryExistingBytes = "something\nsomething\n";

        app.vault._read = arbitraryExistingBytes;

        await request(server)
          .post(`/vault/${arbitraryFilePath}`)
          .set("Content-Type", "text/markdown")
          .set("Authorization", `Bearer ${API_KEY}`)
          .send(arbitraryBytes)
          .expect(204);

        expect(app.vault.adapter._write).toEqual([
          arbitraryFilePath,
          arbitraryExistingBytes + arbitraryBytes,
        ]);
      });

      test("existing without trailing newline", async () => {
        const arbitraryFilePath = "somefile.md";
        const arbitraryBytes = "bytes";

        const arbitraryExistingBytes = "something\nsomething";

        app.vault._read = arbitraryExistingBytes;

        await request(server)
          .post(`/vault/${arbitraryFilePath}`)
          .set("Content-Type", "text/markdown")
          .set("Authorization", `Bearer ${API_KEY}`)
          .send(arbitraryBytes)
          .expect(204);

        expect(app.vault.adapter._write).toEqual([
          arbitraryFilePath,
          arbitraryExistingBytes + "\n" + arbitraryBytes,
        ]);
      });
    });

    test("non-bytes content", async () => {
      const arbitraryFilePath = "somefile.md";
      const arbitraryBytes = "bytes";

      await request(server)
        .post(`/vault/${arbitraryFilePath}`)
        .set("Content-Type", "application/json")
        .set("Authorization", `Bearer ${API_KEY}`)
        .send(arbitraryBytes)
        .expect(400);

      expect(app.vault.adapter._write).toBeUndefined();
    });

    describe("directory operations", () => {
      describe("create directory", () => {
        test("successful directory creation", async () => {
          const dirPath = "new-folder";
          
          // Mock directory doesn't exist
          app.vault.adapter.exists = jest.fn().mockResolvedValue(false);
          app.vault._files = []; // No conflicting files
          
          // Mock createFolder
          app.vault.createFolder = jest.fn().mockResolvedValue(undefined);
          
          const response = await request(server)
            .post(`/vault/${dirPath}`)
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Target-Type", "directory")
            .expect(201);
            
          expect(response.body.message).toEqual("Directory successfully created");
          expect(response.body.path).toEqual(dirPath);
          expect(app.vault.createFolder).toHaveBeenCalledWith(dirPath);
        });

        test("directory already exists", async () => {
          const dirPath = "existing-folder";
          
          // Mock directory exists
          app.vault.adapter.exists = jest.fn().mockResolvedValue(true);
          
          const response = await request(server)
            .post(`/vault/${dirPath}`)
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Target-Type", "directory")
            .expect(409);
            
          expect(response.body.message).toEqual("Directory already exists");
        });

        test("conflicting file exists", async () => {
          const dirPath = "conflict.md";
          
          // Mock directory doesn't exist
          app.vault.adapter.exists = jest.fn().mockResolvedValue(false);
          
          // Mock conflicting file
          const conflictingFile = new TFile();
          conflictingFile.path = "conflict.md";
          app.vault._files = [conflictingFile];
          
          const response = await request(server)
            .post(`/vault/${dirPath}`)
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Target-Type", "directory")
            .expect(409);
            
          expect(response.body.message).toEqual("A file with the same path already exists");
        });

        test("invalid directory path ending with slash", async () => {
          const response = await request(server)
            .post("/vault/folder/")
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Target-Type", "directory")
            .expect(400);
            
          expect(response.body.message).toEqual("Directory path is required and should not end with '/'");
        });

        test("empty directory path", async () => {
          const response = await request(server)
            .post("/vault/")
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Target-Type", "directory")
            .expect(400);
            
          expect(response.body.message).toEqual("Directory path is required and should not end with '/'");
        });

        test("unauthorized request", async () => {
          const response = await request(server)
            .post("/vault/new-folder")
            .set("Target-Type", "directory")
            .expect(401);
        });

        test("createFolder fails", async () => {
          const dirPath = "fail-folder";
          
          // Mock directory doesn't exist
          app.vault.adapter.exists = jest.fn().mockResolvedValue(false);
          app.vault._files = [];
          
          // Mock createFolder to fail
          app.vault.createFolder = jest.fn().mockRejectedValue(new Error("Permission denied"));
          
          const response = await request(server)
            .post(`/vault/${dirPath}`)
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Target-Type", "directory")
            .expect(500);
            
          expect(response.body.message).toEqual("Failed to create directory: Permission denied");
        });
      });
    });
  });

  describe("vaultDelete", () => {
    test("directory", async () => {
      await request(server)
        .delete("/vault/")
        .set("Authorization", `Bearer ${API_KEY}`)
        .expect(405);
    });

    test("directory path without Target-Type returns 405 for backward compatibility", async () => {
      // Mock that path exists but is not a file (it's a directory)
      app.vault.adapter._exists = true;
      app.vault._markdownFiles = []; // No files with this exact path
      
      await request(server)
        .delete("/vault/some-directory")
        .set("Authorization", `Bearer ${API_KEY}`)
        .expect(405);
    });

    test("directory path with Target-Type: file returns 405", async () => {
      app.vault.adapter._exists = true;
      app.vault._markdownFiles = [];
      
      await request(server)
        .delete("/vault/some-directory")
        .set("Authorization", `Bearer ${API_KEY}`)
        .set("Target-Type", "file")
        .expect(405);
    });

    test("non-existing file", async () => {
      const arbitraryFilePath = "somefile.md";
      const arbitraryBytes = "bytes";

      app.vault.adapter._exists = false;

      await request(server)
        .delete(`/vault/${arbitraryFilePath}`)
        .set("Content-Type", "text/markdown")
        .set("Authorization", `Bearer ${API_KEY}`)
        .send(arbitraryBytes)
        .expect(404);

      expect(app.vault.adapter._remove).toBeUndefined();
    });

    test("unauthorized", async () => {
      const arbitraryFilePath = "somefile.md";
      const arbitraryBytes = "bytes";

      await request(server)
        .delete(`/vault/${arbitraryFilePath}`)
        .set("Content-Type", "text/markdown")
        .send(arbitraryBytes)
        .expect(401);
    });

    test("existing file", async () => {
      const arbitraryFilePath = "somefile.md";
      const arbitraryBytes = "bytes";

      await request(server)
        .delete(`/vault/${arbitraryFilePath}`)
        .set("Content-Type", "text/markdown")
        .set("Authorization", `Bearer ${API_KEY}`)
        .send(arbitraryBytes)
        .expect(204);

      expect(app.vault.adapter._remove).toEqual([arbitraryFilePath]);
    });

    describe("directory operations", () => {
      describe("delete directory", () => {
        test("successful directory deletion (move to trash)", async () => {
          const dirPath = "folder-to-delete";
          
          // Mock directory exists
          app.vault.adapter.exists = jest.fn().mockResolvedValue(true);
          app.vault._files = []; // No conflicting files at exact path
          
          // Mock files in directory
          const file1 = new TFile();
          file1.path = "folder-to-delete/file1.md";
          const file2 = new TFile();
          file2.path = "folder-to-delete/subfolder/file2.md";
          
          app.vault._files = [file1, file2];
          
          // Mock trash function
          app.vault.trash = jest.fn().mockResolvedValue(undefined);
          
          // Mock adapter list and rmdir for cleanup
          (app.vault.adapter as any).list = jest.fn()
            .mockResolvedValue({ files: [], folders: [] });
          (app.vault.adapter as any).rmdir = jest.fn().mockResolvedValue(undefined);
          
          const response = await request(server)
            .delete(`/vault/${dirPath}`)
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Target-Type", "directory")
            .expect(200);
            
          expect(response.body.message).toEqual("Directory moved to trash");
          expect(response.body.path).toEqual(dirPath);
          expect(response.body.deletedFilesCount).toEqual(2);
          expect(response.body.permanent).toEqual(false);
          expect(app.vault.trash).toHaveBeenCalledWith(file1, false);
          expect(app.vault.trash).toHaveBeenCalledWith(file2, false);
        });

        test("successful directory deletion (permanent)", async () => {
          const dirPath = "folder-to-delete";
          
          // Mock directory exists
          app.vault.adapter.exists = jest.fn().mockResolvedValue(true);
          app.vault._files = []; // No conflicting files at exact path
          
          // Mock files in directory
          const file1 = new TFile();
          file1.path = "folder-to-delete/file1.md";
          
          app.vault._files = [file1];
          
          // Mock remove function for permanent deletion
          app.vault.adapter.remove = jest.fn().mockResolvedValue(undefined);
          
          // Mock adapter list and rmdir for cleanup
          (app.vault.adapter as any).list = jest.fn()
            .mockResolvedValue({ files: [], folders: [] });
          (app.vault.adapter as any).rmdir = jest.fn().mockResolvedValue(undefined);
          
          const response = await request(server)
            .delete(`/vault/${dirPath}`)
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Target-Type", "directory")
            .set("Permanent", "true")
            .expect(200);
            
          expect(response.body.message).toEqual("Directory permanently deleted");
          expect(response.body.permanent).toEqual(true);
          expect(app.vault.adapter.remove).toHaveBeenCalledWith(file1.path);
        });

        test("directory not found", async () => {
          const dirPath = "nonexistent-folder";
          
          // Mock directory doesn't exist
          app.vault.adapter.exists = jest.fn().mockResolvedValue(false);
          
          const response = await request(server)
            .delete(`/vault/${dirPath}`)
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Target-Type", "directory")
            .expect(404);
        });

        test("path is a file, not directory", async () => {
          const filePath = "somefile.md";
          
          // Mock path exists
          app.vault.adapter.exists = jest.fn().mockResolvedValue(true);
          
          // Mock file at the exact path
          const exactFile = new TFile();
          exactFile.path = "somefile.md";
          app.vault._files = [exactFile];
          
          const response = await request(server)
            .delete(`/vault/${filePath}`)
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Target-Type", "directory")
            .expect(400);
            
          expect(response.body.message).toEqual("Path is a file, not a directory");
        });

        test("invalid directory path ending with slash", async () => {
          const response = await request(server)
            .delete("/vault/folder/")
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Target-Type", "directory")
            .expect(400);
            
          expect(response.body.message).toEqual("Directory path is required and should not end with '/'");
        });

        test("empty directory path", async () => {
          const response = await request(server)
            .delete("/vault/")
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Target-Type", "directory")
            .expect(400);
            
          expect(response.body.message).toEqual("Directory path is required and should not end with '/'");
        });

        test("unauthorized request", async () => {
          const response = await request(server)
            .delete("/vault/folder-to-delete")
            .set("Target-Type", "directory")
            .expect(401);
        });

        test("deletion fails", async () => {
          const dirPath = "fail-folder";
          
          // Mock directory exists
          app.vault.adapter.exists = jest.fn().mockResolvedValue(true);
          app.vault._files = [];
          
          // Mock file in directory
          const file1 = new TFile();
          file1.path = "fail-folder/file1.md";
          app.vault._files = [file1];
          
          // Mock trash to fail
          app.vault.trash = jest.fn().mockRejectedValue(new Error("Permission denied"));
          
          const response = await request(server)
            .delete(`/vault/${dirPath}`)
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Target-Type", "directory")
            .expect(500);
            
          expect(response.body.message).toEqual("Failed to delete directory: Permission denied");
        });
      });
    });
  });

  describe("vaultPatch", () => {
    test("directory", async () => {
      await request(server)
        .patch("/vault/")
        .set("Authorization", `Bearer ${API_KEY}`)
        .expect(405);
    });

    test("missing heading header", async () => {
      const arbitraryFilePath = "somefile.md";
      const arbitraryBytes = "bytes";
      const arbitraryHeading = "somewhere";

      const arbitraryExistingBytes = "something\nsomething";

      const headingCache = new HeadingCache();
      headingCache.heading = arbitraryHeading;

      app.vault._read = arbitraryExistingBytes;
      app.metadataCache._getFileCache.headings.push(headingCache);

      await request(server)
        .patch(`/vault/${arbitraryFilePath}`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .set("Content-Type", "text/markdown")
        .send(arbitraryBytes)
        .expect(400);
    });

    test("non-bytes content", async () => {
      const arbitraryFilePath = "somefile.md";
      const arbitraryBytes = "bytes";
      const arbitraryHeading = "somewhere";

      const arbitraryExistingBytes = "something\nsomething";

      const headingCache = new HeadingCache();
      headingCache.heading = arbitraryHeading;

      app.vault._read = arbitraryExistingBytes;
      app.metadataCache._getFileCache.headings.push(headingCache);

      await request(server)
        .patch(`/vault/${arbitraryFilePath}`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .set("Heading", arbitraryHeading)
        .send(arbitraryBytes)
        .expect(400);
    });

    test("non-existing file", async () => {
      const arbitraryFilePath = "somefile.md";
      const arbitraryBytes = "bytes";
      const arbitraryHeading = "somewhere";

      const arbitraryExistingBytes = "something\nsomething";

      const headingCache = new HeadingCache();
      headingCache.heading = arbitraryHeading;

      app.vault._read = arbitraryExistingBytes;
      app.metadataCache._getFileCache.headings.push(headingCache);
      app.vault._getAbstractFileByPath = null;

      await request(server)
        .patch(`/vault/${arbitraryFilePath}`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .set("Content-Type", "text/markdown")
        .set("Heading", arbitraryHeading)
        .send(arbitraryBytes)
        .expect(404);
    });

    test("unauthorized", async () => {
      const arbitraryFilePath = "somefile.md";
      const arbitraryBytes = "bytes";
      const arbitraryHeading = "somewhere";

      const arbitraryExistingBytes = "something\nsomething";

      const headingCache = new HeadingCache();
      headingCache.heading = arbitraryHeading;

      app.vault._read = arbitraryExistingBytes;
      app.metadataCache._getFileCache.headings.push(headingCache);

      await request(server)
        .patch(`/vault/${arbitraryFilePath}`)
        .set("Content-Type", "text/markdown")
        .set("Heading", arbitraryHeading)
        .set("Content-Insertion-Position", "beginning")
        .send(arbitraryBytes)
        .expect(401);
    });

    describe("acceptable content", () => {
      // Unfortunately, testing the actual written content would be
      // extremely brittle given that we're relying on private Obsidian
      // API interfaces; so we're just going to verify that we get
      // a 200 and that a write occurs :shrug:

      test("undefined content-insertion-position", async () => {
        const arbitraryFilePath = "somefile.md";
        const arbitraryBytes = "bytes";
        const arbitraryHeading = "somewhere";

        const arbitraryExistingBytes = "something\nsomething";

        const headingCache = new HeadingCache();
        headingCache.heading = arbitraryHeading;

        app.vault._read = arbitraryExistingBytes;
        app.metadataCache._getFileCache.headings.push(headingCache);

        const result = await request(server)
          .patch(`/vault/${arbitraryFilePath}`)
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "text/markdown")
          .set("Heading", arbitraryHeading)
          .send(arbitraryBytes)
          .expect(200);

        expect(app.vault.adapter.write).toBeTruthy();
        expect(result.text).toBeTruthy();
      });

      test("beginning content-insertion-position", async () => {
        const arbitraryFilePath = "somefile.md";
        const arbitraryBytes = "bytes";
        const arbitraryHeading = "somewhere";

        const arbitraryExistingBytes = "something\nsomething";

        const headingCache = new HeadingCache();
        headingCache.heading = arbitraryHeading;

        app.vault._read = arbitraryExistingBytes;
        app.metadataCache._getFileCache.headings.push(headingCache);

        const result = await request(server)
          .patch(`/vault/${arbitraryFilePath}`)
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "text/markdown")
          .set("Heading", arbitraryHeading)
          .set("Content-Insertion-Position", "beginning")
          .send(arbitraryBytes)
          .expect(200);

        expect(app.vault.adapter.write).toBeTruthy();
        expect(result.text).toBeTruthy();
        expect(result.text).toEqual("bytes\nsomething\nsomething");
      });

      test("end content-insertion-position", async () => {
        const arbitraryFilePath = "somefile.md";
        const arbitraryBytes = "bytes";
        const arbitraryHeading = "somewhere";

        const arbitraryExistingBytes = "something\nsomething";

        const headingCache = new HeadingCache();
        headingCache.heading = arbitraryHeading;

        app.vault._read = arbitraryExistingBytes;
        app.metadataCache._getFileCache.headings.push(headingCache);

        const result = await request(server)
          .patch(`/vault/${arbitraryFilePath}`)
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "text/markdown")
          .set("Heading", arbitraryHeading)
          .set("Content-Insertion-Position", "end")
          .send(arbitraryBytes)
          .expect(200);

        expect(app.vault.adapter.write).toBeTruthy();
        expect(result.text).toBeTruthy();
        expect(result.text).toEqual("something\nsomething\nbytes");
      });

      test("beginning content-insertion-position with header", async () => {
        const arbitraryFilePath = "somefile.md";
        const arbitraryBytes = "bytes";
        const arbitraryHeading = "Heading1";

        const arbitraryExistingBytes =
          "something\n\n# Heading1\ncontent here\n# Heading2\nsomething";
        app.vault._read = arbitraryExistingBytes;

        // Heading 1
        let headingCache = new HeadingCache();
        headingCache.heading = arbitraryHeading;

        headingCache.position.end.line = 2;
        headingCache.position.start.line = 2;
        app.metadataCache._getFileCache.headings.push(headingCache);

        // Heading 2
        headingCache = new HeadingCache();
        headingCache.heading = "Heading2";

        headingCache.position.end.line = 4;
        headingCache.position.start.line = 4;
        app.metadataCache._getFileCache.headings.push(headingCache);

        const result = await request(server)
          .patch(`/vault/${arbitraryFilePath}`)
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "text/markdown")
          .set("Heading", arbitraryHeading)
          .set("Content-Insertion-Position", "beginning")
          .send(arbitraryBytes)
          .expect(200);

        expect(app.vault.adapter.write).toBeTruthy();
        expect(result.text).toBeTruthy();
        expect(result.text).toEqual(
          "something\n\n# Heading1\nbytes\ncontent here\n# Heading2\nsomething"
        );
      });

      test("end content-insertion-position with header", async () => {
        const arbitraryFilePath = "somefile.md";
        const arbitraryBytes = "bytes";
        const arbitraryHeading = "Heading1";

        const arbitraryExistingBytes =
          "something\n\n# Heading1\ncontent here\n# Heading2\nsomething";
        app.vault._read = arbitraryExistingBytes;

        // Heading 1
        let headingCache = new HeadingCache();
        headingCache.heading = arbitraryHeading;

        headingCache.position.end.line = 2;
        headingCache.position.start.line = 2;
        app.metadataCache._getFileCache.headings.push(headingCache);

        // Heading 2
        headingCache = new HeadingCache();
        headingCache.heading = "Heading2";

        headingCache.position.end.line = 4;
        headingCache.position.start.line = 4;
        app.metadataCache._getFileCache.headings.push(headingCache);

        const result = await request(server)
          .patch(`/vault/${arbitraryFilePath}`)
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "text/markdown")
          .set("Heading", arbitraryHeading)
          .set("Content-Insertion-Position", "end")
          .send(arbitraryBytes)
          .expect(200);

        expect(app.vault.adapter.write).toBeTruthy();
        expect(result.text).toBeTruthy();
        expect(result.text).toEqual(
          "something\n\n# Heading1\ncontent here\nbytes\n# Heading2\nsomething"
        );
      });

      test("end content-insertion-position with header (new lines at end of header block)", async () => {
        const arbitraryFilePath = "somefile.md";
        const arbitraryBytes = "bytes";
        const arbitraryHeading = "Heading1";

        const arbitraryExistingBytes =
          "something\n\n# Heading1\ncontent here\n\n\n# Heading2\nsomething";
        app.vault._read = arbitraryExistingBytes;

        // Heading 1
        let headingCache = new HeadingCache();
        headingCache.heading = arbitraryHeading;

        headingCache.position.end.line = 2;
        headingCache.position.start.line = 2;
        app.metadataCache._getFileCache.headings.push(headingCache);

        // Heading 2
        headingCache = new HeadingCache();
        headingCache.heading = "Heading2";

        headingCache.position.end.line = 6;
        headingCache.position.start.line = 6;
        app.metadataCache._getFileCache.headings.push(headingCache);

        const result = await request(server)
          .patch(`/vault/${arbitraryFilePath}`)
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "text/markdown")
          .set("Heading", arbitraryHeading)
          .set("Content-Insertion-Position", "end")
          .send(arbitraryBytes)
          .expect(200);

        expect(app.vault.adapter.write).toBeTruthy();
        expect(result.text).toBeTruthy();
        expect(result.text).toEqual(
          "something\n\n# Heading1\ncontent here\n\n\nbytes\n# Heading2\nsomething"
        );
      });

      test("end content-insertion-position with header ignore newlines", async () => {
        const arbitraryFilePath = "somefile.md";
        const arbitraryBytes = "bytes";
        const arbitraryHeading = "Heading1";

        const arbitraryExistingBytes =
          "something\n\n# Heading1\ncontent here\n\n\n# Heading2\nsomething";
        app.vault._read = arbitraryExistingBytes;

        // Heading 1
        let headingCache = new HeadingCache();
        headingCache.heading = arbitraryHeading;

        headingCache.position.end.line = 2;
        headingCache.position.start.line = 2;
        app.metadataCache._getFileCache.headings.push(headingCache);

        // Heading 2
        headingCache = new HeadingCache();
        headingCache.heading = "Heading2";

        headingCache.position.end.line = 6;
        headingCache.position.start.line = 6;
        app.metadataCache._getFileCache.headings.push(headingCache);

        const result = await request(server)
          .patch(`/vault/${arbitraryFilePath}`)
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "text/markdown")
          .set("Heading", arbitraryHeading)
          .set("Content-Insertion-Position", "end")
          .set("Content-Insertion-Ignore-Newline", "true")
          .send(arbitraryBytes)
          .expect(200);

        expect(app.vault.adapter.write).toBeTruthy();
        expect(result.text).toBeTruthy();
        expect(result.text).toEqual(
          "something\n\n# Heading1\ncontent here\nbytes\n\n\n# Heading2\nsomething"
        );
      });
    });

    describe("file rename operation", () => {
      test("successful rename with Target-Type: file, Target: name", async () => {
        const oldPath = "folder/old-file.md";
        const newFilename = "new-file.md";
        const expectedNewPath = "folder/new-file.md";
        
        // Mock file exists
        const mockFile = new TFile();
        app.vault._getAbstractFileByPath = mockFile;
        app.vault.adapter._exists = false; // destination doesn't exist
        
        // Mock fileManager
        (app as any).fileManager = {
          renameFile: jest.fn().mockResolvedValue(undefined)
        };
        
        const response = await request(server)
          .patch(`/vault/${oldPath}`)
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "text/plain")
          .set("Operation", "replace")
          .set("Target-Type", "file")
          .set("Target", "name")
          .send(newFilename)
          .expect(200);
          
        expect(response.body.message).toEqual("File successfully renamed");
        expect(response.body.oldPath).toEqual(oldPath);
        expect(response.body.newPath).toEqual(expectedNewPath);
        expect((app as any).fileManager.renameFile).toHaveBeenCalledWith(mockFile, expectedNewPath);
      });

      test("rename fails with non-existent file", async () => {
        // Mock file doesn't exist
        app.vault._getAbstractFileByPath = null;
        
        const response = await request(server)
          .patch("/vault/non-existent.md")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "text/plain")
          .set("Operation", "replace")
          .set("Target-Type", "file")
          .set("Target", "name")
          .send("new-name.md")
          .expect(404);
      });

      test("rename fails when destination exists", async () => {
        const oldPath = "folder/old-file.md";
        const newFilename = "existing-file.md";
        
        // Mock file exists
        const mockFile = new TFile();
        app.vault._getAbstractFileByPath = mockFile;
        app.vault.adapter._exists = true; // destination already exists
        
        const response = await request(server)
          .patch(`/vault/${oldPath}`)
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "text/plain")
          .set("Operation", "replace")
          .set("Target-Type", "file")
          .set("Target", "name")
          .send(newFilename)
          .expect(409);
          
        expect(response.body.message).toContain("Destination file already exists");
      });
    });

    describe("file move operation", () => {
      test("successful move with Operation: move, Target: path", async () => {
        const oldPath = "folder1/file.md";
        const newPath = "folder2/subfolder/file.md";
        
        // Mock file exists
        const mockFile = new TFile();
        app.vault._getAbstractFileByPath = mockFile;
        app.vault.adapter._exists = false; // destination doesn't exist
        
        // Mock createFolder
        app.vault.createFolder = jest.fn().mockResolvedValue(undefined);
        
        // Mock fileManager
        (app as any).fileManager = {
          renameFile: jest.fn().mockResolvedValue(undefined)
        };
        
        const response = await request(server)
          .patch(`/vault/${oldPath}`)
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "text/plain")
          .set("Operation", "move")
          .set("Target-Type", "file")
          .set("Target", "path")
          .send(newPath)
          .expect(200);
          
        expect(response.body.message).toEqual("File successfully moved");
        expect(response.body.oldPath).toEqual(oldPath);
        expect(response.body.newPath).toEqual(newPath);
        expect(app.vault.createFolder).toHaveBeenCalledWith("folder2/subfolder");
        expect((app as any).fileManager.renameFile).toHaveBeenCalledWith(mockFile, newPath);
      });

      test("move fails with non-existent file", async () => {
        // Mock file doesn't exist
        app.vault._getAbstractFileByPath = null;
        
        const response = await request(server)
          .patch("/vault/non-existent.md")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "text/plain")
          .set("Operation", "move")
          .set("Target-Type", "file")
          .set("Target", "path")
          .send("new-location/file.md")
          .expect(404);
      });

      test("move fails when destination exists", async () => {
        const oldPath = "folder/old-file.md";
        const newPath = "existing/location/file.md";
        
        // Mock file exists
        const mockFile = new TFile();
        app.vault._getAbstractFileByPath = mockFile;
        app.vault.adapter._exists = true; // destination already exists
        
        const response = await request(server)
          .patch(`/vault/${oldPath}`)
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "text/plain")
          .set("Operation", "move")
          .set("Target-Type", "file")
          .set("Target", "path")
          .send(newPath)
          .expect(409);
          
        expect(response.body.message).toContain("Destination file already exists");
      });

      test("move operation must use Target: path", async () => {
        const response = await request(server)
          .patch("/vault/file.md")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "text/plain")
          .set("Operation", "move")
          .set("Target-Type", "file")
          .set("Target", "name") // Wrong target for move
          .send("folder/file.md")
          .expect(400);
          
        expect(response.body.message).toContain("move operation must use Target: path");
      });

      test("move operation only valid with file target type", async () => {
        const response = await request(server)
          .patch("/vault/file.md")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "text/plain")
          .set("Operation", "move")
          .set("Target-Type", "heading") // Wrong target type
          .set("Target", "path")
          .send("new-path.md")
          .expect(400);
          
        expect(response.body.message).toContain("Operation 'move' is only valid for Target-Type: file");
      });
    });
  });

  describe("commandGet", () => {
    test("acceptable", async () => {
      const arbitraryCommand = new Command();
      arbitraryCommand.id = "beep";
      arbitraryCommand.name = "boop";

      app.commands.commands[arbitraryCommand.id] = arbitraryCommand;

      const result = await request(server)
        .get(`/commands/`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .expect(200);

      expect(result.body.commands).toEqual([
        {
          id: arbitraryCommand.id,
          name: arbitraryCommand.name,
        },
      ]);
    });

    test("unauthorized", async () => {
      const arbitraryCommand = new Command();
      arbitraryCommand.id = "beep";
      arbitraryCommand.name = "boop";

      app.commands.commands[arbitraryCommand.id] = arbitraryCommand;

      await request(server).get(`/commands/`).expect(401);
    });
  });

  describe("commandPost", () => {
    test("acceptable", async () => {
      const arbitraryCommand = new Command();
      arbitraryCommand.id = "beep";
      arbitraryCommand.name = "boop";

      app.commands.commands[arbitraryCommand.id] = arbitraryCommand;

      await request(server)
        .post(`/commands/${arbitraryCommand.id}/`)
        .set("Authorization", `Bearer ${API_KEY}`)
        .expect(204);

      expect(app._executeCommandById).toEqual([arbitraryCommand.id]);
    });

    test("unauthorized", async () => {
      const arbitraryCommand = new Command();
      arbitraryCommand.id = "beep";
      arbitraryCommand.name = "boop";

      app.commands.commands[arbitraryCommand.id] = arbitraryCommand;

      await request(server)
        .post(`/commands/${arbitraryCommand.id}`)
        .expect(401);
    });
  });

  describe("vaultPatch - file operations", () => {
    describe("file operations with replace (should fail)", () => {
      test("replace operation with file target should fail", async () => {
        const oldPath = "folder/old-file.md";
        const newFilename = "new-file.md";
        
        // Mock file exists
        const mockFile = new TFile();
        app.vault._getAbstractFileByPath = mockFile;
        
        const response = await request(server)
          .patch(`/vault/${oldPath}`)
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "text/plain")
          .set("Operation", "replace")
          .set("Target-Type", "file")
          .set("Target", "name")
          .send(newFilename)
          .expect(400);
          
        // Should get an error because replace is not valid for file operations
        expect(response.body.errorCode).toBeDefined();
      });
    });

    describe("semantic file operations", () => {
      describe("Operation: rename", () => {
        test("successful rename with semantic operation", async () => {
          const oldPath = "folder/old-file.md";
          const newFilename = "new-file.md";
          const expectedNewPath = "folder/new-file.md";
          
          // Mock file exists
          const mockFile = new TFile();
          app.vault._getAbstractFileByPath = mockFile;
          app.vault.adapter._exists = false; // destination doesn't exist
          
          // Mock fileManager
          (app as any).fileManager = {
            renameFile: jest.fn().mockResolvedValue(undefined)
          };
          
          const response = await request(server)
            .patch(`/vault/${oldPath}`)
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Content-Type", "text/plain")
            .set("Operation", "rename")
            .set("Target-Type", "file")
            .set("Target", "name")
            .send(newFilename)
            .expect(200);
            
          expect(response.body.message).toEqual("File successfully renamed");
          expect(response.body.oldPath).toEqual(oldPath);
          expect(response.body.newPath).toEqual(expectedNewPath);
          expect((app as any).fileManager.renameFile).toHaveBeenCalledWith(mockFile, expectedNewPath);
        });

        test("rename operation must use Target: name", async () => {
          const response = await request(server)
            .patch("/vault/file.md")
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Content-Type", "text/plain")
            .set("Operation", "rename")
            .set("Target-Type", "file")
            .set("Target", "path") // Wrong target for rename
            .send("new-name.md")
            .expect(400);
            
          expect(response.body.message).toContain("rename operation must use Target: name");
        });

        test("rename operation only valid with file target type", async () => {
          const response = await request(server)
            .patch("/vault/file.md")
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Content-Type", "text/plain")
            .set("Operation", "rename")
            .set("Target-Type", "heading") // Wrong target type
            .set("Target", "name")
            .send("new-name.md")
            .expect(400);
            
          expect(response.body.message).toContain("Operation 'rename' is only valid for Target-Type: file");
        });
      });

      describe("Operation: move", () => {
        test("successful move with semantic operation", async () => {
          const oldPath = "folder1/file.md";
          const newPath = "folder2/subfolder/file.md";
          
          // Mock file exists
          const mockFile = new TFile();
          app.vault._getAbstractFileByPath = mockFile;
          app.vault.adapter._exists = false; // destination doesn't exist
          
          // Mock createFolder
          app.vault.createFolder = jest.fn().mockResolvedValue(undefined);
          
          // Mock fileManager
          (app as any).fileManager = {
            renameFile: jest.fn().mockResolvedValue(undefined)
          };
          
          const response = await request(server)
            .patch(`/vault/${oldPath}`)
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Content-Type", "text/plain")
            .set("Operation", "move")
            .set("Target-Type", "file")
            .set("Target", "path")
            .send(newPath)
            .expect(200);
            
          expect(response.body.message).toEqual("File successfully moved");
          expect(response.body.oldPath).toEqual(oldPath);
          expect(response.body.newPath).toEqual(newPath);
          expect(app.vault.createFolder).toHaveBeenCalledWith("folder2/subfolder");
          expect((app as any).fileManager.renameFile).toHaveBeenCalledWith(mockFile, newPath);
        });

        test("move operation must use Target: path", async () => {
          const response = await request(server)
            .patch("/vault/file.md")
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Content-Type", "text/plain")
            .set("Operation", "move")
            .set("Target-Type", "file")
            .set("Target", "name") // Wrong target for move
            .send("folder/file.md")
            .expect(400);
            
          expect(response.body.message).toContain("move operation must use Target: path");
        });

        test("move operation only valid with file or directory target type", async () => {
          const response = await request(server)
            .patch("/vault/file.md")
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Content-Type", "text/plain")
            .set("Operation", "move")
            .set("Target-Type", "block") // Wrong target type
            .set("Target", "path")
            .send("new-path.md")
            .expect(400);
            
          expect(response.body.message).toContain("Operation 'move' is only valid for Target-Type: file or directory");
        });
      });

    });

    describe("directory operations", () => {
      describe("Operation: move", () => {
        test("successful directory move", async () => {
          const oldPath = "folder1/subfolder";
          const newPath = "folder2/moved-subfolder";
          
          // Mock directory exists for source, not for destination
          let existsCallCount = 0;
          app.vault.adapter.exists = jest.fn().mockImplementation((path) => {
            existsCallCount++;
            if (existsCallCount === 1) return Promise.resolve(true); // source exists
            if (existsCallCount === 2) return Promise.resolve(false); // destination doesn't exist
            return Promise.resolve(false);
          });
          app.vault.adapter._stat.type = "folder";
          
          // Mock files in directory
          const file1 = new TFile();
          file1.path = "folder1/subfolder/file1.md";
          const file2 = new TFile();
          file2.path = "folder1/subfolder/nested/file2.md";
          
          app.vault._files = [file1, file2];
          
          // Mock createFolder
          app.vault.createFolder = jest.fn().mockResolvedValue(undefined);
          
          // Mock fileManager
          (app as any).fileManager = {
            renameFile: jest.fn().mockResolvedValue(undefined)
          };
          
          // Mock adapter list and rmdir for cleanup
          (app.vault.adapter as any).list = jest.fn()
            .mockResolvedValueOnce({ files: [], folders: [] }) // Empty directory for cleanup
            .mockResolvedValueOnce({ files: [], folders: [] }); // Empty directory for cleanup
          (app.vault.adapter as any).rmdir = jest.fn().mockResolvedValue(undefined);
          
          const response = await request(server)
            .patch(`/vault/${oldPath}`)
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Content-Type", "text/plain")
            .set("Operation", "move")
            .set("Target-Type", "directory")
            .set("Target", "path")
            .send(newPath)
            .expect(200);
            
          expect(response.body.message).toEqual("Directory successfully moved");
          expect(response.body.oldPath).toEqual(oldPath);
          expect(response.body.newPath).toEqual(newPath);
          expect(response.body.filesMovedCount).toEqual(2);
          
          // Verify files were moved
          expect((app as any).fileManager.renameFile).toHaveBeenCalledWith(file1, `${newPath}/file1.md`);
          expect((app as any).fileManager.renameFile).toHaveBeenCalledWith(file2, `${newPath}/nested/file2.md`);
        });

        test("directory move with destination already exists", async () => {
          const oldPath = "folder1";
          const newPath = "folder2";
          
          // Mock source directory exists
          app.vault.adapter._exists = true;
          app.vault.adapter._stat.type = "folder";
          
          // Set up mock to return true for destination exists check
          let existsCallCount = 0;
          app.vault.adapter.exists = jest.fn().mockImplementation((path) => {
            existsCallCount++;
            if (existsCallCount === 1) return Promise.resolve(true); // source exists
            if (existsCallCount === 2) return Promise.resolve(true); // destination exists
            return Promise.resolve(false);
          });
          
          const response = await request(server)
            .patch(`/vault/${oldPath}`)
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Content-Type", "text/plain")
            .set("Operation", "move")
            .set("Target-Type", "directory")
            .set("Target", "path")
            .send(newPath)
            .expect(409);
            
          expect(response.body.message).toEqual("Destination directory already exists");
        });

        test("directory move with source not found", async () => {
          const oldPath = "nonexistent-folder";
          const newPath = "new-folder";
          
          // Mock directory doesn't exist
          app.vault.adapter._exists = false;
          
          const response = await request(server)
            .patch(`/vault/${oldPath}`)
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Content-Type", "text/plain")
            .set("Operation", "move")
            .set("Target-Type", "directory")
            .set("Target", "path")
            .send(newPath)
            .expect(404);
        });

        test("directory move with source is not a directory", async () => {
          const oldPath = "file.md";
          const newPath = "new-folder";
          
          // Mock file exists but is not a directory
          app.vault.adapter._exists = true;
          app.vault.adapter._stat.type = "file";
          
          const response = await request(server)
            .patch(`/vault/${oldPath}`)
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Content-Type", "text/plain")
            .set("Operation", "move")
            .set("Target-Type", "directory")
            .set("Target", "path")
            .send(newPath)
            .expect(400);
            
          expect(response.body.message).toEqual("Source path is not a directory");
        });

        test("directory move operation must use Target: path", async () => {
          const response = await request(server)
            .patch("/vault/folder")
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Content-Type", "text/plain")
            .set("Operation", "move")
            .set("Target-Type", "directory")
            .set("Target", "name") // Wrong target for directory move
            .send("new-folder")
            .expect(400);
            
          expect(response.body.message).toContain("move operation must use Target: path");
        });

        test("directory move with missing body", async () => {
          const response = await request(server)
            .patch("/vault/folder")
            .set("Authorization", `Bearer ${API_KEY}`)
            .set("Content-Type", "text/plain")
            .set("Operation", "move")
            .set("Target-Type", "directory")
            .set("Target", "path")
            .send("") // Empty body
            .expect(400);
            
          expect(response.body.message).toEqual("New directory path is required in request body");
        });
      });
    });
  });

  describe("tags", () => {
    describe("GET /tags", () => {
      test("list all tags in vault", async () => {
        const file1 = new TFile();
        file1.path = "file1.md";
        const file2 = new TFile();
        file2.path = "file2.md";
        
        app.vault._markdownFiles = [file1, file2];
        
        // Mock metadata cache
        const cache1 = new CachedMetadata();
        cache1.tags = [{ tag: "#project" }, { tag: "#todo" }];
        cache1.frontmatter = { tags: ["important"] };
        
        const cache2 = new CachedMetadata();
        cache2.tags = [{ tag: "#project" }];
        cache2.frontmatter = { tags: ["todo", "important"] };
        
        app.metadataCache.getFileCache = jest.fn()
          .mockReturnValueOnce(cache1)
          .mockReturnValueOnce(cache2);
        
        const response = await request(server)
          .get("/tags/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .expect(200);
          
        expect(response.body.tags).toHaveLength(3);
        // Tags are sorted by count (desc) then name (asc) - all have same count so alphabetical
        expect(response.body.tags[0]).toEqual({ tag: "important", count: 2, files: 2 });
        expect(response.body.tags[1]).toEqual({ tag: "project", count: 2, files: 2 });
        expect(response.body.tags[2]).toEqual({ tag: "todo", count: 2, files: 2 });
        expect(response.body.totalTags).toEqual(3);
      });

      test("empty vault returns empty tags", async () => {
        app.vault._markdownFiles = [];
        
        const response = await request(server)
          .get("/tags/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .expect(200);
          
        expect(response.body.tags).toHaveLength(0);
        expect(response.body.totalTags).toEqual(0);
      });
    });

    describe("GET /tags/{tagname}", () => {
      test("get files with specific tag", async () => {
        const file1 = new TFile();
        file1.path = "file1.md";
        const file2 = new TFile();
        file2.path = "file2.md";
        const file3 = new TFile();
        file3.path = "file3.md";
        
        app.vault._markdownFiles = [file1, file2, file3];
        
        // Mock metadata cache
        const cache1 = new CachedMetadata();
        cache1.tags = [{ tag: "#project" }, { tag: "#project" }]; // Two occurrences
        
        const cache2 = new CachedMetadata();
        cache2.frontmatter = { tags: ["project"] }; // One occurrence
        
        const cache3 = new CachedMetadata();
        cache3.tags = [{ tag: "#other" }];
        
        app.metadataCache.getFileCache = jest.fn()
          .mockReturnValueOnce(cache1)
          .mockReturnValueOnce(cache2)
          .mockReturnValueOnce(cache3);
        
        const response = await request(server)
          .get("/tags/project/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .expect(200);
          
        expect(response.body.tag).toEqual("project");
        expect(response.body.files).toHaveLength(2);
        expect(response.body.files[0]).toEqual({ path: "file1.md", occurrences: 2 });
        expect(response.body.files[1]).toEqual({ path: "file2.md", occurrences: 1 });
        expect(response.body.totalFiles).toEqual(2);
        expect(response.body.totalOccurrences).toEqual(3);
      });

      test("tag not found returns 404", async () => {
        const file1 = new TFile();
        file1.path = "file1.md";
        
        app.vault._markdownFiles = [file1];
        
        const cache1 = new CachedMetadata();
        cache1.tags = [{ tag: "#other" }];
        
        app.metadataCache.getFileCache = jest.fn().mockReturnValue(cache1);
        
        await request(server)
          .get("/tags/nonexistent/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .expect(404);
      });

      test("nested tags are matched", async () => {
        const file1 = new TFile();
        file1.path = "file1.md";
        
        app.vault._markdownFiles = [file1];
        
        const cache1 = new CachedMetadata();
        cache1.tags = [{ tag: "#project/web" }, { tag: "#project/mobile" }];
        
        app.metadataCache.getFileCache = jest.fn().mockReturnValue(cache1);
        
        const response = await request(server)
          .get("/tags/project/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .expect(200);
          
        expect(response.body.files).toHaveLength(1);
        expect(response.body.files[0].occurrences).toEqual(2);
      });
    });

    describe("PATCH /tags/{tagname}", () => {
      test("rename tag across vault", async () => {
        const file1 = new TFile();
        file1.path = "file1.md";
        const file2 = new TFile();
        file2.path = "file2.md";
        
        app.vault._markdownFiles = [file1, file2];
        app.vault._read = "Some content #oldtag more content";
        
        const cache1 = new CachedMetadata();
        cache1.tags = [{ tag: "#oldtag" }];
        
        const cache2 = new CachedMetadata();
        cache2.frontmatter = { tags: ["oldtag"] };
        
        app.metadataCache.getFileCache = jest.fn()
          .mockReturnValueOnce(cache1)
          .mockReturnValueOnce(cache2)
          .mockReturnValueOnce(cache1)
          .mockReturnValueOnce(cache2);
        
        const response = await request(server)
          .patch("/tags/oldtag/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Operation", "rename")
          .set("Content-Type", "text/plain")
          .send("newtag")
          .expect(200);
          
        expect(response.body.message).toEqual("Tag successfully renamed");
        expect(response.body.oldTag).toEqual("oldtag");
        expect(response.body.newTag).toEqual("newtag");
        expect(response.body.modifiedCount).toEqual(1);
      });

      test("rename with invalid tag name", async () => {
        const response = await request(server)
          .patch("/tags/oldtag/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Operation", "rename")
          .set("Content-Type", "text/plain")
          .send("new tag with spaces")
          .expect(400);
          
        expect(response.body.message).toContain("Invalid tag name");
      });

      test("rename with invalid operation", async () => {
        const response = await request(server)
          .patch("/tags/oldtag/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Operation", "delete")
          .set("Content-Type", "text/plain")
          .send("newtag")
          .expect(400);
          
        expect(response.body.message).toEqual("Only 'rename' operation is supported for tags");
      });

      test("rename without new tag name", async () => {
        const response = await request(server)
          .patch("/tags/oldtag/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Operation", "rename")
          .set("Content-Type", "text/plain")
          .send("")
          .expect(400);
          
        expect(response.body.message).toEqual("New tag name is required in request body");
      });
    });

    describe("PATCH /vault/{filepath} with Target-Type: tag", () => {
      test("add tag to file", async () => {
        const filePath = "test.md";
        app.vault._getAbstractFileByPath = new TFile();
        app.vault._read = "Some content";
        
        const cache = new CachedMetadata();
        cache.tags = [];
        app.metadataCache._getFileCache = cache;
        
        const response = await request(server)
          .patch(`/vault/${filePath}`)
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Target-Type", "tag")
          .set("Operation", "add")
          .set("Target", "newtag")
          .set("Content-Type", "text/plain")
          .send("")
          .expect(200);
          
        expect(response.body.message).toEqual("Tag added successfully");
        expect(response.body.tag).toEqual("newtag");
        expect(response.body.operation).toEqual("add");
      });

      test("add tag that already exists", async () => {
        const filePath = "test.md";
        app.vault._getAbstractFileByPath = new TFile();
        app.vault._read = "Some content #existing";
        
        const cache = new CachedMetadata();
        cache.tags = [{ tag: "#existing" }];
        app.metadataCache._getFileCache = cache;
        
        const response = await request(server)
          .patch(`/vault/${filePath}`)
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Target-Type", "tag")
          .set("Operation", "add")
          .set("Target", "existing")
          .set("Content-Type", "text/plain")
          .send("")
          .expect(409);
          
        expect(response.body.message).toEqual("Tag already exists in this file");
      });

      test("remove tag from file", async () => {
        const filePath = "test.md";
        app.vault._getAbstractFileByPath = new TFile();
        app.vault._read = "Some content #removeme more content";
        
        const cache = new CachedMetadata();
        cache.tags = [{ tag: "#removeme" }];
        app.metadataCache._getFileCache = cache;
        
        const response = await request(server)
          .patch(`/vault/${filePath}`)
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Target-Type", "tag")
          .set("Operation", "remove")
          .set("Target", "removeme")
          .set("Content-Type", "text/plain")
          .send("")
          .expect(200);
          
        expect(response.body.message).toEqual("Tag removed successfully");
        expect(response.body.tag).toEqual("removeme");
        expect(response.body.operation).toEqual("remove");
        expect(app.vault.adapter._write[1]).not.toContain("#removeme");
      });

      test("remove tag that doesn't exist", async () => {
        const filePath = "test.md";
        app.vault._getAbstractFileByPath = new TFile();
        app.vault._read = "Some content";
        
        const cache = new CachedMetadata();
        cache.tags = [];
        app.metadataCache._getFileCache = cache;
        
        await request(server)
          .patch(`/vault/${filePath}`)
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Target-Type", "tag")
          .set("Operation", "remove")
          .set("Target", "nonexistent")
          .set("Content-Type", "text/plain")
          .send("")
          .expect(404);
      });

      test("invalid tag operation", async () => {
        const response = await request(server)
          .patch("/vault/test.md")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Target-Type", "tag")
          .set("Operation", "delete")
          .set("Target", "tag")
          .set("Content-Type", "text/plain")
          .send("")
          .expect(400);
          
        expect(response.body.message).toEqual("Only 'add' or 'remove' operations are supported for Target-Type: tag");
      });

      test("missing tag name in Target header", async () => {
        app.vault._getAbstractFileByPath = new TFile();
        
        const response = await request(server)
          .patch("/vault/test.md")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Target-Type", "tag")
          .set("Operation", "add")
          .set("Content-Type", "text/plain")
          .send("")
          .expect(400);
          
        expect(response.body.message).toEqual("Target header with tag name is required");
      });

      test("invalid tag name with special characters", async () => {
        app.vault._getAbstractFileByPath = new TFile();
        
        const response = await request(server)
          .patch("/vault/test.md")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Target-Type", "tag")
          .set("Operation", "add")
          .set("Target", "tag with spaces!")
          .set("Content-Type", "text/plain")
          .send("")
          .expect(400);
          
        expect(response.body.message).toContain("Invalid tag name");
      });
    });
  });

  describe("advanced search operations", () => {
    describe("POST /search/advanced", () => {
      beforeEach(() => {
        // Set up test files with various properties
        const file1 = new TFile();
        file1.path = "projects/project1.md";
        file1.stat.ctime = 1609459200000; // 2021-01-01
        file1.stat.mtime = 1609545600000; // 2021-01-02
        file1.stat.size = 1024;
        
        const file2 = new TFile();
        file2.path = "notes/meeting.md";
        file2.stat.ctime = 1609632000000; // 2021-01-03
        file2.stat.mtime = 1609718400000; // 2021-01-04
        file2.stat.size = 2048;
        
        const file3 = new TFile();
        file3.path = "archive/old-note.txt";
        file3.stat.ctime = 1577836800000; // 2020-01-01
        file3.stat.mtime = 1577923200000; // 2020-01-02
        file3.stat.size = 512;
        
        app.vault._files = [file1, file2, file3];
        app.vault._markdownFiles = [file1, file2]; // Only markdown files
        
        // Set up file contents
        app.vault._readMap = {
          "projects/project1.md": "# Project Alpha\nThis is a project about testing advanced search.\n#project #important",
          "notes/meeting.md": "# Team Meeting\nDiscussed search functionality and regex patterns.\n#meeting #todo",
          "archive/old-note.txt": "Legacy content from 2020."
        };
        
        // Set up metadata cache
        const cache1 = new CachedMetadata();
        cache1.tags = [{ tag: "#project" }, { tag: "#important" }];
        cache1.frontmatter = { status: "active", priority: "high" };
        
        const cache2 = new CachedMetadata();
        cache2.tags = [{ tag: "#meeting" }, { tag: "#todo" }];
        cache2.frontmatter = { type: "meeting", attendees: ["Alice", "Bob"] };
        
        const cache3 = new CachedMetadata();
        cache3.tags = [];
        
        app.metadataCache._fileCacheMap = {
          "projects/project1.md": cache1,
          "notes/meeting.md": cache2,
          "archive/old-note.txt": cache3
        };
      });

      test("basic content search", async () => {
        const query = {
          content: {
            query: "search functionality"
          }
        };
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(200);
          
        expect(response.body.results).toHaveLength(1);
        expect(response.body.results[0].path).toEqual("notes/meeting.md");
        expect(response.body.total).toEqual(1);
      });

      test("regex content search", async () => {
        const query = {
          content: {
            regex: "Project \\w+",
            caseSensitive: true
          }
        };
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(200);
          
        expect(response.body.results).toHaveLength(1);
        expect(response.body.results[0].path).toEqual("projects/project1.md");
      });

      test("frontmatter field search", async () => {
        const query = {
          frontmatter: {
            status: "active"
          }
        };
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(200);
          
        expect(response.body.results).toHaveLength(1);
        expect(response.body.results[0].path).toEqual("projects/project1.md");
      });

      test("metadata path pattern search", async () => {
        const query = {
          metadata: {
            path: "notes/*"
          }
        };
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(200);
          
        expect(response.body.results).toHaveLength(1);
        expect(response.body.results[0].path).toEqual("notes/meeting.md");
      });

      test("metadata size range search", async () => {
        const query = {
          metadata: {
            sizeMin: 1000,
            sizeMax: 1500
          }
        };
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(200);
          
        expect(response.body.results).toHaveLength(1);
        expect(response.body.results[0].path).toEqual("projects/project1.md");
      });

      test("metadata date range search", async () => {
        const query = {
          metadata: {
            createdAfter: "2021-01-01",
            modifiedBefore: "2021-01-03"
          }
        };
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(200);
          
        expect(response.body.results).toHaveLength(1);
        expect(response.body.results[0].path).toEqual("projects/project1.md");
      });

      test("tag include filter", async () => {
        const query = {
          tags: {
            include: ["project", "important"]
          }
        };
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(200);
          
        expect(response.body.results).toHaveLength(1);
        expect(response.body.results[0].path).toEqual("projects/project1.md");
      });

      test("tag exclude filter", async () => {
        const query = {
          tags: {
            exclude: ["todo"]
          }
        };
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(200);
          
        expect(response.body.results).toHaveLength(2);
        const paths = response.body.results.map((r: any) => r.path);
        expect(paths).toContain("projects/project1.md");
        expect(paths).toContain("archive/old-note.txt");
      });

      test("tag any filter", async () => {
        const query = {
          tags: {
            any: ["project", "meeting"]
          }
        };
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(200);
          
        expect(response.body.results).toHaveLength(2);
        const paths = response.body.results.map((r: any) => r.path);
        expect(paths).toContain("projects/project1.md");
        expect(paths).toContain("notes/meeting.md");
      });

      test("combined filters", async () => {
        const query = {
          content: {
            query: "project"
          },
          metadata: {
            extension: "md"
          },
          tags: {
            include: ["important"]
          }
        };
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(200);
          
        expect(response.body.results).toHaveLength(1);
        expect(response.body.results[0].path).toEqual("projects/project1.md");
      });

      test("pagination", async () => {
        const query = {
          pagination: {
            page: 1,
            limit: 2
          }
        };
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(200);
          
        expect(response.body.results).toHaveLength(2);
        expect(response.body.total).toEqual(3);
        expect(response.body.page).toEqual(1);
        expect(response.body.limit).toEqual(2);
        expect(response.body.totalPages).toEqual(2);
      });

      test("sorting by modified date descending", async () => {
        const query = {
          options: {
            sortBy: "modified",
            sortOrder: "desc"
          }
        };
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(200);
          
        expect(response.body.results).toHaveLength(2); // Only markdown files
        expect(response.body.results[0].path).toEqual("notes/meeting.md");
        expect(response.body.results[1].path).toEqual("projects/project1.md");
      });

      test("context length option", async () => {
        const query = {
          content: {
            query: "search"
          },
          options: {
            contextLength: 20
          }
        };
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(200);
          
        expect(response.body.results).toHaveLength(2); // Both files contain "search"
        expect(response.body.results[0].context).toBeDefined();
        expect(response.body.results[0].context.length).toBeLessThanOrEqual(60); // 20 chars before + match + 20 chars after
      });

      test("include content option", async () => {
        const query = {
          options: {
            includeContent: true
          },
          pagination: {
            limit: 1
          }
        };
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(200);
          
        expect(response.body.results[0].content).toBeDefined();
        expect(response.body.results[0].content).toContain("Project Alpha");
      });

      test("empty query returns all files", async () => {
        const query = {};
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(200);
          
        expect(response.body.results).toHaveLength(2); // Only markdown files
        expect(response.body.total).toEqual(2);
      });

      test("no results found", async () => {
        const query = {
          content: {
            query: "nonexistent content"
          }
        };
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(200);
          
        expect(response.body.results).toHaveLength(0);
        expect(response.body.total).toEqual(0);
      });

      test("invalid regex pattern", async () => {
        const query = {
          content: {
            regex: "[invalid regex"
          }
        };
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(400);
          
        expect(response.body.message).toContain("Invalid regex pattern");
      });

      test("unauthorized request", async () => {
        const query = {
          content: {
            query: "test"
          }
        };
        
        await request(server)
          .post("/search/advanced/")
          .set("Content-Type", "application/json")
          .send(query)
          .expect(401);
      });

      test("frontmatter array contains search", async () => {
        const query = {
          frontmatter: {
            attendees: { contains: "Alice" }
          }
        };
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(200);
          
        expect(response.body.results).toHaveLength(1);
        expect(response.body.results[0].path).toEqual("notes/meeting.md");
      });

      test("case insensitive content search", async () => {
        const query = {
          content: {
            query: "SEARCH functionality",
            caseSensitive: false
          }
        };
        
        const response = await request(server)
          .post("/search/advanced/")
          .set("Authorization", `Bearer ${API_KEY}`)
          .set("Content-Type", "application/json")
          .send(query)
          .expect(200);
          
        expect(response.body.results).toHaveLength(1);
        expect(response.body.results[0].path).toEqual("notes/meeting.md");
      });
    });
  });
});
