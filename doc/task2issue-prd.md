# task2issue — PRD / Agent Contract

- Status: Proposal
- Source: [Issue #64](https://github.com/bonsai/orochi/issues/64), RAW11-17 (2026-10-18)
- Placement: initially inside `bonsai/orochi`; split to a dedicated repository only if ownership or release cadence requires it.

## 1. Purpose

Convert free-form requests and scattered task notes into a traceable GitHub Issue routed to the correct repository. task2issue performs intent extraction, context integration, repository routing, duplicate detection, and preview. Implementation is delegated to tools such as takt or Jules; task2issue does not itself implement the requested product.

## 2. Core model: intent + implementation context

### Intent (“骨”)

- goal and problem
- intended user / beneficiary
- expected outcome
- acceptance criteria
- relevant evidence/source text

### Implementation context (“肉”)

- user/project preferences relevant to the task
- existing repository structure and conventions
- stack/runtime constraints
- dependencies and deployment assumptions
- explicit prohibitions and non-goals

Store these separately and combine them only when preparing a target-specific Issue. Do not let a transient implementation detail overwrite the underlying intent.

## 3. Input/output contract

Input may be a free-form message, transcript, note, or structured task. Output is a proposal containing:

- normalized intent
- implementation context with provenance
- candidate repositories and routing rationale
- duplicate candidates and recommended action
- generated title, body, and label suggestions
- confidence / unresolved questions
- preview-only status until explicit confirmation
- after creation: issue URL/number and request-to-issue audit record

Schema should be versioned. Preserve source text or a stable source reference so extraction can be audited.

## 4. Routing

Use evidence such as repository descriptions, README/AGENTS files, existing issue history, code ownership, and labels. Rank candidates with explicit reasons. If multiple repositories are plausible or confidence is below a configured threshold, ask the user; never silently create an issue in an uncertain repository.

Do not route based solely on a repository name match when existing ownership or task history contradicts it.

## 5. Duplicate handling

Search for semantically and lexically similar open issues before creating a new one.

- Exact/sufficient duplicate: recommend existing issue and optionally propose an additive comment.
- Related but distinct: create a new issue with cross-reference.
- Unclear: show candidates and ask before writing.
- Closed issue: determine whether reopening, follow-up issue, or comment is appropriate; do not assume.

All write operations require a preview and explicit confirmation.

## 6. Issue generation

Generated Issue body should separate:
- purpose/context
- scope and non-goals
- requirements
- acceptance criteria
- dependencies
- evidence/source
- open questions

Labels are suggestions constrained to labels already available in the target repository. Do not invent labels or assume they exist.

## 7. Delegation boundary

task2issue may produce a handoff payload for takt/Jules containing the issue URL, implementation constraints, acceptance criteria, and validation instructions. It must not claim that delegated work has started or completed until the external runner confirms it.

## 8. Audit and safety

Record the original request reference, extracted intent/context versions, routing candidates, duplicate-check result, confirmation, write result, and resulting issue URL. Avoid logging credentials or unrelated personal context.

## 9. Acceptance criteria

- Intent and implementation context have separate schemas.
- Routing decisions expose evidence and confidence.
- Duplicate detection is part of the create flow.
- Ambiguous routing blocks issue creation pending user confirmation.
- Preview and explicit confirmation prevent accidental writes.
- Issue creation result is auditable and linked to the source request.
- Delegation payload can be passed to takt/Jules without confusing planning with implementation.
