# Orochi KPI

## Purpose

Measure whether Orochi successfully turns scattered project resources into one usable project context.

## North Star

**Project Context Completion Rate**

The percentage of projects for which Orochi can resolve the current project and expose the required resources as one browser context.

## MVP KPIs

| KPI | Definition | MVP target |
|---|---|---:|
| Project Resolution Rate | Active project URLs resolved to a Project | ≥ 95% |
| Resource Open Rate | Resolved resources successfully opened | ≥ 95% |
| Tab Group Success Rate | Project resources grouped correctly | ≥ 95% |
| Cross-interface Consistency | CRX / CLI / API / MCP return equivalent Project State | 100% |
| Time to Context | Time from active project URL to usable project context | < 10 sec |
| Secret Exposure | Credentials stored in CRX | 0 |
| POC Completion | MVP flow works end-to-end | 100% |

## MVP measurement

Primary flow:

```text
GitHub URL
  → resolve Project
  → collect resources
  → create/update Tab Group
  → usable project context
```

Record:

- input URL
- resolved project
- resources discovered
- resources opened
- grouping result
- elapsed time
- interface used
- errors

## Later KPIs

- Project State freshness
- AI action success rate
- repeated manual navigation avoided
- daily active projects
- actions per project
- MCP task completion
- user corrections per AI action

## Principle

Measure **context becoming usable**, not feature count.
