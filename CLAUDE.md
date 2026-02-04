# Events Storia - Claude Code Configuration

## Project Identity & Stack
- **Role:** Senior Full-Stack Developer & Systems Architect
- **Project:** Restaurant and catering events platform (StoriaMaestro)
- **Stack:** Vite, TypeScript, React, shadcn-ui, Tailwind CSS, Supabase
- **Environment:** Local Development (VS Code + Claude Code CLI)
- **Philosophy:** Reliability > Cleverness. Autonomy > Constant Intervention.

### Strict Rules
- **ALWAYS** output FULL files. Never provide snippets or placeholders.
- Prioritize the integrity of the existing architecture.
- No code without a plan for non-trivial tasks.

---

## Project Overview

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: React Context + TanStack Query
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Admin**: Refine v5 data framework
- **Payments**: Stripe integration

### Key Directories
```
src/
├── components/     # React components (155+)
├── pages/          # Page components (33)
├── hooks/          # Custom hooks (19)
├── contexts/       # React contexts
├── integrations/   # Supabase client & types
├── lib/            # Utilities
└── types/          # TypeScript definitions

supabase/
├── migrations/     # Database migrations
└── functions/      # Edge Functions
```

---

## Agentic Workflow: Sub-Agent Orchestration

This project utilizes specialized sub-agents to maintain context efficiency and code quality.

### 1. Built-in Sub-Agents
- **Explore:** Use for codebase discovery and high-volume file analysis to keep the main context window lean.
- **Plan:** Always invoke `/plan` for complex features before writing any code.

### 2. Custom Project Sub-Agents (located in `.claude/agents/`)

| Agent | Model | Purpose | Invoke |
|-------|-------|---------|--------|
| `architect` | sonnet | Technical planning, architecture analysis | `@architect` |
| `reviewer` | sonnet | Code review, security, TypeScript best practices | `@reviewer` |
| `researcher` | haiku | Fast codebase exploration, grep tasks | `@researcher` |

### When to Use Each Agent

#### @architect
Use for:
- Planning new features or refactors
- Analyzing file structure and dependencies
- Designing system architecture
- Evaluating technical trade-offs

Example: `@architect Plan the implementation of a new notification system`

#### @reviewer
Use for:
- Code review before merging
- Security audits
- TypeScript type safety checks
- Performance analysis
- Best practices verification

Example: `@reviewer Review the checkout flow for security issues`

#### @researcher
Use for:
- Quick file/function lookups
- Finding usage examples
- Tracing imports and dependencies
- Pattern discovery across codebase

Example: `@researcher Find all components using useCart hook`

### Orchestration Patterns

#### Sequential Analysis
```
1. @researcher Find all authentication-related files
2. @architect Plan auth system improvements based on findings
3. @reviewer Audit current auth implementation for vulnerabilities
```

#### Parallel Exploration
```
Launch multiple @researcher agents to explore different areas:
- Agent 1: Explore payment flow
- Agent 2: Explore cart management
- Agent 3: Explore user authentication
```

---

## Project Conventions

### Code Style
- Use TypeScript strict mode
- Prefer named exports
- Use React functional components with hooks
- Follow shadcn/ui component patterns

### File Naming
- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utilities: `camelCase.ts`
- Types: `types.ts` or `ComponentName.types.ts`

### Supabase
- All tables require RLS policies
- Use Edge Functions for server-side logic
- Type definitions in `src/integrations/supabase/types.ts`

### State Management
- Global state: React Context (`src/contexts/`)
- Server state: TanStack Query via Refine
- Form state: React Hook Form

---

## Operational Protocols (GSD Workflow)

### Phase 1: Context & Discovery
- Proactively use the **Explore** sub-agent to map dependencies.
- Use `grep` and `ls` to identify existing patterns before proposing new ones.
- **Rule:** Never propose new patterns without exploring existing ones first.

### Phase 2: Planning First (MANDATORY for non-trivial tasks)
1. **Discovery:** Explore the codebase using the `researcher` agent.
2. **Spec:** Document requirements and affected files.
3. **Plan:** Enter `/plan` mode to design the approach and identify dependencies.
4. **Approve:** Get user approval before writing code.

### Phase 3: Implementation Standards
- **Senior Standards:** Write clean, modular, and strictly typed TypeScript code.
- **Naming:** PascalCase for components, camelCase for functions/variables.
- **Tailwind:** Follow existing design tokens. Use `shadcn` components where possible.
- **Types:** Strict TypeScript. No `any`. Clear separation of concerns.
- **Atomic Commits:** Structure work so it can be committed in logical units.

### Phase 4: Execution & Verification
- Provide complete, ready-to-use files.
- Verify changes against the plan before declaring a task complete.
- Delegate to the `reviewer` sub-agent for a final check of the modified files.
- Ensure no unused imports or console logs remain.

---

## Development Commands

```bash
npm run dev          # Start local development server
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Code quality check
```

### Supabase
```bash
supabase functions serve    # Local Edge Functions
supabase db push           # Apply migrations
supabase gen types         # Regenerate TypeScript types
```

### Pre-rendering (SSG)
```bash
npm run prerender          # Generate static pages for SEO
```

### Agent Management
```bash
/agents              # Manage and configure sub-agents
```

---

## SEO Ground Rules (Binding)

These rules are mandatory for all content and page creation tasks.

- Every page MUST target exactly ONE primary keyword.
- No new page may target a primary keyword already assigned to another page.
- Keyword cannibalization is strictly forbidden.
- H1 MUST be a natural-language version of the primary keyword.
- `<title>` MUST include the primary keyword and a local modifier if applicable.
- Canonical, hreflang and breadcrumb data MUST always be set.

---

## Content Architecture (Pillar & Cluster Model)

### Pillar Pages (Authority Hubs)
- `/` (Homepage)
- `/events/` (Event location Munich)
- `/catering/*` (Catering menus)

### Cluster Pages
- City / district pages (e.g. Maxvorstadt, Schwabing)
- Occasion pages (Firmenfeier, Geburtstag, Weihnachtsfeier)
- Culinary focus pages (Pizza, Buffet, Fingerfood)

### Rules
- Cluster pages MUST link to their corresponding pillar page.
- Pillar pages SHOULD link to all related cluster pages.
- All conversion-oriented CTAs MUST lead to `/checkout/` or contact forms.

---

## Keyword Mapping Reference

The authoritative keyword mapping is defined in:

`docs/seo-strategy.md`

Claude MUST:
- Consult this document before creating or modifying pages
- Respect all existing primary keywords
- STOP and request clarification if a conflict is detected

---

## Local SEO Focus

### Primary Location
- Munich – Maxvorstadt (Restaurant address: Karlstr. 47a, 80333 München)

### Secondary Geo Targets
- Greater Munich area
- Adjacent districts (Schwabing, Lehel, Isarvorstadt)

### Rules
- City and district pages MUST include real-world local context (landmarks, public transport).
- NAP data MUST only be sourced from the central configuration.
- No fabricated reviews, ratings or testimonials are allowed.

---

## Instructions for Claude

> When a user request involves cross-module changes or deep codebase analysis, explicitly state: *"I will delegate the [Research/Review] to a sub-agent to preserve context."*

> Always prioritize the integrity of the existing architecture.

> Before creating or modifying any public-facing page, consult `docs/seo-strategy.md` to ensure keyword compliance.
