# Compute & Containers

## Description

Choose, configure, and operate the right compute model for your workload on AWS. This skill covers the spectrum from fully serverless (Lambda) to fully managed containers (ECS/Fargate, EKS) to traditional instances (EC2), including when to use each, how to configure them for production, and how to migrate between them as requirements evolve.

## When To Use

- Choosing between Lambda, Fargate, ECS on EC2, EKS, or raw EC2 for a new workload
- Configuring Lambda functions for production (memory, timeout, concurrency, layers)
- Setting up ECS services with Fargate or EC2 launch types
- Designing container architectures with proper task definitions and service discovery
- Optimising compute costs (Spot, Graviton, right-sizing)
- Managing auto-scaling policies for variable workloads

## Prerequisites

- Basic understanding of containers and Docker
- Familiarity with AWS networking (VPC, subnets, security groups)
- Understanding of IAM roles and policies

## Instructions

### 1. Choose the Right Compute Model

| Model | Best for | Cold start | Ops overhead | Cost model |
|-------|---------|------------|--------------|------------|
| **Lambda** | Event-driven, short tasks (<15 min), variable traffic | 100ms–10s | Minimal | Per-invocation |
| **Fargate** | Containerised services, predictable workloads, no server management | Seconds | Low | Per vCPU/memory/hour |
| **ECS on EC2** | High throughput, GPU workloads, cost-sensitive at scale | None (warm) | Medium | EC2 instance pricing |
| **EKS** | Kubernetes-native teams, multi-cloud portability needs | None (warm) | High | EC2/Fargate + control plane fee |
| **EC2** | Full OS control, specialised hardware, legacy apps | None (warm) | Highest | Instance pricing |

**Decision flow:**

```
Is the workload event-driven and short-lived (<15 min)?
  ├── Yes → Lambda
  └── No → Does the team need/want Kubernetes?
        ├── Yes → EKS (Fargate or managed node groups)
        └── No → Do you need full OS/instance control?
              ├── Yes → ECS on EC2 or raw EC2
              └── No → ECS on Fargate
```

### 2. Lambda — Serverless Compute

**Configuration best practices:**

```yaml
# SAM / CloudFormation Lambda config
MyFunction:
  Type: AWS::Serverless::Function
  Properties:
    Runtime: nodejs20.x
    Handler: index.handler
    MemorySize: 1024          # More memory = more CPU. Profile to find sweet spot.
    Timeout: 30               # Set realistic timeout, not max 900.
    ReservedConcurrentExecutions: 100  # Protect downstream services.
    Environment:
      Variables:
        TABLE_NAME: !Ref MyTable
    Policies:
      - DynamoDBCrudPolicy:   # SAM policy template — scoped automatically.
          TableName: !Ref MyTable
```

**Key Lambda rules:**

- **Right-size memory.** Lambda allocates CPU proportional to memory. Use AWS Lambda Power Tuning to find the optimal setting.
- **Minimise cold starts.** Keep deployment packages small, use layers for shared dependencies, use Provisioned Concurrency for latency-sensitive functions.
- **Set realistic timeouts.** A 15-minute timeout on a function that should complete in 3 seconds will hold resources during failures.
- **Use reserved concurrency** to protect downstream services from Lambda scaling too aggressively.
- **Store state externally.** Lambda is stateless by design. Use DynamoDB, S3, or ElastiCache for state.

### 3. ECS with Fargate — Managed Containers

**Task definition essentials:**

```json
{
  "family": "my-service",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "app",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app:latest",
      "portMappings": [{ "containerPort": 8080, "protocol": "tcp" }],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/my-service",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

**ECS service patterns:**

- **Use `awsvpc` network mode** for Fargate — each task gets its own ENI and security group.
- **Enable ECS Service Connect or Cloud Map** for service discovery between services.
- **Configure health checks** in the task definition AND the target group. Unhealthy tasks should be replaced automatically.
- **Use capacity providers** to mix Fargate and Fargate Spot for cost savings on fault-tolerant workloads.

### 4. Auto-Scaling

**Lambda:** Scales automatically. Use reserved concurrency to cap it when needed.

**ECS/Fargate:** Use Application Auto Scaling:

```yaml
ScalingTarget:
  Type: AWS::ApplicationAutoScaling::ScalableTarget
  Properties:
    MaxCapacity: 10
    MinCapacity: 2
    ResourceId: !Sub service/${ClusterName}/${ServiceName}
    ScalableDimension: ecs:service:DesiredCount
    ServiceNamespace: ecs

ScalingPolicy:
  Type: AWS::ApplicationAutoScaling::ScalingPolicy
  Properties:
    PolicyType: TargetTrackingScaling
    TargetTrackingScalingPolicyConfiguration:
      TargetValue: 70.0
      PredefinedMetricSpecification:
        PredefinedMetricType: ECSServiceAverageCPUUtilization
      ScaleInCooldown: 300
      ScaleOutCooldown: 60
```

- **Scale on the metric closest to the user.** Request count or latency is often better than CPU.
- **Set scale-out cooldown shorter than scale-in** to respond to spikes quickly but avoid flapping.
- **Minimum 2 tasks across 2 AZs** for production services.

### 5. Use Graviton (ARM) for Cost/Performance

AWS Graviton processors (ARM-based) offer up to 40% better price-performance:

- **Lambda:** Set `Architectures: [arm64]` — most runtimes support it natively.
- **Fargate:** Build multi-arch container images and specify ARM64 in the task definition.
- **EC2:** Use `m7g`, `c7g`, `r7g` instance families instead of `m7i`, `c7i`, `r7i`.

Test your workload on Graviton. Most Node.js, Python, Java, and Go workloads run without changes.

## Best Practices

- **Default to serverless.** Start with Lambda unless you have a specific reason not to.
- **Use infrastructure as code** for all compute configuration — no manual console changes.
- **Tag all resources** with service, team, environment, and cost-centre tags.
- **Use Spot for fault-tolerant workloads.** CI/CD, batch processing, and dev/test environments save 60-90% with Spot.
- **Build small, focused container images.** Base on `alpine` or distroless images. Smaller images = faster pulls = faster scaling.
- **Use ECR image scanning** to detect vulnerabilities in container images.

## Common Pitfalls

- **Running everything on EC2.** If you're managing OS patches, instance lifecycle, and auto-scaling groups, ask if Fargate or Lambda would eliminate that overhead.
- **Over-provisioning Lambda memory.** 3GB of memory for a function that reads from DynamoDB and returns JSON is waste. Profile with Power Tuning.
- **No health checks.** Without health checks, ECS will keep routing to unhealthy containers. Always configure both container and ALB health checks.
- **Ignoring cold starts in latency-sensitive paths.** If P99 latency matters, use Provisioned Concurrency for Lambda or keep Fargate tasks warm.
- **Using `latest` tag for container images.** Pin to specific image digests or semantic versions for reproducible deployments.
- **One giant container with everything.** Separate processes into separate containers (sidecar pattern) for independent scaling and lifecycle.

## Reference

- [AWS Lambda Developer Guide](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html)
- [Amazon ECS Best Practices Guide](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/intro.html)
- [AWS Fargate Documentation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html)
- [AWS Lambda Power Tuning](https://github.com/alexcasalboni/aws-lambda-power-tuning)
- [AWS Graviton Getting Started](https://github.com/aws/aws-graviton-getting-started)
