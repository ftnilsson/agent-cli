# Azure Infrastructure as Code Review

Review the following Bicep, ARM template, or Terraform code for quality, security, maintainability, and Azure best practices.

## Check For

### Structure & Organisation
1. **Module separation** — Are concerns separated into logical modules (networking, compute, data, monitoring)? No monolithic templates.
2. **Naming conventions** — Are resource names consistent and include environment/stage identifiers? Do they follow Azure naming conventions and length limits?
3. **Parameterisation** — Are environment-specific values parameterised (not hard-coded)? Are subscription IDs, tenant IDs, and resource IDs derived dynamically?
4. **Module reuse** — Are shared patterns extracted into Bicep modules or Terraform modules?

### Security
5. **Managed identities** — Are services configured with system-assigned or user-assigned managed identities instead of keys/connection strings?
6. **Secrets** — Are sensitive values referenced from Key Vault? Never in plaintext in templates or parameter files.
7. **Encryption** — Are storage resources (Storage Accounts, SQL, Cosmos DB, disks) encrypted by default?
8. **Network access** — Are PaaS services using Private Endpoints? Are NSGs configured correctly?

### Reliability
9. **Availability Zones** — Are stateful resources (SQL, Redis, VMs) deployed across Availability Zones?
10. **Auto-scaling** — Are compute resources configured with auto-scale rules?
11. **Delete locks** — Are resource locks applied to production databases and critical resources?
12. **Backup** — Are automated backups configured with appropriate retention?

### Maintainability
13. **DRY** — Are patterns reused with Bicep modules, Terraform modules, or linked templates?
14. **Tagging** — Are all resources tagged with standard cost-allocation and ownership tags?
15. **Outputs** — Are important values (endpoints, resource IDs, connection strings) exported as outputs?
16. **Documentation** — Are complex modules and non-obvious decisions documented with comments?

### Deployment
17. **State management** — Is Terraform state stored remotely (Azure Storage Account with state locking)? Are Bicep deployments using deployment stacks or standard resource group deployments?
18. **What-if / plan** — Is `az deployment what-if` or `terraform plan` run before every deployment?
19. **Rollback** — Can the deployment be rolled back safely? Are database migrations handled separately?

## Output Format

For each finding:

- **File/Resource**: The IaC file and logical resource name
- **Category**: Structure / Security / Reliability / Maintainability / Deployment
- **Severity**: 🔴 Critical / 🟡 Improvement / 🟢 Suggestion
- **Issue**: Description of the problem
- **Fix**: Recommended change with code snippet
