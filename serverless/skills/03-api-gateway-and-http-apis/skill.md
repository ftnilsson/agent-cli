# API Gateway & HTTP APIs

## Description

Design and implement HTTP APIs on serverless platforms using API gateways, function-backed routes, request validation, rate limiting, and CORS. This skill covers the patterns for building REST and GraphQL APIs where every route is a serverless function, using an API gateway as the front door for routing, authentication, throttling, and transformation.

## When To Use

- Building a REST or GraphQL API backed by serverless functions
- Configuring an API gateway for routing, auth, rate limiting, and CORS
- Designing request/response models with validation
- Implementing pagination, filtering, and error responses
- Choosing between API gateway patterns (proxy, REST, HTTP, GraphQL)

## Prerequisites

- Understanding of REST API design principles
- Familiarity with HTTP methods, status codes, and headers
- Understanding of serverless function basics (skill 02)

## Instructions

### 1. API Gateway Role

The API gateway sits between clients and your functions:

```
Client ──HTTPS──▶ API Gateway ──▶ Function ──▶ Database
                      │
                      ├── Route matching
                      ├── Authentication / authorisation
                      ├── Request validation
                      ├── Rate limiting / throttling
                      ├── CORS handling
                      ├── Request/response transformation
                      └── Caching
```

**Platform API gateways:**

| Platform | Gateway | Key features |
|----------|---------|-------------|
| AWS | API Gateway (REST API) | Full-featured: validation, caching, WAF, usage plans |
| AWS | API Gateway (HTTP API) | Simpler, faster, cheaper — preferred for most APIs |
| AWS | Function URLs | No gateway — direct function invocation via HTTPS |
| Azure | API Management (APIM) | Enterprise: policies, developer portal, versioning |
| Azure | Function HTTP triggers | Built-in routing — no separate gateway needed |
| Cloudflare | Workers Routes | Edge-based routing with Workers |
| General | Self-managed (Express/Fastify in function) | Framework-based routing inside a single function |

### 2. Route Design

Map HTTP routes to individual functions (or use a router function):

**One function per route (recommended for serverless):**

```
GET    /orders          →  listOrders function
POST   /orders          →  createOrder function
GET    /orders/{id}     →  getOrder function
PUT    /orders/{id}     →  updateOrder function
DELETE /orders/{id}     →  deleteOrder function
```

**Advantages:** Independent scaling, independent deployment, granular permissions, granular monitoring.

**Single router function (pragmatic for small APIs):**

```typescript
// Single function handles all /orders/* routes
export async function handler(event: APIGatewayProxyEvent) {
  const { httpMethod, path, pathParameters } = event;

  switch (`${httpMethod} ${path}`) {
    case 'GET /orders':
      return listOrders(event);
    case 'POST /orders':
      return createOrder(event);
    case `GET /orders/${pathParameters?.id}`:
      return getOrder(event);
    default:
      return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
  }
}
```

**Advantages:** Fewer functions to manage, shared middleware, simpler IaC. **Disadvantage:** Can't scale routes independently, larger package size.

**Rule of thumb:** Start with one function per route. Consolidate into a router function only when managing many functions becomes a burden and you don't need per-route scaling.

### 3. Request Validation

Validate at the gateway level AND in the function:

**Gateway-level validation** (rejects invalid requests before invoking the function — saves cost):

```yaml
# OpenAPI spec for API Gateway validation
paths:
  /orders:
    post:
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [customerId, items]
              properties:
                customerId:
                  type: string
                  pattern: '^CUST-[A-Z0-9]{6}$'
                items:
                  type: array
                  minItems: 1
                  items:
                    type: object
                    required: [productId, quantity]
                    properties:
                      productId:
                        type: string
                      quantity:
                        type: integer
                        minimum: 1
```

**Function-level validation** (always validate, even if the gateway does too):

```typescript
import { z } from 'zod';

const CreateOrderSchema = z.object({
  customerId: z.string().regex(/^CUST-[A-Z0-9]{6}$/),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1),
});

export async function createOrder(event: APIGatewayProxyEvent) {
  const body = JSON.parse(event.body ?? '{}');
  const result = CreateOrderSchema.safeParse(body);

  if (!result.success) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Validation failed',
        details: result.error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      }),
    };
  }

  const order = result.data;
  // ... process order
}
```

### 4. Response Format

Use consistent response shapes across all endpoints:

**Success response:**

```json
{
  "data": {
    "id": "ORD-2024-001",
    "customerId": "CUST-ABC123",
    "status": "created",
    "total": 149.99,
    "createdAt": "2025-02-14T10:30:00Z"
  }
}
```

