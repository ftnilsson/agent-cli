# Infrastructure as Code

## Description

Define, deploy, and manage Azure infrastructure using code — primarily Bicep, ARM templates, Terraform, and Pulumi. This skill covers writing maintainable IaC, structuring modules and deployments, managing state, handling environments, and establishing deployment pipelines for infrastructure changes.

## When To Use

- Setting up a new Azure project from scratch
- Migrating portal-created (click-ops) resources to code
- Structuring Bicep or Terraform projects for multi-environment deployments
- Reviewing IaC pull requests for quality, security, and best practices
- Troubleshooting deployment failures or drift
- Deciding between Bicep, ARM, Terraform, or Pulumi

## Prerequisites

- Familiarity with Azure services and their configuration options
- Understanding of programming or declarative configuration concepts
- Basic understanding of CI/CD pipelines and version control

## Instructions

### 1. Choose Your IaC Tool

| Tool | Language | State | Best for |
|------|----------|-------|----------|
| **Bicep** | Bicep DSL | Managed by Azure (deployments) | Azure-native teams, simpler syntax than ARM, first-party support |
| **ARM Templates** | JSON | Managed by Azure | Legacy/existing templates, generated from Bicep |
| **Terraform** | HCL | Self-managed (Azure Storage + lock) or Terraform Cloud | Multi-cloud, large existing Terraform codebases |
| **Pulumi** | TypeScript, Python, Go, C# | Self-managed or Pulumi Cloud | Teams wanting full programming languages |

**Recommendation: Use Bicep** for new Azure-only projects. It compiles to ARM templates, has first-party support, excellent tooling in VS Code, and a much cleaner syntax than raw ARM JSON.

### 2. Structure Your Bicep Project

```
infra/
├── main.bicep                    # Entry point — orchestrates modules
├── main.bicepparam               # Parameter file (or per environment)
├── parameters/
│   ├── dev.bicepparam
│   ├── staging.bicepparam
│   └── prod.bicepparam
├── modules/
│   ├── networking/
│   │   └── main.bicep            # VNet, subnets, NSGs, Private DNS
│   ├── compute/
│   │   └── main.bicep            # App Service, Container Apps, Functions
│   ├── data/
│   │   └── main.bicep            # SQL, Cosmos DB, Storage, Redis
│   ├── monitoring/
│   │   └── main.bicep            # Log Analytics, App Insights, alerts
│   └── shared/
│       ├── key-vault.bicep       # Reusable Key Vault module
│       └── private-endpoint.bicep # Reusable Private Endpoint module
└── scripts/
    └── deploy.sh                 # Deployment helper script
```

**Key principles:**

- **One concern per module.** Networking, data, compute, and monitoring are separate modules.
- **Reusable modules** for patterns you repeat (Private Endpoint, Key Vault, diagnostic settings).
- **Environment configuration** in parameter files — not hard-coded in modules.
- **Use `main.bicep`** as the orchestrator that wires modules together.

### 3. Bicep Patterns and Best Practices

**Module composition:**

```bicep
// main.bicep — orchestrator
targetScope = 'resourceGroup'

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Azure region')
param location string = resourceGroup().location

@description('Base name for resources')
param baseName string

// Networking
module networking 'modules/networking/main.bicep' = {
  name: 'networking-${environment}'
  params: {
    location: location
    baseName: baseName
    environment: environment
  }
}

// Data
module data 'modules/data/main.bicep' = {
  name: 'data-${environment}'
  params: {
    location: location
    baseName: baseName
    environment: environment
    subnetId: networking.outputs.dataSubnetId
    privateDnsZoneId: networking.outputs.sqlPrivateDnsZoneId
  }
}

// Compute
module compute 'modules/compute/main.bicep' = {
  name: 'compute-${environment}'
  params: {
    location: location
    baseName: baseName
    environment: environment
    appSubnetId: networking.outputs.appSubnetId
    sqlConnectionString: data.outputs.sqlConnectionString
    keyVaultName: data.outputs.keyVaultName
  }
}
```

**Reusable Private Endpoint module:**

```bicep
// modules/shared/private-endpoint.bicep
@description('Name of the private endpoint')
param name string
param location string = resourceGroup().location
param subnetId string
param privateLinkServiceId string
param groupIds array
param privateDnsZoneId string

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: name
  location: location
  properties: {
    subnet: { id: subnetId }
    privateLinkServiceConnections: [
      {
        name: '${name}-connection'
        properties: {
          privateLinkServiceId: privateLinkServiceId
          groupIds: groupIds
        }
      }
    ]
  }
}

resource dnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'config1'
        properties: { privateDnsZoneId: privateDnsZoneId }
      }
    ]
  }
}
```

