# Cost Optimisation

## Description

Manage and optimise AWS spending using pricing models, right-sizing, architectural patterns, and FinOps practices. This skill covers the tools, techniques, and decision frameworks for keeping AWS costs under control without sacrificing reliability or performance — from individual resource optimisation to organisation-wide cost governance.

## When To Use

- Reviewing monthly AWS spend for optimisation opportunities
- Choosing between pricing models (On-Demand, Reserved, Savings Plans, Spot)
- Right-sizing compute, database, and storage resources
- Setting up cost monitoring, budgets, and alerts
- Designing cost-aware architectures from the start
- Implementing tagging strategies for cost allocation

## Prerequisites

- Familiarity with AWS core services and their pricing models
- Access to AWS Cost Explorer and Billing dashboard
- Understanding of workload characteristics (traffic patterns, compute needs)

## Instructions

### 1. Understand AWS Pricing Models

| Model | Discount | Commitment | Best for |
|-------|----------|------------|----------|
| **On-Demand** | 0% | None | Variable workloads, dev/test, new projects |
| **Savings Plans (Compute)** | Up to 66% | 1 or 3 year | Steady-state compute (EC2, Fargate, Lambda) |
| **Reserved Instances** | Up to 72% | 1 or 3 year | Known instance types and regions |
| **Spot** | Up to 90% | None (can be interrupted) | Fault-tolerant: batch, CI/CD, dev/test |
| **Fargate Spot** | Up to 70% | None (can be interrupted) | Non-critical ECS tasks |

**Decision flow:**

```
Is the workload fault-tolerant (can handle interruptions)?
  ├── Yes → Spot Instances or Fargate Spot
  └── No → Is the workload steady-state (running 24/7)?
        ├── Yes → Savings Plans (Compute SP for flexibility, EC2 SP for max savings)
        └── No → On-Demand
```

### 2. Right-Size Everything

**Compute:**
- Use **AWS Compute Optimizer** — it analyses CloudWatch metrics and recommends optimal instance types.
- Check **CPU and memory utilisation.** If average CPU < 20%, the instance is over-provisioned.
- **Lambda memory profiling** — use AWS Lambda Power Tuning to find the optimal memory/cost balance.
- **Graviton (ARM)** — switch to `m7g`/`c7g`/`r7g` or ARM Lambda for ~20% cost savings with equal or better performance.

**Database:**
- Use **RDS Performance Insights** to identify if the instance is over-provisioned.
- Consider **Aurora Serverless v2** for variable workloads — pays per ACU instead of fixed instance size.
- Switch DynamoDB to **on-demand mode** for unpredictable workloads (and back to provisioned when patterns are stable).

**Storage:**
- **S3 Intelligent-Tiering** for objects with unknown access patterns.
- **Lifecycle policies** to transition objects to cheaper storage classes.
- **gp3 over gp2** for EBS volumes — gp3 is 20% cheaper with better baseline performance.

### 3. Eliminate Waste

Common sources of waste:

| Resource | Waste indicator | Fix |
|----------|----------------|-----|
| **EBS volumes** | Unattached volumes | Delete or snapshot + delete |
| **Elastic IPs** | Unassociated EIPs | Release them ($3.60/month each) |
| **NAT Gateways** | High GB processed | Use VPC endpoints for S3/DynamoDB |
| **Idle load balancers** | No healthy targets | Remove or consolidate |
| **Old snapshots** | Snapshots >90 days | Implement lifecycle/cleanup |
| **CloudWatch Logs** | No retention policy | Set retention (7/14/30/90 days) |
| **Stopped EC2** | Running attached EBS | Terminate or snapshot |
| **Dev/test environments** | Running 24/7 | Schedule: running 10 hours/day = 60% savings |

**Automate cleanup:**

```typescript
// CDK — Schedule dev environment shutdown
const stopRule = new events.Rule(this, 'StopDevInstances', {
  schedule: events.Schedule.cron({ hour: '18', minute: '0', weekDay: 'MON-FRI' }),
});
stopRule.addTarget(new targets.LambdaFunction(stopInstancesFn));

const startRule = new events.Rule(this, 'StartDevInstances', {
  schedule: events.Schedule.cron({ hour: '8', minute: '0', weekDay: 'MON-FRI' }),
});
startRule.addTarget(new targets.LambdaFunction(startInstancesFn));
```

### 4. Data Transfer Costs

Data transfer is the hidden cost that surprises everyone:

