# CI/CD & DevOps

## Description

Build and operate deployment pipelines for AWS workloads using AWS-native tools (CodePipeline, CodeBuild, CodeDeploy) and third-party tools (GitHub Actions). This skill covers pipeline design, deployment strategies, infrastructure deployment automation, and the DevOps practices that enable safe, fast, and frequent releases.

## When To Use

- Setting up a deployment pipeline for a new service
- Choosing between AWS CodePipeline, GitHub Actions, or other CI/CD tools
- Implementing blue/green, canary, or rolling deployment strategies
- Automating infrastructure deployments (CDK/Terraform in CI)
- Adding quality gates (tests, security scanning, approval steps) to pipelines
- Troubleshooting deployment failures and rollbacks

## Prerequisites

- Familiarity with Git workflows (branching, pull requests, merging)
- Understanding of AWS compute services (Lambda, ECS, EC2)
- Basic understanding of Docker and container registries (ECR)
- Familiarity with at least one IaC tool (CDK, CloudFormation, Terraform)

## Instructions

### 1. Choose Your CI/CD Tool

| Tool | Best for | Trade-offs |
|------|----------|------------|
| **GitHub Actions** | GitHub-hosted repos, flexible workflows, large marketplace | Running outside AWS (cross-account auth needed) |
| **CodePipeline + CodeBuild** | AWS-native, tight IAM integration, CodeDeploy for EC2/ECS | Less flexible, more verbose configuration |
| **GitLab CI** | GitLab-hosted repos, integrated DevSecOps | Similar to GitHub Actions trade-offs |

**Recommendation:** Use **GitHub Actions** for most projects. It's more flexible, has better developer experience, and integrates well with AWS via OIDC.

### 2. GitHub Actions with AWS

**OIDC authentication (no long-lived keys):**

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

permissions:
  id-token: write    # Required for OIDC
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsDeployRole
          aws-region: eu-west-1

      - name: Deploy CDK
        run: |
          npm ci
          npx cdk deploy --all --require-approval never
```

**Key practices:**

- **Use OIDC, not access keys.** Configure an IAM Identity Provider for GitHub and an IAM role with trust policy scoped to your repo/branch.
- **Use GitHub Environments** for deployment protection rules (required reviewers, wait timers, branch restrictions).
- **Cache dependencies** (`actions/cache`) to speed up builds.
- **Use reusable workflows** for shared pipeline logic across repos.

### 3. Pipeline Stages

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Source   │──▶│  Build   │──▶│  Test    │──▶│  Stage   │──▶│  Prod    │
│          │   │          │   │          │   │          │   │          │
│ Git push │   │ Compile  │   │ Unit     │   │ Deploy   │   │ Deploy   │
│ PR merge │   │ Docker   │   │ Integ    │   │ Smoke    │   │ Canary   │
│          │   │ CDK synth│   │ Security │   │ Approval │   │ Full     │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

**Each stage should:**

1. **Source** — Trigger on push to main (or PR merge). Include the full source + IaC.
2. **Build** — Compile code, build Docker images, run `cdk synth` / `terraform plan`.
3. **Test** — Unit tests, integration tests, security scanning (Snyk, Trivy, CDK Nag).
4. **Staging** — Deploy to staging, run smoke tests, hold for approval (if needed).
5. **Production** — Deploy with a safe strategy (canary, blue/green), monitor for errors, auto-rollback.

### 4. Deployment Strategies

| Strategy | Risk | Rollback speed | Complexity | Use case |
|----------|------|---------------|------------|----------|
| **All-at-once** | High | Redeploy | Low | Dev/test environments |
| **Rolling** | Medium | Redeploy | Medium | ECS services, EC2 fleets |
| **Blue/Green** | Low | Instant (switch target group) | Medium | ECS, EC2, Lambda aliases |
| **Canary** | Lowest | Instant (shift traffic back) | High | Production APIs, high-traffic services |

**ECS blue/green with CodeDeploy:**

```yaml
# CDK ECS service with blue/green deployment
const service = new ecs.FargateService(this, 'Service', {
  cluster,
  taskDefinition,
  deploymentController: {
    type: ecs.DeploymentControllerType.CODE_DEPLOY,
  },
});
```

**Lambda canary with aliases:**

```yaml
AutoPublishAlias: live
DeploymentPreference:
  Type: Canary10Percent5Minutes    # 10% traffic for 5 min, then 100%
  Alarms:
    - !Ref ErrorAlarm
    - !Ref LatencyAlarm
```

### 5. Infrastructure Deployment in CI

**CDK deployment pipeline:**

```yaml
- name: CDK Diff (PR only)
  if: github.event_name == 'pull_request'
  run: npx cdk diff 2>&1 | tee cdk-diff.txt

- name: Post diff as PR comment
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      const diff = require('fs').readFileSync('cdk-diff.txt', 'utf8');
      github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        body: `### CDK Diff\n\`\`\`\n${diff}\n\`\`\``
      });

- name: CDK Deploy (main only)
  if: github.ref == 'refs/heads/main'
  run: npx cdk deploy --all --require-approval never
```

**Terraform pipeline:**

```yaml
- name: Terraform Plan
  run: terraform plan -out=tfplan -no-color

- name: Terraform Apply (main only)
  if: github.ref == 'refs/heads/main'
  run: terraform apply -auto-approve tfplan
```

### 6. Quality Gates

Add these checks to every pipeline:

- [ ] **Unit tests** — `npm test`, `pytest`, `dotnet test`
- [ ] **Linting** — `eslint`, `ruff`, `prettier`
- [ ] **Security scanning** — `npm audit`, `trivy image`, `checkov`, `cdk-nag`
- [ ] **IaC validation** — `cdk diff`, `terraform plan`, `cfn-lint`
- [ ] **Integration tests** — Run against staging environment
- [ ] **Smoke tests** — Hit critical endpoints after deployment
- [ ] **Auto-rollback** — On alarm breach, roll back automatically

## Best Practices

- **Deploy frequently.** Small, frequent deployments are safer than large, infrequent ones.
- **Use OIDC for CI/CD auth.** No long-lived AWS access keys in GitHub secrets.
- **Always `plan`/`diff` before `apply`/`deploy`.** Review infrastructure changes before they happen.
- **Separate application and infrastructure deployments** when they have different lifecycles.
- **Use feature flags** to decouple deployment from release. Deploy code to production with the feature disabled, then enable it gradually.
- **Monitor deployments.** Watch error rates and latency during and after every deployment. Auto-rollback on SLO breach.

## Common Pitfalls

- **No staging environment.** Deploying directly to production without testing in a staging environment is gambling.
- **Long-lived feature branches.** Branches that live for weeks diverge from main and create painful merges. Use trunk-based development.
- **Manual deployment steps.** "SSH into the server and run the script" is not CI/CD. Automate everything.
- **No rollback plan.** Every deployment should have a tested rollback path. Blue/green and canary provide instant rollback.
- **Over-complex pipelines.** A pipeline with 30 stages and 20-minute builds discourages frequent deployment. Keep it fast (<10 minutes for most projects).
- **Ignoring pipeline security.** CI/CD pipelines have broad AWS access. Protect them like production infrastructure — branch protection, required reviews, audit logs.

## Reference

- [AWS CodePipeline User Guide](https://docs.aws.amazon.com/codepipeline/latest/userguide/welcome.html)
- [GitHub Actions with AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS CodeDeploy — ECS Blue/Green](https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-groups-create-blue-green-ecs.html)
- [SAM Canary Deployments](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/automating-updates-to-serverless-apps.html)
- [Deployment Strategies on AWS](https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/deployment-methods.html)
