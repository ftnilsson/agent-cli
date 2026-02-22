# Serverless Cost Review

Analyse serverless workload costs for optimisation opportunities across invocations, duration, memory allocation, and architectural patterns.

## Check For

### 1. Invocation Costs
- Unnecessary invocations are eliminated (polling triggers replaced with event-driven triggers)
- Fan-out cardinality is controlled — one event does not trigger thousands of redundant invocations
- Batch processing is used where supported (SQS batch, Event Hub batch) to reduce per-invocation overhead
- Scheduled functions run at appropriate intervals (not every minute when every hour suffices)

### 2. Duration & Memory Optimisation
- Memory allocation is right-sized using power tuning (not default or maximum)
- CPU-bound functions benefit from higher memory (faster execution × higher cost = net savings)
- Function duration is minimised — no unnecessary waits, sleeps, or sequential external calls
- Execution time is tracked and anomalies trigger alerts

### 3. Architecture Cost Patterns
- Serverless is the right model for the workload (not running a constant 100% utilisation workload on pay-per-invocation)
- Workloads exceeding cost breakeven (~50-70% steady utilisation) are candidates for containers
- Step functions / orchestration is used for complex workflows instead of long-running single functions
- Event filtering is applied at the source (not invoking a function just to discard the event)

### 4. Data Transfer
- Cross-region invocations are minimised
- Functions and their data stores are co-located in the same region
- API Gateway caching reduces origin invocations for repeated requests
- Large payloads use claim-check pattern to avoid inflated execution time and transfer costs

### 5. Storage & Logging Costs
- Log retention periods are set (not infinite)
- Debug/verbose logging is disabled in production
- Log sampling is used for high-throughput functions
- Temporary files and data are cleaned up — not accumulating in storage

### 6. Pricing Model Optimisation
- Provisioned concurrency is only used where cold-start latency justifies the cost
- Savings plans / committed use discounts are considered for predictable baseline workloads
- Free tier allocations are understood and maximised for development and low-traffic services
- ARM64 runtimes are used where available (typically 20% cheaper)

### 7. Monitoring & Governance
- Cost alerts and budgets are configured per serverless workload
- Per-function cost attribution is possible (tagging, separate accounts/subscriptions, or tooling)
- Cost anomaly detection is enabled
- Monthly cost reviews include serverless workloads specifically

## Output Format

For each finding, report:

| Field | Description |
|-------|-------------|
| **Severity** | 🔴 Critical · 🟡 Warning · 🟢 Suggestion |
| **Category** | Invocations · Duration/Memory · Architecture · Data Transfer · Storage/Logging · Pricing · Governance |
| **Location** | Function name, service, or workload |
| **Current Cost Impact** | Estimated monthly cost or percentage of spend |
| **Recommendation** | Specific change with estimated savings |
