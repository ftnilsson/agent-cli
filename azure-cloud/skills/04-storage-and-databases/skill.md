# Storage & Databases

## Description

Choose, configure, and operate Azure storage and database services. This skill covers the full spectrum — blob/file/table storage, relational databases (Azure SQL, PostgreSQL), NoSQL (Cosmos DB), caching (Azure Cache for Redis), and the decision framework for picking the right data store for each workload.

## When To Use

- Choosing a database for a new service or feature
- Designing Cosmos DB partition strategies and data models
- Configuring Azure SQL or PostgreSQL for production (HA, backups, security)
- Setting up Storage Accounts with proper security, lifecycle, and redundancy
- Adding caching layers to reduce latency and database load
- Planning data migration strategies

## Prerequisites

- Understanding of relational vs NoSQL data models
- Familiarity with SQL and basic database concepts (indexing, transactions)
- Basic understanding of Azure networking (VNets, Private Endpoints)

## Instructions

### 1. Pick the Right Database

| Service | Type | Best for | Avoid when |
|---------|------|----------|------------|
| **Cosmos DB** | Multi-model (document, key-value, graph, column-family) | Global distribution, single-digit-ms latency, event-driven apps | Complex JOINs, unknown access patterns, strict relational constraints |
| **Azure SQL Database** | Relational (managed) | Transactional workloads, complex queries, .NET ecosystem | Extreme write scale, simple key-value access |
| **Azure Database for PostgreSQL (Flexible)** | Relational (managed) | PostgreSQL workloads, PostGIS, JSONB, full-text search | When Azure SQL features (Hyperscale, Elastic Pools) are needed |
| **Azure Cache for Redis** | In-memory cache/store | Session storage, caching, leaderboards, pub/sub | Persistent primary data store |
| **Azure AI Search** | Search | Full-text search, faceted navigation, AI-enriched search | Primary transactional data |
| **Azure Table Storage** | Key-value (basic) | Simple key-value at low cost, logs, telemetry | Complex queries, relationships |

**Decision flow:**

```
Do you need transactions and complex queries (JOINs, aggregations)?
  ├── Yes → Azure SQL Database or PostgreSQL Flexible Server
  └── No → Do you need global distribution or single-digit-ms latency?
        ├── Yes → Cosmos DB
        └── No → Is it a caching/session/ephemeral use case?
              ├── Yes → Azure Cache for Redis
              └── No → Evaluate based on data shape and query needs
```

### 2. Cosmos DB — Design for Partition Key

Cosmos DB requires upfront partition key design. This is the most critical decision:

**Partition key rules:**

- **High cardinality** — many distinct values (e.g., `userId`, `tenantId`). Avoid low-cardinality keys like `status` or `country`.
- **Even distribution** — requests and storage should spread evenly across partitions.
- **Include the partition key in every query** — cross-partition queries are expensive.

```json
// Example: Multi-tenant order system
{
  "id": "ORD-2024-001",
  "partitionKey": "TENANT-123",    // Partition key = tenantId
  "type": "order",
  "customerId": "CUST-456",
  "total": 149.99,
  "status": "confirmed",
  "createdAt": "2025-02-14T10:30:00Z"
}
```

**Cosmos DB best practices:**

- **Use serverless tier** for dev/test and low-traffic workloads. Switch to **autoscale provisioned** for production.
- **Enable continuous backups** with point-in-time restore (PITR).
- **Use the change feed** for event-driven patterns — materialise views, trigger functions, replicate data.
- **Use hierarchical partition keys** (preview → GA) for multi-level partitioning (e.g., `tenantId` → `category`).
- **Set appropriate indexing policies** — exclude paths you never query on to reduce RU cost and write latency.

### 3. Azure SQL Database — Relational on Azure

**Tier comparison:**

| Tier | Use case | Scaling | Max size |
|------|----------|---------|----------|
| **Basic/Standard (DTU)** | Dev/test, predictable workloads | DTU-based | 1 TB |
| **General Purpose (vCore)** | Most production workloads | vCore-based, auto-scale | 4 TB |
| **Business Critical (vCore)** | Low-latency, high IOPS, read replicas | vCore-based | 4 TB |
| **Hyperscale** | Large databases, rapid scale-out, fast backups | Up to 100 TB, named replicas | 100 TB |
| **Serverless** | Variable/intermittent workloads | Auto-pause, auto-scale | 4 TB |

**Production configuration checklist:**

- [ ] Zone-redundant (enabled in General Purpose and Business Critical tiers)
- [ ] Automated backups with appropriate PITR retention (7-35 days)
- [ ] Transparent Data Encryption (TDE) enabled (default)
- [ ] Long-term backup retention (LTR) configured for compliance
- [ ] Private Endpoint configured (no public access)
- [ ] Entra ID authentication enabled (not SQL auth only)
- [ ] Auditing enabled to Log Analytics
- [ ] Threat detection (Advanced Threat Protection) enabled
- [ ] Read replicas for read-heavy workloads (Business Critical/Hyperscale)

