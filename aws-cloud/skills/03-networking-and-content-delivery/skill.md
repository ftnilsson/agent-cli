# Networking & Content Delivery

## Description

Design and configure AWS networking infrastructure — VPCs, subnets, security groups, load balancers, CDN, DNS, and API gateways. This skill covers building secure, performant, and cost-efficient network architectures that underpin every AWS workload.

## When To Use

- Designing a VPC layout for a new project or migrating from a default VPC
- Configuring security groups and NACLs for defence in depth
- Setting up load balancers (ALB, NLB) for traffic distribution
- Configuring CloudFront for static assets, APIs, or full-site acceleration
- Managing DNS with Route 53 (routing policies, health checks, failover)
- Designing API Gateway configurations for REST or WebSocket APIs

## Prerequisites

- Understanding of IP addressing, CIDR notation, and subnetting
- Familiarity with TCP/UDP, HTTP/HTTPS, and TLS
- Basic understanding of DNS and load balancing concepts

## Instructions

### 1. Design Your VPC

A well-designed VPC is the foundation of secure AWS networking:

```
VPC: 10.0.0.0/16 (65,536 IPs)
│
├── Public Subnets (one per AZ — internet-facing resources)
│   ├── 10.0.1.0/24 (AZ-a) — ALB, NAT Gateway, bastion
│   ├── 10.0.2.0/24 (AZ-b)
│   └── 10.0.3.0/24 (AZ-c)
│
├── Private Subnets (one per AZ — application tier)
│   ├── 10.0.11.0/24 (AZ-a) — ECS tasks, Lambda, EC2
│   ├── 10.0.12.0/24 (AZ-b)
│   └── 10.0.13.0/24 (AZ-c)
│
├── Data Subnets (one per AZ — databases, caches)
│   ├── 10.0.21.0/24 (AZ-a) — RDS, ElastiCache, OpenSearch
│   ├── 10.0.22.0/24 (AZ-b)
│   └── 10.0.23.0/24 (AZ-c)
│
└── Route Tables
    ├── Public RT  →  IGW (0.0.0.0/0)
    ├── Private RT →  NAT Gateway (0.0.0.0/0)
    └── Data RT    →  No internet route
```

**Key rules:**

- **Always use at least 2 AZs** (3 for production) for high availability.
- **Size subnets generously.** Fargate tasks and Lambda ENIs consume IPs fast. Use `/20` or `/19` if possible.
- **Private subnets by default.** Only load balancers, NAT Gateways, and bastion hosts belong in public subnets.
- **Separate data subnets** with their own route table and no internet route — databases should never be internet-accessible.

### 2. Security Groups — Your Primary Firewall

Security groups are stateful firewalls attached to every ENI:

```
# Web tier security group
ALB-SG:
  Inbound:  443/tcp from 0.0.0.0/0  (HTTPS from internet)
  Outbound: All traffic

# Application tier security group
App-SG:
  Inbound:  8080/tcp from ALB-SG     (only from load balancer)
  Outbound: All traffic

# Database tier security group
DB-SG:
  Inbound:  5432/tcp from App-SG     (only from app tier)
  Outbound: None required (stateful return traffic is allowed)
```

**Rules:**

- **Reference security groups, not CIDR blocks** when possible. This keeps rules dynamic as IPs change.
- **Never open SSH (22) or RDP (3389) to 0.0.0.0/0.** Use Systems Manager Session Manager for shell access.
- **Outbound rules matter.** Restrict outbound to only what's needed for compliance-sensitive workloads.
- **Use VPC endpoints** to access S3, DynamoDB, and other AWS services without traversing the internet.

### 3. Load Balancing

| Type | Layer | Use case |
|------|-------|----------|
| **ALB** | Layer 7 (HTTP/HTTPS) | Web apps, APIs, path-based routing, WebSocket |
| **NLB** | Layer 4 (TCP/UDP) | High performance, static IPs, gRPC, non-HTTP protocols |
| **GWLB** | Layer 3 (Network) | Third-party appliances (firewalls, IDS/IPS) |

**ALB configuration best practices:**

