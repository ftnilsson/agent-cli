# Authentication & Authorisation

## Description

Secure serverless APIs and event-driven functions using JWT validation, API keys, OAuth/OIDC flows, and authoriser/middleware patterns. This skill covers how to authenticate callers, authorise access to resources, propagate identity through event-driven systems, and implement these patterns at the API gateway and function level without platform-specific lock-in.

## When To Use

- Adding authentication to a serverless HTTP API
- Implementing role-based or attribute-based access control in function handlers
- Choosing between API keys, JWTs, and OAuth for different client types
- Building authoriser functions (Lambda authorisers, Azure Function middleware)
- Propagating user identity through async events and queues

## Prerequisites

- Understanding of HTTP APIs and API gateways (skill 03)
- Familiarity with OAuth 2.0 and OpenID Connect concepts
- Understanding of JSON Web Tokens (JWTs)

## Instructions

### 1. Authentication Methods

| Method | Use case | Where to validate |
|--------|----------|-------------------|
| **JWT (Bearer token)** | User-facing APIs, SPA/mobile apps | Gateway authoriser or function middleware |
| **API Key** | Service-to-service, third-party integrations, rate limiting | Gateway (usage plans) |
| **OAuth 2.0 Client Credentials** | Machine-to-machine communication | Gateway or function |
| **Mutual TLS (mTLS)** | High-security service-to-service | Gateway / load balancer |
| **IAM / Managed Identity** | Internal cloud service-to-service | Cloud provider SDK |

**Decision flow:**

```
Who is calling?
├── End user (browser, mobile app)
│   └── JWT via OAuth 2.0 / OIDC
├── Third-party service (webhook, partner API)
│   └── API Key + webhook signature verification
├── Internal service (same cloud account)
│   └── IAM role / Managed Identity (no secrets)
└── External service (cross-organisation)
    └── OAuth 2.0 Client Credentials
```

### 2. JWT Validation in Functions

Validate JWTs at the function level (defence in depth, even if the gateway also validates):

```typescript
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

// ── Module scope: JWKS client reused across invocations ──
const jwksClient = jwksRsa({
  jwksUri: `https://${process.env.AUTH_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000,  // Cache signing keys for 10 minutes
});

function getSigningKey(kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    jwksClient.getSigningKey(kid, (err, key) => {
      if (err) return reject(err);
      resolve(key!.getPublicKey());
    });
  });
}

export async function validateToken(token: string): Promise<JwtPayload> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header.kid) throw new AuthError('Invalid token');

  const signingKey = await getSigningKey(decoded.header.kid);

  return jwt.verify(token, signingKey, {
    algorithms: ['RS256'],
    audience: process.env.API_AUDIENCE,
    issuer: `https://${process.env.AUTH_DOMAIN}/`,
  }) as JwtPayload;
}
```

**Validation checklist:**

- [ ] Verify signature using the issuer's public key (JWKS)
- [ ] Check `exp` (expiration) — reject expired tokens
- [ ] Check `aud` (audience) — must match YOUR API identifier
- [ ] Check `iss` (issuer) — must match your identity provider
- [ ] Check `alg` (algorithm) — must be RS256 (never accept `none`)
- [ ] Extract claims for authorisation (`sub`, `roles`, `permissions`, `scope`)

### 3. Gateway Authorisers

Most API gateways support authoriser functions that run before your handler:

```
Client ──Bearer token──▶ API Gateway
                              │
                         ┌────▼────────┐
                         │ Authoriser  │  ← Validates JWT, returns policy
                         │ Function    │
                         └────┬────────┘
                              │
                    ┌─────────▼──────────┐
                    │ Allow / Deny       │
                    │ + user context     │
                    └─────────┬──────────┘
                              │ (allowed)
                         ┌────▼────────┐
                         │ Handler     │  ← Receives user context, skips auth
                         │ Function    │
                         └─────────────┘
```

**Authoriser response pattern:**

```typescript
interface AuthorizerResult {
  principalId: string;       // User identifier
  policyDocument: {
    Statement: [{
      Action: 'execute-api:Invoke';
      Effect: 'Allow' | 'Deny';
      Resource: string;      // API resource ARN or route
    }];
  };
  context: {                 // Passed to handler function
    userId: string;
    roles: string;
    tenantId: string;
  };
}
```

**Gateway authoriser caching** — cache authoriser results for a configured TTL to avoid re-validating the same token on every request. Typical TTL: 300 seconds.

### 4. Authorisation Patterns

**Role-Based Access Control (RBAC):**

```typescript
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['orders:read', 'orders:write', 'orders:delete', 'users:manage'],
  manager: ['orders:read', 'orders:write', 'reports:read'],
  viewer: ['orders:read'],
};