### 4. Azure Blob Storage

Blob Storage is the foundational storage service for nearly everything:

**Security baseline:**

```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: { name: 'Standard_ZRS' }        // Zone-redundant for production
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false         // Never allow public blob access
    allowSharedKeyAccess: false          // Use Entra ID auth, not storage keys
    networkAcls: {
      defaultAction: 'Deny'             // Deny by default
      bypass: 'AzureServices'
    }
    encryption: {
      services: {
        blob: { enabled: true, keyType: 'Account' }
        file: { enabled: true, keyType: 'Account' }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}
```

**Storage redundancy options:**

| Redundancy | Copies | Use case |
|------------|--------|----------|
| **LRS** | 3 (single DC) | Dev/test, non-critical data |
| **ZRS** | 3 (across AZs) | Production data, high availability |
| **GRS** | 6 (2 regions) | DR, compliance, critical backups |
| **GZRS** | 6 (ZRS + regional copy) | Maximum durability and availability |

**Access tiers:**

| Tier | Use case | Access cost | Storage cost |
|------|----------|------------|-------------|
| **Hot** | Frequently accessed data | Low | Higher |
| **Cool** | Infrequent access (30+ days) | Medium | Lower |
| **Cold** | Rarely accessed (90+ days) | Higher | Lower |
| **Archive** | Long-term retention (180+ days) | Highest (rehydration hours) | Lowest |

- **Use lifecycle management policies** to transition blobs to cooler tiers automatically.
- **Disable shared key access** and use Entra ID RBAC (`Storage Blob Data Contributor`).
- **Use immutability policies** for compliance (legal hold, time-based retention).
- **Enable soft delete** (14+ days) and versioning for important containers.

### 5. Caching with Azure Cache for Redis

**When to add a cache:**

- Database queries are a bottleneck (high read-to-write ratio)
- Same data is requested repeatedly
- Latency requirements are sub-millisecond
- You need session storage shared across instances

**Tier selection:**

| Tier | Use case | Clustering | Zone redundancy |
|------|----------|------------|-----------------|
| **Basic** | Dev/test only | No | No |
| **Standard** | Production (single node + replica) | No | No |
| **Premium** | High performance, persistence, clustering | Yes | Yes |
| **Enterprise** | Redis modules (RediSearch, RedisJSON, RedisTimeSeries) | Yes | Yes |

- **Use Premium or Enterprise tier for production** — they support zone redundancy and clustering.
- **Use Private Endpoints** — never expose Redis to the public internet.
- **Enable data persistence** (RDB/AOF) for Premium tier if cache warmup time is critical.
- **Set TTLs on all keys.** No TTL = memory exhaustion.

**Cache strategies:**

- **Cache-aside (lazy loading):** App checks cache first, loads from DB on miss, writes to cache. Most common.
- **Write-through:** Write to cache and DB simultaneously. Ensures cache is always current but adds write latency.
- **TTL on everything.** Always set a TTL. Infinite TTLs lead to stale data and memory exhaustion.

## Best Practices

- **One database per service** in a microservices architecture. No shared databases.
- **Use managed identities** to access databases and storage. No connection strings with passwords in config files.
- **Design Cosmos DB containers for access patterns first.** If you're modelling entities like a relational DB, you're doing it wrong.
- **Enable Private Endpoints** on every data store in production — SQL, Storage, Cosmos DB, Redis.
- **Back up everything.** Enable automated backups, PITR, and geo-redundant storage for critical data.
- **Monitor storage costs.** Blob containers and log data grow silently. Set up lifecycle rules and cost alerts.

## Common Pitfalls

- **Using Cosmos DB like a relational database.** Trying to do JOINs, complex filters across partitions, or ad-hoc queries leads to high RU costs and poor performance.
- **Azure Functions + SQL without connection pooling.** Each function invocation may open a new connection. Use Azure SQL's built-in connection pooling and keep connections short-lived.
- **Storage Accounts without lifecycle rules.** Log and upload containers grow unbounded. Cost increases silently.
- **Wrong Cosmos DB partition key.** A bad partition key creates hot partitions and throttling. Think hard about access patterns upfront.
- **Public endpoints on databases.** Default Azure SQL, Cosmos DB, and Storage Accounts are publicly accessible. Use Private Endpoints.
- **Caching without invalidation strategy.** A cache is only useful if the data is reasonably fresh. Define TTLs and invalidation logic upfront.

## Reference

- [Azure Cosmos DB Documentation](https://learn.microsoft.com/en-us/azure/cosmos-db/)
- [Azure SQL Database Documentation](https://learn.microsoft.com/en-us/azure/azure-sql/database/)
- [Azure Blob Storage Documentation](https://learn.microsoft.com/en-us/azure/storage/blobs/)
- [Azure Cache for Redis Best Practices](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-best-practices)
- [Data Store Decision Tree](https://learn.microsoft.com/en-us/azure/architecture/guide/technology-choices/data-store-decision-tree)
