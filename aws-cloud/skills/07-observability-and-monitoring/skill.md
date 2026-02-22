# Observability & Monitoring

## Description

Build comprehensive observability into AWS workloads using CloudWatch, X-Ray, CloudTrail, and supporting services. This skill covers the three pillars of observability — metrics, logs, and traces — plus alarms, dashboards, and incident response patterns that make production systems visible, diagnosable, and reliable.

## When To Use

- Setting up monitoring for a new service or workload
- Creating CloudWatch alarms and dashboards for production readiness
- Implementing distributed tracing across microservices
- Investigating production incidents or performance degradation
- Defining SLIs, SLOs, and error budgets
- Designing structured logging for searchability and alerting

## Prerequisites

- Familiarity with AWS core services (Lambda, ECS, RDS, API Gateway)
- Understanding of basic monitoring concepts (metrics, logs, alerts)
- Basic understanding of distributed systems and request flows

## Instructions

### 1. The Three Pillars

```
                   Observability
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
     ┌─────────┐  ┌──────────┐  ┌─────────┐
     │ Metrics │  │   Logs   │  │ Traces  │
     │         │  │          │  │         │
     │ What is │  │ Why it   │  │ Where   │
     │ happening│ │ happened │  │ it went │
     └─────────┘  └──────────┘  └─────────┘
     CloudWatch    CloudWatch    AWS X-Ray
     Metrics       Logs
```

All three are required. Metrics tell you something is wrong. Logs tell you why. Traces tell you where in the call chain the problem is.

### 2. Metrics — CloudWatch

**Built-in metrics to monitor for every service:**

| Service | Key metrics |
|---------|------------|
| **Lambda** | Invocations, Errors, Duration, Throttles, ConcurrentExecutions |
| **API Gateway** | 4XXError, 5XXError, Latency, Count |
| **ECS** | CPUUtilization, MemoryUtilization, RunningTaskCount |
| **ALB** | HTTPCode_Target_5XX_Count, TargetResponseTime, HealthyHostCount |
| **RDS** | CPUUtilization, FreeableMemory, DatabaseConnections, ReadLatency, WriteLatency |
| **DynamoDB** | ConsumedReadCapacityUnits, ConsumedWriteCapacityUnits, ThrottledRequests |
| **SQS** | ApproximateNumberOfMessagesVisible, ApproximateAgeOfOldestMessage |

**Custom metrics for business KPIs:**

```typescript
// Emit custom metric from Lambda
import { CloudWatch } from '@aws-sdk/client-cloudwatch';

const cw = new CloudWatch();

await cw.putMetricData({
  Namespace: 'MyApp/Orders',
  MetricData: [
    {
      MetricName: 'OrdersPlaced',
      Value: 1,
      Unit: 'Count',
      Dimensions: [
        { Name: 'Environment', Value: 'prod' },
        { Name: 'Region', Value: 'eu-west-1' },
      ],
    },
  ],
});
```

- **Use EMF (Embedded Metric Format)** for high-throughput custom metrics from Lambda — it's cheaper and simpler than `PutMetricData` API calls.
- **Create composite alarms** that require multiple conditions before firing, reducing alert noise.

### 3. Logs — Structured and Searchable

**Always use structured JSON logs:**

```json
{
  "timestamp": "2025-02-14T10:30:00.000Z",
  "level": "ERROR",
  "message": "Failed to process order",
  "service": "order-processor",
  "traceId": "1-65cf1234-abcdef0123456789",
  "orderId": "ORD-2024-001",
  "customerId": "CUST-123",
  "error": {
    "name": "PaymentDeclinedError",
    "message": "Insufficient funds",
    "code": "PAYMENT_DECLINED"
  },
  "duration_ms": 245
}
```

**Logging rules:**

- **Include correlation IDs** (trace ID, request ID, order ID) in every log line for searchability.
- **Log at appropriate levels.** ERROR = needs attention. WARN = unexpected but handled. INFO = significant events. DEBUG = off in production.
- **Set retention policies.** CloudWatch Logs default to never expire. Set 30-day retention for dev, 90 days for production, archive to S3 for compliance.
- **Use CloudWatch Logs Insights** for ad-hoc queries:

```
fields @timestamp, @message, orderId
| filter level = "ERROR"
| filter service = "order-processor"
| sort @timestamp desc
| limit 50
```

### 4. Traces — AWS X-Ray

