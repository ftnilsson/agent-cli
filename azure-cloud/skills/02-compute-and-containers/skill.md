# Compute & Containers

## Description

Choose, configure, and operate the right compute model for your workload on Azure. This skill covers the spectrum from fully serverless (Azure Functions) to managed containers (Azure Container Apps, AKS) to managed PaaS (App Service) to traditional VMs, including when to use each, how to configure them for production, and how to migrate between them.

## When To Use

- Choosing between Azure Functions, App Service, Container Apps, AKS, or VMs for a new workload
- Configuring Azure Functions for production (plan type, bindings, concurrency)
- Setting up Azure Container Apps with scaling rules and Dapr integration
- Designing AKS clusters with appropriate node pools and networking
- Optimising compute costs (Spot, Reserved, right-sizing)
- Managing auto-scaling policies for variable workloads

## Prerequisites

- Basic understanding of containers and Docker
- Familiarity with Azure networking (VNets, subnets, NSGs)
- Understanding of managed identities and RBAC

## Instructions

### 1. Choose the Right Compute Model

| Model | Best for | Cold start | Ops overhead | Cost model |
|-------|---------|------------|--------------|------------|
| **Azure Functions (Consumption)** | Event-driven, short tasks (<10 min), variable traffic | 1–10s | Minimal | Per-execution |
| **Azure Functions (Flex Consumption)** | Functions with faster cold starts, VNet, larger instances | <1s (pre-provisioned) | Minimal | Per-execution + baseline |
| **App Service** | Web apps/APIs, predictable workloads, WebSocket, SSE | None (always on) | Low | Per-plan (fixed) |
| **Azure Container Apps (ACA)** | Containerised microservices, scale-to-zero, Dapr, event-driven | Seconds | Low | Per vCPU/memory/second |
| **AKS** | Kubernetes-native teams, full control, multi-cloud portability | None (warm) | High | VM node pricing |
| **VMs** | Full OS control, specialised hardware, legacy apps | None (warm) | Highest | VM pricing |

**Decision flow:**

```
Is the workload event-driven and short-lived (<10 min)?
  ├── Yes → Azure Functions
  └── No → Does the team need/want Kubernetes?
        ├── Yes → AKS (with managed node pools)
        └── No → Is it a containerised workload needing scale-to-zero?
              ├── Yes → Azure Container Apps
              └── No → Is it a web app/API?
                    ├── Yes → App Service
                    └── No → VMs
```

### 2. Azure Functions — Serverless Compute

**Hosting plan comparison:**

| Plan | Scale | Timeout | VNet | Idle cost |
|------|-------|---------|------|-----------|
| **Consumption** | 0 → 200 instances | 10 min | Limited | None |
| **Flex Consumption** | 0 → 1000 instances | 10 min | Full | Minimal |
| **Premium (EP)** | 1 → 100 instances | 30 min | Full | Always-warm baseline |
| **Dedicated (ASP)** | Manual/Auto-scale | Unlimited | Full | App Service plan |

**Configuration best practices:**

```json
// host.json — production configuration
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "maxTelemetryItemsPerSecond": 20
      }
    },
    "logLevel": {
      "default": "Information",
      "Host.Results": "Error",
      "Function": "Information"
    }
  },
  "extensions": {
    "serviceBus": {
      "maxConcurrentCalls": 16,
      "autoCompleteMessages": false
    }
  },
  "functionTimeout": "00:05:00"
}
```

**Key Azure Functions rules:**

- **Choose the right plan.** Consumption for sporadic workloads. Flex Consumption for production with VNet needs. Premium for always-warm, latency-sensitive functions.
- **Minimise cold starts.** Keep deployment packages small, use Flex Consumption with pre-provisioned instances, or Premium plan.
- **Use bindings.** Input/output bindings for Blob Storage, Cosmos DB, Service Bus, and Queue Storage reduce boilerplate.
- **Store state externally.** Functions are stateless. Use Cosmos DB, Table Storage, or Redis for state. Use Durable Functions for stateful workflows.
- **Set realistic timeouts.** Don't use the maximum timeout for functions that should complete in seconds.

### 3. Azure Container Apps (ACA) — Managed Containers

ACA is the sweet spot between serverless and Kubernetes — managed containers with scale-to-zero, Dapr, and KEDA-based scaling.

