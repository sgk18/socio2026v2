# Module 11 SOCIO: Approval Workflow, Event and Fest Logic, Database Structure

## Document Status
- Type: Functional and Technical Specification
- Module: Module 11 (Approvals and Workflow Layer)
- Scope: Planning only
- Implementation Status: Not started by design

## 1. Purpose and Scope
This document defines Module 11 approvals and workflow behavior for SOCIO across existing modules:
1. Master
2. Organize
3. Support

The target is a simple, configurable approval engine with minimal schema changes and reusable logic.

This document is planning-only and does not include implementation.

## 2. Image-Aligned Workflow Interpretation
Based on your latest workflow diagram and clarifications:
1. There are two workflow sections: Stage 1 and Stage 2.
2. Stage 1 is go-live blocking.
3. Item goes live only when it moves from Stage 1 to Stage 2.
4. Default Stage 1 approvals are HOD, Dean, CFO/Campus Director, and Accounts Office.
5. Stage 2 contains operational lanes (IT, Venue, Catering, Stalls/Misc, Volunteers).
6. Sequence must be editable by dropdown configuration.

## 3. Business Outcomes
1. Standardize fest and event approvals.
2. Keep go-live gating strict and transparent.
3. Allow inherited skips for events under approved fests.
4. Keep operational handling available after Stage 1 clearance.
5. Make sequence and stage assignment configurable without code rewrites.

## 4. Role and Lane Model
Roles and lanes represented in the workflow:
1. Student Organiser (events edit)
2. Organisers (fest details)
3. HOD
4. Dean
5. CFO/Campus Director
6. Accounts Office
7. Master Admin
8. IT
9. Venue
10. Catering Vendors
11. Stalls/Misc
12. Volunteers

Master Admin behavior (as confirmed):
1. Can do everything.
2. Oversees the full workflow.
3. Can act as override/escalation authority.

## 5. End-to-End Workflow Definition

## 5.1 Pre-Approval Authoring Layer
Before approval routing:
1. Student Organiser prepares or edits event details.
2. Organisers manage fest details and submit items into approval flow.
3. All approval action controls must live inside create or edit fest and event pages only.

This layer is preparatory and not a go-live gate by itself.

## 5.2 Stage 1: Blocking Approval Section
Stage 1 is the mandatory go-live gate.

Default Stage 1 steps:
1. HOD
2. Dean
3. CFO/Campus Director
4. Accounts Office

Behavior:
1. Item remains not-live while Stage 1 has pending or rejected required steps.
2. Item becomes live only when Stage 1 is complete and the workflow moves to Stage 2.
3. If a mapped approver is not assigned yet (for example, no HOD for the organizing department), the request is still created and stays pending until assignee resolution.

## 5.3 Stage 2: Live Operational Section
Stage 2 begins after Stage 1 completion and go-live transition.

Default Stage 2 lanes:
1. IT
2. Venue
3. Catering Vendors
4. Stalls/Misc
5. Volunteers

Behavior:
1. Stage 2 handles operations and execution.
2. Volunteers are added in the event list as part of operational handling.

## 5.4 UI Placement Rules (Strict)
1. Approval initiation and workflow actions must happen in create or edit fest and event pages only.
2. List cards must not host full approval action forms.
3. List cards may only provide navigation entry via an Approvals button.

## 5.5 Approvals Page Scope (Single Source of Truth)
The approvals page is the only place for approval tracking visuals and feedback details.

It must include:
1. Current stage and step-wise status.
2. Full flow diagram.
3. Pain points or bottleneck indicators.
4. Returned-back notes, rejection reasons, and resubmission messages.
5. Assignment state (assigned or waiting_for_assignment).

Create or edit pages may show compact summaries, but the detailed status and diagram must remain on the approvals page.

## 6. Fest vs Event Logic

## 6.1 Fest
Fest follows full Stage 1 default chain (unless configuration changes order/step membership), then enters Stage 2.

## 6.2 Standalone Event (No Fest)
Standalone event follows configured Stage 1 chain, then enters Stage 2.

Order requirement from your clarification:
1. Exact fixed order is not hardcoded.
2. Order is selected from a dropdown configuration.
3. Default sequence is HOD, Dean, CFO/Campus Director, Accounts Office.

## 6.3 Event Under a Fest
If event belongs to a fest that already completed Stage 1 approvals:
1. Skip HOD/Dean approval.
2. Skip CFO/Campus Director approval.
3. Skip Accounts Office approval.
4. Event can start directly in Stage 2 operational section.

## 6.4 Card Entry and Approval Route
1. Every fest and event card must have an Approvals button.
2. Clicking the button opens the approvals route in this form: socio.comlink/approvals/item-id.
3. Route pattern for implementation planning: /approvals/{itemId}.
4. Access for this route is creator-only for the corresponding item.
5. If a non-creator opens the route, access is denied.

## 7. Go-Live Decision Logic
General rule:
1. Go live occurs at transition from Stage 1 to Stage 2.

Runtime rule:
1. stage1RequiredSteps = configured Stage 1 steps after inheritance/skip resolution
2. stage1Complete = all stage1RequiredSteps are approved
3. canGoLive = stage1Complete

