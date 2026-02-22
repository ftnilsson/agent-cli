# Serverless Development

Cloud-agnostic skills for the serverless computing model — designing, building, testing, and operating event-driven, pay-per-execution workloads. These skills focus on **patterns and principles** that apply regardless of whether you deploy to AWS Lambda, Azure Functions, Google Cloud Functions, or Cloudflare Workers. Combine with a cloud-provider category (aws-cloud, azure-cloud) for provider-specific implementation details.

## Skills

| # | Skill | What you'll learn |
|---|-------|-------------------|
| 01 | Architecture & Design Patterns | When to go serverless, event-driven architecture, bounded contexts, composition patterns |
| 02 | Function Design & Composition | Single-responsibility functions, input/output bindings, chaining, fan-out/fan-in, idempotency |
| 03 | API Gateway & HTTP APIs | REST/GraphQL on serverless, gateway patterns, request validation, rate limiting, CORS |
| 04 | Event-Driven Integration | Event sources, triggers, reactive patterns, event schemas, choreography vs orchestration |
| 05 | Data Persistence & State | Stateless functions with external state, database access patterns, caching, connection pooling |
| 06 | Authentication & Authorisation | JWT validation, API keys, OAuth/OIDC flows, authoriser/middleware patterns, token propagation |
| 07 | Testing & Local Development | Unit testing functions, integration testing, local emulators, contract testing, mocking triggers |
| 08 | Observability & Debugging | Distributed tracing, structured logging, custom metrics, cold-start monitoring, debugging production |
| 09 | Performance & Cold Starts | Cold-start mitigation, memory/CPU tuning, concurrency models, connection reuse, payload optimisation |
| 10 | Deployment & Versioning | IaC for serverless, deployment strategies (canary, linear, all-at-once), aliases, stages, rollback |

## How it fits together

```
┌──────────────────────────────────────────────────────────────────────┐
│  Serverless Category (cloud-agnostic patterns)                       │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Architecture  │  │ Function     │  │ API Gateway  │               │
│  │ & Patterns    │──│ Design       │──│ & HTTP APIs  │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│         │                 │                 │                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Event-Driven │  │ Data &       │  │ Auth &       │               │
│  │ Integration  │──│ State        │──│ Authorisation│               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│         │                 │                 │                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Testing &    │  │ Observability│  │ Performance  │               │
│  │ Local Dev    │──│ & Debugging  │──│ & Cold Starts│               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                           │                                          │
│                    ┌──────────────┐                                   │
│                    │ Deployment & │                                   │
│                    │ Versioning   │                                   │
│                    └──────────────┘                                   │
└──────────────────────┬───────────────────────┬───────────────────────┘
                       │  combine with         │
              ┌────────▼────────┐     ┌────────▼────────┐
              │   AWS Cloud     │     │  Azure Cloud     │
              │   (Lambda,      │     │  (Functions,     │
              │    API Gateway, │     │   APIM,          │
              │    DynamoDB...) │     │   Cosmos DB...)  │
              └─────────────────┘     └─────────────────┘
```

## Prompts

| Prompt | Purpose |
|--------|---------|
| `architecture-review` | Assess serverless architecture for anti-patterns, coupling, and scalability issues |
| `function-review` | Review function code for single-responsibility, idempotency, error handling, and best practices |
| `performance-review` | Identify cold-start risks, concurrency bottlenecks, and optimisation opportunities |
| `cost-review` | Analyse execution patterns, memory allocation, and invocation costs for savings |

## Presets

Use presets to combine serverless skills with a cloud provider:

- `serverless-aws` — serverless patterns + AWS cloud specifics
- `serverless-azure` — serverless patterns + Azure cloud specifics
- `serverless-fullstack-aws` — full-stack + serverless + AWS
- `serverless-fullstack-azure` — full-stack + serverless + Azure
