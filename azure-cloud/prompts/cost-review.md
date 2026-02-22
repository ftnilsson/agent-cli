# Azure Cost Review

Review the following Azure infrastructure for cost optimisation opportunities, waste elimination, and FinOps best practices.

## Check For

### Right-Sizing
1. **Over-provisioned compute** — Are VMs, App Service plans, or AKS node pools larger than needed? Check Azure Monitor CPU/memory utilisation.
2. **Over-provisioned databases** — Are Azure SQL DTUs/vCores, Cosmos DB RUs, or Redis cache tiers higher than actual usage?
3. **Idle resources** — Are there unused disks, unattached public IPs, empty App Service plans, idle Application Gateways, or stopped-but-retained VMs?

### Pricing Models
4. **Reserved Instances / Savings Plans** — Are steady-state workloads covered by 1-year or 3-year commitments? What's the coverage percentage?
5. **Spot VMs** — Are fault-tolerant workloads (batch, CI/CD, dev/test) using Spot VMs or Spot node pools?
6. **Dev/Test pricing** — Are non-production workloads using Azure Dev/Test subscription pricing?

### Storage & Data Transfer
7. **Storage tiers** — Are blobs transitioned to Cool, Cold, or Archive tiers when no longer frequently accessed?
8. **Managed disks** — Are Premium SSDs used only where performance justifies cost? Are Standard SSDs or Standard HDDs used for dev/test?
9. **Data transfer** — Are cross-region transfers minimised? Is Front Door or CDN reducing origin egress?
10. **Log retention** — Are Log Analytics retention policies appropriate? Are old logs archived to Storage Accounts?

### Architecture Optimisation
11. **Serverless opportunities** — Can always-on compute be replaced with Azure Functions (Consumption plan) or Container Apps (scale-to-zero)?
12. **Managed services** — Can self-managed infrastructure (Kafka, Redis, Elasticsearch) be replaced with Azure managed equivalents?
13. **Caching** — Are frequently accessed data paths cached (Azure Cache for Redis, Front Door, CDN profiles) to reduce compute and database load?

### Governance
14. **Tagging** — Are all resources tagged with cost-allocation tags (team, environment, project, cost-centre)?
15. **Budgets and alerts** — Are Azure Budgets configured with alerts at 80% and 100% thresholds?
16. **Resource group structure** — Are workloads separated into resource groups for clear cost attribution?

## Output Format

For each finding:

- **Category**: Right-Sizing / Pricing / Storage / Architecture / Governance
- **Estimated Monthly Savings**: $X or a percentage range
- **Effort**: Low / Medium / High
- **Resource**: Specific Azure resource or pattern
- **Issue**: What's costing more than it should
- **Recommendation**: Specific optimisation with implementation steps
