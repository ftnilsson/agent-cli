# Architecture & Design Patterns

## Description

Design serverless architectures that are scalable, cost-effective, and maintainable. This skill covers when to use serverless, event-driven architecture patterns, bounded contexts in serverless, composition strategies, and the trade-offs that determine whether a workload belongs on functions, containers, or a hybrid. All patterns are cloud-agnostic — combine with a cloud provider category for implementation specifics.

## When To Use

- Evaluating whether a workload is a good fit for serverless
- Designing a new serverless application or migrating from servers/containers
- Choosing between choreography (events) and orchestration (workflows) for multi-step processes
- Decomposing a monolith into serverless functions
- Defining bounded contexts and service boundaries in a serverless system

## Prerequisites

- Understanding of distributed systems concepts (eventual consistency, CAP theorem)
- Familiarity with event-driven architecture at a conceptual level
- Basic knowledge of at least one serverless platform (AWS Lambda, Azure Functions, Google Cloud Functions)

## Instructions

### 1. When to Go Serverless

Serverless is ideal when:

| Characteristic | Serverless fits | Serverless doesn't fit |
|----------------|----------------|----------------------|
| **Traffic pattern** | Spiky, unpredictable, or low-traffic | Constant high-throughput (>70% utilisation) |
| **Execution time** | Short tasks (<15 min) | Long-running processes (hours) |
| **State** | Stateless request/response or event processing | Stateful, in-memory workloads (game servers, caches) |
| **Latency tolerance** | Can tolerate cold starts (async) or uses provisioned concurrency | Sub-millisecond latency required |
| **Team size** | Small teams wanting less ops overhead | Teams with dedicated platform/infra engineers |
| **Cost model** | Pay-per-use preferred over reserved capacity | Predictable flat-rate budgeting required |

**The serverless decision is per-workload, not per-application.** A single application can mix serverless functions (event handlers, APIs) with containers (background workers, WebSocket servers) and managed services (databases, queues).

### 2. Event-Driven Architecture

Serverless is inherently event-driven. Every function invocation is triggered by an event:

```
┌──────────────────────────────────────────────────────────┐
│                    Event Sources                          │
│                                                          │
│  HTTP Request    Queue Message    Schedule (cron)        │
│  Database Change File Upload      Stream Record          │
│  IoT Message     Webhook          Custom Event           │
└─────────────┬────────────┬───────────────┬───────────────┘
              │            │               │
              ▼            ▼               ▼
         ┌─────────┐ ┌─────────┐    ┌─────────┐
         │Function A│ │Function B│    │Function C│
         └────┬─────┘ └────┬─────┘    └────┬─────┘
              │            │               │
              ▼            ▼               ▼
         ┌─────────┐ ┌─────────┐    ┌─────────┐
         │Database  │ │Queue    │    │Storage  │
         └─────────┘ └─────────┘    └─────────┘
```

**Design principles:**

- **Events are facts.** They describe what happened (`OrderPlaced`, `UserRegistered`), not what to do.
- **Functions react.** Each function processes one type of event and produces zero or more new events.
- **Loose coupling.** Producers don't know about consumers. The event bus/queue connects them.
- **Eventual consistency.** State changes propagate asynchronously. Design for it.

### 3. Choreography vs Orchestration

| Approach | How it works | Best for | Watch out for |
|----------|-------------|----------|---------------|
| **Choreography** | Services react to events independently. No central coordinator. | Simple workflows, independent reactions, high autonomy | Hard to track multi-step flows, debugging requires correlation |
| **Orchestration** | A central workflow engine (Step Functions, Durable Functions) controls the sequence. | Complex multi-step processes, error handling with compensation, human approval | Single point of coordination, can become a bottleneck |

**Choreography example:**

```
OrderPlaced ──▶ PaymentService ──▶ PaymentProcessed ──▶ InventoryService
                                                    ──▶ NotificationService
                                                    ──▶ AnalyticsService
```

**Orchestration example:**

```
Orchestrator
  ├── Step 1: ValidateOrder()
  ├── Step 2: ProcessPayment()
  ├── Step 3: [parallel]
  │     ├── ReserveInventory()
  │     ├── SendConfirmation()
  │     └── UpdateAnalytics()
  └── Step 4: ShipOrder()
```

