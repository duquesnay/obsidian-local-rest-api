{
  parameters: [
    {
      name: 'Target-Type',
      'in': 'header',
      description: 'Type of target to delete (optional, defaults to file)',
      required: false,
      schema: {
        type: 'string',
        enum: [
          'file',
          'directory',
        ],
        default: 'file',
      },
    },
    {
      name: 'Permanent',
      'in': 'header',
      description: 'Permanently delete instead of moving to trash (optional, defaults to false)',
      required: false,
      schema: {
        type: 'string',
        enum: [
          'true',
          'false',
        ],
        default: 'false',
      },
    },
  ],
  responses: {
    '204': {
      description: 'Success',
    },
    '404': {
      description: 'File or directory does not exist.',
      content: {
        'application/json': {
          schema: {
            '$ref': '#/components/schemas/Error',
          },
        },
      },
    },
    '400': {
      description: 'Bad request; invalid Target-Type or operation not supported.',
      content: {
        'application/json': {
          schema: {
            '$ref': '#/components/schemas/Error',
          },
        },
      },
    },
    '405': {
      description: 'Your path references a directory instead of a file; this request method is valid only for updating files.\n',
      content: {
        'application/json': {
          schema: {
            '$ref': '#/components/schemas/Error',
          },
        },
      },
    },
  },
}