| Transfer type | Cost |
|---------------|------|
| **Inbound** | Free |
| **Same AZ** | Free |
| **Cross-AZ** | $0.01/GB each direction |
| **To internet** | $0.09/GB (first 10 TB) |
| **Cross-region** | $0.02/GB |
| **To CloudFront** | Free (from origin) |
| **VPC endpoint** | $0.01/GB (vs $0.045/GB NAT Gateway) |

**Optimisation strategies:**

- **Use VPC endpoints** for S3 and DynamoDB — gateway endpoints are free, saving NAT Gateway costs.
- **Use CloudFront** to reduce origin egress (data from CloudFront to users is cheaper than from ALB directly).
- **Co-locate compute and data** in the same AZ when possible.
- **Compress data** before transfer.
- **Use S3 Transfer Acceleration** or Direct Connect for large data transfers.

### 5. Set Up Cost Governance

**Tagging strategy:**

Every resource must have:

| Tag | Purpose | Example |
|-----|---------|---------|
| `Environment` | Cost allocation by environment | `dev`, `staging`, `prod` |
| `Service` | Cost allocation by service | `order-api`, `payment-service` |
| `Team` | Cost allocation by team | `platform`, `checkout` |
| `CostCentre` | Finance tracking | `CC-1234` |

**Enforce tagging with SCPs:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RequireTags",
      "Effect": "Deny",
      "Action": ["ec2:RunInstances", "rds:CreateDBInstance"],
      "Resource": "*",
      "Condition": {
        "Null": {
          "aws:RequestTag/Environment": "true",
          "aws:RequestTag/Service": "true"
        }
      }
    }
  ]
}
```

**Budgets and alerts:**

```yaml
Budget:
  Type: AWS::Budgets::Budget
  Properties:
    Budget:
      BudgetName: monthly-account-budget
      BudgetType: COST
      TimeUnit: MONTHLY
      BudgetLimit:
        Amount: 5000
        Unit: USD
    NotificationsWithSubscribers:
      - Notification:
          NotificationType: ACTUAL
          ComparisonOperator: GREATER_THAN
          Threshold: 80
        Subscribers:
          - SubscriptionType: EMAIL
            Address: team@example.com
      - Notification:
          NotificationType: FORECASTED
          ComparisonOperator: GREATER_THAN
          Threshold: 100
        Subscribers:
          - SubscriptionType: EMAIL
            Address: team@example.com
```

### 6. Cost-Aware Architecture Patterns

| Pattern | Savings | Description |
|---------|---------|-------------|
| **Serverless-first** | Variable | Pay only for what you use. No idle compute. |
| **Spot for batch** | 60-90% | CI/CD runners, data processing, dev/test on Spot. |
| **Caching layers** | 30-60% | ElastiCache / CloudFront reduce database and compute load. |
| **Event-driven** | Variable | Process only when events occur, no polling. |
| **Right-sized containers** | 20-40% | Fargate tasks sized to actual CPU/memory needs. |
| **ARM (Graviton)** | 20% | Same performance, lower cost on ARM processors. |

## Best Practices

- **Review costs weekly.** Don't wait for the end-of-month bill. Check Cost Explorer weekly.
- **Set budgets before launching.** Every account and project should have a budget with alerts at 80% and 100%.
- **Tag everything.** Untagged resources are invisible to cost allocation. Enforce tagging via SCPs.
- **Use Savings Plans before Reserved Instances.** Compute Savings Plans are more flexible and cover Lambda and Fargate.
- **Automate dev/test schedules.** Non-production environments should not run 24/7.
- **Architect for cost from day one.** Refactoring a running system for cost is harder than designing for it upfront.

## Common Pitfalls

- **Buying Reserved Instances too early.** Wait until workload patterns are stable (3-6 months). Start with On-Demand, then commit.
- **Ignoring data transfer costs.** Cross-AZ, cross-region, and NAT Gateway costs add up silently.
- **No tagging enforcement.** Without tags, you can't attribute costs to teams or services. Cost becomes unmanageable.
- **Leaving dev/test running 24/7.** 14 hours of idle time on weekdays + weekends = paying for 3x what you use.
- **Over-provisioning "just in case."** Use auto-scaling and right-sizing instead of provisioning for peak.
- **Optimising too early.** Don't micro-optimise $10/month services. Focus on the top 3 cost drivers first.

## Reference

- [AWS Cost Optimisation Pillar](https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/welcome.html)
- [AWS Cost Explorer](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-what-is.html)
- [AWS Compute Optimizer](https://docs.aws.amazon.com/compute-optimizer/latest/ug/what-is-compute-optimizer.html)
- [AWS Pricing Calculator](https://calculator.aws/)
- [The Frugal Architect — Werner Vogels](https://thefrugalarchitect.com/)