- **Enable access logging** to S3 for troubleshooting and audit.
- **Configure health checks with appropriate thresholds.** Don't use `/` — use a dedicated `/health` endpoint that checks downstream dependencies.
- **Use target group deregistration delay** — set long enough for in-flight requests to complete (default 300s is often too long; 30-60s is usually fine).
- **Enable HTTP/2** and connection idle timeout aligned with your backend.
- **Use WAF** with ALB for web application protection.

### 4. CloudFront — CDN and Edge Security

Use CloudFront for more than just static assets:

- **Static sites:** S3 origin with OAC (Origin Access Control)
- **APIs:** Custom origin pointing to ALB or API Gateway — reduces latency and adds DDoS protection
- **Full-site delivery:** Combine static and dynamic content with origin groups and cache behaviours

```yaml
CacheBehaviors:
  - PathPattern: /api/*
    CachePolicyId: !Ref NoCachePolicy       # Don't cache API responses
    OriginRequestPolicyId: !Ref AllViewerPolicy
    ViewerProtocolPolicy: https-only
  - PathPattern: /static/*
    CachePolicyId: !Ref CachingOptimized     # Cache aggressively
    ViewerProtocolPolicy: https-only
```

- **Use Origin Access Control (OAC)** — not legacy OAI — for S3 origins.
- **Enable CloudFront Functions or Lambda@Edge** for auth, redirects, or header manipulation at the edge.
- **Set appropriate TTLs.** Static assets: long TTL with versioned filenames. APIs: no cache or short TTL.

### 5. Route 53 — DNS

- **Use alias records** for AWS resources (ALB, CloudFront, S3 websites) — no charge for alias queries.
- **Health checks with failover routing** for active-passive multi-region setups.
- **Weighted routing** for gradual traffic shifting during deployments.
- **Private hosted zones** for internal service discovery within a VPC.

### 6. API Gateway

**Choose the right type:**

| Type | Use case | Cost model |
|------|----------|------------|
| **HTTP API** | Simple REST proxy, JWT auth, Lambda/HTTP backends | Per-request (cheaper) |
| **REST API** | Full API management (throttling, caching, request validation, API keys) | Per-request + cache |
| **WebSocket API** | Real-time bidirectional communication | Per-message + connection time |

- **Use HTTP API by default** unless you need REST API features (usage plans, request validation, caching).
- **Enable request validation** to reject malformed requests before they reach your Lambda.
- **Use stage variables** for environment-specific configuration.
- **Set throttling limits** to protect backend services.

## Best Practices

- **Use VPC endpoints** (gateway for S3/DynamoDB, interface for other services) to keep traffic off the public internet and reduce NAT Gateway costs.
- **Enable VPC Flow Logs** for security monitoring and troubleshooting.
- **Use AWS Network Firewall or WAF** for perimeter security — not just security groups.
- **Centralise egress** through a shared networking account for inspection and cost control.
- **Use Transit Gateway** for hub-and-spoke connectivity between multiple VPCs and accounts.

## Common Pitfalls

- **Default VPC in production.** The default VPC has public subnets with auto-assign public IPs. Always create a custom VPC.
- **Over-broad security groups.** `0.0.0.0/0` on port ranges like `0-65535` is a wide-open door.
- **NAT Gateway costs.** Each GB through a NAT Gateway costs $0.045. Use VPC endpoints for S3/DynamoDB traffic to reduce this.
- **Not using HTTPS everywhere.** TLS termination at the ALB is fine, but enforce HTTPS on the CloudFront → ALB connection too.
- **Insufficient IP space.** Running out of IPs in subnets because Fargate and Lambda consume ENIs aggressively. Plan for `/19` or larger subnets.
- **Single NAT Gateway.** A single NAT Gateway is a single point of failure. Use one per AZ for production.

## Reference

- [AWS VPC Documentation](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html)
- [AWS Networking Best Practices](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-best-practices.html)
- [CloudFront Developer Guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html)
- [API Gateway Developer Guide](https://docs.aws.amazon.com/apigateway/latest/developerguide/welcome.html)
- [AWS Security Group Best Practices](https://docs.aws.amazon.com/vpc/latest/userguide/security-group-rules.html)
