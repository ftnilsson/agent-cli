# Azure Security Audit

Audit the following Azure infrastructure and application code for security vulnerabilities, misconfigurations, and compliance gaps.

## Check For

### Identity & Access Control
1. **Managed identities** — Are services using managed identities instead of connection strings, keys, or service principals with secrets?
2. **RBAC** — Are Azure role assignments scoped to the narrowest scope (resource > resource group > subscription)? No Owner or Contributor at subscription level without justification.
3. **Conditional Access** — Are Conditional Access policies enforcing MFA, compliant devices, and location-based restrictions for Entra ID users?
4. **Unused credentials** — Are there stale app registrations, expired secrets, or over-permissioned service principals?

### Data Protection
5. **Encryption at rest** — Are Storage Accounts, SQL Databases, Cosmos DB, and disks encrypted? Are customer-managed keys (CMK) used where required?
6. **Encryption in transit** — Is TLS enforced everywhere? Are Storage Account connections requiring HTTPS? Minimum TLS 1.2?
7. **Key Vault** — Are secrets, certificates, and keys stored in Key Vault? Are access policies or RBAC configured correctly? Is soft delete and purge protection enabled?
8. **Storage security** — Are Storage Accounts blocking public blob access? Are SAS tokens scoped and time-limited?

### Network Security
9. **NSGs** — Are inbound rules restrictive? No SSH/RDP open to `*`. No overly broad port ranges.
10. **Private Endpoints** — Are PaaS services (SQL, Storage, Key Vault, Cosmos DB) accessed via Private Endpoints instead of public endpoints?
11. **WAF** — Is Azure WAF (with Application Gateway or Front Door) protecting public-facing endpoints?
12. **DDoS Protection** — Is Azure DDoS Protection Standard enabled for production VNets?

### Logging & Detection
13. **Diagnostic settings** — Are diagnostic logs enabled on all critical resources and sent to Log Analytics?
14. **Defender for Cloud** — Is Microsoft Defender for Cloud enabled with appropriate plans (Servers, Storage, SQL, Key Vault, App Service)?
15. **Activity Log** — Is the Activity Log forwarded to Log Analytics for audit and alerting?
16. **Sentinel** — Is Microsoft Sentinel deployed for SIEM/SOAR capabilities?

### Application Security
17. **Input validation** — Are Azure Functions and API Management endpoints validating input?
18. **CORS** — Are CORS settings in App Service and API Management restrictive (not `*`)?
19. **Dependency scanning** — Are container images scanned by Defender for Containers?

## Output Format

For each finding:

- **Category**: Identity / Data / Network / Logging / Application
- **Severity**: 🔴 Critical / 🟡 Warning / 🟢 Informational
- **Resource**: Specific Azure resource or code location
- **Issue**: Description of the vulnerability or misconfiguration
- **Risk**: What could go wrong if not addressed
- **Remediation**: Step-by-step fix with Azure CLI commands or IaC snippets where applicable
