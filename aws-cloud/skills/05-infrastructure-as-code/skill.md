# Infrastructure as Code

## Description

Define, deploy, and manage AWS infrastructure using code — primarily AWS CDK, CloudFormation, and Terraform. This skill covers writing maintainable IaC, structuring stacks and modules, managing state, handling environments, and establishing deployment pipelines for infrastructure changes.

## When To Use

- Setting up a new AWS project from scratch
- Migrating manually-created (click-ops) resources to code
- Structuring CDK apps or Terraform projects for multi-environment deployments
- Reviewing IaC pull requests for quality, security, and best practices
- Troubleshooting CloudFormation stack failures or drift
- Deciding between CDK, CloudFormation, Terraform, or Pulumi

## Prerequisites

- Familiarity with AWS services and their configuration options
- Understanding of programming concepts (for CDK) or declarative configuration (for CloudFormation/Terraform)
- Basic understanding of CI/CD pipelines and version control

## Instructions

### 1. Choose Your IaC Tool

| Tool | Language | State | Best for |
|------|----------|-------|----------|
| **AWS CDK** | TypeScript, Python, Java, C#, Go | CloudFormation (managed) | AWS-native teams, complex logic, reusable constructs |
| **CloudFormation** | YAML/JSON | Managed by AWS | Simple stacks, when CDK is overkill, SOC2/compliance scenarios |
| **Terraform** | HCL | Self-managed (S3 + DynamoDB) or Terraform Cloud | Multi-cloud, large existing Terraform codebases |
| **Pulumi** | TypeScript, Python, Go, C# | Self-managed or Pulumi Cloud | Teams wanting full programming languages without CDK lock-in |

**Recommendation: Use CDK** for new AWS-only projects. It provides the best balance of productivity, type safety, and AWS integration.

### 2. Structure Your CDK App

```
infra/
├── bin/
│   └── app.ts                    # Entry point — instantiates stacks
├── lib/
│   ├── stacks/
│   │   ├── networking-stack.ts   # VPC, subnets, security groups
│   │   ├── data-stack.ts         # DynamoDB, RDS, S3
│   │   ├── compute-stack.ts      # Lambda, ECS, API Gateway
│   │   └── monitoring-stack.ts   # CloudWatch, alarms, dashboards
│   ├── constructs/
│   │   ├── secure-bucket.ts      # Reusable L3 construct
│   │   └── api-lambda.ts         # Lambda + API GW pattern
│   └── config/
│       ├── dev.ts
│       ├── staging.ts
│       └── prod.ts
├── test/
│   ├── networking-stack.test.ts
│   └── data-stack.test.ts
├── cdk.json
└── tsconfig.json
```

**Key principles:**

- **One concern per stack.** Networking, data, compute, and monitoring are separate stacks.
- **Reusable constructs** for patterns you repeat (secure S3 bucket, Lambda + API GW, ECS service).
- **Environment configuration** externalised into config files — not hard-coded in stacks.
- **Test your infrastructure.** CDK supports snapshot testing and fine-grained assertions.

### 3. CDK Patterns and Best Practices

**Define environment-specific config:**

```typescript
// lib/config/environments.ts
export interface EnvironmentConfig {
  account: string;
  region: string;
  stage: 'dev' | 'staging' | 'prod';
  domainName: string;
  natGateways: number;
  dbInstanceClass: string;
  minCapacity: number;
  maxCapacity: number;
}

export const environments: Record<string, EnvironmentConfig> = {
  dev: {
    account: '111111111111',
    region: 'eu-west-1',
    stage: 'dev',
    domainName: 'dev.example.com',
    natGateways: 1,
    dbInstanceClass: 'db.t4g.micro',
    minCapacity: 1,
    maxCapacity: 2,
  },
  prod: {
    account: '222222222222',
    region: 'eu-west-1',
    stage: 'prod',
    domainName: 'example.com',
    natGateways: 3,
    dbInstanceClass: 'db.r6g.large',
    minCapacity: 2,
    maxCapacity: 20,
  },
};
```

**Create reusable L3 constructs:**

