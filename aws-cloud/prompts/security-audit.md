# AWS Security Audit

Audit the following AWS infrastructure and application code for security vulnerabilities, misconfigurations, and compliance gaps.

## Check For

### IAM & Access Control
1. **Least privilege** — Are IAM policies scoped to specific resources and actions? No `*:*` policies.
2. **Role-based access** — Are services using IAM roles (not access keys)? Are cross-account roles properly constrained?
3. **MFA** — Is MFA enforced for console access and sensitive operations?
4. **Unused credentials** — Are there stale IAM users, unused access keys, or over-permissioned roles?

### Data Protection
5. **Encryption at rest** — Are S3 buckets, EBS volumes, RDS instances, and DynamoDB tables encrypted?
6. **Encryption in transit** — Is TLS enforced everywhere? Are S3 bucket policies blocking HTTP?
7. **Secrets management** — Are credentials stored in Secrets Manager or SSM Parameter Store? Not in environment variables, code, or config files.
8. **S3 bucket policies** — Are buckets private by default? Is public access blocked at the account level?

### Network Security
9. **Security groups** — Are inbound rules restrictive? No SSH/RDP open to `0.0.0.0/0`. No overly broad port ranges.
10. **VPC design** — Are databases and internal services in private subnets? Is VPC Flow Logs enabled?
11. **WAF & Shield** — Is AWS WAF protecting public-facing endpoints? Are rate-limiting rules in place?

### Logging & Detection
12. **CloudTrail** — Is CloudTrail enabled in all regions with log file validation?
13. **GuardDuty** — Is GuardDuty enabled for threat detection?
14. **Config rules** — Are AWS Config rules in place for compliance monitoring?

### Application Security
15. **Input validation** — Are Lambda functions and API Gateway endpoints validating input?
16. **Dependency scanning** — Are dependencies scanned for known vulnerabilities?
17. **CORS** — Are API Gateway CORS settings restrictive (not `*`)?

## Output Format

For each finding:

- **Category**: IAM / Data / Network / Logging / Application
- **Severity**: 🔴 Critical / 🟡 Warning / 🟢 Informational
- **Resource**: Specific AWS resource or code location
- **Issue**: Description of the vulnerability or misconfiguration
- **Risk**: What could go wrong if not addressed
- **Remediation**: Step-by-step fix with AWS CLI commands or IaC snippets where applicable
