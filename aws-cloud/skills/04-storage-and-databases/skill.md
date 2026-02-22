# Storage & Databases

## Description

Choose, configure, and operate AWS storage and database services. This skill covers the full spectrum — object storage (S3), relational databases (RDS, Aurora), NoSQL (DynamoDB), caching (ElastiCache), and the decision framework for picking the right data store for each workload.

## When To Use

- Choosing a database for a new service or feature
- Designing DynamoDB table schemas and access patterns
- Configuring RDS or Aurora for production (Multi-AZ, read replicas, backups)
- Setting up S3 buckets with proper security, lifecycle, and replication policies
- Adding caching layers to reduce latency and database load
- Planning data migration strategies

## Prerequisites

- Understanding of relational vs NoSQL data models
- Familiarity with SQL and basic database concepts (indexing, transactions)
- Basic understanding of AWS networking (VPC, subnets, security groups)

## Instructions

### 1. Pick the Right Database

| Service | Type | Best for | Avoid when |
|---------|------|----------|------------|
| **DynamoDB** | Key-value / document | Single-digit-ms latency at any scale, serverless apps, known access patterns | Complex queries, ad-hoc analytics, many-to-many relationships |
| **Aurora (PostgreSQL/MySQL)** | Relational (managed) | Transactional workloads, complex queries, existing SQL apps | Extreme write scale, simple key-value access |
| **RDS** | Relational (managed) | PostgreSQL, MySQL, MariaDB, SQL Server, Oracle — when Aurora isn't available or needed | New apps where Aurora is available and fits |
| **ElastiCache (Redis)** | In-memory cache/store | Session storage, caching, leaderboards, pub/sub | Persistent primary data store |
| **OpenSearch** | Search / analytics | Full-text search, log analytics, dashboards | Primary transactional data |
| **Neptune** | Graph | Social networks, fraud detection, knowledge graphs | Tabular data, simple lookups |
| **Timestream** | Time series | IoT metrics, application telemetry, time-series analytics | General-purpose queries |

**Decision flow:**

```
Do you need transactions and complex queries?
  ├── Yes → Aurora PostgreSQL (or RDS if Aurora isn't suitable)
  └── No → Are access patterns well-defined and consistent?
        ├── Yes → DynamoDB
        └── No → Is it search/analytics?
              ├── Yes → OpenSearch
              └── No → Evaluate based on data shape and query needs
```

### 2. DynamoDB — Design for Access Patterns

DynamoDB requires upfront access pattern design. You cannot bolt on query flexibility later.

**Single-table design principles:**

```
PK                    SK                    Data
USER#123              PROFILE               { name, email, ... }
USER#123              ORDER#2024-001        { total, status, ... }
USER#123              ORDER#2024-002        { total, status, ... }
ORG#456               METADATA              { name, plan, ... }
ORG#456               MEMBER#USER#123       { role, joinedAt, ... }
```

- **Design for queries, not entities.** Start with your access patterns, then design the schema.
- **Use composite sort keys** for hierarchical data and range queries.
- **Use GSIs sparingly** — each GSI is a full copy of the projected attributes.
- **Use on-demand capacity** for unpredictable workloads. Switch to provisioned with auto-scaling when patterns are stable.
- **Enable point-in-time recovery (PITR)** for all production tables.

### 3. Aurora / RDS — Relational on AWS

**Production configuration checklist:**

- [ ] Multi-AZ enabled (automatic failover)
- [ ] Automated backups with appropriate retention (7-35 days)
- [ ] Encryption at rest (KMS)
- [ ] Enhanced Monitoring enabled
- [ ] Performance Insights enabled
- [ ] Deployed in private subnets (no public access)
- [ ] Security group allows only application tier
- [ ] Parameter group tuned for workload
- [ ] Read replicas for read-heavy workloads

**Aurora-specific benefits:**

- **Aurora Serverless v2** — auto-scales compute between min/max ACUs. Great for variable workloads.
- **Global Database** — sub-second cross-region replication for DR and low-latency global reads.
- **Parallel Query** — for analytical queries on transactional data without impacting OLTP performance.

### 4. S3 — Object Storage

S3 is the default storage layer for nearly everything:

**Security baseline:**

