# Deployment & Versioning

## Description

Deploy serverless applications safely using infrastructure as code, deployment strategies, function versioning, aliases, stages, and rollback mechanisms. This skill covers how to package, deploy, version, and operate serverless functions in a way that supports safe, frequent releases across multiple environments — independent of any specific cloud provider or IaC tool.

## When To Use

- Setting up a deployment pipeline for a serverless application
- Choosing a deployment strategy (all-at-once, canary, linear)
- Implementing environment promotion (dev → staging → production)
- Managing function versions, aliases, and traffic shifting
- Rolling back a failed deployment quickly

## Prerequisites

- Understanding of serverless architecture (skill 01) and function design (skill 02)
- Familiarity with at least one IaC tool (Bicep, Terraform, CloudFormation, SAM, CDK, Pulumi)
- Basic understanding of CI/CD pipeline concepts

## Instructions

### 1. Serverless IaC Landscape

| Tool | Cloud | Language | Serverless focus |
|------|-------|----------|-----------------|
| **SAM (Serverless Application Model)** | AWS | YAML + CloudFormation | ✅ Purpose-built for Lambda |
| **CDK** | AWS | TypeScript, Python, C#, Go | General AWS IaC with serverless constructs |
| **CloudFormation** | AWS | YAML / JSON | General AWS IaC |
| **Terraform** | Multi-cloud | HCL | General IaC, good serverless modules |
| **Bicep** | Azure | Bicep | General Azure IaC, Functions support |
| **Pulumi** | Multi-cloud | TypeScript, Python, C#, Go | General IaC with real programming languages |
| **SST** | AWS (primary) | TypeScript | Developer-focused serverless framework |

**SAM example (AWS Lambda):**

```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Runtime: nodejs20.x
    MemorySize: 512
    Timeout: 30
    Tracing: Active
    Environment:
      Variables:
        TABLE_NAME: !Ref OrdersTable

Resources:
  CreateOrderFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: dist/handlers/create-order.handler
      Events:
        PostOrder:
          Type: Api
          Properties:
            Path: /orders
            Method: post
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref OrdersTable

  GetOrderFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: dist/handlers/get-order.handler
      Events:
        GetOrder:
          Type: Api
          Properties:
            Path: /orders/{id}
            Method: get
      Policies:
        - DynamoDBReadPolicy:
            TableName: !Ref OrdersTable

  OrdersTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub '${AWS::StackName}-orders'
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - { AttributeName: PK, AttributeType: S }
        - { AttributeName: SK, AttributeType: S }
      KeySchema:
        - { AttributeName: PK, KeyType: HASH }
        - { AttributeName: SK, KeyType: RANGE }
```

**Bicep example (Azure Functions):**

```bicep
resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: 'func-orders-prod'
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'Node|20'
      appSettings: [
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'AzureWebJobsStorage', value: storageConnection }
        { name: 'COSMOS_CONNECTION', value: '@Microsoft.KeyVault(SecretUri=${cosmosSecret.properties.secretUri})' }
      ]
    }
  }
}
```

### 2. Project Structure for Deployment

```
project/
├── src/
│   ├── handlers/              # One file per function trigger
│   │   ├── create-order.ts
│   │   ├── get-order.ts
│   │   ├── process-payment.ts
│   │   └── send-notification.ts
│   ├── services/              # Business logic (shared)
│   ├── validators/            # Input validation
│   └── repositories/          # Data access
├── infra/                     # Infrastructure as Code
│   ├── template.yaml          # SAM / CloudFormation
│   ├── main.bicep             # Bicep (Azure)
│   └── parameters/
│       ├── dev.json
│       ├── staging.json
│       └── prod.json
├── scripts/                   # Build, deploy, test scripts
│   ├── build.sh
│   └── deploy.sh
├── __tests__/
│   ├── unit/
│   └── integration/
├── package.json
├── tsconfig.json
└── esbuild.config.ts          # Bundler configuration
```

### 3. Deployment Strategies

| Strategy | Risk | Rollback | Complexity | How it works |
|----------|------|----------|------------|-------------|
| **All-at-once** | High | Redeploy previous | Low | Replace all instances immediately |
| **Canary** | Low | Shift traffic back | Medium | 10% → monitor → 100% |
| **Linear** | Low | Shift traffic back | Medium | 10% every N minutes |
| **Blue/Green** | Low | Swap back | Medium | Deploy new version alongside old, swap |

**Canary deployment flow:**

```
Version 1 (live) ──────────────── 100% traffic
                                       │
Deploy Version 2                       │
                                       ▼
Version 1 ──────────────────────── 90% traffic
Version 2 (canary) ────────────── 10% traffic
                                       │
Monitor errors, latency (5 min)        │
                                       │
  ┌─── Errors? ─── Yes ──▶ Rollback: 100% → Version 1
  │
  └─── No errors ──▶ Shift: 100% → Version 2
```

**SAM canary deployment:**

```yaml
CreateOrderFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: dist/handlers/create-order.handler
    AutoPublishAlias: live           # Creates alias "live" pointing to latest version
    DeploymentPreference:
      Type: Canary10Percent5Minutes  # 10% for 5 min, then 100%
      Alarms:
        - !Ref CreateOrderErrorAlarm
      Hooks:
        PreTraffic: !Ref PreTrafficTestFunction    # Run smoke tests before traffic
        PostTraffic: !Ref PostTrafficTestFunction   # Validate after full rollout
```

