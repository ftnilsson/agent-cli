# Messaging & Event-Driven Architecture

## Description

Design and implement decoupled, event-driven systems on AWS using SQS, SNS, EventBridge, Step Functions, and Kinesis. This skill covers message queue patterns, pub/sub, event routing, workflow orchestration, and stream processing — the building blocks for scalable, resilient, and loosely coupled architectures.

## When To Use

- Decoupling services to reduce tight coupling and cascading failures
- Processing workloads asynchronously (order processing, email sending, image resizing)
- Building event-driven architectures with fan-out and event routing
- Orchestrating multi-step workflows (order fulfilment, onboarding, ETL)
- Processing real-time data streams (clickstream, IoT, log aggregation)
- Designing retry, dead-letter, and exactly-once processing patterns

## Prerequisites

- Understanding of distributed systems concepts (eventual consistency, idempotency)
- Familiarity with AWS compute services (Lambda, ECS)
- Basic understanding of JSON and message serialisation

## Instructions

### 1. Choose the Right Messaging Service

| Service | Pattern | Use case | Message size | Ordering |
|---------|---------|----------|-------------|----------|
| **SQS** | Queue (point-to-point) | Decouple producer/consumer, buffer workloads | 256 KB | FIFO available |
| **SNS** | Pub/Sub (fan-out) | Notify multiple subscribers, push notifications | 256 KB | FIFO available |
| **EventBridge** | Event bus (content-based routing) | Event-driven architecture, cross-service events, SaaS integration | 256 KB | No |
| **Step Functions** | Workflow orchestration | Multi-step processes, human approval, error handling | 256 KB (payload) | Sequential |
| **Kinesis Data Streams** | Stream processing | Real-time analytics, high-throughput ordered data | 1 MB | Per-shard |

**Decision flow:**

```
Is it a multi-step workflow with branching/error handling?
  ├── Yes → Step Functions
  └── No → Is it real-time stream processing (high throughput, ordering)?
        ├── Yes → Kinesis Data Streams
        └── No → Do multiple consumers need the same event?
              ├── Yes → Need content-based routing? → EventBridge
              │         Just fan-out? → SNS (+ SQS per consumer)
              └── No → SQS (simple queue)
```

### 2. SQS — Queues

**Standard queue vs FIFO queue:**

| Feature | Standard | FIFO |
|---------|----------|------|
| Throughput | Unlimited | 3,000 msg/s (with batching) |
| Ordering | Best-effort | Strict (per message group) |
| Delivery | At-least-once | Exactly-once |
| Deduplication | No | 5-minute window |

**SQS best practices:**

```typescript
// CDK — SQS queue with dead-letter queue
const dlq = new sqs.Queue(this, 'DLQ', {
  retentionPeriod: Duration.days(14),
});

const queue = new sqs.Queue(this, 'OrderQueue', {
  visibilityTimeout: Duration.seconds(60),  // 6x Lambda timeout
  deadLetterQueue: {
    maxReceiveCount: 3,                      // Retry 3 times before DLQ
    queue: dlq,
  },
  encryption: sqs.QueueEncryption.SQS_MANAGED,
});
```

- **Always configure a dead-letter queue (DLQ).** Failed messages should go somewhere visible, not disappear.
- **Set visibility timeout to 6x your consumer timeout.** This prevents messages from being processed concurrently.
- **Use batch processing** (`maxBatchingWindow` + `batchSize`) for Lambda consumers to reduce invocations.
- **Monitor `ApproximateAgeOfOldestMessage`** — this is your processing lag metric.
- **Use long polling** (`receiveMessageWaitTimeSeconds: 20`) to reduce empty receives and cost.

### 3. SNS + SQS — Fan-Out Pattern

The most common pattern for distributing events to multiple consumers:

```
                    ┌──────────────┐
                    │    SNS       │
                    │   Topic      │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ SQS      │ │ SQS      │ │ SQS      │
        │ Queue A  │ │ Queue B  │ │ Queue C  │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Lambda A │ │ Lambda B │ │ ECS      │
        │ (email)  │ │ (analytics)│ │ (heavy)  │
        └──────────┘ └──────────┘ └──────────┘
```

- **SNS for fan-out, SQS for buffering.** Each consumer gets its own SQS queue subscribed to the SNS topic.
- **Use filter policies** on SQS subscriptions to route specific event types to specific consumers.
- **Each consumer is independent** — failure in one doesn't affect others.

### 4. EventBridge — Event Router

EventBridge is the preferred service for event-driven architectures:

```json
// EventBridge rule — route order events to specific targets
{
  "source": ["com.myapp.orders"],
  "detail-type": ["OrderPlaced"],
  "detail": {
    "total": [{ "numeric": [">=", 100] }]
  }
}
```