```typescript
// lib/constructs/secure-bucket.ts
export class SecureBucket extends Construct {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: SecureBucketProps) {
    super(scope, id);

    this.bucket = new s3.Bucket(this, 'Bucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      removalPolicy: props?.retain
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY,
      autoDeleteObjects: !props?.retain,
      lifecycleRules: [
        {
          transitions: [
            { storageClass: s3.StorageClass.INFREQUENT_ACCESS, transitionAfter: Duration.days(30) },
          ],
        },
      ],
    });
  }
}
```

### 4. Terraform Project Structure

```
terraform/
├── modules/
│   ├── networking/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── compute/
│   └── data/
├── environments/
│   ├── dev/
│   │   ├── main.tf        # Calls modules with dev values
│   │   ├── backend.tf     # S3 state backend config
│   │   └── terraform.tfvars
│   ├── staging/
│   └── prod/
└── shared/
    └── state-backend/     # Bootstrap: S3 bucket + DynamoDB lock table
```

**Terraform essentials:**

- **Remote state in S3 with DynamoDB locking.** Never use local state for team projects.
- **Use modules** for reusable infrastructure patterns.
- **Use `terraform plan` in CI** — review before every apply.
- **Pin provider versions** to avoid breaking changes.
- **Use `terraform fmt` and `tflint`** in pre-commit hooks.

### 5. Testing IaC

**CDK assertions (recommended):**

```typescript
import { Template } from 'aws-cdk-lib/assertions';

test('creates encrypted S3 bucket', () => {
  const app = new cdk.App();
  const stack = new DataStack(app, 'TestStack', { stage: 'test' });
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::S3::Bucket', {
    BucketEncryption: {
      ServerSideEncryptionConfiguration: [
        { ServerSideEncryptionByDefault: { SSEAlgorithm: 'aws:kms' } }
      ],
    },
  });
});
```

**Terraform validation:**

```bash
terraform validate          # Syntax and internal consistency
terraform plan              # Preview changes
tflint                      # Lint for best practices
checkov --directory .        # Security scanning
```

### 6. Managing Secrets in IaC

- **Never commit secrets to IaC code.** No API keys, passwords, or tokens in templates.
- **Use SSM Parameter Store** for configuration values and **Secrets Manager** for credentials.
- **Reference secrets dynamically:**

```typescript
// CDK — reference existing secret
const dbSecret = secretsmanager.Secret.fromSecretNameV2(this, 'DBSecret', 'prod/db/password');

// Pass to ECS container
container.addSecret('DB_PASSWORD', ecs.Secret.fromSecretsManager(dbSecret));
```

## Best Practices

- **Everything in code.** If it's not in your IaC repo, it doesn't exist. No click-ops.
- **Small, focused stacks.** Large monolithic stacks are slow to deploy and risky to update.
- **Use `cdk diff` / `terraform plan` before every deployment.** Review the changeset.
- **Tag everything.** Apply standard tags (Environment, Service, Team, CostCentre) to all resources.
- **Enable termination/deletion protection** on production databases, S3 buckets, and stateful resources.
- **Use CDK Nag or Checkov** to enforce security best practices in CI.

## Common Pitfalls

- **Giant monolithic stacks.** A single stack with 200 resources is fragile, slow to deploy, and hard to review.
- **Hard-coded account IDs and ARNs.** Use `Aws.ACCOUNT_ID`, `Aws.REGION` (CDK) or data sources (Terraform).
- **No state locking (Terraform).** Concurrent `terraform apply` without DynamoDB locking will corrupt state.
- **Ignoring drift.** Resources changed manually in the console will cause unexpected behaviour on next deploy. Detect and reconcile drift regularly.
- **Not testing IaC.** CloudFormation rollbacks on production are stressful and slow. Test with assertions and in a staging account first.
- **Over-abstracting too early.** Don't build a "framework of frameworks." Write straightforward stacks first, extract constructs/modules when a pattern repeats.

## Reference

- [AWS CDK Developer Guide](https://docs.aws.amazon.com/cdk/v2/guide/home.html)
- [AWS CDK Best Practices](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html)
- [CloudFormation User Guide](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html)
- [Terraform AWS Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [CDK Nag — Security Rules](https://github.com/cdklabs/cdk-nag)
