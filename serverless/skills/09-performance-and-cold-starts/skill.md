# Performance & Cold Starts

## Description

Optimise serverless function performance by addressing cold starts, memory/CPU tuning, concurrency management, connection reuse, and payload optimisation. This skill covers the performance characteristics unique to serverless — ephemeral execution environments, shared tenancy, and the pay-per-duration model that makes every millisecond matter for both latency and cost.

## When To Use

- Investigating or reducing cold-start latency on user-facing functions
- Tuning memory/CPU allocation for optimal cost-performance ratio
- Managing concurrency limits to prevent throttling or downstream overload
- Optimising function package size to reduce start-up time
- Implementing connection reuse and warm-start optimisations

## Prerequisites

- Understanding of serverless function lifecycle (cold start → warm → recycle)
- Familiarity with function handler patterns (skill 02)
- Understanding of basic performance measurement (P50, P95, P99 latency)

## Instructions

### 1. Understanding Cold Starts

A cold start occurs when a new function instance is created:

```
Cold Start:
┌─────────────────────────────────────────────────────────────────┐
│ Download    │ Start      │ Init code    │ Handler              │
│ package     │ runtime    │ (module      │ (your code           │
│             │            │  scope)      │  execution)          │
│  ~50-500ms  │  ~50-200ms │  ~50-2000ms  │  ~10-1000ms          │
└─────────────────────────────────────────────────────────────────┘
│◄─────── Cold start overhead ──────────▶│◄── Normal execution ─▶│

Warm Start:
┌──────────────────────────────┐
│ Handler (your code execution)│
│  ~10-1000ms                  │
└──────────────────────────────┘
```

**Cold start factors:**

| Factor | Impact | Mitigation |
|--------|--------|------------|
| **Package size** | Larger package = longer download | Tree-shaking, bundling, exclude dev dependencies |
| **Runtime** | JVM/C# slower than Node/Python (but faster warm) | Choose runtime by workload needs, not start-up |
| **Init code** | More module-scope code = longer init | Lazy init for non-critical dependencies |
| **Memory allocation** | More memory = more CPU = faster init | Tune memory (see section 2) |
| **VPC/VNet** | Network interface creation adds delay | Use VPC endpoints, avoid VPC unless required |
| **Dependencies** | Large SDK bundles slow downloads | Import only needed clients, use lightweight SDKs |

### 2. Memory & CPU Tuning

On most serverless platforms, **memory controls CPU allocation**. More memory = more CPU = faster execution (but higher per-ms cost):

```
┌──────────────────────────────────────────────────────────────┐
│ Memory:  128 MB    256 MB    512 MB    1024 MB    2048 MB    │
│ CPU:     ~0.08x    ~0.17x    ~0.33x    ~0.67x     ~1.33x    │
│ Cost/ms: $0.000002 $0.000003 $0.000005 $0.000008  $0.000017 │
│ Duration:  800ms     400ms     200ms     100ms      75ms     │
│ Total:   $0.0016   $0.0012   $0.0010   $0.0008    $0.0013   │
│                                          ▲                    │
│                                    Sweet spot                │
└──────────────────────────────────────────────────────────────┘
```

**Power tuning process:**

1. Run the function with different memory settings (128, 256, 512, 1024, 1536, 2048 MB).
2. Measure execution duration at each level.
3. Calculate total cost: memory cost × duration.
4. Choose the memory setting with the lowest total cost (the sweet spot).
5. Use power tuning tools (AWS Lambda Power Tuning, manual benchmarking).

**Rules of thumb:**

- **I/O-bound functions** (HTTP calls, database queries) — 256-512 MB is usually sufficient. More memory doesn't help because the function is waiting on external calls.
- **CPU-bound functions** (data processing, image manipulation, encryption) — 1024-2048 MB gives proportionally more CPU and faster execution. Total cost often decreases.
- **Always benchmark** — don't guess. The sweet spot varies per function.

### 3. Cold Start Mitigation

| Strategy | Latency reduction | Cost increase | Platform |
|----------|------------------|--------------|----------|
| **Reduce package size** | 50-200ms | None | All |
| **Use bundler (esbuild)** | 100-500ms | None | Node.js |
| **Avoid VPC/VNet** | 200-1000ms | None | All |
| **Increase memory** | 50-200ms | Variable | All |
| **Provisioned concurrency** | Eliminates cold starts | Pay for idle instances | AWS Lambda |
| **Always Ready instances** | Eliminates cold starts | Pay for idle instances | Azure Functions (Flex) |
| **Keep-alive pings** | Reduces cold start frequency | Minimal (invocation cost) | All (hacky, not recommended) |
| **ARM64** | 10-20% faster init | 20% cheaper | AWS Lambda, some Azure |

**Reduce package size (biggest impact):**

```bash
# Before: 50 MB (entire aws-sdk, all node_modules)
# After: 2 MB (bundled with tree-shaking)

# Use esbuild for Node.js
esbuild src/handlers/create-order.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile=dist/create-order.js \
  --minify \
  --external:@aws-sdk/*    # AWS SDK v3 is included in Lambda runtime
```

