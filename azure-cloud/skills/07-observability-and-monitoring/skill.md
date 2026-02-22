# Observability & Monitoring

## Description

Build comprehensive observability into Azure workloads using Azure Monitor, Application Insights, Log Analytics, and supporting services. This skill covers the three pillars of observability — metrics, logs, and traces — plus alerts, dashboards, and incident response patterns that make production systems visible, diagnosable, and reliable.

## When To Use

- Setting up monitoring for a new service or workload
- Creating Azure Monitor alerts and dashboards for production readiness
- Implementing distributed tracing across microservices
- Investigating production incidents or performance degradation
- Defining SLIs, SLOs, and error budgets
- Designing structured logging for searchability and alerting

## Prerequisites

- Familiarity with Azure core services (Functions, App Service, Container Apps, SQL)
- Understanding of basic monitoring concepts (metrics, logs, alerts)
- Basic understanding of distributed systems and request flows

## Instructions

### 1. The Azure Monitor Ecosystem

```
                   Azure Monitor
                        │
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
  ┌──────────┐   ┌────────────┐   ┌──────────────┐
  │ Metrics  │   │ Logs       │   │ Application  │
  │          │   │ (Log       │   │ Insights     │
  │ Platform │   │ Analytics) │   │ (APM)        │
  │ & Custom │   │            │   │              │
  └──────────┘   └────────────┘   └──────────────┘
       │                │                │
       │                ▼                │
       │         ┌────────────┐          │
       └────────▶│  Alerts    │◀─────────┘
                 │ & Actions  │
                 └────────────┘
                      │
                 ┌────▼─────┐
                 │Dashboards│
                 │ Grafana  │
                 │ Workbooks│
                 └──────────┘
```

### 2. Application Insights — The Core of Azure APM

Application Insights provides metrics, logs, and distributed traces in one service:

```bicep
// Bicep — Application Insights with Log Analytics workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-myapp-prod'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 90
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-myapp-prod'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    RetentionInDays: 90
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}
```

**Application Insights provides:**

- **Request tracking** — HTTP requests with latency, status codes, and dependencies
- **Dependency tracking** — SQL, HTTP, Redis, Service Bus calls with timing
- **Exception tracking** — Unhandled exceptions with stack traces
- **Custom events and metrics** — Business KPIs and domain events
- **Distributed tracing** — End-to-end request flow across services
- **Live Metrics** — Real-time monitoring during deployments and incidents
- **Application Map** — Visual service dependency graph

**Key configuration:**

```csharp
// .NET — Application Insights setup
builder.Services.AddApplicationInsightsTelemetry(options =>
{
    options.ConnectionString = builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"];
    options.EnableAdaptiveSampling = true;
});

// Add custom telemetry initialiser
builder.Services.AddSingleton<ITelemetryInitializer, CustomTelemetryInitializer>();
```

```typescript
// Node.js — Application Insights
import { useAzureMonitor } from '@azure/monitor-opentelemetry';

useAzureMonitor({
  azureMonitorExporterOptions: {
    connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
  },
});
```

### 3. Structured Logging

**Always use structured logs:**

```json
{
  "timestamp": "2025-02-14T10:30:00.000Z",
  "level": "Error",
  "message": "Failed to process order",
  "service": "order-processor",
  "operationId": "abc123def456",
  "orderId": "ORD-2024-001",
  "customerId": "CUST-123",
  "error": {
    "type": "PaymentDeclinedError",
    "message": "Insufficient funds",
    "code": "PAYMENT_DECLINED"
  },
  "durationMs": 245
}
```

**Logging rules:**

- **Include operation IDs** (Application Insights propagates these automatically) for cross-service correlation.
- **Log at appropriate levels.** Error = needs attention. Warning = unexpected but handled. Information = significant events. Debug/Trace = off in production.
- **Set Log Analytics retention policies.** 30 days for dev, 90 days for production, export to Storage Account for compliance.

**KQL queries for investigation:**

```kusto
// Find errors for a specific service
traces
| where timestamp > ago(1h)
| where severityLevel >= 3    // Error and above
| where customDimensions.service == "order-processor"
| project timestamp, message, customDimensions.orderId, customDimensions.error
| order by timestamp desc
| take 50

// Request latency percentiles
requests
| where timestamp > ago(1h)
| summarize
    p50 = percentile(duration, 50),
    p95 = percentile(duration, 95),
    p99 = percentile(duration, 99),
    count()
  by bin(timestamp, 5m)
| render timechart
```

### 4. Metrics

**Platform metrics to monitor for every service:**

