# Function Design & Composition

## Description

Design serverless functions that are small, testable, idempotent, and composable. This skill covers the handler pattern, extracting business logic, input/output bindings, function chaining, fan-out/fan-in, and the idempotency strategies that are mandatory in event-driven systems. All patterns are cloud-agnostic — the principles apply whether you use AWS Lambda, Azure Functions, or any other FaaS platform.

## When To Use

- Writing a new serverless function from scratch
- Refactoring an existing function that has grown too large
- Implementing idempotent event handlers
- Composing multiple functions into a workflow (chaining, fan-out)
- Reviewing function code for design and testability issues

## Prerequisites

- Understanding of serverless architecture basics (skill 01)
- Familiarity with at least one programming language used in serverless (TypeScript, Python, C#, Go)
- Understanding of event-driven messaging (queues, topics)

## Instructions

### 1. The Handler Pattern

Every serverless function follows the same structure:

```
┌─────────────────────────────────────────────┐
│  Module Scope (runs once per cold start)     │
│  - Create SDK clients                        │
│  - Initialise database connections           │
│  - Load configuration                        │
├─────────────────────────────────────────────┤
│  Handler Function (runs per invocation)      │
│  1. Parse & validate input                   │
│  2. Call business logic                      │
│  3. Return output / publish events           │
└─────────────────────────────────────────────┘
```

**TypeScript example:**

```typescript
// ── Module scope: runs ONCE per cold start ──
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { OrderService } from './services/order-service';
import { validateOrderInput } from './validators/order-validator';

const db = new DynamoDBClient({});  // Reused across warm invocations
const orderService = new OrderService(db);

// ── Handler: runs PER invocation ──
export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    // 1. Parse & validate
    const input = JSON.parse(record.body);
    const order = validateOrderInput(input);  // Throws on invalid

    // 2. Call business logic
    await orderService.processOrder(order);

    // 3. Side effects (publish event, etc.)
    // Handled inside orderService — handler stays thin
  }
}
```

**Python example:**

```python
# ── Module scope: runs ONCE per cold start ──
import boto3
from services.order_service import OrderService
from validators.order_validator import validate_order_input

dynamodb = boto3.resource("dynamodb")  # Reused across warm invocations
order_service = OrderService(dynamodb)

# ── Handler: runs PER invocation ──
def handler(event, context):
    for record in event["Records"]:
        # 1. Parse & validate
        order = validate_order_input(json.loads(record["body"]))

        # 2. Call business logic
        order_service.process_order(order)
```

**C# example:**

```csharp
// ── Class scope: runs ONCE per cold start ──
public class ProcessOrderFunction
{
    private readonly OrderService _orderService;

    public ProcessOrderFunction()
    {
        var db = new CosmosClient(Environment.GetEnvironmentVariable("COSMOS_CONNECTION"));
        _orderService = new OrderService(db);
    }

    // ── Handler: runs PER invocation ──
    [Function("ProcessOrder")]
    public async Task Run([ServiceBusTrigger("orders")] ServiceBusReceivedMessage message)
    {
        // 1. Parse & validate
        var order = message.Body.ToObjectFromJson<OrderInput>();
        OrderValidator.Validate(order);  // Throws on invalid

        // 2. Call business logic
        await _orderService.ProcessAsync(order);
    }
}
```

### 2. Keep Handlers Thin

The handler's job is **glue**, not business logic:

| Handler does | Business logic module does |
|-------------|--------------------------|
| Parse event payload | Domain validation rules |
| Schema validation | Business calculations |
| Call business logic | Database operations |
| Return response / publish event | External API calls |
| Log entry/exit | Complex orchestration |

**Why?** Thin handlers are:
- **Testable** — business logic can be unit tested without invoking the function runtime.
- **Portable** — business logic works in any runtime (function, container, CLI, test).
- **Readable** — the handler shows the flow at a glance.

### 3. Idempotency

In serverless systems, **every event handler must be idempotent**. Events will be delivered more than once (at-least-once delivery):

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Queue   │────▶│ Function │────▶│ Database │
│          │     │          │     │          │
│ Message  │     │ Process  │     │ Upsert   │
│ delivered│     │ order    │     │ (not     │
│ twice    │     │ twice    │     │  insert) │
└──────────┘     └──────────┘     └──────────┘
```

**Strategy 1: Natural idempotency (preferred)**

Design operations to be inherently safe to repeat:

```typescript
// ✅ Idempotent: SET status = 'processed' (same result if run twice)
await db.update({
  Key: { orderId },
  UpdateExpression: 'SET #status = :status, processedAt = :now',
  ConditionExpression: '#status <> :status',  // Only if not already processed
  ExpressionAttributeValues: { ':status': 'processed', ':now': new Date().toISOString() },
});

// ❌ NOT idempotent: INCREMENT counter (different result if run twice)
await db.update({
  Key: { orderId },
  UpdateExpression: 'ADD processCount :one',
  ExpressionAttributeValues: { ':one': 1 },
});
```

**Strategy 2: Idempotency store**

Track processed event IDs:

```typescript
async function processIdempotent(eventId: string, handler: () => Promise<void>): Promise<void> {
  // Check if already processed
  const exists = await idempotencyStore.get(eventId);
  if (exists) {
    console.log(`Event ${eventId} already processed, skipping`);
    return;
  }

  // Process
  await handler();

  // Mark as processed (with TTL for cleanup)
  await idempotencyStore.set(eventId, { ttl: 7 * 24 * 60 * 60 });  // 7 days
}
```

**Strategy 3: Conditional writes (optimistic concurrency)**

```typescript
// Use a version number — write only succeeds if version matches
await db.put({
  Item: { ...order, version: order.version + 1 },
  ConditionExpression: 'version = :currentVersion',
  ExpressionAttributeValues: { ':currentVersion': order.version },
});
```

### 4. Input/Output Bindings

Most serverless platforms support declarative input and output bindings — connecting functions to data sources without boilerplate code:

```
Input Binding                Handler              Output Binding
(auto-fetched data)         (your code)           (auto-sent data)
                                  
┌─────────────┐          ┌──────────────┐         ┌──────────────┐
│ Queue Message│─────────▶│  Process     │────────▶│ Database     │
│ HTTP Request │          │  Transform   │         │ Queue        │
│ Timer        │          │  Validate    │         │ HTTP Response│
│ Blob         │          │              │         │ Event        │
└─────────────┘          └──────────────┘         └──────────────┘
```

Bindings reduce boilerplate — you declare what you need, the runtime fetches/sends it. Use them for simple integrations. Fall back to SDK calls when you need more control (retries, error handling, conditional logic).

### 5. Function Composition Patterns

**Chain (sequential):**

```
Function A ──▶ Queue ──▶ Function B ──▶ Queue ──▶ Function C
```

- Use a queue between each step for durability and decoupling.
- Each function processes one step and publishes a result event.
- If any step fails, its message returns to the queue for retry.

**Fan-out / Fan-in:**

```
                    ┌──▶ Function B1 ──┐
Event ──▶ Function A├──▶ Function B2 ──┼──▶ Function C (aggregate)
                    └──▶ Function B3 ──┘
```

- Function A publishes N messages (one per item to process).
- Functions B1-B3 process in parallel (competing consumers or separate triggers).
- Function C aggregates results (use an orchestrator or counter pattern).

**Async HTTP (request-acknowledge-poll):**

```
Client ──POST──▶ API Function ──▶ Queue ──▶ Processor Function
  │                  │                             │
  │◀── 202 Accepted ─┘                             │
  │    { statusUrl: "/status/abc" }                 │
  │                                                 │
  │──GET /status/abc──▶ Status Function             │
  │◀── 200 { status: "completed", result: {...} } ──┘
```

### 6. Error Handling Strategy

```typescript
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const failures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    try {
      const input = JSON.parse(record.body);
      await processOrder(input);
    } catch (error) {
      if (isRetryable(error)) {
        // Return as failure — SQS will retry
        failures.push({ itemIdentifier: record.messageId });
      } else {
        // Permanent failure — log and move on (message won't retry)
        logger.error('Permanent failure processing order', {
          messageId: record.messageId,
          error: error.message,
        });
        // Optionally: send to a separate error topic for manual review
      }
    }
  }

  return { batchItemFailures: failures };
}

