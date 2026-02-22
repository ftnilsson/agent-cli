# Testing & Local Development

## Description

Test serverless functions effectively using unit tests, integration tests, local emulators, and contract tests. This skill covers how to structure testable serverless code, mock event payloads and cloud services, run functions locally, and build a testing strategy that catches bugs before deployment without relying on deploying to a cloud environment for every change.

## When To Use

- Writing unit tests for serverless function handlers and business logic
- Setting up local development environments for serverless projects
- Choosing and configuring local emulators for cloud services
- Implementing integration tests that verify function + database/queue interactions
- Building contract tests for event-driven communication between services

## Prerequisites

- Understanding of function design patterns (skill 02 — thin handlers, extracted business logic)
- Familiarity with a testing framework (Jest, pytest, xUnit, etc.)
- Basic understanding of mocking and test doubles

## Instructions

### 1. Testing Strategy for Serverless

```
                    ┌─────────────┐
                    │  E2E Tests  │  Few — deployed environment
                    │  (Cloud)    │  Verify full flow works
                    ├─────────────┤
                    │ Integration │  Some — local emulators or
                    │   Tests     │  deployed test environment
                    ├─────────────┤  Verify function + dependencies
                    │ Contract    │
                    │  Tests      │  Event schema compliance
                    ├─────────────┤
                    │ Unit Tests  │  Many — fast, no cloud
                    │             │  Verify business logic
                    └─────────────┘
```

| Test type | What it verifies | Speed | Cloud required? |
|-----------|-----------------|-------|----------------|
| **Unit** | Business logic in isolation (services, validators, mappers) | Fast (<1s) | No |
| **Handler** | Function handler with mocked dependencies | Fast (<1s) | No |
| **Integration** | Function + real database/queue (local emulator) | Medium (1-10s) | No (emulator) |
| **Contract** | Event schemas match between producer and consumer | Fast (<1s) | No |
| **E2E** | Full deployed stack (API → function → database → event) | Slow (10-60s) | Yes |

### 2. Unit Testing Business Logic

Because handlers are thin (skill 02), business logic lives in testable modules:

```typescript
// services/order-service.ts — pure business logic, no cloud SDK
export class OrderService {
  constructor(private readonly repo: OrderRepository) {}

  async createOrder(input: CreateOrderInput): Promise<Order> {
    if (input.items.length === 0) {
      throw new ValidationError('Order must have at least one item');
    }

    const total = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (total > 10000) {
      throw new ValidationError('Order total cannot exceed $10,000');
    }

    return this.repo.save({
      id: generateId(),
      customerId: input.customerId,
      items: input.items,
      total,
      status: 'created',
      createdAt: new Date(),
    });
  }
}
```

```typescript
// __tests__/order-service.test.ts
describe('OrderService', () => {
  const mockRepo: OrderRepository = {
    save: jest.fn().mockImplementation(order => Promise.resolve(order)),
    findById: jest.fn(),
  };

  const service = new OrderService(mockRepo);

  it('calculates total from items', async () => {
    const order = await service.createOrder({
      customerId: 'CUST-001',
      items: [
        { productId: 'P1', quantity: 2, price: 29.99 },
        { productId: 'P2', quantity: 1, price: 49.99 },
      ],
    });

    expect(order.total).toBe(109.97);
    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ total: 109.97, status: 'created' })
    );
  });

  it('rejects empty orders', async () => {
    await expect(
      service.createOrder({ customerId: 'CUST-001', items: [] })
    ).rejects.toThrow('Order must have at least one item');
  });

  it('rejects orders exceeding $10,000', async () => {
    await expect(
      service.createOrder({
        customerId: 'CUST-001',
        items: [{ productId: 'P1', quantity: 1, price: 10001 }],
      })
    ).rejects.toThrow('Order total cannot exceed $10,000');
  });
});
```

### 3. Testing Handlers

Test the handler function with crafted event payloads:

```typescript
// __tests__/create-order-handler.test.ts
import { handler } from '../handlers/create-order';

describe('createOrder handler', () => {
  it('returns 201 for valid input', async () => {
    const event = makeApiGatewayEvent({
      method: 'POST',
      path: '/orders',
      body: { customerId: 'CUST-001', items: [{ productId: 'P1', quantity: 1, price: 29.99 }] },
      authorizer: { userId: 'CUST-001', roles: 'user' },
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.data.status).toBe('created');
  });

  it('returns 400 for invalid input', async () => {
    const event = makeApiGatewayEvent({
      method: 'POST',
      path: '/orders',
      body: { customerId: 'CUST-001', items: [] },  // No items
      authorizer: { userId: 'CUST-001', roles: 'user' },
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
  });
});

// Helper to create realistic API Gateway events
function makeApiGatewayEvent(overrides: Partial<EventOptions>): APIGatewayProxyEvent {
  return {
    httpMethod: overrides.method ?? 'GET',
    path: overrides.path ?? '/',
    body: overrides.body ? JSON.stringify(overrides.body) : null,
    headers: { 'Content-Type': 'application/json' },
    pathParameters: overrides.pathParams ?? null,
    queryStringParameters: overrides.queryParams ?? null,
    requestContext: {
      requestId: 'test-request-id',
      authorizer: overrides.authorizer ?? null,
    },
    // ... other required fields
  } as APIGatewayProxyEvent;
}
```

### 4. Local Emulators

Run cloud services locally for integration testing:

| Service | Local emulator |
|---------|---------------|
| DynamoDB | DynamoDB Local, LocalStack |
| S3 | LocalStack, MinIO |
| SQS/SNS | LocalStack, ElasticMQ |
| Cosmos DB | Azure Cosmos DB Emulator |
| Azure Storage | Azurite |
| Service Bus | Azure Service Bus Emulator |
| General (AWS) | LocalStack (free tier) |
| General (Azure) | Azurite + individual emulators |

**Docker Compose for local development:**

```yaml
# docker-compose.yml
services:
  dynamodb:
    image: amazon/dynamodb-local:latest
    ports:
      - "8000:8000"
    command: ["-jar", "DynamoDBLocal.jar", "-inMemory"]

  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      SERVICES: sqs,sns,s3
      DEFAULT_REGION: eu-west-1

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

**Integration test with local DynamoDB:**

```typescript
// __tests__/integration/order-repository.test.ts
import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { OrderRepository } from '../../repositories/order-repository';

const localDb = new DynamoDBClient({
  endpoint: 'http://localhost:8000',
  region: 'local',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

beforeAll(async () => {
  await localDb.send(new CreateTableCommand({
    TableName: 'orders-test',
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  }));
});

describe('OrderRepository', () => {
  const repo = new OrderRepository(localDb, 'orders-test');

  it('saves and retrieves an order', async () => {
    const order = { id: 'ORD-001', customerId: 'CUST-001', total: 99.99, status: 'created' };
    await repo.save(order);

    const retrieved = await repo.findById('ORD-001');
    expect(retrieved).toEqual(expect.objectContaining({ id: 'ORD-001', total: 99.99 }));
  });
});
```

### 5. Contract Testing

Verify that event producers and consumers agree on the event schema:

```typescript
// contracts/order-placed.contract.ts
import { z } from 'zod';

// Shared contract — used by producer AND consumer tests
export const OrderPlacedEventSchema = z.object({
  type: z.literal('com.myapp.order.placed.v1'),
  source: z.literal('orders-service'),
  data: z.object({
    orderId: z.string().startsWith('ORD-'),
    customerId: z.string().startsWith('CUST-'),
    total: z.number().positive(),
    currency: z.enum(['USD', 'EUR', 'GBP']),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
      price: z.number().positive(),
    })).min(1),
  }),
});

// Producer test — verify published events match contract
describe('OrderService (producer)', () => {
  it('publishes OrderPlaced event matching contract', async () => {
    const publishedEvent = await capturePublishedEvent(() =>
      orderService.createOrder(validInput)
    );

    const result = OrderPlacedEventSchema.safeParse(publishedEvent);
    expect(result.success).toBe(true);
  });
});

// Consumer test — verify consumer can handle contract events
describe('PaymentProcessor (consumer)', () => {
  it('processes OrderPlaced events matching contract', async () => {
    const event = generateFromSchema(OrderPlacedEventSchema);
    await expect(paymentProcessor.handle(event)).resolves.not.toThrow();
  });
});
```

### 6. Testing Async Event Handlers

```typescript
// Test queue-triggered functions
describe('ProcessPayment handler', () => {
  it('processes a valid payment and publishes PaymentProcessed', async () => {
    const sqsEvent = makeSQSEvent({
      body: { orderId: 'ORD-001', amount: 99.99, currency: 'USD' },
      messageId: 'msg-001',
    });

    await handler(sqsEvent);

    // Verify side effects
    expect(paymentGateway.charge).toHaveBeenCalledWith({
      amount: 99.99,
      currency: 'USD',
    });
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'com.myapp.payment.processed.v1' })
    );
  });

  it('returns batch item failure for retryable errors', async () => {
    paymentGateway.charge.mockRejectedValue(new Error('ECONNRESET'));

    const sqsEvent = makeSQSEvent({
      body: { orderId: 'ORD-001', amount: 99.99 },
      messageId: 'msg-001',
    });

    const result = await handler(sqsEvent);

    expect(result.batchItemFailures).toEqual([
      { itemIdentifier: 'msg-001' },
    ]);
  });
});
```

## Best Practices

- **Test business logic without the cloud.** The thin handler pattern (skill 02) means 80% of your tests are plain unit tests with no cloud SDK mocking.
- **Use event factories.** Create helper functions (`makeSQSEvent`, `makeApiGatewayEvent`) that produce realistic event payloads for testing.
- **Run emulators in CI.** Docker Compose with DynamoDB Local, Azurite, or LocalStack in your CI pipeline gives high confidence without deploying.
- **Contract tests prevent breaking changes.** When Service A changes its event schema, the contract test in Service B catches it before production.
- **Keep tests fast.** Unit tests: <1 second. Integration tests: <10 seconds. If tests are slow, developers won't run them.

## Common Pitfalls

- **Testing the cloud SDK instead of your logic.** Tests that verify `DynamoDB.send()` was called with the right parameters are testing the SDK, not your business rules. Test the outcome.
- **No local development setup.** If every code change requires `deploy → test → fix → deploy`, developer velocity dies. Invest in local emulators.
- **Mocking everything.** Over-mocking produces tests that pass but don't verify real behaviour. Use emulators for data stores — mock only external APIs.
- **Skipping error path tests.** Testing only the happy path. Always test: invalid input, missing data, downstream failures, partial batch failures.
- **No contract tests.** Breaking event schema changes between producer and consumer are discovered in production, not in CI.

## Reference

- [Jest Documentation](https://jestjs.io/)
- [pytest Documentation](https://docs.pytest.org/)
- [LocalStack](https://docs.localstack.cloud/)
- [Azurite](https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azurite)
- [Pact Contract Testing](https://pact.io/)
- [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html)
