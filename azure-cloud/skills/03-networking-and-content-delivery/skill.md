# Networking & Content Delivery

## Description

Design and configure Azure networking infrastructure — VNets, subnets, NSGs, load balancers, CDN, DNS, and API Management. This skill covers building secure, performant, and cost-efficient network architectures that underpin every Azure workload.

## When To Use

- Designing a VNet layout for a new project
- Configuring NSGs and Private Endpoints for defence in depth
- Setting up Azure Front Door or Application Gateway for traffic distribution
- Configuring Azure CDN or Front Door for static assets and acceleration
- Managing DNS with Azure DNS (public and private zones)
- Designing API Management configurations for API gateway patterns

## Prerequisites

- Understanding of IP addressing, CIDR notation, and subnetting
- Familiarity with TCP/UDP, HTTP/HTTPS, and TLS
- Basic understanding of DNS, load balancing, and firewall concepts

## Instructions

### 1. Design Your VNet

A well-designed VNet is the foundation of secure Azure networking:

```
VNet: 10.0.0.0/16 (65,536 IPs)
│
├── Gateway Subnet (required for VPN/ExpressRoute)
│   └── 10.0.0.0/27
│
├── Azure Firewall Subnet
│   └── 10.0.1.0/26
│
├── App Subnets (delegated — App Service, Container Apps, Functions)
│   ├── 10.0.10.0/24 — App Service VNet integration
│   ├── 10.0.11.0/24 — Container Apps environment
│   └── 10.0.12.0/23 — AKS node pool
│
├── Private Endpoint Subnets
│   └── 10.0.20.0/24 — Private Endpoints for PaaS services
│
├── Data Subnets
│   └── 10.0.30.0/24 — SQL Managed Instance, self-hosted DBs
│
└── Bastion Subnet
    └── AzureBastionSubnet 10.0.255.0/26
```

**Key rules:**

- **Always use at least 2 Availability Zones** (3 for production) for high availability.
- **Size subnets generously.** AKS, Container Apps, and delegated subnets consume IPs aggressively. Use `/23` or `/22` for AKS.
- **Use Private Endpoints** for all PaaS services in production (SQL, Storage, Key Vault, Cosmos DB).
- **Hub-spoke topology** for multi-workload environments with centralised firewall and connectivity.

### 2. Network Security Groups (NSGs) — Your Primary Firewall

NSGs are stateful packet filters attached to subnets or NICs:

```
# Web tier NSG
AppGW-NSG:
  Inbound:  443/tcp from Internet    (HTTPS from clients)
  Inbound:  65200-65535 from GatewayManager (required for App Gateway)
  Outbound: All traffic

# Application tier NSG
App-NSG:
  Inbound:  8080/tcp from AppGW-Subnet  (only from App Gateway)
  Inbound:  Deny all other
  Outbound: 443/tcp to AzureCloud        (Azure services)
  Outbound: 1433/tcp to Data-Subnet      (SQL)

# Data tier NSG
Data-NSG:
  Inbound:  1433/tcp from App-Subnet     (SQL from app tier only)
  Inbound:  Deny all other
  Outbound: Deny all (stateful return traffic is allowed)
```

**Rules:**

- **Apply NSGs at the subnet level** for consistent enforcement. Use NIC-level NSGs only for additional per-resource restrictions.
- **Never open RDP (3389) or SSH (22) to `*`.** Use Azure Bastion for secure management access.
- **Use Application Security Groups (ASGs)** to group VMs/NICs logically and reference them in NSG rules.
- **Enable NSG Flow Logs** for security monitoring and troubleshooting.
- **Use Service Tags** (`AzureCloud`, `Storage`, `Sql`, `AzureKeyVault`) instead of hard-coding Azure IP ranges.

### 3. Load Balancing

| Service | Layer | Scope | Use case |
|---------|-------|-------|----------|
| **Azure Front Door** | Layer 7 | Global | Global load balancing, WAF, CDN, SSL offload |
| **Application Gateway** | Layer 7 | Regional | Regional HTTP(S) LB, WAF v2, path-based routing |
| **Azure Load Balancer** | Layer 4 | Regional | TCP/UDP, high performance, internal or public |
| **Traffic Manager** | DNS | Global | DNS-based routing, multi-region failover |

**Decision flow:**

```
Is the workload global (multi-region)?
  ├── Yes → Azure Front Door (L7) or Traffic Manager (DNS)
  └── No → Is it HTTP/HTTPS?
        ├── Yes → Application Gateway (with WAF v2)
        └── No → Azure Load Balancer (Standard SKU)
```

**Application Gateway best practices:**