**Collection response (with pagination):**

```json
{
  "data": [
    { "id": "ORD-2024-001", "status": "created", "total": 149.99 },
    { "id": "ORD-2024-002", "status": "shipped", "total": 49.99 }
  ],
  "pagination": {
    "nextToken": "eyJsYXN0SWQiOiJPUkQtMjAyNC0wMDIifQ==",
    "limit": 20
  }
}
```

**Error response:**

```json
{
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order ORD-2024-999 not found",
    "requestId": "req-abc123"
  }
}
```

**Use cursor-based pagination** (not offset) in serverless. Most serverless databases (DynamoDB, Cosmos DB) use continuation tokens natively. Offset pagination requires counting rows, which is expensive at scale.

### 5. Rate Limiting & Throttling

Configure rate limits at the gateway to protect downstream functions and databases:

| Level | Purpose | Implementation |
|-------|---------|---------------|
| **Global** | Protect the entire API | Gateway throttle: 1000 req/sec |
| **Per-client** | Fair usage per API key / tenant | Usage plans, API keys, token bucket |
| **Per-route** | Protect expensive operations | Route-level throttle: POST /orders = 100 req/sec |
| **Per-function** | Protect downstream resources | Reserved concurrency / max instances |

**Return proper headers:**

```
HTTP/1.1 429 Too Many Requests
Retry-After: 5
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1739523600
```

### 6. CORS Configuration

Configure CORS at the gateway level, not in every function:

```json
{
  "allowOrigins": ["https://app.example.com"],
  "allowMethods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  "allowHeaders": ["Content-Type", "Authorization", "X-Request-Id"],
  "exposeHeaders": ["X-Request-Id"],
  "maxAge": 86400,
  "allowCredentials": true
}
```

**Rules:**
- **Never use `*` for `allowOrigins` in production.** List specific origins.
- **Handle OPTIONS preflight** at the gateway — don't invoke a function for it.
- **Set `maxAge`** to cache preflight responses (reduces OPTIONS requests).

### 7. Error Handling Middleware

Create a consistent error handling wrapper:

```typescript
type ApiHandler = (event: APIGatewayProxyEvent) => Promise<{ statusCode: number; body: string }>;

function withErrorHandling(handler: ApiHandler): ApiHandler {
  return async (event) => {
    const requestId = event.requestContext.requestId;
    try {
      return await handler(event);
    } catch (error) {
      if (error instanceof ValidationError) {
        return response(400, { error: { code: 'VALIDATION_ERROR', message: error.message, requestId } });
      }
      if (error instanceof NotFoundError) {
        return response(404, { error: { code: 'NOT_FOUND', message: error.message, requestId } });
      }
      if (error instanceof ConflictError) {
        return response(409, { error: { code: 'CONFLICT', message: error.message, requestId } });
      }

      // Unexpected error — log full details, return generic message
      console.error('Unhandled error', { requestId, error });
      return response(500, { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId } });
    }
  };
}

function response(statusCode: number, body: object) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// Usage
export const handler = withErrorHandling(async (event) => {
  const order = await orderService.getOrder(event.pathParameters!.id!);
  return response(200, { data: order });
});
```

## Best Practices

- **Validate at the gateway AND the function.** Gateway validation saves cost by rejecting bad requests early. Function validation is your safety net.
- **Use consistent response shapes.** Every endpoint returns `{ data }` or `{ error }` — never raw objects or strings.
- **Handle CORS at the gateway.** Don't add CORS headers in every function.
- **Return proper HTTP status codes.** 200 success, 201 created, 400 validation, 404 not found, 409 conflict, 429 throttled, 500 server error.
- **Use cursor-based pagination.** Offset-based pagination doesn't scale in serverless databases.
- **Include request IDs.** Every response should include a request ID for tracing and support.

## Common Pitfalls

- **No request validation.** Trusting client input leads to database errors, injection attacks, and confusing error messages.
- **Returning stack traces to clients.** Log the full error, return a generic message with a request ID.
- **CORS `*` in production.** Opens the API to requests from any origin.
- **No rate limiting.** A single misbehaving client can exhaust your function concurrency and affect all users.
- **Oversized payloads.** Functions have response size limits (6 MB on Lambda, varies by platform). Paginate or stream large results.
- **Cold start on every route.** A router function (single Lambda) has one cold start for all routes. One-function-per-route means cold starts on less-hit routes.

## Reference

- [REST API Design Best Practices](https://restfulapi.net/)
- [AWS API Gateway](https://docs.aws.amazon.com/apigateway/)
- [Azure API Management](https://learn.microsoft.com/en-us/azure/api-management/)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