function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    return ['ECONNRESET', 'ETIMEDOUT', 'ThrottlingException'].some(
      code => error.message.includes(code)
    );
  }
  return false;
}
```

## Best Practices

- **Module scope for clients, handler for logic.** Initialise SDK clients, database connections, and HTTP clients outside the handler so they persist across warm invocations.
- **One trigger, one job.** Each function handles one type of event and does one thing. Split multi-purpose handlers.
- **Always be idempotent.** Use natural idempotency (conditional writes, upserts) or an idempotency store.
- **Use partial batch failure reporting.** Don't fail the entire batch because one message errored.
- **Extract business logic.** The handler file should be <50 lines. Everything else goes in `services/`, `validators/`, `mappers/`.

## Common Pitfalls

- **Creating clients inside the handler.** `new DynamoDBClient()` inside the handler means a new TCP connection on every invocation. Move it to module scope.
- **No input validation.** Trusting the event payload (`JSON.parse` without validation) leads to undecipherable errors deep in business logic.
- **Catching all errors silently.** `catch (e) { console.log(e) }` swallows the error and acknowledges the message — the event is lost.
- **Giant functions.** A 500-line handler with database queries, API calls, and business logic inlined is untestable and unmaintainable.
- **Forgetting idempotency.** An `INSERT` that's run twice creates duplicate records. A payment processed twice charges the customer double. Always design for at-least-once.

## Reference

- [AWS Lambda Handler Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Azure Functions Best Practices](https://learn.microsoft.com/en-us/azure/azure-functions/functions-best-practices)
- [Idempotency Patterns (AWS)](https://docs.powertools.aws.dev/lambda/typescript/latest/utilities/idempotency/)
- [Enterprise Integration Patterns](https://www.enterpriseintegrationpatterns.com/)