```yaml
MyBucket:
  Type: AWS::S3::Bucket
  Properties:
    BucketEncryption:
      ServerSideEncryptionConfiguration:
        - ServerSideEncryptionByDefault:
            SSEAlgorithm: aws:kms
    PublicAccessBlockConfiguration:
      BlockPublicAcls: true
      BlockPublicPolicy: true
      IgnorePublicAcls: true
      RestrictPublicBuckets: true
    VersioningConfiguration:
      Status: Enabled
    LifecycleConfiguration:
      Rules:
        - Id: TransitionToIA
          Status: Enabled
          Transitions:
            - StorageClass: STANDARD_IA
              TransitionInDays: 30
            - StorageClass: GLACIER
              TransitionInDays: 90
```

**Storage class selection:**

| Class | Use case | Min duration |
|-------|----------|-------------|
| **Standard** | Frequently accessed data | None |
| **Standard-IA** | Infrequent access, rapid retrieval needed | 30 days |
| **One Zone-IA** | Infrequent, non-critical, reproducible data | 30 days |
| **Glacier Instant** | Archive with millisecond retrieval | 90 days |
| **Glacier Flexible** | Archive with minutes-to-hours retrieval | 90 days |
| **Glacier Deep Archive** | Long-term archive, 12-hour retrieval | 180 days |

- **Enable versioning** on all buckets containing important data.
- **Use lifecycle rules** to transition objects to cheaper storage classes automatically.
- **Use S3 Intelligent-Tiering** when access patterns are unpredictable.
- **Block all public access** at the account level unless explicitly needed.

### 5. Caching with ElastiCache

**When to add a cache:**

- Database queries are a bottleneck (high read-to-write ratio)
- Same data is requested repeatedly
- Latency requirements are sub-millisecond
- You need session storage shared across instances

**Redis vs Memcached:**

| Feature | Redis | Memcached |
|---------|-------|-----------|
| Data structures | Strings, hashes, lists, sets, sorted sets | Simple key-value |
| Persistence | Yes (snapshots, AOF) | No |
| Replication | Yes (Multi-AZ, read replicas) | No |
| Pub/Sub | Yes | No |
| Cluster mode | Yes | Yes |

**Use Redis in nearly all cases.** Memcached is only preferable for simple caching with multi-threaded access.

**Cache strategies:**

- **Cache-aside (lazy loading):** App checks cache first, loads from DB on miss, writes to cache. Most common.
- **Write-through:** Write to cache and DB simultaneously. Ensures cache is always current.
- **TTL on everything.** Always set a TTL. Infinite TTLs lead to stale data and memory exhaustion.

## Best Practices

- **One database per service** in a microservices architecture. No shared databases.
- **Use connection pooling** (RDS Proxy, PgBouncer) for Lambda-to-RDS connections to avoid connection exhaustion.
- **Design DynamoDB tables for access patterns first.** If you're modelling entities like a relational DB, you're doing it wrong.
- **Enable encryption at rest** on every data store — S3, RDS, DynamoDB, ElastiCache. There's negligible performance impact.
- **Back up everything.** Enable automated backups, PITR, and cross-region replication for critical data.
- **Monitor storage costs.** S3 buckets and EBS volumes grow silently. Set up lifecycle rules and alerts.

## Common Pitfalls

- **Using DynamoDB like a relational database.** Trying to do JOINs, complex filters, or ad-hoc queries against DynamoDB leads to table scans and frustration.
- **Lambda + RDS without connection pooling.** Each Lambda invocation opens a new database connection. At scale, you'll exhaust the connection limit. Use RDS Proxy.
- **S3 buckets without lifecycle rules.** Log and upload buckets grow unbounded. Cost increases silently.
- **No read replicas for read-heavy workloads.** Sending all reads to the primary instance wastes resources and increases latency.
- **Over-provisioned DynamoDB.** Provisioned mode with high WCU/RCU for tables that get sporadic traffic. Use on-demand mode.
- **Caching without invalidation strategy.** A cache is only useful if the data is reasonably fresh. Define TTLs and invalidation logic upfront.

## Reference

- [Amazon DynamoDB Developer Guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
- [DynamoDB Single-Table Design](https://www.alexdebrie.com/posts/dynamodb-single-table-design/)
- [Amazon Aurora User Guide](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/CHAP_AuroraOverview.html)
- [Amazon S3 Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)
- [ElastiCache Best Practices](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/BestPractices.html)
