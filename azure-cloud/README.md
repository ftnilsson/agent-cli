# Azure Cloud Development Skills

Comprehensive Azure cloud development skills covering architecture, core services, infrastructure as code, security, and operational excellence. These skills apply across serverless, container-based, and traditional compute workloads running on Microsoft Azure.

## Skills

| # | Skill | Summary |
|---|-------|---------|
| 01 | [Azure Architecture & Well-Architected](skills/01-architecture-and-well-architected/skill.md) | Design resilient, cost-efficient, high-performing architectures using the Azure Well-Architected Framework |
| 02 | [Compute & Containers](skills/02-compute-and-containers/skill.md) | Azure Functions, App Service, ACA, AKS, VMs — choosing and configuring the right compute model |
| 03 | [Networking & Content Delivery](skills/03-networking-and-content-delivery/skill.md) | VNet design, NSGs, Application Gateway, Front Door, Azure DNS, and API Management |
| 04 | [Storage & Databases](skills/04-storage-and-databases/skill.md) | Blob Storage, Cosmos DB, Azure SQL, Azure Cache for Redis — picking and configuring data stores |
| 05 | [Infrastructure as Code](skills/05-infrastructure-as-code/skill.md) | Bicep, ARM templates, Terraform, and Pulumi for repeatable, version-controlled Azure infrastructure |
| 06 | [Security & Identity](skills/06-security-and-identity/skill.md) | Entra ID, managed identities, Key Vault, Defender for Cloud, and RBAC |
| 07 | [Observability & Monitoring](skills/07-observability-and-monitoring/skill.md) | Azure Monitor, Application Insights, Log Analytics, alerts, and dashboards |
| 08 | [CI/CD & DevOps](skills/08-cicd-and-devops/skill.md) | Azure DevOps, GitHub Actions with Azure, deployment strategies, and release automation |
| 09 | [Messaging & Event-Driven Architecture](skills/09-messaging-and-event-driven/skill.md) | Service Bus, Event Grid, Event Hubs, Durable Functions, and Logic Apps for decoupled systems |
| 10 | [Cost Optimisation](skills/10-cost-optimisation/skill.md) | Cost Management, Advisor, Reserved Instances, Spot VMs, right-sizing, and FinOps practices |

## How These Skills Relate

```
              ┌────────────────────────────────┐
              │ 01 Architecture &              │  ← Foundation — the blueprint
              │    Well-Architected            │
              └───────────────┬────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                      ▼
┌───────────────┐  ┌───────────────────┐  ┌──────────────────┐
│ 02 Compute &  │  │ 03 Networking &   │  │ 04 Storage &     │
│ Containers    │  │ Content Delivery  │  │ Databases        │
└───────┬───────┘  └────────┬──────────┘  └────────┬─────────┘
        │                   │                       │
        └─────────────┬─────┴───────────────────────┘
                      ▼
        ┌──────────────────────────┐
        │ 05 Infrastructure as Code │  ← Define it all in code
        └─────────────┬────────────┘
                      │
        ┌─────────────┼──────────────────┐
        ▼             ▼                   ▼
┌──────────────┐ ┌────────────────┐ ┌────────────────┐
│ 06 Security  │ │ 07 Observability│ │ 08 CI/CD &     │
│ & Identity   │ │ & Monitoring   │ │ DevOps         │
└──────────────┘ └────────────────┘ └────────────────┘
                      │
        ┌─────────────┼──────────────┐
        ▼                            ▼
┌───────────────────────┐  ┌──────────────────┐
│ 09 Messaging &        │  │ 10 Cost          │
│ Event-Driven          │  │ Optimisation     │
└───────────────────────┘  └──────────────────┘
```

Architecture sets the direction. Compute, networking, and storage form the infrastructure core. IaC codifies it. Security, observability, and CI/CD wrap it in operational excellence. Messaging enables decoupling and scale. Cost optimisation keeps it sustainable.
