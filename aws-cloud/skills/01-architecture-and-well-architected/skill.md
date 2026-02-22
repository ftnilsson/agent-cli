# AWS Architecture & Well-Architected

## Description

Design and evaluate AWS architectures using the AWS Well-Architected Framework's six pillars: Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimisation, and Sustainability. This skill covers the decision-making process for choosing AWS services, designing for failure, planning multi-account and multi-region strategies, and building architectures that scale, recover, and evolve.

## When To Use

- Starting a new project or workload on AWS
- Reviewing an existing architecture for gaps or improvement opportunities
- Preparing for an AWS Well-Architected Review
- Deciding between architectural patterns (monolith vs microservices, serverless vs containers)
- Planning disaster recovery, multi-region, or high-availability strategies
- Evaluating trade-offs between managed services and self-hosted solutions

## Prerequisites

- Basic understanding of cloud computing concepts (regions, AZs, managed services)
- Familiarity with core AWS services (EC2, S3, RDS, Lambda)
- Understanding of networking fundamentals (IP addressing, DNS, load balancing)

## Instructions

### 1. Start with the Well-Architected Framework

Every architecture decision should be evaluated against the six pillars:

| Pillar | Key Question |
|--------|-------------|
| **Operational Excellence** | Can you deploy, monitor, and improve this system efficiently? |
| **Security** | Is access controlled, data protected, and compliance maintained? |
| **Reliability** | Will this system recover from failures and meet availability targets? |
| **Performance Efficiency** | Are you using the right resources for the workload characteristics? |
| **Cost Optimisation** | Are you spending only what's necessary? |
| **Sustainability** | Are you minimising environmental impact? |

Don't optimise a single pillar at the expense of others. Architecture is about trade-offs.

### 2. Design for Failure

Everything in the cloud will fail eventually. Design for it:

- **Multi-AZ by default.** Stateful services (RDS, ElastiCache) should always be Multi-AZ. Stateless services should have instances in at least 2 AZs behind a load balancer.
- **Retry with exponential backoff.** Every service call should handle transient failures gracefully.
- **Circuit breakers.** Prevent cascading failures when a downstream dependency is unhealthy.
- **Graceful degradation.** Serve stale cache, show partial results, or queue requests rather than returning errors.
- **Chaos engineering.** Test failure scenarios proactively with AWS Fault Injection Simulator.

```
               ┌──────────────────────────┐
               │      Route 53 (DNS)      │
               └────────────┬─────────────┘
                            │
               ┌────────────▼─────────────┐
               │   CloudFront (CDN/WAF)   │
               └────────────┬─────────────┘
                            │
               ┌────────────▼─────────────┐
               │   ALB (Multi-AZ)         │
               └─────┬──────────────┬─────┘
                     │              │
              ┌──────▼──────┐ ┌────▼────────┐
              │  AZ-1       │ │  AZ-2       │
              │  Compute    │ │  Compute    │
              │  Cache      │ │  Cache      │
              │  DB Primary │ │  DB Standby │
              └─────────────┘ └─────────────┘
```

### 3. Choose the Right Architecture Pattern

| Pattern | When to use | AWS services |
|---------|------------|--------------|
| **Monolith** | Early stage, small team, unclear domain boundaries | EC2, Elastic Beanstalk, ECS single service |
| **Microservices** | Clear domain boundaries, independent scaling/deployment needs | ECS, EKS, Lambda, API Gateway, SQS |
| **Serverless-first** | Event-driven, variable traffic, minimise ops overhead | Lambda, API Gateway, DynamoDB, S3, EventBridge |
| **Event-driven** | Decoupled workflows, async processing, eventual consistency is acceptable | EventBridge, SQS, SNS, Step Functions, Kinesis |

**Don't start with microservices.** Start with a well-structured monolith. Extract services when you have clear boundaries, independent scaling needs, and a team structure to support them.

### 4. Plan Your Account Strategy

Use AWS Organizations with multiple accounts for isolation:

```
Management Account (billing, org policies)
├── Security Account (GuardDuty, Security Hub, CloudTrail)
├── Shared Services (CI/CD, container registries, DNS)
├── Dev Account
├── Staging Account
└── Production Account
```

- **One workload per account** for blast-radius isolation
- **Service Control Policies (SCPs)** to enforce guardrails organisation-wide
- **AWS SSO / Identity Center** for centralised human access
- **Cross-account roles** for programmatic access

### 5. Design for Observability from Day One

Architecture without observability is flying blind:

- **Metrics** — CloudWatch metrics for every service, custom metrics for business KPIs
- **Logs** — Structured JSON logs, centralised in CloudWatch Logs or OpenSearch
- **Traces** — X-Ray for distributed tracing across services
- **Alarms** — CloudWatch Alarms for SLO breaches, anomaly detection
- **Dashboards** — Operational and business dashboards per service

### 6. Make Decisions Reversible

Two-way doors (easily reversible) should be made quickly. One-way doors (hard to reverse) require more analysis:

| One-way door (be careful) | Two-way door (move fast) |
|--------------------------|--------------------------|
| Database engine choice | Instance size |
| Primary AWS region | Feature flag rollout |
| Account/org structure | Lambda runtime |
| Event schema format | API response fields (additive) |
| DynamoDB partition key design | CloudFront cache TTL |

## Best Practices

- **Use managed services over self-hosted.** Let AWS handle undifferentiated heavy lifting (patching, scaling, HA).
- **Decouple components with queues and events.** Direct service-to-service calls create tight coupling and cascading failures.
- **Automate everything.** If you're clicking in the console, you're doing it wrong for production.
- **Design for the 10x scale.** Your architecture should handle 10x current load without rearchitecting.
- **Document architecture decisions.** Use ADRs (Architecture Decision Records) to capture why, not just what.
- **Use tags consistently.** Every resource should have `Environment`, `Team`, `Service`, and `CostCentre` tags.

## Common Pitfalls

- **Lifting and shifting without rearchitecting.** Running your on-premises architecture on EC2 misses most cloud benefits.
- **Single-AZ deployments.** An AZ failure shouldn't take your application down. Multi-AZ is a baseline, not optional.
- **Tight coupling between services.** Synchronous HTTP calls between microservices create fragile dependency chains.
- **No disaster recovery plan.** "We'll figure it out" is not a DR strategy. Define RTO and RPO, then design accordingly.
- **Over-engineering early.** Multi-region active-active for an app with 100 users is wasted effort and money.
- **Ignoring data gravity.** Moving data is expensive and slow. Co-locate compute with data.

## Reference

- [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html)
- [AWS Architecture Center](https://aws.amazon.com/architecture/)
- [AWS Well-Architected Labs](https://www.wellarchitectedlabs.com/)
- [AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/welcome.html)
- [The Frugal Architect — Werner Vogels](https://thefrugalarchitect.com/)