**Rule of thumb:** Use choreography for ≤3 steps with independent reactions. Use orchestration for >3 steps, ordered sequences, error compensation, or human-in-the-loop workflows.

### 4. Serverless Composition Patterns

| Pattern | Description | When to use |
|---------|-------------|-------------|
| **Function chain** | Function A → Queue → Function B → Queue → Function C | Sequential processing pipeline |
| **Fan-out / fan-in** | One event triggers N parallel functions, results aggregated | Parallel processing (image thumbnails, batch validation) |
| **Async HTTP** | API receives request → enqueues work → returns 202 Accepted → client polls for result | Long-running operations behind an API |
| **Event fork** | One event published to a topic → multiple subscribers react independently | Multi-consumer notifications |
| **Aggregator** | Collect events from multiple sources → produce summary event | Batch processing, reporting |
| **Claim check** | Store large payload in object storage → pass reference in event | Events with large data (images, documents, CSVs) |

### 5. Bounded Contexts in Serverless

Organise functions into logical service boundaries:

```
project/
├── services/
│   ├── orders/             # Bounded context: Orders
│   │   ├── create-order/   # Function
│   │   ├── process-order/  # Function
│   │   ├── get-order/      # Function
│   │   └── shared/         # Shared code within this context
│   ├── payments/           # Bounded context: Payments
│   │   ├── process-payment/
│   │   ├── refund/
│   │   └── shared/
│   └── notifications/      # Bounded context: Notifications
│       ├── send-email/
│       ├── send-sms/
│       └── shared/
├── libs/                   # Cross-context shared libraries
│   ├── event-schemas/
│   └── common-utils/
└── infra/                  # Infrastructure as Code
    ├── main.bicep / template.yaml
    └── parameters/
```

**Rules:**

- Functions within a bounded context can share code via a local `shared/` module.
- Functions across contexts communicate only through events or APIs — never shared databases.
- Each context owns its data store. No cross-context database queries.
- Event schemas are versioned and published to a shared schema library.

### 6. Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|-------------|---------|-----|
| **Monolith function** | One function handles all routes/events. Can't scale independently. | Split into single-responsibility functions. |
| **Lambda pinball** | Synchronous function-to-function calls via SDK (not events). Creates tight coupling and multiplied latency. | Use queues/events between functions. |
| **Serverless for everything** | Using functions for WebSockets, long-running jobs, or constant-throughput workloads. | Use containers or managed services for workloads that don't fit. |
| **Shared database** | Multiple services read/write the same tables. Creates hidden coupling. | Each service owns its data. Use events to synchronise. |
| **No dead-letter queue** | Failed events are silently lost. | Configure DLQ on every async event source. |
| **Synchronous fan-out** | Calling 10 APIs sequentially in one function. | Use parallel invocation or fan-out to queue. |

## Best Practices

- **Design for failure.** Every external call can fail. Use retries, DLQs, and circuit breakers.
- **Design for idempotency.** Events will be delivered more than once. Make every handler safe to re-execute.
- **Keep functions small.** Small package size (<5 MB), short execution time (<30 seconds for sync, <5 minutes for async), single purpose.
- **Use managed services for glue.** Queues, event buses, object storage, and managed databases are the connective tissue. Don't build your own message broker in a function.
- **Version your events.** Event schemas change over time. Use versioning (e.g., `com.myapp.OrderPlaced.v2`) to avoid breaking consumers.

## Common Pitfalls

- **Starting with too many functions.** Start with a few functions per bounded context and split when there's a scaling or deployment reason, not upfront.
- **Ignoring cold starts in architecture.** If user-facing latency matters, plan for cold starts from day one — don't discover it in production.
- **No correlation IDs.** Without a trace/correlation ID flowing through all events, debugging distributed serverless systems is nearly impossible.
- **Over-engineering.** Not every CRUD API needs event sourcing, CQRS, and saga orchestration. Start simple.

## Reference

- [Serverless Architectures (Martin Fowler)](https://martinfowler.com/articles/serverless.html)
- [AWS Serverless Application Lens](https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/welcome.html)
- [Azure Serverless Community Library](https://serverlesslibrary.net/)
- [The Twelve-Factor App](https://12factor.net/) — many principles apply directly to serverless