| Service | Key metrics |
|---------|------------|
| **Azure Functions** | FunctionExecutionCount, FunctionExecutionUnits, Errors |
| **App Service** | Http5xx, HttpResponseTime, CpuPercentage, MemoryPercentage |
| **Container Apps** | Requests, Replicas, RestartCount, CpuUsage, MemoryUsage |
| **Azure SQL** | cpu_percent, dtu_consumption_percent, deadlock, connection_failed |
| **Cosmos DB** | TotalRequests, TotalRequestUnits, NormalizedRUConsumption |
| **Service Bus** | ActiveMessages, DeadletteredMessages, IncomingMessages |
| **Storage** | Transactions, E2ELatency, Availability |

**Custom metrics for business KPIs:**

```csharp
// .NET — Track custom metric
private readonly TelemetryClient _telemetry;

_telemetry.TrackMetric("OrdersPlaced", 1, new Dictionary<string, string>
{
    { "Environment", "prod" },
    { "Region", "westeurope" }
});

// Or use GetMetric for pre-aggregation (recommended for high volume)
_telemetry.GetMetric("OrderValue", "Currency").TrackValue(149.99, "USD");
```

### 5. Alerts

**Alert design:**

```bicep
// Bicep — Metric alert for high error rate
resource errorAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-high-error-rate-prod'
  location: 'global'
  properties: {
    severity: 1    // 0 = Critical, 1 = Error, 2 = Warning, 3 = Info, 4 = Verbose
    enabled: true
    scopes: [appService.id]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.MultipleResourceMultipleMetricCriteria'
      allOf: [
        {
          criterionType: 'StaticThresholdCriterion'
          name: 'Http5xxErrors'
          metricName: 'Http5xx'
          operator: 'GreaterThan'
          threshold: 10
          timeAggregation: 'Total'
        }
      ]
    }
    actions: [{ actionGroupId: criticalActionGroup.id }]
  }
}

// Action group — route alerts by severity
resource criticalActionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: 'ag-critical-prod'
  location: 'global'
  properties: {
    groupShortName: 'Critical'
    enabled: true
    emailReceivers: [{ name: 'oncall', emailAddress: 'oncall@example.com' }]
    webhookReceivers: [{ name: 'pagerduty', serviceUri: pagerdutyWebhookUri }]
  }
}
```

**Alert best practices:**

- **Alert on symptoms, not causes.** "Error rate > 1%" is better than "CPU > 80%".
- **Use dynamic thresholds** for metrics with variable baselines (traffic patterns).
- **Set appropriate evaluation periods** to avoid flapping.
- **Route alerts by severity.** Critical → PagerDuty/Opsgenie. Warning → Slack/Teams. Informational → Dashboard only.
- **Use alert processing rules** for maintenance windows and suppression.

### 6. Dashboards

Build two types of dashboards:

**Operational dashboard (per service):**
- Request rate, error rate, latency (P50, P95, P99)
- Resource utilisation (CPU, memory, connections, DTU/RU)
- Queue depth and processing lag
- Health check status and dependency availability

**Business dashboard (per domain):**
- Orders per minute
- Revenue / conversion rate
- Sign-up funnel metrics
- Feature adoption

**Use Azure Workbooks** for rich, interactive dashboards with KQL queries. Use **Azure Managed Grafana** for teams already familiar with Grafana.

## Best Practices

- **Use a single Log Analytics workspace** per environment for cross-service correlation. Split only for compliance or cost isolation.
- **Enable Application Insights on every service.** It's the fastest path to observability on Azure.
- **Use sampling** for high-traffic services to control Application Insights costs. Adaptive sampling is enabled by default in .NET.
- **Define SLIs and SLOs.** "99.9% of requests return successfully within 500ms" is measurable and actionable.
- **Automate incident response.** Use Azure Monitor action groups and Logic Apps for automated remediation.
- **Review dashboards and alerts weekly.** Remove stale alerts, add new services, validate relevance.

## Common Pitfalls

- **Unstructured logs.** `Console.WriteLine($"Error processing order {orderId}")` is impossible to query reliably. Use structured logging with ILogger or equivalent.
- **Alert fatigue.** Too many alerts firing for non-actionable issues. Every alert should have a runbook and a clear action.
- **No log retention policy.** Log Analytics at $2.76/GB/month adds up fast. Set retention and export old data to cheaper storage.
- **Missing operation IDs.** Without distributed trace correlation, debugging cross-service issues is guesswork.
- **Dashboard-only monitoring.** Dashboards are for investigation, not detection. Use alerts for detection.
- **Not monitoring costs of monitoring.** Application Insights ingestion and Log Analytics can become expensive with verbose logging. Monitor your monitoring costs.

## Reference

- [Azure Monitor Documentation](https://learn.microsoft.com/en-us/azure/azure-monitor/)
- [Application Insights Documentation](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview)
- [Log Analytics KQL Reference](https://learn.microsoft.com/en-us/kusto/query/)
- [Azure Monitor Best Practices](https://learn.microsoft.com/en-us/azure/azure-monitor/best-practices)
- [Azure Workbooks](https://learn.microsoft.com/en-us/azure/azure-monitor/visualize/workbooks-overview)