**EventBridge best practices:**

- **Use a custom event bus** (not the default) for application events.
- **Design a consistent event schema** with `source`, `detail-type`, and structured `detail`.
- **Use Schema Registry** to discover and document event shapes.
- **Use archive and replay** to reprocess historical events after bug fixes.
- **Use content-based filtering** in rules to route events precisely.

**Event schema convention:**

```json
{
  "source": "com.myapp.orders",
  "detail-type": "OrderPlaced",
  "detail": {
    "orderId": "ORD-2024-001",
    "customerId": "CUST-123",
    "total": 149.99,
    "currency": "USD",
    "items": [
      { "sku": "PROD-456", "quantity": 2, "price": 74.99 }
    ],
    "timestamp": "2025-02-14T10:30:00Z"
  }
}
```

### 5. Step Functions — Workflow Orchestration

Use Step Functions for multi-step processes that need error handling, retries, and branching:

```
┌──────────────┐
│ Validate     │
│ Order        │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│ Process      │────▶│ Handle       │
│ Payment      │fail │ Payment      │
└──────┬───────┘     │ Failure      │
       │success      └──────────────┘
       ▼
┌──────────────┐
│ Parallel:    │
│ ├─ Reserve   │
│ │  Inventory │
│ ├─ Send      │
│ │  Email     │
│ └─ Update    │
│    Analytics │
└──────┬───────┘
       ▼
┌──────────────┐
│ Ship Order   │
└──────────────┘
```

**Step Functions best practices:**

- **Use Express Workflows** for high-volume, short-duration (<5 min) workflows. Use Standard for long-running.
- **Use SDK integrations** to call AWS services directly (DynamoDB, SQS, Lambda) without writing Lambda functions for simple operations.
- **Handle errors at each step** with `Catch` and `Retry` blocks.
- **Use `Map` state** for parallel processing of arrays (e.g., process each order item).

### 6. Idempotency

In distributed systems, messages will be delivered more than once. Design for it:

```typescript
// Idempotent handler pattern
async function processOrder(event: SQSEvent) {
  for (const record of event.Records) {
    const order = JSON.parse(record.body);

    // Check if already processed using idempotency key
    const existing = await dynamodb.get({
      TableName: 'ProcessedOrders',
      Key: { orderId: order.orderId },
    });

    if (existing.Item) {
      console.log(`Order ${order.orderId} already processed, skipping`);
      continue;
    }

    // Process the order
    await processPayment(order);

    // Mark as processed
    await dynamodb.put({
      TableName: 'ProcessedOrders',
      Item: { orderId: order.orderId, processedAt: new Date().toISOString() },
      ConditionExpression: 'attribute_not_exists(orderId)',
    });
  }
}
```

- **Use DynamoDB conditional writes** or **Powertools for AWS idempotency** to prevent duplicate processing.
- **Use SQS FIFO with deduplication** for exactly-once delivery at the queue level.
- **Design operations to be naturally idempotent** where possible (PUT vs POST semantics).

## Best Practices

- **Default to async.** If the caller doesn't need an immediate response, use a queue or event.
- **Always use DLQs.** Every SQS queue and Lambda event source mapping should have a dead-letter destination.
- **Design events, not commands.** Events describe what happened ("OrderPlaced"), commands tell what to do ("ProcessPayment"). Events are more flexible.
- **Keep payloads small.** Store large data in S3 and pass the S3 reference in the message.
- **Monitor queue depth and age.** A growing queue or aging messages indicate consumer issues.
- **Use Powertools for AWS** — it provides idempotency, batch processing, and event parsing utilities.

## Common Pitfalls

- **Synchronous chains disguised as microservices.** If service A calls B calls C synchronously, you have a distributed monolith.
- **No DLQ monitoring.** Messages in a DLQ need attention. Set up alarms on DLQ message count.
- **Missing idempotency.** SQS standard queues deliver at-least-once. Your consumer must handle duplicates.
- **Visibility timeout too short.** If the consumer takes longer than the visibility timeout, the message becomes visible again and gets processed twice.
- **Giant messages.** Putting large payloads in SQS/SNS/EventBridge. Use the claim check pattern (S3 + reference).
- **Over-orchestrating with Step Functions.** Not everything needs a state machine. Simple queue → Lambda patterns are fine for basic async processing.

## Reference

- [Amazon SQS Developer Guide](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html)
- [Amazon EventBridge User Guide](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html)
- [AWS Step Functions Developer Guide](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html)
- [Powertools for AWS Lambda](https://docs.powertools.aws.dev/lambda/typescript/latest/)
- [Enterprise Integration Patterns](https://www.enterpriseintegrationpatterns.com/)
