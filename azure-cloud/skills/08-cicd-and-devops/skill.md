# CI/CD & DevOps

## Description

Build and operate deployment pipelines for Azure workloads using Azure DevOps, GitHub Actions, and Azure-native deployment services. This skill covers pipeline design, deployment strategies, infrastructure deployment automation, and the DevOps practices that enable safe, fast, and frequent releases.

## When To Use

- Setting up a deployment pipeline for a new service
- Choosing between Azure DevOps Pipelines or GitHub Actions
- Implementing blue/green, canary, or rolling deployment strategies
- Automating infrastructure deployments (Bicep/Terraform in CI)
- Adding quality gates (tests, security scanning, approval steps) to pipelines
- Troubleshooting deployment failures and rollbacks

## Prerequisites

- Familiarity with Git workflows (branching, pull requests, merging)
- Understanding of Azure compute services (Functions, App Service, Container Apps, AKS)
- Basic understanding of Docker and container registries (ACR)
- Familiarity with at least one IaC tool (Bicep, ARM, Terraform)

## Instructions

### 1. Choose Your CI/CD Tool

| Tool | Best for | Trade-offs |
|------|----------|------------|
| **GitHub Actions** | GitHub-hosted repos, flexible workflows, large marketplace | Needs OIDC config for Azure auth |
| **Azure DevOps Pipelines** | Enterprise, Azure-native, service connections, boards integration | More complex YAML, tighter Azure coupling |
| **Azure Deployment Environments** | Standardised dev/test environments, self-service provisioning | Infrastructure provisioning only |

**Recommendation:** Use **GitHub Actions** for most projects. It's more flexible, has better developer experience, and integrates well with Azure via OIDC (workload identity federation).

### 2. GitHub Actions with Azure (OIDC — No Secrets)

**Set up workload identity federation:**

```bash
# Create app registration and federated credential
az ad app create --display-name "github-deploy-prod"
az ad sp create --id <app-id>
az ad app federated-credential create --id <app-id> --parameters '{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:myorg/myrepo:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'
# Assign Contributor role on target resource group
az role assignment create --assignee <sp-id> \
  --role Contributor \
  --scope /subscriptions/<sub-id>/resourceGroups/rg-myapp-prod
```

