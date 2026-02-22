# Event-Driven Integration

## Description

Design event-driven integrations between serverless functions using event sources, triggers, routing, and schema management. This skill covers the reactive patterns that connect serverless functions to each other and to external systems — choreography, event routing, schema evolution, and the difference between events, commands, and queries in a serverless context.

## When To Use

- Connecting serverless functions to event sources (queues, streams, webhooks, schedules)
- Designing event flows between services (choreography vs orchestration)
- Defining and versioning event schemas for cross-service communication
- Implementing event filtering, transformation, and routing
- Handling event delivery guarantees (at-least-once, ordering, deduplication)

## Prerequisites

- Understanding of serverless architecture patterns (skill 01)
- Familiarity with messaging concepts (queues, topics, pub/sub)
- Understanding of idempotency (skill 02)

## Instructions

### 1. Event Source Types

Every serverless function needs a trigger — the event that causes it to execute:

| Trigger type | Examples | Invocation model |
|-------------|---------|-----------------|
| **Synchronous** | HTTP request, API gateway | Request → function → response (caller waits) |
| **Asynchronous** | Queue message, topic subscription | Event → function → acknowledge (fire and forget) |
| **Stream** | Change stream, Kinesis, Event Hub | Ordered batch of records → function → checkpoint |
| **Schedule** | Cron, timer | Time-based → function → complete |
| **Resource event** | Blob uploaded, DB change, deploy | Cloud resource → event → function |
| **Webhook** | Stripe event, GitHub event | External system → HTTP → function |

**Choose trigger type based on the pattern:**

```
Need immediate response?
  ├── Yes → Synchronous (HTTP trigger)
  └── No → Is ordering important?
        ├── Yes → Stream trigger (per-partition ordering)
        └── No → Is it a reaction to something happening?
              ├── Yes → Async (queue/topic trigger)
              └── No → Is it time-based?
                    ├── Yes → Schedule trigger
                    └── No → Resource event trigger
```

### 2. Event Design

**Events vs Commands vs Queries:**

| Type | Describes | Direction | Example |
|------|----------|-----------|---------|
| **Event** | What happened (past tense) | Producer → many consumers | `OrderPlaced`, `PaymentFailed` |
| **Command** | What to do (imperative) | Sender → one receiver | `ProcessPayment`, `SendEmail` |
| **Query** | What data is needed | Requester → responder | `GetOrderStatus`, `ListProducts` |

**Use events for inter-service communication.** Commands within a service are fine, but crossing service boundaries with commands creates coupling.

**Event schema structure:**

```json
{
  "id": "evt-a1b2c3d4",
  "source": "orders-service",
  "type": "com.myapp.order.placed",
  "specversion": "1.0",
  "time": "2025-02-14T10:30:00.000Z",
  "datacontenttype": "application/json",
  "subject": "orders/ORD-2024-001",
  "data": {
    "orderId": "ORD-2024-001",
    "customerId": "CUST-ABC123",
    "items": [
      { "productId": "PROD-001", "quantity": 2, "price": 29.99 }
    ],
    "total": 59.98,
    "currency": "USD"
  }
}
```

**Use the CloudEvents specification** for event envelope format. It provides a standardised structure with `id`, `source`, `type`, `time`, and `data` fields that work across all cloud providers and messaging systems.

### 3. Event Routing Patterns

**Direct routing (point-to-point):**

```
OrderService ──▶ Queue: process-payments ──▶ PaymentService
```

Simple. One producer, one consumer. Use a queue.

**Fan-out (pub/sub):**

```
OrderService ──▶ Topic: order-events ──▶ PaymentService
                                     ──▶ InventoryService
                                     ──▶ NotificationService
                                     ──▶ AnalyticsService
```

One event, many consumers. Each gets a copy. Consumers are independent.

**Content-based routing (filtered subscriptions):**

```
OrderService ──▶ Topic: order-events
                    │
                    ├── Filter: total > 100 ──▶ FraudCheckService
                    ├── Filter: region = "EU" ──▶ EUComplianceService
                    └── Filter: * (all) ──▶ AnalyticsService
```

Subscribers only receive events matching their filter. This is more efficient than filtering in the function.

**Event bridge / bus (centralised routing):**

```
┌─────────────────────────────────────────────┐
│              Event Bus / Router              │
│                                              │
│  Rule: source=orders, type=OrderPlaced       │
│    ──▶ PaymentQueue                          │
│    ──▶ InventoryQueue                        │
│                                              │
│  Rule: source=payments, type=PaymentFailed   │
│    ──▶ OrdersQueue (compensation)            │
│    ──▶ NotificationQueue                     │
│                                              │
│  Rule: * (catch-all)                         │
│    ──▶ AuditLogStorage                       │
└─────────────────────────────────────────────┘
```

