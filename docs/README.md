# Keyvantic Knowledge Operating System (KOS) — Documentation

This directory contains the architecture and design documentation for the Keyvantic Knowledge Operating System (KOS), the enterprise knowledge management platform for Keyvantic, an AI Business Transformation and Advisory firm.

KOS is the system of record for Keyvantic's intellectual property: frameworks, methodologies, research, sales collateral, client deliverables, and institutional knowledge. It combines a structured "Master Library" document repository with version control, approval workflows, full-text and semantic search, an AI research assistant, and a relationship graph — with room to grow into a broader operating system for the firm (CRM, project management, client portal, learning management, and more).

## Document Index

| Doc | Contents |
|---|---|
| [01-system-architecture.md](./01-system-architecture.md) | High-level architecture, monorepo layout, service responsibilities, extensibility model for future modules |
| [02-database-schema.md](./02-database-schema.md) | Full Prisma-aligned data model, ER diagram, indexes, and design rationale |
| [03-api-design.md](./03-api-design.md) | REST API resources, endpoints, auth/role requirements, pagination and error conventions |
| [04-user-flows.md](./04-user-flows.md) | Key end-to-end flows as Mermaid sequence/flowchart diagrams |
| [05-ui-ux-wireframes.md](./05-ui-ux-wireframes.md) | Screen-by-screen wireframes, layout regions, responsive behavior, visual identity |
| [06-component-hierarchy.md](./06-component-hierarchy.md) | Next.js App Router component tree and NestJS module/provider hierarchy |
| [07-development-roadmap.md](./07-development-roadmap.md) | Phased roadmap from foundation through future modules |
| [08-security-architecture.md](./08-security-architecture.md) | AuthN/AuthZ, RBAC matrix, confidentiality levels, audit, OWASP mitigations |
| [09-deployment-guide.md](./09-deployment-guide.md) | Local dev via Docker Compose, environment variables, production deployment, CI/CD |
| [10-saas-product-scope.md](./10-saas-product-scope.md) | Scoping draft for the multi-tenant SaaS product — secure AI-powered CRM with a document vault for professional services firms |
| [11-positioning-and-messaging.md](./11-positioning-and-messaging.md) | Category choice, positioning statement, buyer map, differentiators, objection handling, and messaging for professional services firms |

## Core Concepts at a Glance

- **Monorepo**: pnpm workspaces with `apps/web` (Next.js 14 App Router), `apps/api` (NestJS + Prisma + PostgreSQL), and `packages/types` (shared TypeScript contracts).
- **Master Library**: a hierarchical document tree rooted at nine top-level categories (`01 Strategy` through `09 Clients`), with every document assigned a human-readable ID such as `KV-BS-001`.
- **Document lifecycle**: `DRAFT → INTERNAL_REVIEW → APPROVED → ARCHIVED`, with append-only version history and full audit trail.
- **Roles**: `ADMINISTRATOR, PARTNER, CONSULTANT, RESEARCHER, DESIGNER, SALES, MARKETING, GUEST`, governed by a configurable permission matrix.
- **Search & AI**: Meilisearch for full-text/faceted search, OpenAI-backed RAG for semantic search and the AI assistant, both scoped to `APPROVED` documents and the requesting user's confidentiality clearance.
- **Extensibility**: new capabilities (CRM, Project Management, Proposal Generator, AI Transformation Assessment, Client Portal, LMS, Research Publishing, Executive/Financial Dashboards, Knowledge Graph, Internal AI Copilot) are added as new NestJS modules and new Next.js route groups, communicating through shared types and domain events rather than reaching into each other's internals.

## How to Read This Documentation

Start with `01-system-architecture.md` for the big picture, then `02-database-schema.md` for the data model. `03-api-design.md` and `06-component-hierarchy.md` are the most useful references while implementing features. `04-user-flows.md` and `05-ui-ux-wireframes.md` are the product/UX reference. `07-development-roadmap.md` sequences the work; `08-security-architecture.md` and `09-deployment-guide.md` cover operational concerns.
