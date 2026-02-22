# AWS Infrastructure as Code Review

Review the following CDK, CloudFormation, or Terraform code for quality, security, maintainability, and AWS best practices.

## Check For

### Structure & Organisation
1. **Stack separation** — Are concerns separated into logical stacks (networking, compute, data, monitoring)? No monolithic stacks.
2. **Naming conventions** — Are resource names consistent and include environment/stage identifiers?
3. **Parameterisation** — Are environment-specific values parameterised (not hard-coded)? Are account IDs, region, and ARNs derived dynamically?
4. **Cross-stack references** — Are exports and imports used cleanly? No circular dependencies.

### Security
5. **IAM policies** — Are policies scoped to specific resources and actions? No inline `*:*` policies.
6. **Secrets** — Are sensitive values referenced from Secrets Manager or SSM Parameter Store? Never in plaintext in templates.
7. **Encryption** — Are storage resources (S3, EBS, RDS, DynamoDB) encrypted by default?
8. **Network access** — Are security group ingress rules restrictive? Are databases in private subnets?

### Reliability
9. **Multi-AZ** — Are stateful resources (RDS, ElastiCache) configured for Multi-AZ?
10. **Auto-scaling** — Are compute resources configured with auto-scaling policies?
11. **Deletion protection** — Is deletion protection enabled on databases and critical resources?
12. **Backup** — Are automated backups configured with appropriate retention?

### Maintainability
13. **DRY** — Are patterns reused with constructs (CDK), modules (Terraform), or nested stacks (CloudFormation)?
14. **Tagging** — Are all resources tagged with standard cost-allocation and ownership tags?
15. **Outputs** — Are important values (endpoints, ARNs, URLs) exported as stack outputs?
16. **Documentation** — Are complex constructs and non-obvious decisions documented with comments?

### Deployment
17. **State management** — Is Terraform state stored remotely with locking (S3 + DynamoDB)? Are CDK assets in a dedicated bucket?
18. **Drift detection** — Is there a plan for detecting and reconciling drift?
19. **Rollback** — Can the deployment be rolled back safely? Are database migrations handled separately?

## Output Format

For each finding:

- **File/Resource**: The IaC file and logical resource name
- **Category**: Structure / Security / Reliability / Maintainability / Deployment
- **Severity**: 🔴 Critical / 🟡 Improvement / 🟢 Suggestion
- **Issue**: Description of the problem
- **Fix**: Recommended change with code snippet
