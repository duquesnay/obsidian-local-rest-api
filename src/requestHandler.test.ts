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
  });

  describe("vaultDelete", () => {
    test("directory", async () => {
      await request(server)
        .delete("/vault/")
        .set("Authorization", `Bearer ${API_KEY}`)
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
});