Important:
1. For under-fest events with inherited Stage 1 completion, canGoLive is true immediately for that event instance.
2. Stage 2 is post-clearance execution lane.

## 8. Venue Rule (Event-Type Dependent)
Venue behavior is configurable by event type.

Default policy:
1. Venue is in Stage 2.
2. Venue does not block Stage 1 completion by default.

Configurable policy:
1. Certain event types can move venue into Stage 1 or mark it blocking if required by policy.
2. This must be handled through configuration, not code forks.

## 9. Configurability Model (Dropdown-Driven)

## 9.1 Required Capability
Workflow must be editable from configuration UI (dropdown-based), including:
1. Step order
2. Stage bucket (Stage 1 or Stage 2)
3. Whether a step is blocking
4. Whether a step is inheritable from fest

## 9.2 Configuration Data Contract
Store a workflow sequence configuration object with:
1. stepKey
2. stepLabel
3. stageBucket (1 or 2)
4. orderIndex
5. isBlocking
6. appliesTo (fest, standalone_event, under_fest_event)
7. canInheritFromFest
8. enabled

Engine behavior:
1. Load active configuration.
2. Resolve event context (fest-linked or standalone).
3. Apply inheritance and skip rules.
4. Execute approvals in configured order.
5. Compute go-live from Stage 1 completion.

## 9.3 Default Configuration Snapshot
Default Stage 1:
1. HOD (blocking)
2. Dean (blocking)
3. CFO/Campus Director (blocking)
4. Accounts Office (blocking)

Default Stage 2:
1. IT
2. Venue
3. Catering Vendors
4. Stalls/Misc
5. Volunteers

## 10. Database Structure (Proposed)

## 10.1 New Table: approvals
Create one approvals table for both events and fests.

Required columns (as requested):
1. id
2. eventOrFestId
3. type (event or fest)
4. stage1Hod
5. stage2Dean
6. stage3Cfo
7. stage4Accounts
8. cateringApproval
9. itSupportApproval
10. stallsApproval
11. venueApproval
12. miscellaneousApproval

Allowed status values:
1. pending
2. approved
3. rejected

Note:
1. Column names remain as requested.
2. Runtime order and stage bucket come from configuration, not from numeric names in column labels.

## 10.2 Minimal Metadata in approvals
Recommended additional columns for robust operation:
1. parentFestId (nullable)
2. workflowVersion
3. currentStage (1 or 2)
4. wentLiveAt
5. createdAt
6. updatedAt
7. lastActionBy
8. lastActionAt
9. organizingDepartmentSnapshot
10. organizingSchoolSnapshot
11. stage1HodAssigneeUserId (nullable)
12. stage2DeanAssigneeUserId (nullable)
13. stage1HodRoutingState (assigned or waiting_for_assignment)
14. stage2DeanRoutingState (assigned or waiting_for_assignment)

These remain simple and avoid complex relational expansion.

## 10.3 Index Guidance
Add indexes for:
1. eventOrFestId
2. type
3. parentFestId
4. currentStage
5. frequently queried pending columns

## 11. Users Table Updates (Role Flags)
Add boolean role flags:
1. isHod
2. isDean
3. isCfo
4. isAccountsOffice
5. isStalls
6. isItSupport
7. isVenueManager

Recommended addition for image parity:
1. isCampusDirector

All role flags are true/false.

## 12. Approver Mapping Logic

## 12.1 HOD Mapping
1. isHod must be true.
2. user.department must match item.organizingDepartment captured at event or fest creation.
3. If no matching HOD exists, keep Stage 1 HOD step as pending with routing state waiting_for_assignment.

## 12.2 Dean Mapping
1. isDean must be true.
2. user.school must match item.organizingSchool captured at event or fest creation.
3. If no matching Dean exists, keep Stage 1 Dean step as pending with routing state waiting_for_assignment.

## 12.3 CFO/Campus Mapping
1. isCfo or isCampusDirector must be true.
2. Optional campus scoping can be applied if policy requires.

## 12.4 Accounts Mapping
1. isAccountsOffice must be true.

## 12.5 Master Admin Override
1. Master Admin can approve any step.
2. Master Admin can override stalled workflows.
3. All override actions must be audit-marked.

## 12.6 Deferred Assignment and Auto-Routing
Required behavior:
1. Approval request must always be created, even when HOD or Dean assignee is not currently available.
2. Missing assignee must not delete or block request creation.
3. Request remains in pending status with waiting_for_assignment routing state for that step.

Auto-routing trigger:
1. When a user is later assigned isHod with matching department, pending HOD requests for that department are auto-linked and shown in that HOD queue.
2. When a user is later assigned isDean with matching school, pending Dean requests for that school are auto-linked and shown in that Dean queue.
3. This rebind must happen automatically on role or profile updates (or scheduled reconciliation) without manual request recreation.

## 13. Queue and Action Model
Each queue view should expose:
1. Item type and reference
2. Current stage
3. Current step
4. Department and school context
5. Parent fest linkage
6. Pending duration
7. Override eligibility
8. Routing state (assigned or waiting_for_assignment)