- **Always use WAF v2 SKU** for production — includes WAF, auto-scaling, and zone redundancy.
- **Configure health probes** with a dedicated `/health` endpoint that checks downstream dependencies.
- **Use Private Link** for internal-only Application Gateways.
- **Enable diagnostic logging** to Log Analytics for troubleshooting.

### 4. Azure Front Door — Global Load Balancing & CDN

Use Front Door for global traffic distribution, SSL offload, and edge security:

```bicep
resource frontDoor 'Microsoft.Cdn/profiles@2024-02-01' = {
  name: 'fd-myapp'
  location: 'global'
  sku: { name: 'Premium_AzureFrontDoor' }   // Standard for CDN, Premium for WAF + Private Link
}

resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2024-02-01' = {
  parent: frontDoor
  name: 'myapp'
  location: 'global'
  properties: { enabledState: 'Enabled' }
}
```

- **Use Premium SKU** for WAF integration and Private Link origins.
- **Cache static content aggressively** with rules engine overrides for `/api/*` (no cache).
- **Enable WAF with managed rule sets** (OWASP, Bot protection).
- **Use Rules Engine** for redirects, header manipulation, and URL rewrites at the edge.

### 5. Azure DNS

- **Use Azure DNS** for public zones and **Private DNS Zones** for internal resolution.
- **Private DNS Zones are required for Private Endpoints** — link them to your VNets for automatic DNS resolution.
- **Use alias record sets** for Azure resources (Traffic Manager, Front Door, Public IPs) — they track resource lifecycle.
- **Automate DNS records** in IaC — no manual portal DNS changes.

Common Private DNS Zones for Private Endpoints:

| Service | Private DNS Zone |
|---------|-----------------|
| Blob Storage | `privatelink.blob.core.windows.net` |
| Azure SQL | `privatelink.database.windows.net` |
| Key Vault | `privatelink.vaultcore.azure.net` |
| Cosmos DB | `privatelink.documents.azure.com` |
| Azure Cache for Redis | `privatelink.redis.cache.windows.net` |

### 6. API Management (APIM)

Azure API Management is the enterprise API gateway:

| Tier | Best for | VNet support | Cost |
|------|----------|-------------|------|
| **Consumption** | Serverless, low-traffic APIs | No | Per-call |
| **Developer** | Dev/test, exploration | External/Internal | Low |
| **Standard v2** | Production APIs, moderate traffic | VNet integration | Medium |
| **Premium** | Enterprise, multi-region, full VNet isolation | Full (injection) | High |

- **Use Standard v2** for most production workloads — it offers VNet integration without the cost of Premium.
- **Use policies** for authentication, rate limiting, caching, transformation, and validation.
- **Use named values** with Key Vault references for secrets in policies.
- **Use Products and Subscriptions** for API access control and usage tracking.
- **Enable Application Insights integration** for API analytics and diagnostics.

## Best Practices

- **Use Private Endpoints for all PaaS services.** Public endpoints on SQL, Storage, and Key Vault are the #1 networking security gap.
- **Enable NSG Flow Logs** and **Network Watcher** for security and troubleshooting.
- **Centralise egress with Azure Firewall** in a hub VNet for inspection, logging, and policy enforcement.
- **Use Service Endpoints as a stepping stone** to Private Endpoints if budget is constrained — they restrict PaaS access to your VNet but don't provide private IPs.
- **Use Azure Bastion** for management access — never expose RDP/SSH to the internet.

## Common Pitfalls

- **No Private Endpoints in production.** Default PaaS services (SQL, Storage, Key Vault) have public endpoints. Always use Private Endpoints.
- **Over-broad NSG rules.** `*` source on inbound rules is a wide-open door. Be specific about allowed sources.
- **Insufficient IP space for AKS.** AKS with Azure CNI consumes one IP per pod. Plan for `/22` or larger subnets.
- **Not using Azure Bastion.** Opening NSG rules for RDP/SSH is a security risk. Bastion provides secure management access without public IPs.
- **Missing Private DNS Zones.** Private Endpoints without linked Private DNS Zones won't resolve correctly from your VNets.
- **Single Application Gateway.** Not configuring zone redundancy for production Application Gateways creates a single point of failure.

## Reference

- [Azure Networking Documentation](https://learn.microsoft.com/en-us/azure/networking/)
- [Hub-Spoke Network Topology](https://learn.microsoft.com/en-us/azure/architecture/networking/architecture/hub-spoke)
- [Azure Front Door Documentation](https://learn.microsoft.com/en-us/azure/frontdoor/)
- [API Management Documentation](https://learn.microsoft.com/en-us/azure/api-management/)
- [Private Endpoint Documentation](https://learn.microsoft.com/en-us/azure/private-link/private-endpoint-overview)