```json
// package.json — separate production dependencies
{
  "dependencies": {
    "zod": "^3.22.0",
    "pino": "^8.16.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "esbuild": "^0.19.0",
    "jest": "^29.7.0",
    "@aws-sdk/client-dynamodb": "^3.0.0"  // Dev-only, available in runtime
  }
}
```

### 4. Concurrency Management

```
                            Function concurrency limit: 100
                            ┌────────────────────────────────┐
Requests ──▶                │ Instance 1 ████                │
                            │ Instance 2 ██████              │
                            │ Instance 3 ███                 │
                            │ ...                            │
                            │ Instance 99 ████               │
                            │ Instance 100 ██████            │
                            └────────────────────────────────┘
Request 101 ── THROTTLED ──▶  ❌ 429 Too Many Requests
```

**Concurrency strategies:**

| Strategy | Purpose | When to use |
|----------|---------|-------------|
| **Reserved concurrency** | Guarantee capacity for critical functions | Payment processing, auth endpoints |
| **Throttled concurrency** | Limit concurrent executions to protect downstream | Database-connected functions |
| **No concurrency limit** | Use account default (1000 on AWS, varies) | Low-risk, independent functions |

**Protect downstream databases and APIs:**

```
Functions (up to 1000 concurrent) ──▶ Database (max 100 connections)

Solution 1: Limit function concurrency to 50
Solution 2: Use a connection proxy (RDS Proxy, PgBouncer)
Solution 3: Use a queue between the function and database writes
```

### 5. Connection Reuse

```typescript
// ✅ Connections created in module scope — reused across warm invocations
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Agent } from 'https';

// HTTP keep-alive for SDK clients
const agent = new Agent({ keepAlive: true, maxSockets: 50 });

const db = new DynamoDBClient({
  requestHandler: new NodeHttpHandler({ httpsAgent: agent }),
});

// ✅ Disable Nagle's algorithm for lower latency
import { Socket } from 'net';
Socket.prototype.setNoDelay = function () { return this; };
```

```python
# ✅ Python — reuse connections
import urllib3

# Enable connection pooling for boto3
urllib3.disable_warnings()

# SDK clients in module scope
import boto3
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])
```

### 6. Payload Optimisation

| Technique | Impact | When |
|-----------|--------|------|
| **Claim-check pattern** | Large body → reference | Payloads > 256 KB |
| **Compression** | Reduce transfer size | API responses > 1 KB |
| **Pagination** | Limit response size | Collection endpoints |
| **Field selection** | Return only requested fields | GraphQL or sparse fieldset |
| **Binary formats** | Protobuf/MessagePack vs JSON | High-throughput internal APIs |

**Claim-check for large payloads:**

```typescript
// Instead of putting large data in the event:
// ❌ { type: "FileUploaded", data: { content: "<10MB base64>" } }

// Store in object storage and pass the reference:
// ✅ { type: "FileUploaded", data: { bucket: "uploads", key: "abc/file.pdf" } }

export async function processFile(event: SQSEvent) {
  const { bucket, key } = JSON.parse(event.Records[0].body);
  const file = await s3.getObject({ Bucket: bucket, Key: key });
  // Process the file...
}
```

## Best Practices

- **Measure before optimising.** Profile your functions to find the actual bottleneck. Don't optimise cold starts if your P95 latency is dominated by database queries.
- **Bundle and tree-shake.** Use esbuild, webpack, or similar to produce minimal deployment packages. This is the highest-impact cold start optimisation.
- **Tune memory based on data.** Run power tuning tests. The cheapest configuration is rarely the lowest or highest memory setting.
- **Reserve concurrency for critical paths.** Don't let a traffic spike on your analytics function starve your payment processor.
- **Use ARM64 where available.** Better price/performance and often faster cold starts.
- **Monitor cold start rate continuously.** Target <5% cold start rate for user-facing sync functions.

## Common Pitfalls

- **Default memory for everything.** The default (128 MB on AWS, 1.5 GB on Azure) is rarely optimal. Always tune.
- **Including the entire SDK.** Importing `aws-sdk` (v2, 70 MB) instead of `@aws-sdk/client-dynamodb` (v3, 2 MB) adds hundreds of milliseconds to cold starts.
- **VPC for everything.** Putting functions in a VPC when they don't access private resources adds 500ms+ to cold starts. Only use VPC when required.
- **No keep-alive on HTTP clients.** Without `keepAlive: true`, every SDK call opens a new TCP connection.
- **Provisioned concurrency as a default.** Provisioned concurrency eliminates cold starts but costs money 24/7. Use it only for latency-critical synchronous endpoints, not for async queue processors.
- **Ignoring concurrency limits.** Account-level concurrency limits (1000 on AWS) are shared across all functions. One runaway function can throttle everything.

## Reference

- [AWS Lambda Performance Optimization](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Azure Functions Performance](https://learn.microsoft.com/en-us/azure/azure-functions/functions-best-practices)
- [AWS Lambda Power Tuning](https://github.com/alexcasalboni/aws-lambda-power-tuning)
- [esbuild](https://esbuild.github.io/)
- [Serverless Performance (theburningmonk)](https://theburningmonk.com/2019/09/how-to-make-lambda-cold-starts-a-non-issue/)
