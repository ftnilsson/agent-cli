# Azure Architecture Review

Review the following Azure architecture for design quality, resilience, security, cost-effectiveness, and alignment with the Azure Well-Architected Framework.

## Check For

1. **Reliability** — Is the workload deployed across multiple Availability Zones? Are there health probes, auto-scaling, and retry policies? Is there a disaster recovery strategy with defined RTO/RPO?
2. **Security** — Are managed identities used instead of connection strings and keys? Are secrets in Key Vault? Is encryption at rest and in transit enabled? Are NSGs and Private Endpoints configured correctly?
3. **Cost Optimisation** — Are resources right-sized? Are Reserved Instances or Savings Plans in place for steady-state workloads? Are idle resources identified and deallocated? Are budgets and alerts configured?
4. **Operational Excellence** — Is infrastructure defined as code (Bicep/Terraform)? Are there deployment pipelines with rollback capability? Is monitoring and alerting comprehensive?
5. **Performance Efficiency** — Is the right compute model chosen (Functions vs App Service vs AKS)? Are caching layers in place (Azure Cache for Redis, Front Door)? Are database read replicas used where appropriate?

## Check Infrastructure as Code

- **Is all infrastructure defined in Bicep, ARM, or Terraform?** No portal click-ops.
- **Are deployments logically separated?** (networking, compute, data, monitoring)
- **Are cross-resource references clean?** No hard-coded resource IDs or subscription IDs.
- **Are parameters and secrets externalised?** Not committed to source control.

## Check Networking

- **VNet design** — Are public and private subnets properly separated? Are service endpoints or Private Endpoints in place for PaaS services?
- **NSGs** — Are inbound rules restricted to specific ports and source CIDRs? No `*` on anything other than public load balancers.
- **DNS and routing** — Is Azure DNS or Private DNS Zones managing resolution? Are UDRs configured for forced tunnelling where required?

## Output Format

For each finding:

- **Component**: The Azure service or architectural element
- **Pillar**: Which Well-Architected pillar it relates to
- **Severity**: 🔴 Critical / 🟡 Improvement / 🟢 Suggestion
- **Issue**: Description of the concern
- **Recommendation**: Specific fix with Azure service/configuration details
