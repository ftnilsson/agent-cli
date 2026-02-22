# AWS Architecture Review

Review the following AWS architecture for design quality, resilience, security, cost-effectiveness, and alignment with the AWS Well-Architected Framework.

## Check For

1. **Operational Excellence** — Is infrastructure defined as code? Are there runbooks for failure scenarios? Is there a deployment pipeline with rollback capability?
2. **Security** — Are IAM roles following least privilege? Are secrets in Secrets Manager or Parameter Store (not environment variables)? Is encryption at rest and in transit enabled? Are security groups and NACLs scoped tightly?
3. **Reliability** — Is the workload deployed across multiple AZs? Are there health checks, auto-scaling, and circuit breakers? Is there a disaster recovery strategy (backup, cross-region replication)?
4. **Performance Efficiency** — Is the right compute model chosen (Lambda vs Fargate vs EC2)? Are caching layers in place (ElastiCache, CloudFront, DAX)? Are database read replicas used where appropriate?
5. **Cost Optimisation** — Are resources right-sized? Are there Reserved Instances, Savings Plans, or Spot usage where appropriate? Are idle/unused resources tagged and alerting in place? Is there lifecycle management for S3 and logs?
6. **Sustainability** — Are resources provisioned only when needed? Is serverless or managed services preferred over self-managed infrastructure?

## Check Infrastructure as Code

- **Is all infrastructure defined in CDK, CloudFormation, or Terraform?** No click-ops.
- **Are stacks logically separated?** (networking, compute, data, monitoring)
- **Are cross-stack references clean?** No hard-coded ARNs or account IDs.
- **Are parameters and secrets externalised?** Not committed to source control.

## Check Networking

- **VPC design** — Are public and private subnets properly separated? Are NAT Gateways in place for private subnet egress?
- **Security groups** — Are ingress rules restricted to specific ports and source CIDRs? No `0.0.0.0/0` on anything other than public load balancers.
- **DNS and routing** — Is Route 53 managing DNS? Are alias records used for AWS resources?

## Output Format

For each finding:

- **Component**: The AWS service or architectural element
- **Pillar**: Which Well-Architected pillar it relates to
- **Severity**: 🔴 Critical / 🟡 Improvement / 🟢 Suggestion
- **Issue**: Description of the concern
- **Recommendation**: Specific fix with AWS service/configuration details