Additional queue requirement:
1. Master Admin must have an Unassigned Approvals view to monitor requests waiting for HOD or Dean assignment.

Actions:
1. Approve
2. Reject
3. Reassign
4. Override (Master Admin)

Rejection behavior for Stage 1 blocking steps:
1. Stage progression stops.
2. Item remains not-live.

Creator approvals page requirements:
1. The approvals page must present the complete workflow diagram and approval status progression.
2. The approvals page must display pain points and delayed-step indicators.
3. Any return-back or correction message must be shown on this page as canonical feedback.
4. The creator should not need to check multiple pages for workflow state.

## 14. Validation Rules
1. Action is allowed only for mapped approver role or Master Admin override.
2. Stage 1 required sequence must be respected according to current dropdown configuration.
3. Under-fest inheritance must be validated against parent fest Stage 1 completion.
4. Type must be event or fest.
5. One active approvals record per item.
6. Request creation must succeed even when assignee is missing.
7. On matching role assignment later, pending waiting_for_assignment requests must auto-bind to the new assignee.
8. /approvals/{itemId} route must allow creator-only access for item-level view.

## 15. Assumptions and Dependencies
Assumptions:
1. Existing modules remain intact during rollout.
2. Department and school context are reliably available.
3. Parent fest linkage is reliable for inheritance checks.

Dependencies:
1. Role assignment governance by admins.
2. Configuration UI for dropdown sequencing.
3. Notification system for approval actions.
4. Venue schedule source for conflict checks.

## 16. Edge Cases
1. Parent fest approved after child event was created.
- Child must recompute inheritance and potentially skip Stage 1.

2. Event detached from fest.
- Child event must be moved back to standalone Stage 1 path.

3. Configuration changes mid-flow.
- Respect workflowVersion snapshot to avoid breaking in-flight approvals.

4. Multiple eligible approvers for one step.
- Policy default: any one can approve unless stricter quorum is configured.

5. Venue rule differs by event type.
- Evaluate event-type policy before deciding if venue is blocking or operational.

6. Master Admin override used.
- Must capture reason, actor, and timestamp.

7. HOD not assigned at request creation time.
- Keep request pending and visible in Unassigned Approvals.
- Auto-route to the newly assigned HOD once department match exists.

8. Dean not assigned at request creation time.
- Keep request pending and visible in Unassigned Approvals.
- Auto-route to the newly assigned Dean once school match exists.

## 17. Risks and Mitigations
1. Risk: Hidden hardcoding in service logic.
- Mitigation: One central configuration-driven approval engine.

2. Risk: Inheritance mistakes for under-fest events.
- Mitigation: Explicit inheritance check and audit mark in approvals record.

3. Risk: Config changes destabilize active workflows.
- Mitigation: Versioned config and transition safeguards.

4. Risk: Role mapping gaps (department/school missing).
- Mitigation: Pre-validation and clear remediation messages.

## 18. Suggested Implementation Approach (Future, Not Started)
1. Phase 1 only: finalize and implement HOD and Dean assignment logic first.
2. Phase 1 only: ensure request routing works end-to-end for Stage 1 approval chain only (HOD -> Dean -> CFO/Campus Director -> Accounts Office).
3. Phase 1 exit gate: do not start later features until Stage 1 assignment and routing are verified as stable in testing and real workflow checks.
4. Phase 1 mandatory test: create requests before HOD or Dean assignment, then assign role later and verify auto-appearance in the new assignee queue.
5. Phase 2: enforce UI boundaries (approval actions in create or edit pages, detailed statuses and diagram in approvals page).
6. Phase 2: add Approvals button on fest and event cards and route to /approvals/{itemId} with creator-only guard.
7. Phase 3: after Phase 2 sign-off, implement under-fest inheritance and transition handling.
8. Phase 4: after Phase 3 sign-off, implement Stage 2 operational lanes (IT, Venue, Catering, Stalls/Misc, Volunteers).
9. Phase 5: add full auditability, notifications, and operational hardening.

## 19. Acceptance Criteria
1. Stage 1 is blocking and controls go-live.
2. Item goes live when it transitions to Stage 2.
3. Default Stage 1 is HOD, Dean, CFO/Campus Director, Accounts Office.
4. Under-fest events skip HOD/Dean/CFO/Accounts when parent fest is approved.
5. Sequence and stage assignment are editable by dropdown configuration.
6. Master Admin can oversee and act across all workflow steps.
7. Volunteers can be added in event operational list.
8. Venue behavior can vary by event type via configuration.
9. Request is created even when no HOD or Dean is assigned yet.
10. After HOD or Dean assignment is added later, pending requests auto-show in that approver queue without recreating the request.
11. Approval actions are available in create or edit fest and event pages only.
12. Fest and event cards include an Approvals button that opens /approvals/{itemId}.
13. /approvals/{itemId} is creator-only for item-level access.
14. The approvals page is the single page containing full status timeline, flow diagram, and return-back messages.

## 20. Out of Scope for This Document
1. Code implementation
2. Migration scripts
3. API code contracts
4. UI implementation details
5. Deployment execution

---
Prepared for Module 11 planning only. No implementation has been initiated.