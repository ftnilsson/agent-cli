# Messaging & Event-Driven Architecture

## Description

Design and implement decoupled, event-driven systems on Azure using Service Bus, Event Grid, Event Hubs, Durable Functions, and Logic Apps. This skill covers message queue patterns, pub/sub, event routing, workflow orchestration, and stream processing — the building blocks for scalable, resilient, and loosely coupled architectures.

## When To Use

- Decoupling services to reduce tight coupling and cascading failures
- Processing workloads asynchronously (order processing, email sending, image resizing)
- Building event-driven architectures with fan-out and event routing
- Orchestrating multi-step workflows (order fulfilment, onboarding, ETL)
- Processing real-time data streams (clickstream, IoT, log aggregation)
- Designing retry, dead-letter, and exactly-once processing patterns

## Prerequisites

- Understanding of distributed systems concepts (eventual consistency, idempotency)
- Familiarity with Azure compute services (Azure Functions, Container Apps)
- Basic understanding of JSON and message serialisation

## Instructions

### 1. Choose the Right Messaging Service

| Service | Pattern | Use case | Message size | Ordering |
|---------|---------|----------|-------------|----------|
| **Service Bus (Queues)** | Queue (point-to-point) | Transactional messaging, decouple producer/consumer | 256 KB (Standard) / 100 MB (Premium) | FIFO (sessions) |
| **Service Bus (Topics)** | Pub/Sub (fan-out) | Multi-subscriber message distribution, filtering | 256 KB / 100 MB | FIFO (sessions) |
| **Event Grid** | Event routing (push) | Event-driven architecture, resource events, webhooks | 1 MB | No |
| **Event Hubs** | Stream processing | High-throughput telemetry, clickstream, IoT, log aggregation | 1 MB | Per-partition |
| **Storage Queues** | Simple queue | Basic queueing, very high volume, low cost | 64 KB | No |

**Decision flow:**

```
Is it high-throughput telemetry/streaming (millions of events/sec)?
  ├── Yes → Event Hubs
  └── No → Do you need enterprise messaging features (transactions, sessions, DLQ)?
        ├── Yes → Service Bus
        └── No → Is it a reactive event (something happened, notify subscribers)?
              ├── Yes → Event Grid
              └── No → Is it simple, high-volume, low-cost queueing?
                    ├── Yes → Storage Queues
                    └── No → Service Bus (safe default)
```

### 2. Azure Service Bus — Enterprise Messaging

**Queues (point-to-point):**

```bicep
resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: 'sb-myapp-prod'
  location: location
  sku: { name: 'Premium', tier: 'Premium', capacity: 1 }  // Premium for VNet, large messages
  properties: {
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Disabled'  // Private Endpoint only
  }
}

resource ordersQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'orders'
  properties: {
    maxDeliveryCount: 5                        // DLQ after 5 failed attempts
    lockDuration: 'PT1M'                       // 1-minute lock (set to > consumer processing time)
    defaultMessageTimeToLive: 'P7D'            // Messages expire after 7 days
    deadLetteringOnMessageExpiration: true      // Expired messages go to DLQ
    requiresSession: false                     // Enable for FIFO ordering
    enablePartitioning: false                  // Disable for Premium tier
  }
}
```

**Topics (pub/sub with filtering):**

```bicep
resource ordersTopic 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'order-events'
  properties: {
    defaultMessageTimeToLive: 'P7D'
    enablePartitioning: false
  }
}

// Subscription with filter — only high-value orders
resource highValueSub 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  parent: ordersTopic
  name: 'high-value-processor'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT1M'
    deadLetteringOnMessageExpiration: true
  }
}

resource highValueFilter 'Microsoft.ServiceBus/namespaces/topics/subscriptions/rules@2022-10-01-preview' = {
  parent: highValueSub
  name: 'high-value-filter'
  properties: {
    filterType: 'SqlFilter'
    sqlFilter: { sqlExpression: 'orderTotal > 100' }
  }
}
```

**Service Bus best practices:**

- **Use Premium tier for production** — VNet integration, Private Endpoints, large messages (up to 100 MB), and predictable performance.
- **Always configure dead-letter queues (DLQ).** Monitor DLQ message count with alerts.
- **Set `lockDuration` > consumer processing time.** If the lock expires, the message becomes visible again and gets processed twice.
- **Use sessions for FIFO ordering** when message order matters per logical group (e.g., per order ID).
- **Use managed identities** for authentication (Azure Service Bus Data Sender/Receiver roles).

### 3. Event Grid — Event Routing

Event Grid is for reactive, event-driven patterns — "something happened, react to it":

```bicep
// System topic — react to Azure resource events (e.g., blob uploaded)
resource blobEventSubscription 'Microsoft.EventGrid/eventSubscriptions@2024-06-01-preview' = {
  name: 'blob-uploaded-handler'
  scope: storageAccount
  properties: {
    destination: {
      endpointType: 'AzureFunction'
      properties: { resourceId: processorFunction.id }
    }
    filter: {
      includedEventTypes: ['Microsoft.Storage.BlobCreated']
      subjectBeginsWith: '/blobServices/default/containers/uploads/'
      subjectEndsWith: '.pdf'
    }
  }
}
```

**Custom topics for application events:**

```json
// Custom event schema
{
  "id": "evt-abc123",
  "source": "/myapp/orders",
  "type": "com.myapp.OrderPlaced",
  "subject": "orders/ORD-2024-001",
  "time": "2025-02-14T10:30:00Z",
  "data": {
    "orderId": "ORD-2024-001",
    "customerId": "CUST-123",
    "total": 149.99
  }
}
```

**Event Grid best practices:**

