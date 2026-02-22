# AWS Cost Review

Review the following AWS infrastructure for cost optimisation opportunities, waste elimination, and FinOps best practices.

## Check For

### Right-Sizing
1. **Over-provisioned compute** — Are EC2 instances, Lambda memory, or Fargate tasks larger than needed? Check CloudWatch CPU/memory utilisation.
2. **Over-provisioned databases** — Are RDS instances or DynamoDB tables provisioned beyond actual usage?
3. **Idle resources** — Are there unused EBS volumes, unattached Elastic IPs, idle load balancers, or stopped-but-retained instances?

### Pricing Models
4. **Reserved Instances / Savings Plans** — Are steady-state workloads covered by commitments? What's the RI/SP coverage percentage?
5. **Spot Instances** — Are fault-tolerant workloads (batch, CI/CD, dev/test) using Spot?
6. **On-Demand waste** — Are production workloads running on-demand that could benefit from commitments?

### Storage & Data Transfer
7. **S3 lifecycle policies** — Are objects transitioned to Infrequent Access, Glacier, or deleted when no longer needed?
8. **EBS volumes** — Are gp3 volumes used instead of gp2? Are snapshots cleaned up?
9. **Data transfer** — Are cross-AZ and cross-region transfers minimised? Is CloudFront reducing origin egress?
10. **Log retention** — Are CloudWatch Logs retention policies set? Are old logs archived or deleted?

### Architecture Optimisation
11. **Serverless opportunities** — Can always-on compute be replaced with Lambda, Fargate Spot, or event-driven patterns?
12. **Managed services** — Can self-managed infrastructure (Kafka, Redis, Elasticsearch) be replaced with managed equivalents?
13. **Caching** — Are frequently accessed data paths cached (ElastiCache, CloudFront, DAX) to reduce compute and database load?

### Governance
14. **Tagging** — Are all resources tagged with cost-allocation tags (team, environment, project)?
15. **Budgets and alerts** — Are AWS Budgets configured with alerts at 80% and 100% thresholds?
16. **Account structure** — Are workloads separated into AWS accounts for billing isolation (dev, staging, prod)?

## Output Format

For each finding:

- **Category**: Right-Sizing / Pricing / Storage / Architecture / Governance
- **Estimated Monthly Savings**: $X or a percentage range
- **Effort**: Low / Medium / High
- **Resource**: Specific AWS resource or pattern
- **Issue**: What's costing more than it should
- **Recommendation**: Specific optimisation with implementation steps
