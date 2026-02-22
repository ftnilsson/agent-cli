# Data Persistence & State

## Description

Manage state in stateless serverless functions using external data stores, caching strategies, and connection management patterns. This skill covers how to choose databases for serverless workloads, handle connection pooling in ephemeral environments, implement caching layers, and work with the constraints of functions that have no persistent local state.

## When To Use

- Choosing a database or data store for a serverless workload
- Implementing connection pooling in serverless functions
- Adding caching to reduce database load and latency
- Designing data access patterns for serverless-friendly databases
- Handling state in multi-step serverless workflows

## Prerequisites

- Understanding of serverless function lifecycle (cold start, warm invocations, shutdown)
- Familiarity with database concepts (relational, document, key-value)
- Understanding of function design patterns (skill 02)

## Instructions

### 1. The Stateless Constraint

Serverless functions are **stateless by design**:

```
Invocation 1          Invocation 2          Invocation 3
┌──────────┐          ┌──────────┐          ┌──────────┐
│ Function │          │ Function │          │ Function │
│          │          │          │          │          │
│ No local │          │ No local │          │ No local │
│ state    │          │ state    │          │ state    │
└────┬─────┘          └────┬─────┘          └────┬─────┘
     │                     │                     │
     └─────────────────────┼─────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   External  │
                    │   State     │
                    │  (Database, │
                    │   Cache,    │
                    │   Storage)  │
                    └─────────────┘
```

**Rules:**

- **Don't store state in memory between invocations.** The function instance may be destroyed or a different instance may handle the next request.
- **Don't write to the local file system** for data that must persist. Local storage is ephemeral and not shared across instances.
- **Module-scope variables** (like SDK clients) ARE reused across warm invocations of the same instance — use this for connection pooling, not for application state.

### 2. Choose the Right Database

| Database type | Serverless-friendly? | Best for | Watch out for |
|--------------|---------------------|----------|---------------|
| **Key-value / Document** (DynamoDB, Cosmos DB) | ✅ Excellent | High-throughput reads/writes, flexible schemas, per-request pricing | Complex queries, transactions across partitions |
| **Serverless relational** (Aurora Serverless, Azure SQL Serverless, Neon, PlanetScale) | ✅ Good | Complex queries, transactions, relational data, auto-pause | Connection limits, cold-start delay on auto-pause |
| **Traditional relational** (RDS, Azure SQL provisioned) | ⚠️ Requires pooling | Complex queries, existing schemas | Connection limits overwhelmed by function concurrency |
| **In-memory cache** (ElastiCache, Azure Cache for Redis) | ✅ Good | Low-latency reads, session state, rate limiting | VPC/VNet required, not truly serverless pricing |
| **Object storage** (S3, Blob Storage) | ✅ Excellent | Large files, backups, data lake, static assets | Not a database — no queries, no transactions |

**Decision flow:**

```
Do you need complex queries, joins, or transactions?
  ├── Yes → Serverless relational (Aurora Serverless, Neon, PlanetScale, Azure SQL Serverless)
  └── No → Is it key-value or document access patterns?
        ├── Yes → DynamoDB or Cosmos DB (true serverless, per-request pricing)
        └── No → Is it large files/objects?
              ├── Yes → Object storage (S3, Blob Storage)
              └── No → Is it a cache or ephemeral state?
                    ├── Yes → Redis (ElastiCache / Azure Cache)
                    └── No → Evaluate DynamoDB/Cosmos DB — they handle more than people expect
```

### 3. Connection Pooling

Traditional databases (PostgreSQL, MySQL, SQL Server) have a **fixed connection limit**. Serverless functions can spin up hundreds of concurrent instances, each opening a connection:

```
❌ Without pooling:
Function Instance 1 ──conn──┐
Function Instance 2 ──conn──┤
Function Instance 3 ──conn──┤
...                         ├──▶ Database (max 100 connections)
Function Instance 100──conn─┤
Function Instance 101──conn─┤    💥 Connection refused!
Function Instance 200──conn─┘
```

**Solutions:**

| Solution | How it works | Platform |
|----------|-------------|----------|
| **Connection proxy** | A proxy manages a pool of database connections that functions share | AWS RDS Proxy, Azure SQL connection pooling, PgBouncer |
| **HTTP-based database access** | Functions talk to the database over HTTP (no persistent connections) | Neon, PlanetScale, Prisma Data Proxy |
| **Serverless-native databases** | No connection limits by design | DynamoDB, Cosmos DB, Fauna |
| **Module-scope reuse** | Reuse the connection across warm invocations of the same instance | All platforms (partial mitigation) |

**Module-scope connection reuse (do this regardless of other strategies):**

```typescript
// ✅ Connection created once per cold start, reused across warm invocations
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,           // One connection per function instance
  idleTimeoutMillis: 120000,  // Close idle connections after 2 minutes
});

export async function handler(event: any) {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM orders WHERE id = $1', [event.orderId]);
    return result.rows[0];
  } finally {
    client.release();
  }
}
```

```python
# ✅ Python — module-scope connection reuse
import psycopg2

conn = None

def get_connection():
    global conn
    if conn is None or conn.closed:
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
    return conn

def handler(event, context):
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM orders WHERE id = %s", (event["orderId"],))
        return cur.fetchone()
```

### 4. Data Access Patterns for Serverless Databases

**Single-table design (DynamoDB / Cosmos DB):**