**GitHub Actions workflow:**

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

      - name: Azure Login (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Deploy Bicep
        uses: azure/arm-deploy@v2
        with:
          resourceGroupName: rg-myapp-prod
          template: infra/main.bicep
          parameters: infra/parameters/prod.bicepparam
```

**Key practices:**

- **Use OIDC (workload identity federation), not client secrets.** No long-lived credentials to rotate.
- **Use GitHub Environments** for deployment protection rules (required reviewers, wait timers, branch restrictions).
- **Use reusable workflows** for shared pipeline logic across repos.
- **Cache dependencies** to speed up builds.

### 3. Azure DevOps Pipelines

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include: [main]

pool:
  vmImage: 'ubuntu-latest'

stages:
  - stage: Build
    jobs:
      - job: BuildAndTest
        steps:
          - task: NodeTool@0
            inputs: { versionSpec: '20.x' }
          - script: npm ci && npm test
          - task: Docker@2
            inputs:
              containerRegistry: 'acr-connection'
              repository: 'myapp'
              command: 'buildAndPush'
              Dockerfile: 'Dockerfile'
              tags: '$(Build.BuildId)'

  - stage: DeployStaging
    dependsOn: Build
    jobs:
      - deployment: Deploy
        environment: staging
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureCLI@2
                  inputs:
                    azureSubscription: 'azure-staging-connection'
                    scriptType: 'bash'
                    scriptLocation: 'inlineScript'
                    inlineScript: |
                      az containerapp update \
                        --name myapp \
                        --resource-group rg-myapp-staging \
                        --image myacr.azurecr.io/myapp:$(Build.BuildId)

  - stage: DeployProd
    dependsOn: DeployStaging
    condition: succeeded()
    jobs:
      - deployment: Deploy
        environment: production    # Requires approval
        strategy:
          runOnce:
            deploy:
              steps:
                - task: AzureCLI@2
                  inputs:
                    azureSubscription: 'azure-prod-connection'
                    scriptType: 'bash'
                    scriptLocation: 'inlineScript'
                    inlineScript: |
                      az containerapp update \
                        --name myapp \
                        --resource-group rg-myapp-prod \
                        --image myacr.azurecr.io/myapp:$(Build.BuildId)
```

### 4. Pipeline Stages

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Source   │──▶│  Build   │──▶│  Test    │──▶│  Stage   │──▶│  Prod    │
│          │   │          │   │          │   │          │   │          │
│ Git push │   │ Compile  │   │ Unit     │   │ Deploy   │   │ Deploy   │
│ PR merge │   │ Docker   │   │ Integ    │   │ Smoke    │   │ Canary   │
│          │   │ Bicep    │   │ Security │   │ Approval │   │ Full     │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

### 5. Deployment Strategies

| Strategy | Risk | Rollback speed | Complexity | Azure support |
|----------|------|---------------|------------|---------------|
| **All-at-once** | High | Redeploy | Low | All services |
| **Deployment slots (swap)** | Low | Instant (swap back) | Low | App Service, Functions |
| **Revisions (traffic split)** | Low | Instant (shift traffic) | Medium | Container Apps |
| **Blue/Green** | Low | Instant (swap) | Medium | App Service, AKS |
| **Canary** | Lowest | Instant (shift back) | High | Container Apps, AKS, Front Door |

**App Service — Deployment slots (recommended):**

```yaml
# Deploy to staging slot, then swap
- task: AzureWebApp@1
  inputs:
    azureSubscription: 'azure-prod'
    appType: 'webApp'
    appName: 'app-myapi-prod'
    deployToSlotOrASE: true
    slotName: 'staging'
    package: '$(Pipeline.Workspace)/drop/*.zip'

# Run smoke tests against staging slot
- script: curl -f https://app-myapi-prod-staging.azurewebsites.net/health

# Swap staging → production
- task: AzureAppServiceManage@0
  inputs:
    azureSubscription: 'azure-prod'
    action: 'Swap Slots'
    webAppName: 'app-myapi-prod'
    sourceSlot: 'staging'
    targetSlot: 'production'
```

**Container Apps — Revision traffic splitting:**

```bash
# Deploy new revision
az containerapp update --name myapp --resource-group rg-prod \
  --image myacr.azurecr.io/myapp:v2

# Split traffic: 90% old, 10% new (canary)
az containerapp ingress traffic set --name myapp --resource-group rg-prod \
  --revision-weight myapp--v1=90 myapp--v2=10

# After validation, shift 100% to new
az containerapp ingress traffic set --name myapp --resource-group rg-prod \
  --revision-weight myapp--v2=100
```

### 6. Infrastructure Deployment in CI

**Bicep deployment pipeline:**

```yaml
- name: Bicep What-If (PR only)
  if: github.event_name == 'pull_request'
  run: |
    az deployment group what-if \
      --resource-group ${{ vars.RESOURCE_GROUP }} \
      --template-file infra/main.bicep \
      --parameters infra/parameters/${{ vars.ENVIRONMENT }}.bicepparam

- name: Bicep Deploy (main only)
  if: github.ref == 'refs/heads/main'
  run: |
    az deployment group create \
      --resource-group ${{ vars.RESOURCE_GROUP }} \
      --template-file infra/main.bicep \
      --parameters infra/parameters/${{ vars.ENVIRONMENT }}.bicepparam
```

### 7. Quality Gates

Add these checks to every pipeline:

- [ ] **Unit tests** — `dotnet test`, `npm test`, `pytest`
- [ ] **Linting** — `eslint`, `ruff`, `dotnet format`
- [ ] **Security scanning** — `trivy image`, `checkov`, `PSRule for Azure`, `Defender for DevOps`
- [ ] **IaC validation** — `az bicep build`, `what-if`, `terraform plan`
- [ ] **Integration tests** — Run against staging environment
- [ ] **Smoke tests** — Hit critical endpoints after deployment
- [ ] **Auto-rollback** — On alert breach, swap back/shift traffic

## Best Practices

- **Deploy frequently.** Small, frequent deployments are safer than large, infrequent ones.
- **Use OIDC for CI/CD auth.** No long-lived client secrets in GitHub/Azure DevOps.
- **Always `what-if`/`plan` before `deploy`/`apply`.** Review infrastructure changes before they happen.
- **Use deployment slots** for App Service and Functions — they provide instant rollback.
- **Use feature flags** to decouple deployment from release. Deploy code with the feature disabled, then enable gradually.
- **Monitor deployments.** Watch error rates and latency during and after every deployment. Auto-rollback on SLO breach.

## Common Pitfalls

- **No staging environment.** Deploying directly to production without testing is gambling.
- **Long-lived feature branches.** Branches that live for weeks diverge from main and create painful merges. Use trunk-based development.
- **Client secrets for CI/CD.** Client secrets expire and need rotation. Use OIDC (workload identity federation) instead.
- **No rollback plan.** Every deployment should have a tested rollback path. Deployment slots and revision traffic splitting provide instant rollback.
- **Over-complex pipelines.** A pipeline with 30 stages and 20-minute builds discourages frequent deployment. Keep it fast (<10 minutes).
- **Ignoring pipeline security.** CI/CD pipelines have broad Azure access. Protect them with branch protection, required reviews, and scoped service principals.

## Reference

- [GitHub Actions for Azure](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure)
- [Azure DevOps Pipelines](https://learn.microsoft.com/en-us/azure/devops/pipelines/)
- [App Service Deployment Slots](https://learn.microsoft.com/en-us/azure/app-service/deploy-staging-slots)
- [Container Apps Revisions](https://learn.microsoft.com/en-us/azure/container-apps/revisions)
- [Workload Identity Federation](https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation)