Centralised routing rules. Producers publish to the bus, rules route to consumers. Good for complex event topologies.

### 4. Schema Evolution

Events schemas change over time. Handle it without breaking consumers:

**Rules for backward-compatible changes:**

- ✅ **Add optional fields** — old consumers ignore them
- ✅ **Add new event types** — old consumers don't subscribe to them
- ❌ **Remove fields** — old consumers break
- ❌ **Rename fields** — old consumers break
- ❌ **Change field types** — old consumers break

**Versioning strategies:**

| Strategy | How | Example |
|----------|-----|---------|
| **Type-based** | Include version in event type | `com.myapp.order.placed.v2` |
| **Envelope** | Version field in the event | `{ "schemaVersion": 2, ... }` |
| **Content negotiation** | Producer sends multiple formats | Rarely used in events |

**When you must make breaking changes:**

1. Publish both v1 and v2 events simultaneously during a transition period.
2. Consumers migrate to v2 at their own pace.
3. Once all consumers have migrated, stop publishing v1.

```typescript
// Producer — dual-publish during migration
async function publishOrderPlaced(order: Order): Promise<void> {
  // V1 — legacy consumers
  await eventBus.publish({
    type: 'com.myapp.order.placed.v1',
    data: { orderId: order.id, total: order.total },
  });

  // V2 — new format with currency
  await eventBus.publish({
    type: 'com.myapp.order.placed.v2',
    data: { orderId: order.id, amount: { value: order.total, currency: order.currency } },
  });
}
```

### 5. Dead-Letter Queues (DLQ)

Every async event source must have a DLQ:

```
Source Queue ──▶ Function ──▶ Success
      │                │
      │  retry (N times)│
      │◀───────────────┘
      │
      │  max retries exceeded
      ▼
  Dead-Letter Queue ──▶ Alert ──▶ Investigate & replay
```

**DLQ rules:**

- **Configure max retry count** (typically 3-5 for queues, 2-3 for event subscriptions).
- **Alert on DLQ message count.** Any message in the DLQ needs human attention.
- **Include the original event, error details, and timestamp** in DLQ metadata.
- **Build a replay mechanism.** You need to be able to move messages from the DLQ back to the source queue after fixing the issue.
- **Set DLQ retention** longer than the source queue (e.g., 14 days vs 7 days).

### 6. Event Ordering

| Guarantee | How to achieve | Use when |
|-----------|---------------|----------|
| **No ordering** | Standard queue (SQS, Storage Queue) | Independent events, idempotent handlers |
| **Per-entity ordering** | Queue sessions / message groups (same partition key) | Events for the same order must be processed in sequence |
| **Global ordering** | Single partition stream (Kinesis, Event Hub) | Rare — limits throughput to one partition |

```
// Per-entity ordering: all events for order ORD-001 go to the same partition
publish({
  type: 'OrderUpdated',
  partitionKey: 'ORD-001',  // Ensures ordering within this order
  data: { ... }
});
```

**Rule of thumb:** Design for unordered processing with idempotency. Use ordered delivery only when you truly need it (state machine transitions, event sourcing).

## Best Practices

- **Use CloudEvents format.** Standard envelope, wide tooling support, cloud-agnostic.
- **Filter at the source, not in the function.** Use subscription filters, event rules, or topic policies to avoid invoking functions for events they'll discard.
- **Configure DLQ on every async trigger.** No exceptions.
- **Version your schemas from day one.** Adding `schemaVersion: 1` costs nothing and saves pain later.
- **Keep events small.** Include entity IDs and essential fields. Consumers can look up full details if needed. Large payloads use claim-check.
- **Document event flows.** An event flow diagram showing producers → topics/queues → consumers is essential for onboarding and debugging.

## Common Pitfalls

- **No DLQ.** Failed events are retried infinitely or silently dropped. Both are bad.
- **Events with too much data.** An event containing the full customer profile, all orders, and address history is fragile and expensive. Include IDs, let consumers query what they need.
- **Circular event flows.** Service A publishes event → Service B reacts → publishes event → Service A reacts → publishes event → infinite loop. Detect and break cycles with idempotency or event metadata.
- **Tight coupling via events.** If Consumer B breaks when Producer A changes its event payload, you have coupling. Use schema versioning and backward-compatible changes.
- **Relying on event ordering across partitions.** Most messaging systems only guarantee ordering within a partition or session. Cross-partition ordering is not guaranteed.

## Reference

- [CloudEvents Specification](https://cloudevents.io/)
- [Event-Driven Architecture (Martin Fowler)](https://martinfowler.com/articles/201701-event-driven.html)
- [Enterprise Integration Patterns](https://www.enterpriseintegrationpatterns.com/)
- [AWS EventBridge](https://docs.aws.amazon.com/eventbridge/)
- [Azure Event Grid](https://learn.microsoft.com/en-us/azure/event-grid/)
