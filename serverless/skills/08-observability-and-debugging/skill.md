# Observability & Debugging

## Description

Build observability into serverless workloads using structured logging, distributed tracing, custom metrics, and alerting. This skill covers the unique challenges of monitoring ephemeral, event-driven functions — cold-start visibility, cross-function trace correlation, cost-aware logging, and the debugging techniques for systems where you can't SSH into a server.

## When To Use

- Adding logging, tracing, and metrics to serverless functions
- Debugging production issues in event-driven architectures
- Setting up alerts for serverless-specific failure modes
- Monitoring cold starts, concurrency, and throttling
- Correlating requests across multiple functions and services

## Prerequisites

- Understanding of serverless function lifecycle (cold start, warm, shutdown)
- Familiarity with JSON/structured logging
- Basic understanding of distributed tracing concepts (trace ID, span ID)

## Instructions

### 1. The Three Pillars in Serverless

```
┌──────────────────────────────────────────────────────────────┐
│                    Observability                              │
│                                                               │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐     │
│  │    Logs      │   │   Traces     │   │   Metrics    │     │
│  │              │   │              │   │              │     │
│  │ Structured   │   │ Distributed  │   │ Platform +   │     │
│  │ JSON, with   │   │ trace/span   │   │ Custom       │     │
│  │ correlation  │   │ across       │   │ business     │     │
│  │ IDs          │   │ functions    │   │ KPIs         │     │
│  └──────────────┘   └──────────────┘   └──────────────┘     │
│         │                  │                  │               │
│         └──────────────────┼──────────────────┘               │
│                           │                                   │
│                    ┌──────▼──────┐                            │
│                    │   Alerts    │                            │
│                    └─────────────┘                            │
└──────────────────────────────────────────────────────────────┘
```

### 2. Structured Logging

**Never use `console.log` with string concatenation:**

```typescript
// ❌ Unstructured — impossible to query
console.log(`Error processing order ${orderId}: ${error.message}`);

// ✅ Structured — queryable, filterable, correlatable
logger.error('Failed to process order', {
  orderId,
  customerId,
  error: { type: error.name, message: error.message, stack: error.stack },
  correlationId: context.requestId,
  functionName: context.functionName,
  coldStart: isColdStart,
});
```

**Minimal structured log format:**

```json
{
  "level": "ERROR",
  "message": "Failed to process order",
  "timestamp": "2025-02-14T10:30:00.000Z",
  "service": "order-processor",
  "function": "processOrder",
  "correlationId": "abc-123-def-456",
  "coldStart": false,
  "orderId": "ORD-2024-001",
  "error": {
    "type": "PaymentDeclinedError",
    "message": "Insufficient funds"
  },
  "durationMs": 245
}
```

**Logging libraries for serverless:**

| Runtime | Library | Features |
|---------|---------|----------|
| TypeScript/Node.js | Powertools for AWS Lambda, pino | Structured JSON, correlation, cold start detection |
| Python | Powertools for AWS Lambda, structlog | Structured JSON, log levels, context injection |
| C# | Serilog, ILogger | Structured logging, sinks, enrichers |
| Go | zerolog, slog | Zero-allocation, structured JSON |

**Logging rules:**

- **JSON format only.** No plain text in production.
- **Include correlation ID** in every log entry (request ID, trace ID).
- **Log at function entry and exit.** Capture input summary (not full payload — PII risk) and result status.
- **Distinguish cold start logs.** Mark the first invocation per instance.
- **Never log secrets, tokens, or PII.** Redact sensitive fields before logging.
- **Control log levels** per environment. `DEBUG` in dev, `INFO` in production.

### 3. Distributed Tracing

In serverless, a single user request may flow through multiple functions:

```
Client ──▶ API Gateway ──▶ OrderFunction ──▶ SQS ──▶ PaymentFunction ──▶ SNS ──▶ NotifyFunction
                                │                            │
                Trace: abc-123  │                            │
                Span: order-1   │         Span: payment-1   │        Span: notify-1
```

**Propagate trace context through all events:**

```typescript
// When publishing to a queue, include trace context
await queue.send({
  body: JSON.stringify(orderData),
  messageAttributes: {
    'X-Trace-Id': traceId,
    'X-Span-Id': spanId,
    'X-Correlation-Id': correlationId,
  },
});

// When consuming from a queue, extract and continue the trace
export async function handler(event: SQSEvent) {
  for (const record of event.Records) {
    const traceId = record.messageAttributes['X-Trace-Id']?.stringValue;
    const correlationId = record.messageAttributes['X-Correlation-Id']?.stringValue;

    // Create child span under the parent trace
    const span = tracer.startSpan('processPayment', { parent: traceId });

    // Include in all logs
    logger.addContext({ traceId, correlationId, spanId: span.id });

    try {
      await processPayment(record);
      span.end();
    } catch (error) {
      span.setStatus('ERROR');
      span.end();
      throw error;
    }
  }
}
```

