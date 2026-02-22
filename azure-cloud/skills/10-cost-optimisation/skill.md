# Cost Optimisation

## Description

Manage and optimise Azure spending using pricing models, right-sizing, architectural patterns, and FinOps practices. This skill covers the tools, techniques, and decision frameworks for keeping Azure costs under control without sacrificing reliability or performance — from individual resource optimisation to organisation-wide cost governance.

## When To Use

- Reviewing monthly Azure spend for optimisation opportunities
- Choosing between pricing models (Pay-as-you-go, Reserved Instances, Savings Plans, Spot)
- Right-sizing compute, database, and storage resources
- Setting up cost monitoring, budgets, and alerts
- Designing cost-aware architectures from the start
- Implementing tagging strategies for cost allocation

## Prerequisites

- Familiarity with Azure core services and their pricing models
- Access to Azure Cost Management and Billing
- Understanding of workload characteristics (traffic patterns, compute needs)

## Instructions

### 1. Understand Azure Pricing Models

| Model | Discount | Commitment | Best for |
|-------|----------|------------|----------|
| **Pay-as-you-go** | 0% | None | Variable workloads, dev/test, new projects |
| **Savings Plans** | Up to 65% | 1 or 3 year (hourly spend) | Steady-state compute (VMs, App Service, Functions Premium) |
| **Reserved Instances** | Up to 72% | 1 or 3 year (specific SKU + region) | Known VM types and regions, SQL, Cosmos DB |
| **Spot VMs** | Up to 90% | None (can be evicted) | Fault-tolerant: batch, CI/CD, dev/test |
| **Dev/Test Pricing** | ~55% on VMs | Enterprise Agreement / MCA | Non-production environments |

**Decision flow:**

```
Is the workload fault-tolerant (can handle evictions)?
  ├── Yes → Spot VMs or Spot AKS node pools
  └── No → Is the workload steady-state (running 24/7)?
        ├── Yes → Savings Plans (flexibility) or Reserved Instances (max savings)
        └── No → Pay-as-you-go or serverless (Consumption plan)
```

### 2. Right-Size Everything

**Compute:**
- Use **Azure Advisor** — it analyses utilisation and recommends optimal SKUs.
- Check **CPU and memory utilisation.** If average CPU < 20%, the VM or App Service plan is over-provisioned.
- **Azure Functions** — Use Consumption plan for sporadic workloads. Switch to Flex Consumption or Premium only when needed.
- **B-series VMs** for dev/test — burstable, much cheaper than D-series.
- **Start small, scale up.** It's easier to scale up than to convince someone to scale down.

**Database:**
- **Azure SQL Serverless** — auto-pauses after idle period (great for dev/test, intermittent workloads).
- **Cosmos DB** — Use serverless tier for dev/test. Use autoscale provisioned for production (avoids over-provisioning).
- **Elastic Pools** for multiple SQL databases with variable usage patterns — share DTUs/vCores across databases.

**Storage:**
- **Storage tiering** — Hot → Cool (30 days) → Cold (90 days) → Archive (180 days).
- **Lifecycle management policies** to transition blobs automatically.
- **Standard SSD over Premium SSD** for dev/test disks.

### 3. Eliminate Waste

Common sources of waste:

| Resource | Waste indicator | Fix |
|----------|----------------|-----|
| **Managed Disks** | Unattached disks | Delete or snapshot + delete |
| **Public IPs** | Unassociated IPs | Delete ($3.65/month each) |
| **Application Gateways** | No backend targets | Remove or consolidate |
| **App Service plans** | Empty plans (no apps) | Delete |
| **Stopped VMs** | Still paying for disks and IPs | Deallocate or delete |
| **Old snapshots** | Snapshots >90 days | Implement cleanup automation |
| **Log Analytics** | Data ingestion too verbose | Set retention, use sampling, filter |
| **Dev/test environments** | Running 24/7 | Schedule: auto-shutdown at 6 PM |

**Automate dev/test shutdown:**

```bicep
// Auto-shutdown schedule for dev VMs
resource autoShutdown 'Microsoft.DevTestLab/schedules@2018-09-15' = {
  name: 'shutdown-computevm-${vmName}'
  location: location
  properties: {
    status: 'Enabled'
    taskType: 'ComputeVmShutdownTask'
    dailyRecurrence: { time: '1800' }   // 6 PM
    timeZoneId: 'W. Europe Standard Time'
    targetResourceId: vm.id
    notificationSettings: {
      status: 'Enabled'
      timeInMinutes: 30
      emailRecipient: 'team@example.com'
    }
  }
}
```

For App Service and Container Apps, use **Azure Automation** or **Logic Apps** to stop/start on schedule.