### 4. Environment Management

```
Source Code ──▶ Build ──▶ Package (artifact)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
           Dev              Staging        Production
           │                │               │
           ├── dev.json     ├── staging.json├── prod.json     (parameters)
           ├── dev account  ├── staging acct├── prod account  (isolation)
           └── auto-deploy  └── auto-deploy └── manual approve
```

**Rules:**

- **Same artifact, different config.** Build once, deploy to all environments with environment-specific parameters.
- **Use separate accounts/subscriptions per environment.** At minimum, isolate production.
- **No hardcoded environment values.** Use environment variables, parameter files, or a configuration service.
- **Production requires approval.** Manual or automated validation gate before production deployment.

### 5. Versioning & Aliases

**Function versions** are immutable snapshots of your function code and configuration. **Aliases** are named pointers to versions:

```
                    CreateOrderFunction
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
          Version 1  Version 2  Version 3
              │          │          │
              │     Alias: staging──┘
              │
         Alias: live ──▶ Version 2 (90%)
                     ──▶ Version 3 (10%)   ← Canary
```

**Alias traffic shifting:**

```bash
# Shift 10% traffic to new version (canary)
aws lambda update-alias \
  --function-name CreateOrder \
  --name live \
  --routing-config '{"AdditionalVersionWeights":{"3":0.1}}'

# After validation, shift 100% to new version
aws lambda update-alias \
  --function-name CreateOrder \
  --name live \
  --function-version 3 \
  --routing-config '{}'
```

### 6. Rollback

**Instant rollback options:**

| Platform | Rollback mechanism | Speed |
|----------|-------------------|-------|
| AWS Lambda | Shift alias back to previous version | Instant |
| Azure Functions | Deployment slot swap back | Instant |
| Container-based (Container Apps, ECS) | Shift traffic to previous revision | Instant |
| CloudFormation/Bicep | Stack rollback | Minutes |

**Automated rollback on alarm:**

```yaml
# SAM — auto-rollback if alarm fires during deployment
DeploymentPreference:
  Type: Canary10Percent5Minutes
  Alarms:
    - !Ref ErrorRateAlarm     # Rollback if error rate exceeds threshold
    - !Ref LatencyAlarm       # Rollback if P99 latency exceeds threshold
```

**Always test rollback before you need it:**

1. Deploy a known-good version.
2. Deploy a version with a deliberate error.
3. Verify the alarm fires and rollback occurs automatically.
4. Verify the system returns to the previous good version.

### 7. Build & Package

Optimise the build process for small, fast-deploying packages:

```bash
#!/bin/bash
# scripts/build.sh

set -euo pipefail

# Clean previous build
rm -rf dist/

# Bundle each handler separately (tree-shaking)
for handler in src/handlers/*.ts; do
  name=$(basename "$handler" .ts)
  npx esbuild "$handler" \
    --bundle \
    --platform=node \
    --target=node20 \
    --outfile="dist/handlers/${name}.js" \
    --minify \
    --sourcemap \
    --external:@aws-sdk/*    # Available in Lambda runtime
done

echo "Build complete. Package sizes:"
du -sh dist/handlers/*.js
```

**Per-function packaging** — each function gets its own deployment package containing only its code and dependencies. This minimises cold starts and allows independent deployment.

## Best Practices

- **Build once, deploy to all environments.** The artifact is identical; only configuration changes per environment.
- **Use canary deployments for production.** Deploy to 10% traffic, monitor, then shift to 100%. Auto-rollback on alarm.
- **Automate rollback.** Don't rely on humans to notice and react. Use alarms + automatic rollback.
- **Bundle per-function.** Each function should have its own minimal package. Don't deploy a monolithic package with all functions.
- **Keep infrastructure and code deployments separate** when possible. Infra changes (new tables, queues) are higher risk than code changes (new handler logic).
- **Test in staging with production-like load.** A function that works in staging with 10 req/min may throttle in production at 10,000 req/min.

## Common Pitfalls

- **No deployment strategy.** "All-at-once to production" means a bad deploy affects 100% of users instantly. Use canary or linear.
- **No rollback plan.** Every deployment should have a tested, instant rollback path.
- **Environment-specific code.** `if (process.env.ENV === 'prod')` in application code creates untestable branches. Use configuration, not conditionals.
- **Monolithic packages.** Deploying all 20 functions in a single 100 MB package means every cold start downloads code for functions that won't run.
- **Skipping staging.** Deploying directly from local dev to production. Always deploy through a staging environment first.
- **Manual deployments.** Any deployment that requires manual steps will eventually fail. Automate everything in CI/CD.

## Reference

- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [AWS CDK](https://docs.aws.amazon.com/cdk/)
- [Azure Functions Deployment](https://learn.microsoft.com/en-us/azure/azure-functions/functions-deployment-technologies)
- [Terraform AWS Lambda Module](https://registry.terraform.io/modules/terraform-aws-modules/lambda/aws/latest)
- [SST](https://sst.dev/)
- [Lambda Deployment Preferences](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/automating-updates-to-serverless-apps.html)
