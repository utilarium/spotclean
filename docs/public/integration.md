# Integration Patterns

Common patterns for integrating Spotclean into your applications.

## Express/Koa Error Handler

```typescript
import { getErrorSanitizer } from '@theunwalked/spotclean';

// Express error handler
app.use((err, req, res, next) => {
  const { external, internal } = getErrorSanitizer().sanitize(err);
  
  // Log full details internally
  req.log.error('Request failed', {
    correlationId: internal.correlationId,
    originalMessage: internal.originalMessage,
    stack: internal.originalStack,
    path: req.path,
    method: req.method,
  });
  
  // Return safe response
  res.status(500).json({
    error: external.message,
    correlationId: external.correlationId,
  });
});
```

## Async Function Wrapper

```typescript
import { withErrorHandling } from '@theunwalked/spotclean';

const logger = {
  error: (msg, ctx) => console.error(msg, ctx),
  warn: (msg) => console.warn(msg),
  info: (msg) => console.log(msg),
};

// Wrap database operations
const safeDbQuery = withErrorHandling(
  async (sql: string) => database.query(sql),
  { logger, context: { component: 'database' } }
);

// Wrap API calls
const safeApiCall = withErrorHandling(
  async (endpoint: string, data: unknown) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  },
  { logger, context: { component: 'api-client' } }
);

// Use wrapped functions
const users = await safeDbQuery('SELECT * FROM users');
const result = await safeApiCall('/api/process', { userId: 123 });
```

## CLI Error Handler

```typescript
import { sanitize } from '@theunwalked/spotclean';

async function main() {
  try {
    await runCommand();
  } catch (error) {
    const { external, internal } = sanitize(error);
    
    // Show safe message to user
    console.error(`Error: ${external.message}`);
    
    if (external.correlationId) {
      console.error(`Reference: ${external.correlationId}`);
    }
    
    // Log full details if verbose mode
    if (process.env.VERBOSE) {
      console.error('Debug info:', internal);
    }
    
    process.exit(1);
  }
}
```

## GraphQL Error Formatting

```typescript
import { getErrorSanitizer } from '@theunwalked/spotclean';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  formatError: (error) => {
    const { external, internal } = getErrorSanitizer().sanitize(error);
    
    // Log internally
    logger.error('GraphQL error', {
      correlationId: internal.correlationId,
      originalError: internal,
    });
    
    // Return safe error
    return {
      message: external.message,
      extensions: {
        correlationId: external.correlationId,
      },
    };
  },
});
```

## Next.js API Routes

```typescript
import { sanitize, configureErrorSanitizer } from '@theunwalked/spotclean';

// Configure once
configureErrorSanitizer({
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  includeCorrelationId: true,
});

// API route handler
export default async function handler(req, res) {
  try {
    const data = await processRequest(req.body);
    res.status(200).json(data);
  } catch (error) {
    const { external, internal } = sanitize(error);
    
    console.error('API error:', internal);
    
    res.status(500).json({
      error: external.message,
      correlationId: external.correlationId,
    });
  }
}
```

## Fastify Plugin

```typescript
import { getErrorSanitizer, configureErrorSanitizer } from '@theunwalked/spotclean';

const spotcleanPlugin = async (fastify) => {
  configureErrorSanitizer({
    environment: 'production',
    includeCorrelationId: true,
  });

  fastify.setErrorHandler((error, request, reply) => {
    const { external, internal } = getErrorSanitizer().sanitize(error);

    request.log.error({
      correlationId: internal.correlationId,
      originalError: internal,
    });

    reply.status(500).send({
      error: external.message,
      correlationId: external.correlationId,
    });
  });
};

fastify.register(spotcleanPlugin);
```

## Lambda/Serverless

```typescript
import { sanitize, configureErrorSanitizer } from '@theunwalked/spotclean';

// Configure at cold start
configureErrorSanitizer({
  environment: 'production',
  includeCorrelationId: true,
});

export const handler = async (event, context) => {
  try {
    const result = await processEvent(event);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    const { external, internal } = sanitize(error);

    console.error(JSON.stringify({
      correlationId: internal.correlationId,
      requestId: context.awsRequestId,
      error: internal,
    }));

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: external.message,
        correlationId: external.correlationId,
      }),
    };
  }
};
```

## Testing

When testing error handling, you may want to disable sanitization:

```typescript
import { configureErrorSanitizer } from '@theunwalked/spotclean';

beforeEach(() => {
  configureErrorSanitizer({
    environment: 'test',
    // Full messages for test assertions
  });
});

test('handles database errors', async () => {
  await expect(dbOperation()).rejects.toThrow('connection refused');
});
```

## Best Practices

### 1. Configure Early

```typescript
// app.ts - at the top
import { configureErrorSanitizer } from '@theunwalked/spotclean';

configureErrorSanitizer({
  environment: process.env.NODE_ENV as any,
  includeCorrelationId: true,
});
```

### 2. Always Log Internally

```typescript
const { external, internal } = sanitize(error);

// ALWAYS log full details
logger.error('Error occurred', internal);

// Return safe details
return external;
```

### 3. Use Correlation IDs

```typescript
// In error response
return {
  error: external.message,
  correlationId: external.correlationId, // Always include this
};

// Users can report: "Error reference: err-abc123"
// Support can look up full details
```