```bicep
// Bicep — Container App with scaling rules
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'order-api'
  location: location
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'http'
      }
      secrets: [
        { name: 'db-connection', keyVaultUrl: keyVaultSecretUri, identity: managedIdentityId }
      ]
    }
    template: {
      containers: [
        {
          name: 'order-api'
          image: '${acrName}.azurecr.io/order-api:${imageTag}'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/health', port: 8080 }
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: { path: '/ready', port: 8080 }
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 10
        rules: [
          {
            name: 'http-scaling'
            http: { metadata: { concurrentRequests: '50' } }
          }
        ]
      }
    }
  }
}
```

**ACA best practices:**

- **Use scale-to-zero** for non-production and off-hours workloads to eliminate idle cost.
- **Use KEDA scalers** for event-driven scaling (Service Bus queue length, Event Hub lag, custom metrics).
- **Enable Dapr** for service-to-service invocation, state management, and pub/sub if using microservices.
- **Use revisions** for traffic splitting and blue/green deployments.
- **Configure probes** — liveness for restart on deadlock, readiness for traffic routing.

### 4. App Service — Managed Web Platform

**Production configuration checklist:**

- [ ] Use **Premium v3** (P1v3+) for production — better performance and VNet integration
- [ ] Enable **Always On** to prevent cold starts
- [ ] Configure **auto-scale rules** based on CPU, memory, or HTTP queue length
- [ ] Enable **deployment slots** for zero-downtime deployments
- [ ] Set up **health check endpoint** at `/health`
- [ ] Enable **managed identity** for accessing other Azure resources
- [ ] Configure **VNet integration** for private backend access
- [ ] Enable **diagnostic logging** to Log Analytics
- [ ] Set **minimum TLS version to 1.2**
- [ ] Disable **FTP** and **remote debugging** in production

### 5. Auto-Scaling

**Azure Functions:** Scales automatically with Consumption/Flex Consumption plans. Use `maxConcurrentRequests` and function-level concurrency limits to protect downstream services.

**Container Apps:** Use KEDA scalers:

```bicep
scale: {
  minReplicas: 2    // Minimum for production (HA)
  maxReplicas: 20
  rules: [
    {
      name: 'cpu-scaling'
      custom: {
        type: 'cpu'
        metadata: { type: 'Utilization', value: '70' }
      }
    }
    {
      name: 'service-bus-scaling'
      custom: {
        type: 'azure-servicebus'
        metadata: {
          queueName: 'orders'
          messageCount: '10'
        }
        auth: [{ secretRef: 'sb-connection', triggerParameter: 'connection' }]
      }
    }
  ]
}
```

**App Service:** Use built-in auto-scale rules:
- Scale on **CPU > 70%** or **HTTP queue > 100** for web workloads.
- Set **scale-out cooldown shorter than scale-in** to respond to spikes quickly but avoid flapping.
- **Minimum 2 instances across Availability Zones** for production.

## Best Practices

- **Default to PaaS/serverless.** Start with Azure Functions or Container Apps unless you have a specific requirement for AKS or VMs.
- **Use infrastructure as code** for all compute configuration — no portal changes in production.
- **Tag all resources** with service, team, environment, and cost-centre tags.
- **Use Spot VMs for AKS node pools** for fault-tolerant workloads (batch, CI/CD agents, dev/test).
- **Build small, focused container images.** Use multi-stage builds, base on Alpine or distroless. Smaller images = faster pulls = faster scaling.
- **Use Azure Container Registry (ACR)** with Defender for Containers enabled for vulnerability scanning.

## Common Pitfalls

- **Running everything on VMs.** If you're managing OS patches, availability sets, and custom load balancing, ask if App Service, Container Apps, or Functions would eliminate that overhead.
- **Wrong Function plan.** Using Consumption for latency-sensitive APIs or Premium for low-traffic background tasks wastes money.
- **No health probes.** Without health probes, load balancers will keep routing to unhealthy instances.
- **Ignoring cold starts in latency-sensitive paths.** If P99 latency matters, use Flex Consumption with pre-provisioned instances, Premium plan, or always-on App Service.
- **Using `latest` tag for container images.** Pin to specific image digests or semantic versions for reproducible deployments.
- **AKS without managed node pools.** Self-managed node pools add operational burden. Use system and user managed node pools.

## Reference

- [Azure Functions Documentation](https://learn.microsoft.com/en-us/azure/azure-functions/)
- [Azure Container Apps Documentation](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Azure App Service Documentation](https://learn.microsoft.com/en-us/azure/app-service/)
- [Azure Kubernetes Service Best Practices](https://learn.microsoft.com/en-us/azure/aks/best-practices)
- [Compute Decision Tree](https://learn.microsoft.com/en-us/azure/architecture/guide/technology-choices/compute-decision-tree)