X-Ray provides distributed tracing across Lambda, API Gateway, ECS, and other AWS services:

```typescript
// Enable X-Ray in CDK
const fn = new lambda.Function(this, 'Handler', {
  tracing: lambda.Tracing.ACTIVE,
  // ...
});

// Enable on API Gateway
const api = new apigateway.RestApi(this, 'Api', {
  deployOptions: { tracingEnabled: true },
});
```

**X-Ray best practices:**

- **Enable active tracing** on Lambda, API Gateway, and ECS services.
- **Add custom subsegments** for external API calls, database queries, and business logic.
- **Add annotations** (indexed, searchable) for key attributes like `orderId`, `customerId`.
- **Add metadata** (not indexed) for debugging context like request/response payloads.
- **Use X-Ray service map** to visualise service dependencies and identify bottlenecks.

### 5. Alarms and Incident Response

**Alarm design:**

```yaml
# High-severity alarm — pages on-call
OrderProcessingErrors:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: prod-order-processing-errors
    MetricName: Errors
    Namespace: AWS/Lambda
    Dimensions:
      - Name: FunctionName
        Value: !Ref OrderProcessorFunction
    Statistic: Sum
    Period: 60
    EvaluationPeriods: 3
    DatapointsToAlarm: 2          # 2 out of 3 periods breaching
    Threshold: 5
    ComparisonOperator: GreaterThanThreshold
    TreatMissingData: notBreaching
    AlarmActions:
      - !Ref PagerDutySNSTopic    # Critical — page on-call
    OKActions:
      - !Ref PagerDutySNSTopic    # Auto-resolve
```

**Alarm best practices:**

- **Alarm on symptoms, not causes.** "Error rate > 1%" is better than "CPU > 80%".
- **Use anomaly detection** for metrics with variable baselines (traffic patterns).
- **Set appropriate evaluation periods** to avoid flapping. `DatapointsToAlarm` 2/3 or 3/5 reduces noise.
- **Always set `TreatMissingData`** — `notBreaching` for most, `breaching` for expected-to-always-have-data metrics.
- **Route alarms by severity.** Critical → PagerDuty/Opsgenie. Warning → Slack. Informational → Dashboard only.

### 6. Dashboards

Build two types of dashboards:

**Operational dashboard (per service):**
- Request rate, error rate, latency (P50, P95, P99)
- Resource utilisation (CPU, memory, connections)
- Queue depth and processing lag
- Health check status

**Business dashboard (per domain):**
- Orders per minute
- Revenue
- Sign-up conversion rate
- Feature adoption metrics

Use CloudWatch Dashboards or Grafana (via Amazon Managed Grafana) for visualisation.

## Best Practices

- **Define SLIs and SLOs.** "99.9% of requests return successfully within 500ms" is measurable and actionable.
- **Emit metrics at the edge.** API Gateway and ALB metrics capture the client-facing experience, not just the backend.
- **Use EMF for Lambda metrics.** Embedded Metric Format logs metrics as structured JSON — cheaper and simpler than CloudWatch API calls.
- **Centralise logs.** Use a shared logging account or OpenSearch for cross-service log analysis.
- **Automate runbooks.** Use Systems Manager Automation to perform common remediation actions automatically.
- **Review dashboards weekly.** Remove stale widgets, add new services, and validate that alarms are still relevant.

## Common Pitfalls

- **Unstructured logs.** `console.log("Error processing order " + orderId)` is impossible to query reliably. Use structured JSON.
- **Alert fatigue.** Too many alarms firing for non-actionable issues. Every alarm should have a runbook and a clear action.
- **No log retention policy.** CloudWatch Logs at $0.03/GB/month adds up fast. Set retention and archive old logs to S3.
- **Missing correlation IDs.** Without a trace ID flowing through every service, debugging distributed issues is guesswork.
- **Dashboard-only monitoring.** Dashboards are for investigation, not detection. Use alarms for detection.
- **Not monitoring costs.** CloudWatch itself can become expensive with high cardinality custom metrics. Monitor your monitoring costs.

## Reference

- [Amazon CloudWatch User Guide](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/WhatIsCloudWatch.html)
- [AWS X-Ray Developer Guide](https://docs.aws.amazon.com/xray/latest/devguide/aws-xray.html)
- [CloudWatch Embedded Metric Format](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format.html)
- [Amazon CloudWatch Logs Insights](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AnalyzingLogData.html)
- [Building dashboards with CloudWatch](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Dashboards.html)