### 4. Data Transfer Costs

Azure data transfer pricing:

| Transfer type | Cost |
|---------------|------|
| **Inbound (ingress)** | Free |
| **Same region, same VNet** | Free |
| **Cross Availability Zone** | $0.01/GB each direction |
| **To internet (egress)** | $0.087/GB (first 10 TB) |
| **Cross-region** | $0.02/GB |
| **To Front Door / CDN** | Reduced rates from origin |

**Optimisation strategies:**

- **Use Azure CDN or Front Door** to cache static content at the edge — reduces origin egress.
- **Use Private Endpoints** — traffic stays on the Azure backbone, avoiding egress charges.
- **Co-locate compute and data** in the same region and VNet.
- **Compress data** before transfer.
- **Use VNet peering** (cheaper than VPN Gateway) for VNet-to-VNet connectivity.

### 5. Set Up Cost Governance

**Tagging strategy:**

Every resource must have:

| Tag | Purpose | Example |
|-----|---------|---------|
| `Environment` | Cost allocation by environment | `dev`, `staging`, `prod` |
| `Service` | Cost allocation by service | `order-api`, `payment-service` |
| `Team` | Cost allocation by team | `platform`, `checkout` |
| `CostCentre` | Finance tracking | `CC-1234` |

**Enforce tagging with Azure Policy:**

```json
{
  "if": {
    "allOf": [
      {
        "field": "tags['Environment']",
        "exists": "false"
      }
    ]
  },
  "then": {
    "effect": "deny"
  }
}
```

**Budgets and alerts:**

```bicep
resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'budget-myapp-prod'
  properties: {
    category: 'Cost'
    amount: 5000
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: '2025-01-01'
      endDate: '2026-12-31'
    }
    notifications: {
      'actual-80-percent': {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 80
        thresholdType: 'Actual'
        contactEmails: ['team@example.com']
      }
      'forecast-100-percent': {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: ['team@example.com', 'manager@example.com']
      }
    }
  }
}
```

### 6. Cost-Aware Architecture Patterns

| Pattern | Savings | Description |
|---------|---------|-------------|
| **Serverless-first** | Variable | Pay only for execution. No idle cost. Functions Consumption, Container Apps scale-to-zero. |
| **Spot for batch** | 60-90% | CI/CD runners, batch processing, AKS user node pools on Spot VMs. |
| **Caching layers** | 30-60% | Azure Cache for Redis, CDN, Front Door reduce database and compute load. |
| **SQL Serverless** | 40-60% | Auto-pause for intermittent workloads — no cost during idle. |
| **Event-driven** | Variable | Process only when events occur, no polling. |
| **Dev/Test pricing** | ~55% | Enterprise Agreement Dev/Test subscriptions for non-production. |

## Best Practices

- **Review costs weekly.** Don't wait for the end-of-month bill. Check Cost Management weekly.
- **Set budgets before launching.** Every subscription and resource group should have a budget with alerts at 80% and 100%.
- **Tag everything.** Untagged resources are invisible to cost allocation. Enforce tagging via Azure Policy.
- **Use Savings Plans before Reserved Instances.** Savings Plans are more flexible and cover multiple compute services.
- **Automate dev/test schedules.** Non-production environments should not run 24/7.
- **Architect for cost from day one.** Refactoring a running system for cost is harder than designing for it upfront.
- **Use Azure Advisor regularly.** It provides personalised recommendations for cost, security, reliability, and performance.

## Common Pitfalls

- **Buying reservations too early.** Wait until workload patterns are stable (3-6 months). Start with pay-as-you-go, then commit.
- **Ignoring data transfer costs.** Cross-region, cross-zone, and egress costs add up silently.
- **No tagging enforcement.** Without tags, you can't attribute costs to teams or services. Cost becomes unmanageable.
- **Leaving dev/test running 24/7.** 14 hours of idle time on weekdays + weekends = paying for 3x what you use.
- **Over-provisioning "just in case."** Use auto-scaling and right-sizing instead of provisioning for peak.
- **Premium services in dev/test.** Premium SSD, Premium Service Bus, and large VM SKUs in development waste money. Use Standard/Basic tiers.

## Reference

- [Azure Cost Management Documentation](https://learn.microsoft.com/en-us/azure/cost-management-billing/)
- [Azure Advisor Cost Recommendations](https://learn.microsoft.com/en-us/azure/advisor/advisor-cost-recommendations)
- [Azure Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/)
- [Azure Savings Plans](https://learn.microsoft.com/en-us/azure/cost-management-billing/savings-plan/)
- [FinOps Foundation](https://www.finops.org/)