function authorize(userRoles: string[], requiredPermission: string): void {
  const userPermissions = userRoles.flatMap(role => ROLE_PERMISSIONS[role] ?? []);
  if (!userPermissions.includes(requiredPermission)) {
    throw new ForbiddenError(`Missing permission: ${requiredPermission}`);
  }
}

// Usage in handler
export async function deleteOrder(event: APIGatewayProxyEvent) {
  const user = event.requestContext.authorizer!;
  authorize(user.roles.split(','), 'orders:delete');
  // ... proceed with deletion
}
```

**Resource-level authorisation (ownership check):**

```typescript
export async function getOrder(event: APIGatewayProxyEvent) {
  const userId = event.requestContext.authorizer!.userId;
  const orderId = event.pathParameters!.id!;

  const order = await orderService.getOrder(orderId);

  // Admins can see all orders; regular users only their own
  if (order.customerId !== userId && !hasRole(user, 'admin')) {
    throw new ForbiddenError('You can only access your own orders');
  }

  return response(200, { data: order });
}
```

**Multi-tenant isolation:**

```typescript
// Every database query is scoped to the tenant
async function listOrders(tenantId: string): Promise<Order[]> {
  return db.query({
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}` },
  });
}

// Tenant ID comes from the JWT — never from the request path/body
export async function handler(event: APIGatewayProxyEvent) {
  const tenantId = event.requestContext.authorizer!.tenantId;
  const orders = await listOrders(tenantId);  // Tenant-scoped
  return response(200, { data: orders });
}
```

### 5. Identity in Event-Driven Systems

When events flow through queues and topics, the original user context can be lost:

```
User ──JWT──▶ API Function ──message──▶ Queue ──▶ Processor Function
                                              (who triggered this?)
```

**Propagate identity in event metadata:**

```typescript
// API function — include actor in event
await queue.send({
  body: JSON.stringify(orderData),
  messageAttributes: {
    'actor.userId': user.sub,
    'actor.tenantId': user.tenantId,
    'actor.roles': user.roles.join(','),
    'correlationId': requestId,
  },
});

// Processor function — extract actor from message
export async function processOrder(message: SQSRecord) {
  const actor = {
    userId: message.messageAttributes['actor.userId'],
    tenantId: message.messageAttributes['actor.tenantId'],
    roles: message.messageAttributes['actor.roles'].split(','),
  };

  // Use actor for audit logging and authorisation checks
  await orderService.process(order, actor);
}
```

### 6. API Key Management

Use API keys for rate limiting and client identification (not as the sole authentication):

```
API Key authentication:
- Identifies the calling application (not the user)
- Used for rate limiting and usage tracking
- Always combined with JWT or another auth method for user identity
- Rotate regularly and support multiple active keys during rotation
```

**Key rotation pattern:**

1. Generate a new key (Key 2) while Key 1 is still active.
2. Update the client to use Key 2.
3. Verify Key 2 is working (monitor usage).
4. Revoke Key 1.

## Best Practices

- **Validate at the gateway AND the function.** Gateway catches obvious issues (expired tokens, missing headers). Function validates business-level authorisation (ownership, permissions).
- **Use managed identity for internal calls.** IAM roles (AWS) and managed identities (Azure) eliminate secrets entirely.
- **Cache JWKS keys.** Don't fetch the signing key on every invocation — cache it in module scope with a reasonable TTL.
- **Never log tokens.** Redact `Authorization` headers and token values from all logs.
- **Use short-lived tokens.** Access tokens should expire in minutes (5-60 min), not hours or days. Use refresh tokens for longevity.
- **Propagate identity through events.** Include the actor (user/service identity) in event metadata for audit trails and downstream authorisation.

## Common Pitfalls

- **API key as sole authentication.** API keys identify applications, not users. They're easily leaked and can't be scoped per-user.
- **Validating JWT signature but not claims.** Checking `exp` without checking `aud` means any valid token from the same provider works on your API.
- **Hardcoded secrets.** Auth0/Okta secrets, API keys, or signing keys in source code. Use a secrets manager.
- **No tenant isolation.** If `tenantId` can be set by the client (URL parameter, body), users can access other tenants' data. Always extract `tenantId` from the JWT.
- **Missing authorisation on async handlers.** Queue processors often skip authorisation because "it's internal." Always verify the actor has permission for the operation.

## Reference

- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)
- [JWT Best Practices (RFC 8725)](https://tools.ietf.org/html/rfc8725)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
