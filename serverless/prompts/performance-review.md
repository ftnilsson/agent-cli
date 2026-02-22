# Serverless Performance Review

Review serverless workloads for cold-start risks, concurrency bottlenecks, resource allocation inefficiencies, and optimisation opportunities.

## Check For

### 1. Cold Start Analysis
- Identify functions on latency-sensitive paths (synchronous user-facing APIs)
- Package/bundle size is optimised — tree-shaken, no unnecessary dependencies
- Runtime choice is appropriate for latency requirements (compiled runtimes start faster at scale)
- Provisioned concurrency / always-ready instances are configured for critical paths
- SDK clients and connections are initialised outside the handler for reuse across warm invocations

### 2. Memory & CPU Allocation
- Memory is tuned based on actual usage, not left at defaults (128 MB or 1024 MB)
- CPU-bound functions have enough memory allocated (memory controls CPU allocation on most platforms)
- Power-tuning has been performed or is planned (test multiple memory sizes for cost/duration sweet spot)
- ARM64 architecture is used where supported (better price/performance)

### 3. Concurrency & Throttling
- Reserved concurrency is set on critical functions to prevent throttling
- Concurrency limits protect downstream dependencies from being overwhelmed
- Burst limits are understood and accounted for in architecture
- Fan-out patterns limit parallelism to avoid thundering herd on databases/APIs

### 4. Execution Duration
- Function execution time is monitored — P50, P95, P99
- Functions timing out are investigated (not just increasing timeout)
- Long-running operations are decomposed into orchestrated steps
- External call timeouts are configured and shorter than function timeout

### 5. Payload & Data Transfer
- Event payloads are compact — large data uses claim-check pattern (S3/Blob reference)
- Response payloads are paginated or streamed for large result sets
- Binary data is not base64-encoded in JSON events unnecessarily
- Data compression is used for cross-region or high-volume transfers

### 6. Connection Management
- Database connections are pooled and reused across warm invocations
- Connection limits per function are set to prevent pool exhaustion
- HTTP clients use keep-alive and connection reuse
- Serverless-friendly connection strategies are used (connection proxies, HTTP-based database access)

### 7. Caching
- Frequently accessed reference data is cached (in-memory for warm invocations, external cache for shared)
- Cache invalidation strategy is defined and documented
- API responses use appropriate Cache-Control headers
- CDN/edge caching is used for static and semi-static content

## Output Format

For each finding, report:

| Field | Description |
|-------|-------------|
| **Severity** | 🔴 Critical · 🟡 Warning · 🟢 Suggestion |
| **Category** | Cold Start · Memory/CPU · Concurrency · Duration · Payload · Connections · Caching |
| **Location** | Function name, service, or architectural component |
| **Impact** | Estimated latency, cost, or reliability impact |
| **Recommendation** | Specific optimisation with expected improvement |