- **Use system topics** for Azure resource events (blob created, resource modified, etc.).
- **Use custom topics** or **Event Grid Namespaces** for application-to-application events.
- **Use filters** to route specific event types to specific handlers — don't send everything everywhere.
- **Enable dead-lettering** to a Storage Account for failed deliveries.
- **Use CloudEvents schema** for interoperability with other event-driven systems.

### 4. Event Hubs — Stream Processing

Use Event Hubs for high-throughput data ingestion and stream processing:

```
Producers (millions/sec)
    │
    ▼
┌──────────────────────────┐
│ Event Hubs               │
│ ┌────┬────┬────┬────┐   │
│ │ P0 │ P1 │ P2 │ P3 │   │    Partitions (parallel processing)
│ └────┴────┴────┴────┘   │
└──────────┬───────────────┘
           │
    ┌──────┼──────┐
    ▼      ▼      ▼
  Consumer Group 1    Consumer Group 2
  (Real-time analytics) (Archive to storage)
```

- **Use for telemetry, clickstream, IoT, and log aggregation** — not for transactional messaging (use Service Bus instead).
- **Choose partition count based on parallelism needs.** Each partition supports up to 1 MB/s ingress and 2 MB/s egress.
- **Use Event Hubs Capture** to automatically archive events to Blob Storage or Data Lake.
- **Use consumer groups** to allow multiple independent consumers to read the same stream.

### 5. Durable Functions — Workflow Orchestration

Use Durable Functions for multi-step workflows that need error handling, retries, and human interaction:

```csharp
// Orchestrator function — order fulfilment workflow
[Function("OrderFulfilmentOrchestrator")]
public static async Task RunOrchestrator(
    [OrchestrationTrigger] TaskOrchestrationContext context)
{
    var order = context.GetInput<OrderData>();

    // Step 1: Validate order
    await context.CallActivityAsync("ValidateOrder", order);

    // Step 2: Process payment (with retry)
    var retryOptions = new TaskOptions(new RetryPolicy(
        maxNumberOfAttempts: 3,
        firstRetryInterval: TimeSpan.FromSeconds(5)));

    await context.CallActivityAsync("ProcessPayment", order, retryOptions);

    // Step 3: Parallel tasks
    var parallelTasks = new List<Task>
    {
        context.CallActivityAsync("ReserveInventory", order),
        context.CallActivityAsync("SendConfirmationEmail", order),
        context.CallActivityAsync("UpdateAnalytics", order),
    };
    await Task.WhenAll(parallelTasks);

    // Step 4: Ship order
    await context.CallActivityAsync("ShipOrder", order);
}
```

**Durable Functions patterns:**

- **Function chaining** — sequential steps with error handling
- **Fan-out/fan-in** — parallel processing with aggregation
- **Human interaction** — wait for external events (approval, callback)
- **Monitor** — polling with configurable intervals
- **Eternal orchestrations** — long-running, recurring processes

### 6. Idempotency

In distributed systems, messages will be delivered more than once. Design for it:

```csharp
// Idempotent handler using Service Bus message deduplication
[Function("ProcessOrder")]
public async Task Run(
    [ServiceBusTrigger("orders")] ServiceBusReceivedMessage message)
{
    var orderId = message.ApplicationProperties["orderId"].ToString();

    // Check if already processed using idempotency store
    if (await _idempotencyStore.ExistsAsync(orderId))
    {
        _logger.LogInformation("Order {OrderId} already processed, skipping", orderId);
        return;
    }

    // Process the order
    var order = message.Body.ToObjectFromJson<OrderData>();
    await _orderService.ProcessAsync(order);

    // Mark as processed (with TTL for cleanup)
    await _idempotencyStore.SetAsync(orderId, TimeSpan.FromDays(7));
}
```

- **Use Service Bus duplicate detection** (requires `requiresDuplicateDetection: true`) for built-in message deduplication.
- **Use sessions** for ordered, exactly-once processing per session ID.
- **Design operations to be naturally idempotent** where possible (PUT semantics, conditional writes).

## Best Practices

- **Default to async.** If the caller doesn't need an immediate response, use a queue or event.
- **Always configure dead-letter queues.** Every Service Bus queue and topic subscription should have DLQ monitoring.
- **Design events, not commands.** Events describe what happened ("OrderPlaced"), commands tell what to do ("ProcessPayment"). Events are more flexible.
- **Keep payloads small.** Store large data in Blob Storage and pass the blob reference in the message (claim check pattern).
- **Monitor queue depth and message age.** A growing queue or aging messages indicate consumer issues.
- **Use managed identities** for Service Bus authentication — no connection strings.

## Common Pitfalls

- **Synchronous chains disguised as microservices.** If service A calls B calls C synchronously, you have a distributed monolith. Use Service Bus or Event Grid to decouple.
- **No DLQ monitoring.** Messages in a DLQ need attention. Set up alerts on DLQ message count.
- **Missing idempotency.** Service Bus at-least-once delivery means your consumer must handle duplicates.
- **Lock duration too short.** If the consumer takes longer than the lock duration, the message becomes visible again and gets processed twice.
- **Using Event Hubs for transactional messaging.** Event Hubs is for streaming, not request-response or transactional patterns. Use Service Bus.
- **Over-orchestrating with Durable Functions.** Not every async workflow needs a state machine. Simple Function + Service Bus is often sufficient.

## Reference

- [Azure Service Bus Documentation](https://learn.microsoft.com/en-us/azure/service-bus-messaging/)
- [Azure Event Grid Documentation](https://learn.microsoft.com/en-us/azure/event-grid/)
- [Azure Event Hubs Documentation](https://learn.microsoft.com/en-us/azure/event-hubs/)
- [Durable Functions Documentation](https://learn.microsoft.com/en-us/azure/azure-functions/durable/)
- [Enterprise Integration Patterns](https://www.enterpriseintegrationpatterns.com/)
