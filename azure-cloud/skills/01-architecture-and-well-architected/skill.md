# Azure Architecture & Well-Architected

## Description

Design and evaluate Azure architectures using the Azure Well-Architected Framework's five pillars: Reliability, Security, Cost Optimisation, Operational Excellence, and Performance Efficiency. This skill covers the decision-making process for choosing Azure services, designing for failure, planning subscription and landing zone strategies, and building architectures that scale, recover, and evolve.

## When To Use

- Starting a new project or workload on Azure
- Reviewing an existing architecture for gaps or improvement opportunities
- Preparing for an Azure Well-Architected Review
- Deciding between architectural patterns (monolith vs microservices, serverless vs containers)
- Planning disaster recovery, multi-region, or high-availability strategies
- Evaluating trade-offs between managed PaaS services and self-hosted IaaS

## Prerequisites

- Basic understanding of cloud computing concepts (regions, Availability Zones, managed services)
- Familiarity with core Azure services (VMs, App Service, Azure SQL, Storage Accounts)
- Understanding of networking fundamentals (IP addressing, DNS, load balancing)

## Instructions

### 1. Start with the Well-Architected Framework

Every architecture decision should be evaluated against the five pillars:

| Pillar | Key Question |
|--------|-------------|
| **Reliability** | Will this system recover from failures and meet availability targets? |
| **Security** | Is access controlled, data protected, and compliance maintained? |
| **Cost Optimisation** | Are you spending only what's necessary? |
| **Operational Excellence** | Can you deploy, monitor, and improve this system efficiently? |
| **Performance Efficiency** | Are you using the right resources for the workload characteristics? |

Don't optimise a single pillar at the expense of others. Architecture is about trade-offs.

### 2. Design for Failure

Everything in the cloud will fail eventually. Design for it:

- **Availability Zones by default.** Stateful services (Azure SQL, Redis) should always be zone-redundant. Stateless services should spread across zones behind a load balancer.
- **Retry with exponential backoff.** Every service call should handle transient failures. Use Polly (.NET), resilience4j (Java), or equivalent libraries.
- **Circuit breakers.** Prevent cascading failures when a downstream dependency is unhealthy.
- **Graceful degradation.** Serve stale cache, show partial results, or queue requests rather than returning errors.
- **Chaos engineering.** Test failure scenarios proactively with Azure Chaos Studio.

```
               ┌──────────────────────────┐
               │     Azure Front Door     │
               │     (Global LB + WAF)    │
               └────────────┬─────────────┘
                            │
               ┌────────────▼─────────────┐
               │  Application Gateway     │
               │  (Regional L7 LB)        │
               └─────┬──────────────┬─────┘
                     │              │
              ┌──────▼──────┐ ┌────▼────────┐
              │  Zone 1     │ │  Zone 2     │
              │  Compute    │ │  Compute    │
              │  Cache      │ │  Cache      │
              │  SQL Primary│ │  SQL Replica│
              └─────────────┘ └─────────────┘
```

### 3. Choose the Right Architecture Pattern

| Pattern | When to use | Azure services |
|---------|------------|--------------|
| **Monolith** | Early stage, small team, unclear domain boundaries | App Service, single container in ACA |
| **Microservices** | Clear domain boundaries, independent scaling/deployment needs | ACA, AKS, Azure Functions, Service Bus |
| **Serverless-first** | Event-driven, variable traffic, minimise ops overhead | Azure Functions, Event Grid, Cosmos DB, Blob Storage |
| **Event-driven** | Decoupled workflows, async processing, eventual consistency is acceptable | Event Grid, Service Bus, Event Hubs, Durable Functions |

**Don't start with microservices.** Start with a well-structured monolith. Extract services when you have clear boundaries, independent scaling needs, and a team structure to support them.

### 4. Plan Your Subscription & Landing Zone Strategy

Use Azure Landing Zones for enterprise-scale governance:

```
Management Group Hierarchy
├── Root Management Group
│   ├── Platform
│   │   ├── Identity (Entra ID Connect, domain controllers)
│   │   ├── Management (Log Analytics, Automation, Monitor)
│   │   └── Connectivity (Hub VNet, ExpressRoute, Firewall)
│   ├── Landing Zones
│   │   ├── Corp (internal apps, private endpoints)
│   │   └── Online (internet-facing apps)
│   ├── Sandbox (dev/experimentation, no production data)
│   └── Decommissioned
```

- **Separate subscriptions per environment** for blast-radius isolation and clear billing.
- **Azure Policy** at management group level to enforce guardrails (allowed regions, required tags, denied resource types).
- **Hub-spoke networking** with Azure Firewall or NVA for centralised egress and inspection.
- **Entra ID** with Privileged Identity Management (PIM) for just-in-time admin access.

### 5. Design for Observability from Day One

Architecture without observability is flying blind:

- **Metrics** — Azure Monitor metrics for every service, custom metrics for business KPIs.
- **Logs** — Structured logs, centralised in Log Analytics workspace.
- **Traces** — Application Insights for distributed tracing across services.
- **Alerts** — Azure Monitor alerts for SLO breaches and anomaly detection.
- **Dashboards** — Azure Dashboards or Grafana (via Azure Managed Grafana) per service and per domain.

### 6. Make Decisions Reversible

Two-way doors (easily reversible) should be made quickly. One-way doors (hard to reverse) require more analysis:

| One-way door (be careful) | Two-way door (move fast) |
|--------------------------|--------------------------|
| Database engine choice | VM/tier size |
| Primary Azure region | Feature flag rollout |
| Subscription/MG structure | App Service plan tier |
| Cosmos DB partition key design | Cache TTL |
| Event schema format | API response fields (additive) |

## Best Practices

- **Use PaaS and managed services over IaaS.** Let Azure handle undifferentiated heavy lifting (patching, scaling, HA).
- **Decouple components with queues and events.** Direct service-to-service calls create tight coupling and cascading failures.
- **Automate everything.** If you're clicking in the Azure Portal, you're doing it wrong for production.
- **Design for the 10x scale.** Your architecture should handle 10x current load without rearchitecting.
- **Document architecture decisions.** Use ADRs (Architecture Decision Records) to capture why, not just what.
- **Use tags consistently.** Every resource should have `Environment`, `Team`, `Service`, and `CostCentre` tags.

## Common Pitfalls

- **Lifting and shifting without rearchitecting.** Running your on-premises architecture on VMs misses most cloud benefits.
- **Single Availability Zone deployments.** A zone failure shouldn't take your application down. Zone redundancy is a baseline, not optional.
- **Tight coupling between services.** Synchronous HTTP calls between microservices create fragile dependency chains.
- **No disaster recovery plan.** "We'll figure it out" is not a DR strategy. Define RTO and RPO, then design accordingly.
- **Over-engineering early.** Multi-region active-active for an app with 100 users is wasted effort and money.
- **Using public endpoints for PaaS.** Default Azure SQL, Storage, and Cosmos DB are publicly accessible. Use Private Endpoints for production.

## Reference

- [Azure Well-Architected Framework](https://learn.microsoft.com/en-us/azure/well-architected/)
- [Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/)
- [Azure Landing Zones](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/landing-zone/)
- [Cloud Adoption Framework for Azure](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/)
- [Azure Reliability Documentation](https://learn.microsoft.com/en-us/azure/reliability/)
