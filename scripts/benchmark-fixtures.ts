// Raw context an agent would currently have to be fed, piece by piece, in order to
// arrive at the SAME correct, nuanced answer that the board already has condensed
// into one resolved thread. This simulates "ask a human / re-derive from source docs"
// without the board.

export const QUESTION =
  "For Acme's renewal proposal, can we tell them their customer data stays entirely in the EU? What's our actual EU data-residency story, and is there anything sales needs to be careful not to overstate?";

export const RAW_CONTEXT_DOCS = [
  {
    name: "security-faq.md (current page)",
    text: `# Security FAQ

## Where is customer data hosted?
Primary application data is hosted in AWS eu-west-1 (Ireland) for all EU customers,
per our standard data residency commitments.

## Logging
Operational logs (including request/response metadata) are shipped to our central
logging cluster. All logs are US-hosted. This has been true since the original
logging pipeline was built in 2022 and has not changed since.

## Data retention
Customer data is retained per the contractual terms in each customer's order form.
Logs are retained for 30 days.

## Subprocessors
See subprocessors.md for the current list of subprocessors and their regions.

## Encryption
All data is encrypted at rest (AES-256) and in transit (TLS 1.2+).

## Incident response
See incident-response.md.

## Access controls
Role-based access control is enforced for all production systems. See access-control-policy.md.`,
  },
  {
    name: "SEC-912 (security ticket, resolved)",
    text: `SEC-912: Evaluate EU-only logging configuration for enterprise customers
Status: Resolved
Reporter: Lena (Engineering)
Assignee: Security team

Description:
Several EU enterprise prospects (Acme, Nordvik, Bauer) have data-residency
requirements that our current logging setup doesn't meet, because the default
logging configuration ships request bodies (which can contain customer data) to
our US logging cluster.

Investigation:
Engineering built and tested an alternate logging configuration:
- Disables request-body logging entirely for tenants with this flag enabled.
- Routes remaining operational logs (timestamps, status codes, latencies — no
  customer data) to a Frankfurt-region logging cluster instead of the US one.
- Verified via test harness that no customer-identifying fields appear in the
  Frankfurt logs across 500 synthetic requests.

Security review (comments from secteam-maria, 2026-08-14):
"Reviewed the test results and the Frankfurt logging pipeline config. This
configuration satisfies our EU data-residency bar for customers who need it.
Approving for use on a per-tenant opt-in basis. Do NOT enable by default org-wide
yet — we want it opt-in until we've run it in production for a full quarter."

Resolution: Approved as an opt-in per-tenant configuration. Not a default.

Linked: EU-deployment-checklist.md, config-test-results-2026-08.log`,
  },
  {
    name: "config-test-results-2026-08.log (excerpt)",
    text: `Test run: eu-only-logging-config v0.3
Date: 2026-08-12
Requests tested: 500 synthetic + 1200 replayed (scrubbed) production requests

Summary:
- 0/1700 requests leaked a customer-identifying field into the Frankfurt log stream
- Request-body logging confirmed disabled across all tested endpoints
- Latency overhead of EU routing: +4ms p50, +11ms p99 (within tolerance)
- One gap found and fixed: a debug log statement in the billing webhook handler
  was still logging full payloads. Patched in PR #4821, re-tested clean.

Recommendation: safe to approve as opt-in tenant configuration.`,
  },
  {
    name: "EU-deployment-checklist.md",
    text: `# EU Data Residency Configuration — Onboarding Checklist

Use this checklist when a customer requires EU-only data residency.

1. Confirm customer's requirement is about logs/operational data, not just
   primary app data (primary app data is already EU-hosted by default for all
   EU customers — this checklist is specifically about the logging path).
2. Enable the "eu_only_logging" tenant flag in the admin console.
3. Verify in the tenant's log dashboard that logs are now flowing to the
   Frankfurt cluster, not the default US cluster.
4. Confirm request-body logging is OFF for this tenant.
5. Note in the customer's account record: "EU-only logging enabled on <date>,
   approved under SEC-912."
6. This is NOT yet the default for all tenants — each customer needing it must
   be explicitly configured. Do not tell a prospect it is automatic.`,
  },
  {
    name: "account-notes-acme.md",
    text: `# Account notes: Acme Corp

Renewal: Q4, ~$340k ACV
Primary contact: Jordan Vee (IT Procurement)
Key stakeholder: Acme's security team is unusually strict; they run their own
vendor security questionnaire (see acme-questionnaire.xlsx) separate from our
standard SOC2 package.

Prior conversations:
- 2026-03: Acme asked about data residency generally; we pointed them to the
  security FAQ and they seemed satisfied re: primary app data being EU-hosted.
- 2026-07: Acme's renewal questionnaire explicitly asks: "Does ALL customer
  data, including logs and operational telemetry, remain within the EU at all
  times?" This is stricter than their original question and not yet answered
  in this account.`,
  },
];