**Use OpenTelemetry** for vendor-neutral distributed tracing. It works across all cloud providers and observability backends (Jaeger, X-Ray, Application Insights, Datadog).

### 4. Serverless-Specific Metrics

**Platform metrics to monitor:**

| Metric | What it tells you | Alert threshold |
|--------|------------------|----------------|
| **Invocations** | Request volume | Anomaly detection (spike or drop) |
| **Errors** | Failed invocations | Error rate > 1% |
| **Duration (P99)** | Latency for slowest requests | P99 > function timeout × 0.8 |
| **Throttles** | Requests rejected due to concurrency limit | Any throttle > 0 |
| **Cold starts** | New instances being created | Cold start rate > 10% |
| **Concurrent executions** | How many instances are running | > 80% of concurrency limit |
| **Dead-letter messages** | Messages that failed all retries | Any DLQ message > 0 |
| **Iterator age** (streams) | How far behind the consumer is | Age > 60 seconds |

**Custom business metrics:**

```typescript
// Track business KPIs as custom metrics
metrics.addMetric('OrderPlaced', 1, 'Count');
metrics.addMetric('OrderValue', order.total, 'USD');
metrics.addMetric('ItemsPerOrder', order.items.length, 'Count');
metrics.addDimension('Region', order.region);
metrics.addDimension('PaymentMethod', order.paymentMethod);
```

### 5. Cold Start Monitoring

Cold starts are the most common serverless performance issue. Make them visible:

```typescript
// Detect and log cold starts
let isColdStart = true;

export async function handler(event: any) {
  if (isColdStart) {
    logger.info('Cold start detected', {
      runtime: process.version,
      memoryAllocated: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
      initDuration: process.uptime() * 1000,  // ms since process started
    });
    isColdStart = false;
  }

  const startTime = Date.now();
  // ... handle event
  const duration = Date.now() - startTime;

  logger.info('Invocation complete', { duration, coldStart: false });
}
```

**Cold start dashboard should show:**

- Cold start rate (%) over time
- P50 / P95 cold start duration
- Cold starts by function (which functions are worst?)
- Cold starts by time of day (do they correlate with low-traffic periods?)

### 6. Debugging Production Issues

**Investigation workflow:**

```
1. Alert fires (error rate spike)
        │
2. Check dashboard — which function? which time window?
        │
3. Query logs — filter by function + time + error level
        │
4. Find correlation ID — trace the request across functions
        │
5. Check traces — see the full request flow and where it failed
        │
6. Check downstream — was it a database timeout? API failure? throttle?
        │
7. Fix, deploy, verify — monitor the fix in real time (live tail)
```

**Useful log queries:**

```
// Recent errors for a specific function
filter @message like /ERROR/
  | fields @timestamp, message, correlationId, error.type, error.message
  | sort @timestamp desc
  | limit 50

// Slow invocations (P99 investigation)
filter duration > 5000
  | fields @timestamp, functionName, duration, coldStart, correlationId
  | sort duration desc
  | limit 20

// Cold start frequency
filter coldStart = true
  | stats count() as coldStarts by bin(30m)
  | sort @timestamp
```

## Best Practices

- **Structured logging from day one.** Retrofitting structured logging is painful. Start with JSON logs and correlation IDs immediately.
- **Use OpenTelemetry.** Vendor-neutral tracing that works across providers and backends.
- **Alert on DLQ messages immediately.** Any message in a dead-letter queue means data is being lost or stuck.
- **Monitor cold start rates.** If >10% of invocations are cold starts, investigate provisioned concurrency or architecture changes.
- **Log sampling for high-throughput functions.** A function invoked 10,000 times/second at `DEBUG` level generates enormous log volume. Sample at 1-10% for debug logs.
- **Include business context in logs.** `orderId`, `customerId`, `tenantId` — not just technical details.

## Common Pitfalls

- **`console.log` in production.** Unstructured text logs are impossible to query, filter, or alert on reliably.
- **No correlation across functions.** Without a correlation ID flowing through HTTP → queue → function → function, you can't trace a request end-to-end.
- **Logging full payloads.** Logging the entire request/event body leads to PII exposure, log bloat, and cost spikes. Log a summary with IDs.
- **Ignoring log costs.** CloudWatch Logs, Log Analytics, and similar services charge per GB ingested. Verbose logging on high-traffic functions can cost more than the compute.
- **No dev/prod log separation.** Debug-level logging should be off (or sampled) in production. Use environment-based log-level configuration.

## Reference

- [OpenTelemetry](https://opentelemetry.io/)
- [AWS Lambda Powertools](https://docs.powertools.aws.dev/lambda/)
- [Azure Monitor for Functions](https://learn.microsoft.com/en-us/azure/azure-functions/functions-monitoring)
- [Structured Logging Best Practices](https://www.structlog.org/en/stable/why.html)
