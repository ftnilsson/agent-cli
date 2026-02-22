# Serverless Function Review

Review serverless function code for best practices in design, error handling, performance, and maintainability.

## Check For

### 1. Single Responsibility
- Function handles exactly one trigger and one logical operation
- Business logic is extracted into testable modules/classes, not inlined in the handler
- Handler code is thin — validates input, calls business logic, returns output
- No shared mutable state between invocations (global variables used only for reusable clients)

### 2. Idempotency
- Duplicate invocations produce the same result (at-least-once delivery is assumed)
- Idempotency key is derived from the event (message ID, request ID, or business key)
- Database writes use conditional operations (upsert, conditional put, optimistic concurrency)
- Side effects (emails, webhooks, charges) are guarded against duplicate execution

### 3. Error Handling
- All external calls are wrapped in try/catch with meaningful error context
- Retryable errors (network, throttle) are distinguished from permanent errors (validation, not found)
- Errors are logged with structured context (function name, event source, correlation ID, input summary)
- Unhandled exceptions result in the message returning to the queue (not silently swallowed)
- Partial batch failures are handled where supported (SQS partial batch, Kafka commit)

### 4. Input Validation
- Event payloads are validated at the handler entry point before processing
- Schema validation uses a library (Zod, Joi, Pydantic, FluentValidation), not manual checks
- Invalid input is rejected early with a clear error — not passed through to crash deeper
- Large payloads use the claim-check pattern (reference to blob/S3, not inline data)

### 5. Initialisation & Resource Reuse
- SDK clients, database connections, and HTTP clients are created outside the handler (module scope)
- Connections are reused across warm invocations
- Heavy initialisation (loading ML models, large config) is lazy or uses provisioned concurrency
- No per-invocation resource creation that leaks (connections, file handles)

### 6. Timeout & Duration
- Function timeout is set to a reasonable value (not the maximum allowed)
- Long-running operations are broken into steps (orchestration, step functions, durable functions)
- External call timeouts are shorter than the function timeout
- Graceful shutdown handles in-progress work before timeout

### 7. Logging & Observability
- Structured logging with JSON output (not `console.log` with string concatenation)
- Correlation/trace IDs are propagated from the incoming event
- Cold starts are identifiable from logs (initialisation vs execution timing)
- Sensitive data (PII, secrets, tokens) is never logged

### 8. Dependencies
- Package size is minimal — unused dependencies are removed
- Tree-shaking or bundling is used (esbuild, webpack) to reduce cold-start time
- Native dependencies are compiled for the target runtime (Linux x64/ARM64)
- Dependencies are pinned to specific versions for reproducible builds

## Output Format

For each finding, report:

| Field | Description |
|-------|-------------|
| **Severity** | 🔴 Critical · 🟡 Warning · 🟢 Suggestion |
| **Category** | Responsibility · Idempotency · Error Handling · Validation · Initialisation · Timeout · Logging · Dependencies |
| **Location** | Function name, file path, and line range |
| **Issue** | What the problem is |
| **Recommendation** | Specific fix with code example |
