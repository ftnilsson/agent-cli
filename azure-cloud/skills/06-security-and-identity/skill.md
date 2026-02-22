# Security & Identity

## Description

Secure Azure workloads using Microsoft Entra ID (Azure AD), managed identities, RBAC, Key Vault, Defender for Cloud, and network security. This skill covers identity-first security, least-privilege access, encryption, secrets management, threat detection, and the security practices that every Azure workload must implement.

## When To Use

- Designing identity and access control for services, users, or cross-subscription access
- Reviewing RBAC role assignments for over-permissioning
- Configuring encryption at rest and in transit
- Setting up secrets and certificate management with Key Vault
- Enabling security monitoring (Defender for Cloud, Sentinel)
- Preparing for compliance audits (SOC 2, ISO 27001, HIPAA)

## Prerequisites

- Understanding of Entra ID concepts (tenants, app registrations, service principals, managed identities)
- Familiarity with encryption concepts
- Basic understanding of Azure networking (VNets, NSGs, Private Endpoints)

## Instructions

### 1. Identity-First Security — Managed Identities

Azure's identity model is built on Entra ID. Use managed identities to eliminate secrets:

```
┌─────────────────────┐
│ App Service /       │
│ Container App /     │       Entra ID Token
│ Azure Function      │──────────────────────▶ Azure SQL
│                     │       (no password)    Cosmos DB
│ System-assigned     │                        Key Vault
│ managed identity    │                        Storage
└─────────────────────┘                        Service Bus
```

**Managed identity rules:**

- **Use managed identities for EVERY Azure-to-Azure connection.** No connection strings with passwords, no storage account keys, no SAS tokens.
- **System-assigned** — tied to a single resource lifecycle. Use when the identity should be deleted with the resource.
- **User-assigned** — shared across resources. Use when multiple resources need the same permissions or when identity must persist across resource recreation.