### 4. Terraform Project Structure for Azure

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
│   │   ├── main.tf           # Calls modules with dev values
│   │   ├── backend.tf        # Azure Storage state backend
│   │   └── terraform.tfvars
│   ├── staging/
│   └── prod/
└── shared/
    └── state-backend/        # Bootstrap: Storage Account + container
```

**Terraform with Azure essentials:**

```hcl
# backend.tf — Azure Storage backend
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "stterraformstate"
    container_name       = "tfstate"
    key                  = "dev.terraform.tfstate"
  }
}

# Use AzureRM provider with OIDC auth (no secrets)
provider "azurerm" {
  features {}
  use_oidc = true
}
```

- **Remote state in Azure Storage** with blob lease locking. Never use local state for team projects.
- **Use OIDC authentication** for Terraform in CI/CD — no client secrets.
- **Pin provider versions** to avoid breaking changes.
- **Use `terraform plan` in CI** — review before every apply.

### 5. Testing IaC

**Bicep validation:**

```bash
# Validate syntax and types
az bicep build --file main.bicep

# Preview changes before deployment
az deployment group what-if \
  --resource-group rg-myapp-dev \
  --template-file main.bicep \
  --parameters parameters/dev.bicepparam
```

**Automated checks in CI:**

```yaml
# GitHub Actions — Bicep validation and what-if
- name: Bicep lint
  run: az bicep lint --file infra/main.bicep

- name: What-if (PR only)
  if: github.event_name == 'pull_request'
  run: |
    az deployment group what-if \
      --resource-group ${{ vars.RESOURCE_GROUP }} \
      --template-file infra/main.bicep \
      --parameters infra/parameters/${{ vars.ENVIRONMENT }}.bicepparam \
      --no-pretty-print
```

**Terraform validation:**

```bash
terraform validate          # Syntax and internal consistency
terraform plan              # Preview changes
tflint                      # Lint for Azure best practices
checkov --directory .        # Security scanning
```

### 6. Managing Secrets in IaC

- **Never commit secrets to IaC code.** No passwords, connection strings, or SAS tokens in templates.
- **Use Key Vault references** in Bicep:

```bicep
// Reference existing Key Vault secret
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
  scope: resourceGroup()
}

module appService 'modules/compute/main.bicep' = {
  params: {
    sqlPassword: keyVault.getSecret('sql-admin-password')
  }
}
```

- **Use managed identities** wherever possible to eliminate secrets entirely.
- **Use `.bicepparam` files** with Key Vault references for sensitive parameters.
- **Never store Terraform state containing secrets in public storage.** Use encryption and access policies.

## Best Practices

- **Everything in code.** If it's not in your IaC repo, it doesn't exist. No portal click-ops.
- **Small, focused modules.** Large monolithic templates are slow to deploy and risky to update.
- **Use `what-if` / `plan` before every deployment.** Review the changeset.
- **Tag everything.** Apply standard tags (Environment, Service, Team, CostCentre) to all resources.
- **Enable delete locks** on production databases, Key Vaults, and Storage Accounts.
- **Use Bicep linter and PSRule for Azure** to enforce best practices in CI.

## Common Pitfalls

- **Giant monolithic templates.** A single Bicep file with 200 resources is fragile, slow to deploy, and hard to review.
- **Hard-coded subscription IDs and resource IDs.** Use `subscription().subscriptionId`, `resourceGroup().id`, and module outputs.
- **No state locking (Terraform).** Concurrent `terraform apply` without blob lease locking will corrupt state.
- **Ignoring drift.** Resources changed in the portal will cause unexpected behaviour on next deploy. Use `what-if` to detect drift.
- **Not testing IaC.** Deployment failures in production are stressful and slow. Validate in a staging environment first.
- **Over-abstracting too early.** Don't build a "framework of frameworks." Write straightforward modules first, extract reusable patterns when they repeat.

## Reference

- [Bicep Documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/)
- [Bicep Best Practices](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/best-practices)
- [ARM Template Reference](https://learn.microsoft.com/en-us/azure/templates/)
- [Terraform AzureRM Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [PSRule for Azure](https://azure.github.io/PSRule.Rules.Azure/)
