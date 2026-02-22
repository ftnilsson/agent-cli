# Security & IAM

## Description

Secure AWS workloads using identity and access management (IAM), encryption, secrets management, network security, and threat detection. This skill covers the principle of least privilege, IAM policy design, KMS encryption, Secrets Manager, GuardDuty, Security Hub, and the security practices that every AWS workload must implement.

## When To Use

- Designing IAM roles and policies for services, users, or cross-account access
- Reviewing IAM policies for over-permissioning
- Configuring encryption at rest and in transit
- Setting up secrets management for database credentials, API keys, and tokens
- Enabling security monitoring (GuardDuty, CloudTrail, Security Hub)
- Preparing for compliance audits (SOC 2, HIPAA, PCI DSS)

## Prerequisites

- Understanding of AWS IAM concepts (users, roles, policies, groups)
- Familiarity with encryption concepts (symmetric, asymmetric, envelope encryption)
- Basic understanding of AWS networking (VPC, security groups)

## Instructions

### 1. IAM — Least Privilege

Every IAM policy should answer: **Who** can do **what** on **which resources** under **what conditions**?

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowReadFromSpecificBucket",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-app-data-prod",
        "arn:aws:s3:::my-app-data-prod/*"
      ],
      "Condition": {
        "StringEquals": {
          "aws:PrincipalTag/Environment": "prod"
        }
      }
    }
  ]
}
```

**IAM rules:**

- **Never use `*` for actions or resources** unless there's a documented, reviewed justification.
- **Use IAM roles, not access keys** for services. EC2, Lambda, ECS, and CodeBuild should all assume roles.
- **Scope policies to specific resource ARNs** — not `arn:aws:s3:::*`.
- **Use conditions** (source IP, MFA, tags, VPC endpoint) to further restrict access.
- **Use permission boundaries** to cap the maximum permissions a role can have.
- **Audit with IAM Access Analyzer** — it finds unused permissions and external access.

### 2. Service Roles

Every AWS service should have its own IAM role with minimal permissions:

```typescript
// CDK — Lambda function with scoped role
const orderProcessor = new lambda.Function(this, 'OrderProcessor', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/order-processor'),
});

// Grant only what's needed
ordersTable.grantReadWriteData(orderProcessor);
ordersBucket.grantRead(orderProcessor);
notificationTopic.grantPublish(orderProcessor);
// Don't do: orderProcessor.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
```

- **Use CDK's `grant*` methods** — they generate correctly scoped policies automatically.
- **One role per function/service.** No shared "lambda-role" used by 20 functions.
- **Review generated policies** with `cdk synth` to ensure they're not overly broad.

### 3. Encryption

**At rest:**

| Service | Default encryption | Recommendation |
|---------|-------------------|----------------|
| S3 | SSE-S3 (AES-256) | Use SSE-KMS for sensitive data (audit trail via CloudTrail) |
| EBS | Optional | Enable by default at account level |
| RDS/Aurora | Optional | Enable with KMS key |
| DynamoDB | AWS-owned key | Use customer-managed KMS key for compliance |
| SQS/SNS | Optional | Enable SSE with KMS |

**In transit:**

- **Enforce TLS everywhere.** S3 bucket policies should deny HTTP. ALB listeners should redirect 80→443.
- **Use ACM (Certificate Manager)** for free, auto-renewing TLS certificates on ALB, CloudFront, and API Gateway.
- **Enforce minimum TLS 1.2** on all endpoints.

### 4. Secrets Management

```
┌─────────────────────┐
│ Application Code    │
│                     │
│ // ❌ Never do this│
│ DB_PASS = "p@ssw0rd"│
│                     │
│ // ✅ Do this      │
│ const secret =      │
│   getSecret(        │
│    'prod/db/pass')  │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────┐
│ Secrets Manager      │
│ - Automatic rotation │
│ - Audit via CloudTrail│
│ - Cross-account access│
│ - Versioned secrets  │
└──────────────────────┘
```

- **Use Secrets Manager** for credentials that need rotation (database passwords, API keys).
- **Use SSM Parameter Store (SecureString)** for configuration values that change infrequently.
- **Enable automatic rotation** for RDS credentials with Secrets Manager.
- **Never store secrets in environment variables, code, or config files.**
- **Reference secrets at runtime** — don't bake them into container images or Lambda deployment packages.

### 5. Security Monitoring

**Enable these in every account:**

| Service | Purpose | Enable? |
|---------|---------|---------|
| **CloudTrail** | API call logging | Yes — all regions, with log file validation |
| **GuardDuty** | Threat detection (anomalous API calls, crypto mining, compromised credentials) | Yes — all regions |
| **Security Hub** | Centralised security findings, compliance checks | Yes — aggregate to security account |
| **Config** | Resource compliance monitoring, drift detection | Yes — with conformance packs |
| **IAM Access Analyzer** | Detect external access and unused permissions | Yes |
| **VPC Flow Logs** | Network traffic logging | Yes — at least for production VPCs |

### 6. Account-Level Security Baseline

Apply these to every AWS account:

- [ ] Block S3 public access at account level
- [ ] Enable EBS encryption by default
- [ ] Enable CloudTrail in all regions
- [ ] Enable GuardDuty in all regions
- [ ] Enable IAM Access Analyzer
- [ ] Require MFA for IAM users
- [ ] Use SCPs to prevent disabling security services
- [ ] Set password policy (minimum length, complexity, rotation)
- [ ] Remove unused IAM users and access keys

## Best Practices

- **Assume breach.** Design with the assumption that credentials will be compromised. Limit blast radius with scoped policies and account isolation.
- **Use temporary credentials.** IAM roles with STS provide temporary, auto-rotated credentials. Avoid long-lived access keys.
- **Automate security checks in CI/CD.** Use CDK Nag, Checkov, or cfn-guard to catch security issues before deployment.
- **Centralise security monitoring.** Aggregate GuardDuty, Security Hub, and CloudTrail to a dedicated security account.
- **Tag sensitive resources** so you can enforce policies (e.g., "only encrypted resources can have this tag").

## Common Pitfalls

- **`AdministratorAccess` on Lambda roles.** This is the most common IAM mistake. Use the minimum permissions needed.
- **Wildcard resource ARNs.** `"Resource": "*"` means the role can access every resource of that type in the account. Scope it.
- **Secrets in environment variables.** Environment variables are visible in the Lambda console and ECS task definitions. Use Secrets Manager.
- **No MFA on root account.** The root account can bypass all SCPs and IAM policies. Enable MFA and lock it away.
- **Disabled CloudTrail.** Without CloudTrail, you have no audit trail. It should be an SCP-enforced non-negotiable.
- **Security group rules as the only security layer.** Defence in depth: use WAF, NACLs, VPC endpoints, and IAM policies alongside security groups.

## Reference

- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [AWS Security Best Practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/welcome.html)
- [AWS KMS Developer Guide](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html)
- [AWS Secrets Manager User Guide](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html)
- [AWS GuardDuty User Guide](https://docs.aws.amazon.com/guardduty/latest/ug/what-is-guardduty.html)
