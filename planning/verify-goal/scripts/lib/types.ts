export type ContractStatus = "draft" | "verified";
export type WorkflowPhase =
  | "authoring"
  | "ready"
  | "executing"
  | "awaiting_merge"
  | "complete"
  | "blocked";

export interface SourceReference {
  url: string;
  authority: "authoritative" | "discovery";
  version: string;
  checked_at: string;
  valid_until: string | null;
}

export interface Approval {
  status: "pending" | "approved" | "invalidated";
  approver_alias: string | null;
  approved_at: string | null;
  method: "structured-input" | "typed" | null;
  semantic_sha256: string | null;
  proof_plan_sha256: string | null;
}

export interface Criterion {
  id: string;
  description: string;
  pass_threshold: string;
  claim_ids: string[];
  scenario_ids: string[];
  artifact_ids: string[];
}

export interface Claim {
  id: string;
  description: string;
  required_evidence: string;
  capability_ids: string[];
  criterion_ids: string[];
  verifier_ids: string[];
  scenario_ids: string[];
  artifact_ids: string[];
}

export interface Capability {
  id: string;
  description: string;
  claim_ids: string[];
  verifier_id: string;
}

export interface Risk {
  id: string;
  description: string;
  class: "role" | "state" | "transition" | "failure" | "regression" | "release" | "other";
  disposition: "covered" | "excluded";
  scenario_ids: string[];
  exclusion_reason: string | null;
}

export interface ProductionApproval {
  status: "approved" | "pending" | "denied";
  approved_at?: string;
  approver_alias?: string;
}

export interface Verifier {
  id: string;
  name: string;
  kind: string;
  version: string;
  status: "pending" | "ready" | "blocked";
  claim_ids: string[];
  capability_ids: string[];
  sources: SourceReference[];
  installation: {
    status: "pending" | "ready" | "not_required" | "blocked";
    source: string;
    installed_by_goal: boolean;
    receipt_path: string;
  };
  authentication: {
    route: "none" | "vault" | "direct_cli";
    status: "pending" | "ready" | "not_required" | "blocked";
    vault_provider: string;
    reference_names: string[];
    identity_alias: string;
    environment: string;
    checked_at: string;
    expires_at: string | null;
    production_approval: ProductionApproval | null;
  };
  smoke_test: {
    status: "pending" | "passed" | "failed" | "blocked";
    capability_proved: string;
    checked_at: string;
    receipt_path: string;
  };
  fallback_or_blocker: string;
}

export interface Scenario {
  id: string;
  name: string;
  risk: string;
  criterion_ids: string[];
  claim_ids: string[];
  artifact_ids: string[];
  risk_ids: string[];
  identity_aliases: string[];
  preconditions: string;
  cleanup: string;
  pass_condition: string;
  record: boolean;
}

export interface Artifact {
  id: string;
  type: "automated" | "video" | "screenshot" | "trace" | "log";
  path: string;
  criterion_ids: string[];
  claim_ids: string[];
  scenario_ids: string[];
  required: boolean;
  retention: "commit_if_sanitized" | "pr_attachment" | "local_only";
  privacy_status: string;
  review_status: string;
}

export interface Takeover {
  previous_owner: string;
  previous_run_id: string;
  successor: string;
  reason: string;
  at: string;
  source_revision: number;
  source_readiness_sha256: string;
  goal_sha256: string;
  proof_plan_sha256: string;
}

export interface Readiness {
  schema_version: number;
  client: {
    name: "codex" | "claude-code" | string;
    version: string;
    skill_revision_sha256: string;
    support: "supported" | "best_effort";
    evaluation_receipt_path: string;
  };
  approval: Approval;
  contract: {
    slug: string;
    title: string;
    status: ContractStatus;
    work_type: string;
    created_at: string;
    verified_at: string | null;
    objective: string;
    scope: string[];
    constraints: string[];
    non_goals: string[];
    affected_users: string[];
    affected_systems: string[];
    authority: string[];
    residual_risks: string[];
    unresolved_questions: string[];
  };
  workflow: {
    phase: WorkflowPhase;
    revision: number;
    updated_at: string;
    blockers: string[];
    completed_checks: string[];
    next_checks: string[];
  };
  lease: {
    state: "active" | "released";
    owner: string;
    run_id: string;
    revision: number;
    parent_readiness_sha256: string | null;
    acquired_at: string;
    released_at: string | null;
    takeovers: Takeover[];
  };
  source_hashes: {
    goal_sha256: string | null;
    proof_plan_sha256: string | null;
    checked_at: string | null;
  };
  research: {
    exa: {
      status: "pending" | "complete" | "blocked";
      queried_at: string | null;
      sources: SourceReference[];
    };
  };
  vault: {
    provider: string;
    mechanism: string;
    status: "pending" | "ready" | "not_required" | "blocked";
    checked_at: string | null;
    reference_names: string[];
  };
  criteria: Criterion[];
  claims: Claim[];
  capabilities: Capability[];
  risks: Risk[];
  verifiers: Verifier[];
  scenarios: Scenario[];
  artifacts: Artifact[];
  release: {
    strategy: string;
    rationale: string;
    old_path: string;
    new_path: string;
    transition: string;
    fallback: string;
    telemetry: string;
    cleanup: string;
  };
  evidence_lifecycle: {
    delivery: string;
    provider: "github" | "none";
    attachment_visibility: "link_accessible" | "none";
    pr_number: number | null;
    pr_url: string | null;
    pr_state: string;
    local_video_policy: string;
    sanitized_manifest: string;
  };
  handoff: {
    last_checkpoint: string | null;
    branch: string;
    commit: string | null;
    next_action: string;
  };
}

export type GraphItem = Criterion | Claim | Capability | Risk | Verifier | Scenario | Artifact;

export interface ValidationOptions {
  readinessPath?: string;
  requireReady?: boolean;
  now?: string;
  goalContent?: string;
}
