local Delete = import 'delete.jsonnet';
local Get = import 'get.jsonnet';
local Patch = import 'patch.jsonnet';
local Post = import 'post.jsonnet';
local Put = import 'put.jsonnet';

local ParamDay = import 'day.param.jsonnet';
local ParamMonth = import 'month.param.jsonnet';
local ParamPath = import 'path.param.jsonnet';
local ParamPeriod = import 'period.param.jsonnet';
local ParamYear = import 'year.param.jsonnet';


std.manifestYamlDoc(
  {
    openapi: '3.0.2',
    info: {
      title: 'Local REST API for Obsidian',
      description: "You can use this interface for trying out your Local REST API in Obsidian.\n\nBefore trying the below tools, you will want to make sure you press the \"Authorize\" button below and provide the API Key you are shown when you open the \"Local REST API\" section of your Obsidian settings.  All requests to the API require a valid API Key; so you won't get very far without doing that.\n\nWhen using this tool you may see browser security warnings due to your browser not trusting the self-signed certificate the plugin will generate on its first run.  If you do, you can make those errors disappear by adding the certificate as a \"Trusted Certificate\" in your browser or operating system's settings.\n",
      version: '1.0',
    },
    servers: [
      {
        url: 'https://{host}:{port}',
        description: 'HTTPS (Secure Mode)',
        variables: {
          port: {
            default: '27124',
            description: 'HTTPS port',
          },
          host: {
            default: '127.0.0.1',
            description: 'Binding host',
          },
        },
      },
      {
        url: 'http://{host}:{port}',
        description: 'HTTP (Insecure Mode)',
        variables: {
          port: {
            default: '27123',
            description: 'HTTP port',
          },
          host: {
            default: '127.0.0.1',
            description: 'Binding host',
          },
        },
      },
    ],
    components: {
      securitySchemes: {
        apiKeyAuth: {
          description: 'Find your API Key in your Obsidian settings\nin the "Local REST API" section under "Plugins".\n',
          type: 'http',
          scheme: 'bearer',
        },
      },
      schemas: {
        NoteJson: {
          type: 'object',
          required: [
            'tags',
            'frontmatter',
            'stat',
            'path',
            'content',
          ],
          properties: {
            tags: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            frontmatter: {
              type: 'object',
            },
            stat: {
              type: 'object',
              required: [
                'ctime',
                'mtime',
                'size',
              ],
              properties: {
                ctime: {
                  type: 'number',
                },
                mtime: {
                  type: 'number',
                },
                size: {
                  type: 'number',
                },
              },
            },
            path: {
              type: 'string',
            },
            content: {
              type: 'string',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Message describing the error.',
              example: 'A brief description of the error.',
            },
            errorCode: {
              type: 'number',
              description: 'A 5-digit error code uniquely identifying this particular type of error.\n',
              example: 40149,
            },
          },
        },
      },
    },
    security: [
      {
        apiKeyAuth: [],
      },
    ],
    paths: {
      '/active/': {
        get: Get {
          tags: ['Active File'],
          summary: 'Return the content of the active file open in Obsidian.\n',
          description: 'Returns the content of the currently active file in Obsidian.\n\nIf you specify the header `Accept: application/vnd.olrapi.note+json`, will return a JSON representation of your note including parsed tag and frontmatter data as well as filesystem metadata.  See "responses" below for details.\n',
        },
        put: Put {
          tags: [
            'Active File',
          ],
          summary: 'Update the content of the active file open in Obsidian.\n',
        },
        post: Post {
          tags: [
            'Active File',
          ],
          summary: 'Append content to the active file open in Obsidian.\n',
          description: "Appends content to the end of the currently-open note.\n\nIf you would like to insert text relative to a particular heading instead of appending to the end of the file, see 'patch'.\n",
        },
        patch: Patch {
          tags: [
            'Active File',
          ],
          summary: 'Partially update content in the currently open note.\n',
          description: 'Inserts content into the currently-open note relative to a heading, block refeerence, or frontmatter field within that document.\n\n' + Patch.description,
        },
        delete: Delete {
          tags: [
            'Active File',
          ],
          summary: 'Deletes the currently-active file in Obsidian.\n',
        },
      },
      '/vault/{filename}': {
        get: Get {
          tags: [
            'Vault Files',
          ],
          summary: 'Return the content of a single file in your vault.\n',
          description: 'Returns the content of the file at the specified path in your vault should the file exist.\n\nIf you specify the header `Accept: application/vnd.olrapi.note+json`, will return a JSON representation of your note including parsed tag and frontmatter data as well as filesystem metadata.  See "responses" below for details.\n',
          parameters+: [ParamPath],
        },
        put: Put {
          tags: [
            'Vault Files',
          ],
          summary: 'Create a new file in your vault or update the content of an existing one.\n',
          description: 'Creates a new file in your vault or updates the content of an existing one if the specified file already exists.\n',
          parameters+: [ParamPath],
        },
        post: Post {
          tags: [
            'Vault Files',
          ],
          summary: 'Append content to a new or existing file.\n',
          description: "Appends content to the end of an existing note. If the specified file does not yet exist, it will be created as an empty file.\n\nIf you would like to insert text relative to a particular heading, block reference, or frontmatter field instead of appending to the end of the file, see 'patch'.\n",
          parameters+: [ParamPath],
        },
        patch: Patch {
          tags: [
            'Vault Files',
          ],
          summary: 'Partially update content in an existing note.\n',
          description: 'Inserts content into an existing note relative to a heading, block refeerence, or frontmatter field within that document.\n\n' + Patch.description,
          parameters+: [ParamPath],
        },
        delete: Delete {
          tags: [
            'Vault Files',
          ],
          summary: 'Delete a particular file or directory in your vault.\n',
          parameters: Delete.parameters + [ParamPath],
        },
      },
      '/vault/': {
        get: {
          tags: [
            'Vault Directories',
          ],
          summary: 'List files that exist in the root of your vault.\n',
          description: 'Lists files in the root directory of your vault.\n\nNote: that this is exactly the same API endpoint as the below "List files that exist in the specified directory." and exists here only due to a quirk of this particular interactive tool.\n',
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      files: {
                        type: 'array',
                        items: {
                          type: 'string',
                        },
                      },
                    },
                  },
                  example: {
                    files: [
                      'mydocument.md',
                      'somedirectory/',
                    ],
                  },
                },
              },
            },
            '404': {
              description: 'Directory does not exist',
              content: {
                'application/json': {
                  schema: {
                    '$ref': '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/vault/{pathToDirectory}/': {
        get: {
          tags: [
            'Vault Directories',
          ],
          summary: 'List files that exist in the specified directory.\n',
          parameters: [
            {
              name: 'pathToDirectory',
              'in': 'path',
              description: 'Path to list files from (relative to your vault root).  Note that empty directories will not be returned.\n\nNote: this particular interactive tool requires that you provide an argument for this field, but the API itself will allow you to list the root folder of your vault. If you would like to try listing content in the root of your vault using this interactive tool, use the above "List files that exist in the root of your vault" form above.\n',
              required: true,
              schema: {
                type: 'string',
                format: 'path',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      files: {
                        type: 'array',
                        items: {
                          type: 'string',
                        },
                      },
                    },
                  },
                  example: {
                    files: [
                      'mydocument.md',
                      'somedirectory/',
                    ],
                  },
                },
              },
            },
            '404': {
              description: 'Directory does not exist',
              content: {
                'application/json': {
                  schema: {
                    '$ref': '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/periodic/{period}/': {
        get: Get {
          tags: [
            'Periodic Notes',
          ],
          summary: 'Get current periodic note for the specified period.\n',
          parameters+: [ParamPeriod],
        },
        put: Put {
          tags: [
            'Periodic Notes',
          ],
          summary: 'Update the content of the current periodic note for the specified period.\n',
          parameters+: [ParamPeriod],
        },
        post: Post {
          tags: [
            'Periodic Notes',
          ],
          summary: 'Append content to the current periodic note for the specified period.\n',
          description: 'Note that this will create the relevant periodic note if necessary.\n',
          parameters+: [ParamPeriod],
        },
        patch: Patch {
          tags: [
            'Periodic Notes',
          ],
          summary: 'Partially update content in the current periodic note for the specified period.\n',
          description: 'Inserts content into the current periodic note for the specified period relative to a heading, block refeerence, or frontmatter field within that document.\n\n' + Patch.description,
          parameters+: [ParamPeriod],
        },
        delete: Delete {
          tags: [
            'Periodic Notes',
          ],
          summary: 'Delete the current periodic note for the specified period.\n',
          parameters+: [ParamPeriod],
        },
      },
      '/periodic/{period}/{year}/{month}/{day}/': {
        get: Get {
          tags: [
            'Periodic Notes',
          ],
          summary: 'Get the periodic note for the specified period and date.\n',
          parameters+: [ParamYear, ParamMonth, ParamDay, ParamPeriod],
        },
        put: Put {
          tags: [
            'Periodic Notes',
          ],
          summary: 'Update the content of the periodic note for the specified period and date.\n',
          parameters+: [ParamYear, ParamMonth, ParamDay, ParamPeriod],
        },
        post: Post {
          tags: [
            'Periodic Notes',
          ],
          summary: 'Append content to the periodic note for the specified period and date.\n',
          description: 'This will create the relevant periodic note if necessary.\n',
          parameters+: [ParamYear, ParamMonth, ParamDay, ParamPeriod],
        },
        patch: Patch {
          tags: [
            'Periodic Notes',
          ],
          summary: 'Partially update content in the periodic note for the specified period and date.\n',
          description: 'Inserts content into a periodic note relative to a heading, block refeerence, or frontmatter field within that document.\n\n' + Patch.description,
          parameters+: [ParamYear, ParamMonth, ParamDay, ParamPeriod],
        },
        delete: Delete {
          tags: [
            'Periodic Notes',
          ],
          summary: 'Delete the periodic note for the specified period and date.\n',
          description: 'Deletes the periodic note for the specified period.\n',
          parameters+: [ParamYear, ParamMonth, ParamDay, ParamPeriod],
        },
      },
      '/commands/': {
        get: {
          tags: [
            'Commands',
          ],
          summary: 'Get a list of available commands.\n',
          responses: {
            '200': {
              description: 'A list of available commands.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      commands: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: {
                              type: 'string',
                            },
                            name: {
                              type: 'string',
                            },
                          },
                        },
                      },
                    },
                  },
                  example: {
                    commands: [
                      {
                        id: 'global-search:open',
                        name: 'Search: Search in all files',
                      },
                      {
                        id: 'graph:open',
                        name: 'Graph view: Open graph view',
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      '/commands/{commandId}/': {
        post: {
          tags: [
            'Commands',
          ],
          summary: 'Execute a command.\n',
          parameters: [
            {
              name: 'commandId',
              'in': 'path',
              description: 'The id of the command to execute',
              required: true,
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '204': {
              description: 'Success',
            },
            '404': {
              description: 'The command you specified does not exist.',
              content: {
                'application/json': {
                  schema: {
                    '$ref': '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/search/': {
        post: {
          tags: [
            'Search',
          ],
          summary: 'Search for documents matching a specified search query\n',
          description: "Evaluates a provided query against each file in your vault.\n\nThis endpoint supports multiple query formats.  Your query should be specified in your request's body, and will be interpreted according to the `Content-type` header you specify from the below options.Additional query formats may be added in the future.\n\n# Dataview DQL (`application/vnd.olrapi.dataview.dql+txt`)\n\nAccepts a `TABLE`-type Dataview query as a text string.  See [Dataview](https://blacksmithgu.github.io/obsidian-dataview/query/queries/)'s query documentation for information on how to construct a query.\n\n# JsonLogic (`application/vnd.olrapi.jsonlogic+json`)\n\nAccepts a JsonLogic query specified as JSON.  See [JsonLogic](https://jsonlogic.com/operations.html)'s documentation for information about the base set of operators available, but in addition to those operators the following operators are available:\n\n- `glob: [PATTERN, VALUE]`: Returns `true` if a string matches a glob pattern.  E.g.: `{\"glob\": [\"*.foo\", \"bar.foo\"]}` is `true` and `{\"glob\": [\"*.bar\", \"bar.foo\"]}` is `false`.\n- `regexp: [PATTERN, VALUE]`: Returns `true` if a string matches a regular expression.  E.g.: `{\"regexp\": [\".*\\.foo\", \"bar.foo\"]` is `true` and `{\"regexp\": [\".*\\.bar\", \"bar.foo\"]}` is `false`.\n\nReturns only non-falsy results.  \"Non-falsy\" here treats the following values as \"falsy\":\n\n- `false`\n- `null` or `undefined`\n- `0`\n- `[]`\n- `{}`\n\nFiles are represented as an object having the schema described\nin the Schema named 'NoteJson' at the bottom of this page.\nUnderstanding the shape of a JSON object from a schema can be\ntricky; so you may find it helpful to examine the generated metadata\nfor individual files in your vault to understand exactly what values\nare returned.  To see that, access the `GET` `/vault/{filePath}`\nroute setting the header:\n`Accept: application/vnd.olrapi.note+json`.  See examples below\nfor working examples of queries performing common search operations.\n",
          requestBody: {
            required: true,
            content: {
              'application/vnd.olrapi.dataview.dql+txt': {
                schema: {
                  type: 'object',
                  externalDocs: {
                    url: 'https://blacksmithgu.github.io/obsidian-dataview/query/queries/',
                  },
                },
                examples: {
                  find_fields_by_tag: {
                    summary: 'List data from files having the #game tag.',
                    value: 'TABLE\n  time-played AS "Time Played",\n  length AS "Length",\n  rating AS "Rating"\nFROM #game\nSORT rating DESC\n',
                  },
                },
              },
              'application/vnd.olrapi.jsonlogic+json': {
                schema: {
                  type: 'object',
                  externalDocs: {
                    url: 'https://jsonlogic.com/operations.html',
                  },
                },
                examples: {
                  find_by_frontmatter_value: {
                    summary: 'Find notes having a certain frontmatter field value.',
                    value: '{\n  "==": [\n    {"var": "frontmatter.myField"},\n    "myValue"\n  ]\n}\n',
                  },
                  find_by_frontmatter_url_glob: {
                    summary: 'Find notes having URL or a matching URL glob frontmatter field.',
                    value: '{\n  "or": [\n    {"===": [{"var": "frontmatter.url"}, "https://myurl.com/some/path/"]},\n    {"glob": [{"var": "frontmatter.url-glob"}, "https://myurl.com/some/path/"]}\n  ]\n}\n',
                  },
                  find_by_tag: {
                    summary: 'Find notes having a certain tag',
                    value: '{\n  "in": [\n    "myTag",\n    {"var": "tags"}\n  ]\n}\n',
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: [
                        'filename',
                        'result',
                      ],
                      properties: {
                        filename: {
                          type: 'string',
                          description: 'Path to the matching file',
                        },
                        result: {
                          oneOf: [
                            {
                              type: 'string',
                            },
                            {
                              type: 'number',
                            },
                            {
                              type: 'array',
                            },
                            {
                              type: 'object',
                            },
                            {
                              type: 'boolean',
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Bad request.  Make sure you have specified an acceptable\nContent-Type for your search query.\n',
              content: {
                'application/json': {
                  schema: {
                    '$ref': '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/search/advanced/': {
        post: {
          tags: [
            'Search',
          ],
          summary: 'Advanced search with comprehensive filtering options\n',
          description: 'Perform advanced searches with multiple filter criteria including content, frontmatter, file metadata, and tags.\n\n## Query Structure\n\nThe request body should be a JSON object with the following structure:\n\n```json\n{\n  "filters": {\n    "content": {\n      "query": "search text",\n      "regex": "pattern.*",\n      "caseSensitive": false\n    },\n    "frontmatter": {\n      "fieldName": {\n        "operator": "equals",\n        "value": "desired value"\n      }\n    },\n    "file": {\n      "path": {\n        "pattern": "folder/**/*.md"\n      },\n      "size": {\n        "min": 1000,\n        "max": 50000\n      },\n      "modified": {\n        "after": "2024-01-01T00:00:00Z"\n      }\n    },\n    "tags": {\n      "include": ["tag1", "tag2"],\n      "exclude": ["tag3"],\n      "mode": "all"\n    }\n  },\n  "options": {\n    "limit": 100,\n    "offset": 0,\n    "contextLength": 100,\n    "includeContent": false,\n    "sort": {\n      "field": "relevance",\n      "direction": "desc"\n    }\n  }\n}\n```\n\n## Available Operators for Frontmatter\n\n- `equals`: Exact match\n- `contains`: Substring match\n- `gt`, `lt`, `gte`, `lte`: Numeric comparisons\n- `exists`, `not_exists`: Field presence checks\n',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    filters: {
                      type: 'object',
                      properties: {
                        content: {
                          type: 'object',
                          properties: {
                            query: { type: 'string' },
                            regex: { type: 'string' },
                            caseSensitive: { type: 'boolean' }
                          }
                        },
                        frontmatter: {
                          type: 'object',
                          additionalProperties: {
                            type: 'object',
                            properties: {
                              operator: {
                                type: 'string',
                                enum: ['equals', 'contains', 'gt', 'lt', 'gte', 'lte', 'exists', 'not_exists']
                              },
                              value: {}
                            }
                          }
                        },
                        file: {
                          type: 'object',
                          properties: {
                            path: {
                              type: 'object',
                              properties: {
                                pattern: { type: 'string' },
                                regex: { type: 'string' }
                              }
                            },
                            extension: {
                              type: 'array',
                              items: { type: 'string' }
                            },
                            size: {
                              type: 'object',
                              properties: {
                                min: { type: 'number' },
                                max: { type: 'number' }
                              }
                            },
                            created: {
                              type: 'object',
                              properties: {
                                after: { type: 'string' },
                                before: { type: 'string' }
                              }
                            },
                            modified: {
                              type: 'object',
                              properties: {
                                after: { type: 'string' },
                                before: { type: 'string' }
                              }
                            }
                          }
                        },
                        tags: {
                          type: 'object',
                          properties: {
                            include: {
                              type: 'array',
                              items: { type: 'string' }
                            },
                            exclude: {
                              type: 'array',
                              items: { type: 'string' }
                            },
                            mode: {
                              type: 'string',
                              enum: ['all', 'any']
                            }
                          }
                        }
                      }
                    },
                    options: {
                      type: 'object',
                      properties: {
                        limit: { type: 'number' },
                        offset: { type: 'number' },
                        contextLength: { type: 'number' },
                        includeContent: { type: 'boolean' },
                        sort: {
                          type: 'object',
                          properties: {
                            field: {
                              type: 'string',
                              enum: ['name', 'modified', 'created', 'size', 'relevance']
                            },
                            direction: {
                              type: 'string',
                              enum: ['asc', 'desc']
                            }
                          }
                        }
                      }
                    }
                  },
                  required: ['filters']
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      results: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            path: { type: 'string' },
                            score: { type: 'number' },
                            matches: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  type: { type: 'string' },
                                  match: {
                                    type: 'object',
                                    properties: {
                                      start: { type: 'number' },
                                      end: { type: 'number' }
                                    }
                                  },
                                  context: { type: 'string' }
                                }
                              }
                            },
                            content: { type: 'string' },
                            metadata: { type: 'object' }
                          }
                        }
                      },
                      totalCount: { type: 'number' },
                      hasMore: { type: 'boolean' }
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Invalid search query',
              content: {
                'application/json': {
                  schema: {
                    '$ref': '#/components/schemas/Error',
                  },
                },
              },
            }
          }
        }
      },
      '/search/simple/': {
        post: {
          tags: [
            'Search',
          ],
          summary: 'Search for documents matching a specified text query\n',
          parameters: [
            {
              name: 'query',
              'in': 'query',
              description: 'Your search query',
              required: true,
              schema: {
                type: 'string',
              },
            },
            {
              name: 'contextLength',
              'in': 'query',
              description: 'How much context to return around the matching string',
              required: false,
              schema: {
                type: 'number',
                default: 100,
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        filename: {
                          type: 'string',
                          description: 'Path to the matching file',
                        },
                        score: {
                          type: 'number',
                        },
                        matches: {
                          type: 'array',
                          items: {
                            type: 'object',
                            required: [
                              'match',
                              'context',
                            ],
                            properties: {
                              match: {
                                type: 'object',
                                required: [
                                  'start',
                                  'end',
                                ],
                                properties: {
                                  start: {
                                    type: 'number',
                                  },
                                  end: {
                                    type: 'number',
                                  },
                                },
                              },
                              context: {
                                type: 'string',
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/tags/': {
        get: {
          tags: [
            'Tags',
          ],
          summary: 'List all unique tags in the vault\n',
          description: 'Returns all unique tags found in the vault, including both inline tags (#tag) and frontmatter tags. Each tag includes usage counts and file counts.\n',
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tags: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            tag: {
                              type: 'string',
                              description: 'Tag name (without # prefix)'
                            },
                            count: {
                              type: 'number',
                              description: 'Total occurrences of this tag across all files'
                            },
                            files: {
                              type: 'number',
                              description: 'Number of files containing this tag'
                            }
                          }
                        }
                      },
                      totalTags: {
                        type: 'number',
                        description: 'Total number of unique tags'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/tags/{tagname}/': {
        get: {
          tags: [
            'Tags',
          ],
          summary: 'Get files containing a specific tag\n',
          description: 'Returns all files that contain the specified tag, either as inline tags or in frontmatter. Includes occurrence counts for each file.\n',
          parameters: [
            {
              name: 'tagname',
              'in': 'path',
              description: 'Tag name to search for (with or without # prefix)',
              required: true,
              schema: {
                type: 'string'
              }
            }
          ],
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tag: {
                        type: 'string',
                        description: 'The tag that was searched'
                      },
                      files: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            path: {
                              type: 'string',
                              description: 'Path to the file'
                            },
                            occurrences: {
                              type: 'number',
                              description: 'Number of times the tag appears in this file'
                            }
                          }
                        }
                      },
                      totalFiles: {
                        type: 'number',
                        description: 'Total number of files containing this tag'
                      },
                      totalOccurrences: {
                        type: 'number',
                        description: 'Total occurrences across all files'
                      }
                    }
                  }
                }
              }
            },
            '404': {
              description: 'Tag not found in any files',
              content: {
                'application/json': {
                  schema: {
                    '$ref': '#/components/schemas/Error',
                  },
                },
              },
            }
          }
        },
        patch: {
          tags: [
            'Tags',
          ],
          summary: 'Rename a tag across the entire vault\n',
          description: 'Renames a tag throughout the vault, updating both inline tags and frontmatter tags. This is a vault-wide operation that modifies all files containing the tag.\n',
          parameters: [
            {
              name: 'tagname',
              'in': 'path',
              description: 'Current tag name to rename (with or without # prefix)',
              required: true,
              schema: {
                type: 'string'
              }
            },
            {
              name: 'Operation',
              'in': 'header',
              description: 'Must be "rename" for tag renaming',
              required: true,
              schema: {
                type: 'string',
                enum: ['rename']
              }
            },
            {
              name: 'Target',
              'in': 'header',
              description: 'New tag name (with or without # prefix)',
              required: true,
              schema: {
                type: 'string'
              }
            }
          ],
          responses: {
            '200': {
              description: 'Tag successfully renamed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      oldTag: { type: 'string' },
                      newTag: { type: 'string' },
                      modifiedFiles: {
                        type: 'array',
                        items: { type: 'string' }
                      },
                      modifiedCount: { type: 'number' }
                    }
                  }
                }
              }
            },
            '207': {
              description: 'Tag rename completed with errors',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      oldTag: { type: 'string' },
                      newTag: { type: 'string' },
                      modifiedFiles: {
                        type: 'array',
                        items: { type: 'string' }
                      },
                      modifiedCount: { type: 'number' },
                      errors: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            file: { type: 'string' },
                            'error': { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Invalid request',
              content: {
                'application/json': {
                  schema: {
                    '$ref': '#/components/schemas/Error',
                  },
                },
              },
            },
            '404': {
              description: 'Tag not found',
              content: {
                'application/json': {
                  schema: {
                    '$ref': '#/components/schemas/Error',
                  },
                },
              },
            }
          }
        }
      },
      '/links/': {
        get: {
          tags: [
            'Links',
          ],
          summary: 'Get all links in the vault\n',
          description: 'Returns a comprehensive list of all links found across the vault, including source file, target, and link statistics.\n',
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      links: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            source: {
                              type: 'string',
                              description: 'Path to the file containing the link'
                            },
                            target: {
                              type: 'string',
                              description: 'Target of the link'
                            },
                            original: {
                              type: 'string',
                              description: 'Original link text as it appears in the file'
                            },
                            displayText: {
                              type: 'string',
                              description: 'Display text for the link (if different from target)'
                            },
                            position: {
                              type: 'object',
                              properties: {
                                start: {
                                  type: 'object',
                                  properties: {
                                    line: { type: 'number' },
                                    col: { type: 'number' },
                                    offset: { type: 'number' }
                                  }
                                },
                                end: {
                                  type: 'object',
                                  properties: {
                                    line: { type: 'number' },
                                    col: { type: 'number' },
                                    offset: { type: 'number' }
                                  }
                                }
                              }
                            }
                          }
                        }
                      },
                      statistics: {
                        type: 'object',
                        properties: {
                          totalLinks: {
                            type: 'number',
                            description: 'Total number of links in the vault'
                          },
                          totalFiles: {
                            type: 'number',
                            description: 'Total number of files in the vault'
                          },
                          filesWithLinks: {
                            type: 'number',
                            description: 'Number of files containing at least one link'
                          },
                          orphanedFiles: {
                            type: 'number',
                            description: 'Number of files with no incoming links'
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/links/broken/': {
        get: {
          tags: [
            'Links',
          ],
          summary: 'Get all broken links in the vault\n',
          description: 'Returns all links that point to non-existent files, along with suggestions for potential matches.\n',
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      brokenLinks: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            source: {
                              type: 'string',
                              description: 'Path to the file containing the broken link'
                            },
                            target: {
                              type: 'string',
                              description: 'Target of the broken link'
                            },
                            original: {
                              type: 'string',
                              description: 'Original link text'
                            },
                            displayText: {
                              type: 'string',
                              description: 'Display text for the link'
                            },
                            resolvedTarget: {
                              type: 'string',
                              description: 'Resolved path that was checked'
                            },
                            suggestions: {
                              type: 'array',
                              items: {
                                type: 'string'
                              },
                              description: 'Suggested files with similar names'
                            },
                            position: {
                              type: 'object',
                              properties: {
                                start: {
                                  type: 'object',
                                  properties: {
                                    line: { type: 'number' },
                                    col: { type: 'number' },
                                    offset: { type: 'number' }
                                  }
                                },
                                end: {
                                  type: 'object',
                                  properties: {
                                    line: { type: 'number' },
                                    col: { type: 'number' },
                                    offset: { type: 'number' }
                                  }
                                }
                              }
                            }
                          }
                        }
                      },
                      count: {
                        type: 'number',
                        description: 'Total number of broken links'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/links/orphaned/': {
        get: {
          tags: [
            'Links',
          ],
          summary: 'Get all orphaned files in the vault\n',
          description: 'Returns all files that have no incoming links from other files in the vault.\n',
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      orphanedFiles: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            path: {
                              type: 'string',
                              description: 'Path to the orphaned file'
                            },
                            metadata: {
                              type: 'object',
                              properties: {
                                size: {
                                  type: 'number',
                                  description: 'File size in bytes'
                                },
                                created: {
                                  type: 'number',
                                  description: 'Creation timestamp'
                                },
                                modified: {
                                  type: 'number',
                                  description: 'Last modified timestamp'
                                }
                              }
                            }
                          }
                        }
                      },
                      count: {
                        type: 'number',
                        description: 'Total number of orphaned files'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/open/{filename}': {
        post: {
          tags: [
            'Open',
          ],
          summary: 'Open the specified document in the Obsidian user interface.\n',
          description: 'Note: Obsidian will create a new document at the path you have\nspecified if such a document did not already exist.\n',
          parameters: [
            {
              name: 'filename',
              'in': 'path',
              description: 'Path to the file to return (relative to your vault root).\n',
              required: true,
              schema: {
                type: 'string',
                format: 'path',
              },
            },
            {
              name: 'newLeaf',
              'in': 'query',
              description: 'Open this as a new leaf?',
              required: false,
              schema: {
                type: 'boolean',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/': {
        get: {
          tags: [
            'System',
          ],
          summary: 'Returns basic details about the server.\n',
          description: 'Returns basic details about the server as well as your authentication status.\n\nThis is the only API request that does *not* require authentication.\n',
          responses: {
            '200': {
              description: 'Success',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: {
                        type: 'string',
                        description: "'OK'",
                      },
                      versions: {
                        type: 'object',
                        properties: {
                          obsidian: {
                            type: 'string',
                            description: 'Obsidian plugin API version',
                          },
                          'self': {
                            type: 'string',
                            description: 'Plugin version.',
                          },
                        },
                      },
                      service: {
                        type: 'string',
                        description: "'Obsidian Local REST API'",
                      },
                      authenticated: {
                        type: 'boolean',
                        description: 'Is your current request authenticated?',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/openapi.yaml': {
        get: {
          tags: [
            'System',
          ],
          summary: 'Returns OpenAPI YAML document describing the capabilities of this API.\n',
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
      '/obsidian-local-rest-api.crt': {
        get: {
          tags: [
            'System',
          ],
          summary: 'Returns the certificate in use by this API.\n',
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
    },
  },
  quote_keys=false,
  indent_array_in_object=true,
)