```bicep
// Bicep — App Service with managed identity accessing SQL and Storage
resource appService 'Microsoft.Web/sites@2023-12-01' = {
  name: 'app-myapi-prod'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    siteConfig: {
      connectionStrings: [
        {
          name: 'SqlConnection'
          // No password! Uses managed identity
          connectionString: 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName};Database=mydb;Authentication=Active Directory Managed Identity;'
          type: 'SQLAzure'
        }
      ]
    }
  }
}

// Grant SQL access
resource sqlRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: sqlDatabase
  name: guid(sqlDatabase.id, appService.id, 'sql-contributor')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c')
    principalId: appService.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

### 2. RBAC — Role-Based Access Control

Azure RBAC controls who can do what on which resources:

| Scope level | Example | Use when |
|------------|---------|----------|
| **Resource** | Single SQL Database | Service-specific access (most restrictive — preferred) |
| **Resource Group** | All resources in rg-myapp-prod | Team owns all resources in the group |
| **Subscription** | Entire subscription | Platform/infra teams, CI/CD pipelines |
| **Management Group** | Multiple subscriptions | Organisation-wide policies |

**RBAC best practices:**

- **Assign at the narrowest scope.** Resource > Resource Group > Subscription.
- **Use built-in roles** before creating custom roles. Common roles:
  - `Reader` — view only
  - `Contributor` — full access except RBAC/Policy
  - `Key Vault Secrets User` — read secrets
  - `Storage Blob Data Contributor` — read/write blobs
  - `Azure Service Bus Data Receiver` — receive messages
- **Use Entra ID groups** for role assignments, not individual users.
- **Use Privileged Identity Management (PIM)** for just-in-time, time-limited elevated access.
- **Never assign Owner or Contributor at subscription level** without documented justification.

### 3. Key Vault — Secrets, Keys, and Certificates

```bicep
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-myapp-prod'
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true       // Use RBAC, not access policies
    enableSoftDelete: true              // Required — 90-day recovery
    enablePurgeProtection: true         // Prevent permanent deletion
    networkAcls: {
      defaultAction: 'Deny'            // Private Endpoint only
      bypass: 'AzureServices'
    }
  }
}
```

**Key Vault rules:**

- **Use RBAC authorization** (not access policies) — it's more granular and consistent with the rest of Azure.
- **Enable soft delete and purge protection** — prevents accidental or malicious permanent deletion.
- **Use Private Endpoints** — Key Vault should never be accessed over the public internet in production.
- **Reference secrets from IaC** — never copy secret values into app config or environment variables.
- **Use separate Key Vaults per environment** — dev secrets should never be in the production vault.
- **Enable diagnostic logging** to detect unusual access patterns.

### 4. Encryption

**At rest:**

| Service | Default encryption | Recommendation |
|---------|-------------------|----------------|
| Storage Accounts | Microsoft-managed keys | Use customer-managed keys (CMK) for compliance |
| Azure SQL | TDE (always on) | Enabled by default, CMK for compliance |
| Cosmos DB | Encrypted at rest | CMK for compliance |
| Managed Disks | SSE with platform keys | CMK for compliance |
| Key Vault | HSM-protected | Always encrypted |

**In transit:**

- **Enforce TLS 1.2 minimum** on all services (Storage Accounts, App Service, SQL).
- **Use Azure Front Door or Application Gateway** for TLS termination with managed certificates.
- **Disable HTTP** on Storage Accounts (`supportsHttpsTrafficOnly: true`).
- **Use App Service managed certificates** or Key Vault certificates — free and auto-renewing.

### 5. Security Monitoring

**Enable these in every subscription:**

| Service | Purpose | Enable? |
|---------|---------|---------|
| **Defender for Cloud** | Security posture, vulnerability assessment, compliance | Yes — enable relevant plans |
| **Defender for Servers** | VM vulnerability scanning, endpoint protection | Yes — for IaaS workloads |
| **Defender for Containers** | Container image scanning, runtime protection | Yes — for AKS/ACA |
| **Defender for Key Vault** | Anomalous Key Vault access detection | Yes |
| **Defender for Storage** | Malware scanning, anomalous access | Yes |
| **Microsoft Sentinel** | SIEM/SOAR, threat detection, incident response | Yes — for enterprise |
| **Activity Log** | Control plane audit trail | Forward to Log Analytics |
| **Diagnostic Settings** | Resource-level logging | Enable on all critical resources |

### 6. Subscription-Level Security Baseline

Apply these to every Azure subscription:

- [ ] Enable Defender for Cloud with appropriate plans
- [ ] Forward Activity Log to Log Analytics
- [ ] Enforce Azure Policy for required tags, allowed regions, denied resource types
- [ ] Block public access on Storage Accounts at the subscription level
- [ ] Require Private Endpoints for PaaS services (via Azure Policy)
- [ ] Enable Entra ID Conditional Access policies (MFA, compliant devices)
- [ ] Use PIM for privileged role assignments
- [ ] Enable diagnostic settings on all critical resources
- [ ] Configure delete locks on production databases and Key Vaults

## Best Practices

- **Identity over secrets.** Use managed identities for everything. If you must use a secret, put it in Key Vault with automatic rotation.
- **Assume breach.** Design with the assumption that credentials will be compromised. Limit blast radius with scoped RBAC and subscription isolation.
- **Use Conditional Access.** Enforce MFA, block legacy authentication, require compliant devices for privileged access.
- **Automate security checks in CI/CD.** Use PSRule for Azure, Checkov, or Defender for DevOps to catch security issues before deployment.
- **Centralise security monitoring.** Aggregate Defender for Cloud and Sentinel to a dedicated security subscription.

## Common Pitfalls

- **Connection strings with passwords in app config.** Use managed identities and Key Vault references instead.
- **Storage account keys in code.** Disable shared key access entirely (`allowSharedKeyAccess: false`) and use Entra ID RBAC.
- **Contributor at subscription level for CI/CD.** Scope CI/CD service principal permissions to specific resource groups and actions.
- **No MFA for admin accounts.** Enforce MFA for all users via Conditional Access, especially privileged roles.
- **Key Vault without purge protection.** A deleted Key Vault with purge protection disabled can be permanently lost, including all secrets and certificates.
- **Public endpoints on PaaS services.** Default Azure SQL, Storage, Cosmos DB, and Key Vault have public endpoints. Use Private Endpoints for production.

## Reference

- [Microsoft Entra ID Documentation](https://learn.microsoft.com/en-us/entra/identity/)
- [Azure RBAC Documentation](https://learn.microsoft.com/en-us/azure/role-based-access-control/)
- [Key Vault Best Practices](https://learn.microsoft.com/en-us/azure/key-vault/general/best-practices)
- [Defender for Cloud Documentation](https://learn.microsoft.com/en-us/azure/defender-for-cloud/)
- [Azure Security Benchmark](https://learn.microsoft.com/en-us/security/benchmark/azure/)