Store multiple entity types in one table using composite keys:

```
| PK (Partition Key)  | SK (Sort Key)        | Data               |
|---------------------|---------------------|--------------------|
| CUSTOMER#C001       | PROFILE              | { name, email }    |
| CUSTOMER#C001       | ORDER#ORD-001        | { total, status }  |
| CUSTOMER#C001       | ORDER#ORD-002        | { total, status }  |
| ORDER#ORD-001       | ITEM#PROD-001        | { quantity, price } |
| ORDER#ORD-001       | ITEM#PROD-002        | { quantity, price } |
```

This enables efficient access patterns:
- Get customer profile: `PK = "CUSTOMER#C001" AND SK = "PROFILE"`
- List customer orders: `PK = "CUSTOMER#C001" AND SK begins_with "ORDER#"`
- Get order items: `PK = "ORDER#ORD-001" AND SK begins_with "ITEM#"`

**Key design principle:** Design your keys around your access patterns, not your entity relationships. In serverless databases, you optimise for speed of reads, not for normalisation.

### 5. Caching Strategies

```
Client ──▶ API Gateway ──▶ Function ──▶ Cache ──(miss)──▶ Database
                                         │
                                    (hit) │
                                         ▼
                                    Return cached data
```

**Caching layers for serverless:**

| Layer | Scope | Latency | Use for |
|-------|-------|---------|---------|
| **API Gateway cache** | Per-route, shared across all invocations | ~1ms | GET responses that don't change often |
| **CDN/Edge cache** | Global, per-URL | ~5ms | Static assets, public API responses |
| **External cache (Redis)** | Shared across all function instances | ~1-5ms | Session data, frequently read reference data, rate limiting |
| **In-memory (module scope)** | Per function instance | ~0ms | SDK clients, configuration, rarely changing lookups |

**Cache-aside pattern:**

```typescript
async function getProduct(productId: string): Promise<Product> {
  // 1. Check cache
  const cached = await redis.get(`product:${productId}`);
  if (cached) return JSON.parse(cached);

  // 2. Cache miss — query database
  const product = await db.query('SELECT * FROM products WHERE id = $1', [productId]);

  // 3. Populate cache with TTL
  await redis.setex(`product:${productId}`, 300, JSON.stringify(product));  // 5-minute TTL

  return product;
}
```

**Cache invalidation:**

- **TTL-based** — simplest. Set a time-to-live and accept stale data within the window.
- **Event-based** — on `ProductUpdated` event, delete the cache key. More complex but more consistent.
- **Write-through** — update cache on every write. Ensures cache is always fresh but adds write latency.

### 6. State in Multi-Step Workflows

For multi-step processes, use orchestration services to manage state:

```
Step 1: ValidateOrder    → state: { orderId, status: "validated" }
Step 2: ProcessPayment   → state: { orderId, status: "paid", paymentId }
Step 3: ReserveInventory → state: { orderId, status: "reserved", items }
Step 4: ShipOrder        → state: { orderId, status: "shipped", trackingId }
```

**Options:**

| Approach | How | When |
|----------|-----|------|
| **Orchestrator** (Step Functions, Durable Functions) | Orchestrator manages state between steps | Complex workflows with error handling and retries |
| **Database status field** | Each function updates a status column | Simple 2-3 step flows |
| **Event chain** | Each step publishes a result event that triggers the next step | Loosely coupled services, choreography |

**Never store workflow state in a function's memory.** The instance may be destroyed between steps.

## Best Practices

- **Use serverless-native databases when possible.** DynamoDB, Cosmos DB, and serverless SQL eliminate connection management headaches.
- **Always use a connection proxy** with traditional databases. RDS Proxy, PgBouncer, or HTTP-based access prevents connection exhaustion.
- **Create connections in module scope.** Reuse across warm invocations — don't create per handler call.
- **Set `max: 1` on connection pools** in functions. Each function instance should hold one connection, not the default pool size of 10-20.
- **Cache aggressively.** Serverless functions pay per invocation — reducing database calls with caching saves both latency and cost.
- **Design for eventual consistency.** Data replicated via events will be eventually consistent. Don't fight it — design your UX for it.

## Common Pitfalls

- **Connection pool exhaustion.** 200 concurrent function instances × default pool size 10 = 2000 connections. Most databases max out at 100-500. Use `max: 1` and a connection proxy.
- **Storing state in `/tmp`.** The `/tmp` directory is local to the function instance and ephemeral. Use it for temporary files within a single invocation, not for persistent data.
- **No TTL on cache entries.** Cache entries without expiry become stale forever. Always set a TTL.
- **Full table scans.** Serverless databases are optimised for point reads and narrow queries. A `SELECT *` without a WHERE clause on a DynamoDB table is expensive and slow.
- **Ignoring warm-start connection reuse.** Developers who create a new database connection in every handler call waste cold-start benefits. Module-scope clients are reused.

## Reference

- [DynamoDB Single-Table Design](https://www.alexdebrie.com/posts/dynamodb-single-table/)
- [Cosmos DB Partition Key Design](https://learn.microsoft.com/en-us/azure/cosmos-db/partitioning-overview)
- [AWS RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html)
- [Neon Serverless PostgreSQL](https://neon.tech/docs/serverless/serverless-driver)
- [Caching Best Practices](https://aws.amazon.com/caching/best-practices/)
