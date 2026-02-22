# Serverless Architecture Review

Review the serverless architecture for anti-patterns, scalability issues, coupling problems, and alignment with serverless best practices.

## Check For

### 1. Function Granularity
- Functions follow single-responsibility principle (one function = one task)
- No "monolith Lambda/Function" anti-pattern (single function handling multiple routes or all business logic)
- Functions are stateless — no in-memory state between invocations
- Function code is focused on glue/orchestration, not heavy business logic that should be in shared libraries

### 2. Event-Driven Design
- Services communicate through events, not synchronous chains
- No "Lambda pinball" — deeply nested synchronous function-to-function calls
- Event schemas are versioned and documented
- Dead-letter queues (DLQ) are configured for every async event source
- Idempotency is implemented for all event handlers

### 3. Cold Start Impact
- Latency-sensitive paths avoid cold-start-prone runtimes or use provisioned concurrency / always-ready instances
- Dependency bundles are minimised (no unnecessary libraries inflating package size)
- Initialisation code is outside the handler (connection pooling, SDK clients)
- Warm-up strategies are documented for user-facing synchronous endpoints

### 4. State Management
- No reliance on local file system or in-memory state between invocations
- External state stores are appropriate for the access pattern (key-value, relational, document)
- Caching strategy avoids redundant database/API calls per invocation
- Connection pooling is reused across warm invocations, not created per-request

### 5. Error Handling & Resilience
- Retry policies are configured with exponential backoff
- Poison messages are routed to dead-letter queues with alerting
- Partial failures in fan-out patterns are handled (some succeed, some fail)
- Timeouts are set appropriately — not at the maximum allowed duration
- Circuit breaker or fallback patterns protect downstream dependencies

### 6. Security
- Functions run with least-privilege permissions (no wildcard IAM/RBAC)
- Secrets are fetched from a secrets manager, not environment variables
- API endpoints have authentication and authorisation
- Input validation occurs at the function entry point
- VPC/VNet placement is justified (only when accessing private resources)

### 7. Cost Awareness
- Memory/CPU allocation is tuned (not left at defaults)
- Execution duration is monitored — long-running functions may be cheaper as containers
- Unnecessary invocations are eliminated (polling replaced with event triggers)
- Log verbosity is controlled — debug logging is off in production

## Output Format

For each finding, report:

| Field | Description |
|-------|-------------|
| **Severity** | 🔴 Critical · 🟡 Warning · 🟢 Suggestion |
| **Category** | Granularity · Event Design · Cold Start · State · Resilience · Security · Cost |
| **Location** | Function name, file, or architectural component |
| **Issue** | What the problem is |
| **Recommendation** | Specific fix with code or architecture change |
