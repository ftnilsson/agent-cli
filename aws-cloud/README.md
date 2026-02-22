# AWS Cloud Development Skills

Comprehensive AWS cloud development skills covering architecture, core services, infrastructure as code, security, and operational excellence. These skills apply across serverless, container-based, and traditional compute workloads running on AWS.

## Skills

| # | Skill | Summary |
|---|-------|---------|
| 01 | [AWS Architecture & Well-Architected](skills/01-architecture-and-well-architected/skill.md) | Design resilient, cost-efficient, high-performing AWS architectures using the Well-Architected Framework |
| 02 | [Compute & Containers](skills/02-compute-and-containers/skill.md) | Lambda, ECS, EKS, Fargate, EC2 — choosing and configuring the right compute model |
| 03 | [Networking & Content Delivery](skills/03-networking-and-content-delivery/skill.md) | VPC design, subnets, security groups, ALB/NLB, CloudFront, Route 53, and API Gateway |
| 04 | [Storage & Databases](skills/04-storage-and-databases/skill.md) | S3, DynamoDB, RDS, Aurora, ElastiCache — picking and configuring data stores |
| 05 | [Infrastructure as Code](skills/05-infrastructure-as-code/skill.md) | CDK, CloudFormation, and Terraform for repeatable, version-controlled AWS infrastructure |
| 06 | [Security & IAM](skills/06-security-and-iam/skill.md) | IAM policies, least-privilege roles, Secrets Manager, KMS, GuardDuty, and compliance |
| 07 | [Observability & Monitoring](skills/07-observability-and-monitoring/skill.md) | CloudWatch, X-Ray, CloudTrail, alarms, dashboards, and structured logging |
| 08 | [CI/CD & DevOps](skills/08-cicd-and-devops/skill.md) | CodePipeline, CodeBuild, CodeDeploy, GitHub Actions with AWS, and deployment strategies |
| 09 | [Messaging & Event-Driven Architecture](skills/09-messaging-and-event-driven/skill.md) | SQS, SNS, EventBridge, Step Functions, and Kinesis for decoupled, event-driven systems |
| 10 | [Cost Optimisation](skills/10-cost-optimisation/skill.md) | Cost Explorer, Budgets, Reserved/Spot strategies, right-sizing, and FinOps practices |

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
│ & IAM        │ │ & Monitoring   │ │ DevOps         │
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
