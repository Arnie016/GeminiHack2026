# SentinelQA PRD

## 1) One-liner

An AI agent that continuously tests your product like a tireless QA team: it executes real user flows in a browser, runs regression suites on every change, and performs controlled chaos experiments to uncover reliability gaps before users do.

## 2) Context + Problem

Vibecoding accelerates shipping, but it also accelerates regressions:

- Features ship faster than humans can re-test.
- Manual QA is intermittent, subjective, and expensive.
- Traditional automated testing requires writing and maintaining brittle scripts (selectors break, flows drift).
- “It worked on my machine” becomes “it broke in prod” because nobody constantly checks the end-to-end truth.

**Core pain:** teams (and especially solo vibecoders) need confidence that “the app still works” after every update, without becoming a full-time test engineer.

## 3) Target Users (Personas)

1. **Solo Vibecoder**
   - Wants: set-and-forget regression checks, clear bug reports, minimal setup.
2. **Small Team PM/Tech Lead**
   - Wants: release confidence, fewer hotfixes, automatic bug tickets, coverage metrics.
3. **QA-minded Engineer**
   - Wants: controllable suites, reproducibility, logs, artifacts, ability to add constraints and assertions.
4. **DevOps/Platform**
   - Wants: safe non-prod testing, predictable cost/runtime, clean integrations with CI/CD and alerting.

## 4) Goals / Non-goals

### Goals

- **Autonomous functional regression testing** via browser execution (real UI).
- **Test-case generation** from product artifacts (README, user stories, API spec, routes, changelog).
- **Chaos testing** (controlled fault injection) to validate resilience and error handling.
- **Actionable reporting**: reproducible steps, screenshots/video, console/network traces, severity.
- **Continuous operation**: on PRs, on deploys, nightly, and “always-on” monitoring.

### Non-goals (important for safety + scope)

- Not a “hacking tool.” The agent must **only test environments you explicitly authorize**.
- No exploitation, no bypassing auth, no data exfiltration, no scanning random hosts.
- Security checks are limited to **defensive validation** (misconfig/unsafe behavior indicators) inside scope.

## 5) Key User Stories

- **US1 (Setup in minutes):** As a vibecoder, I connect my staging URL and test account, and the agent starts running a default smoke suite.
- **US2 (Every PR gets a verdict):** As a dev, I see pass/fail with links to artifacts and a concise summary of what broke.
- **US3 (Agent writes tests for me):** As a PM, I paste a user story, and the agent turns it into executable tests.
- **US4 (Chaos day, but polite):** As an ops person, I schedule a chaos run (latency, API failures, retries) and get a resilience report.
- **US5 (Bug tickets that don’t lie):** As a team, failures auto-create Linear/Jira/GitHub issues with reproduction steps and evidence.

## 6) Product Experience (User Journey)

### A. Onboarding

1. User provides:
   - App base URL(s) (staging preferred)
   - Test credentials (or SSO test account)
   - Optional: OpenAPI spec, list of critical flows, seed data
2. Agent runs:
   - Environment validation (robots/scope, auth works, pages reachable)
   - Initial crawl to map key pages/routes and identify core flows
3. Agent proposes:
   - “Recommended smoke suite” + optional deeper regression suite

### B. Continuous Runs

- Triggers:
  - PR opened/updated
  - Deploy completed
  - Scheduled nightly
  - On-demand “Test this URL now”
- Output:
  - Status + summary
  - Failures grouped by root cause
  - Artifacts: screenshots, video, console logs, network HAR, trace

### C. Chaos Experiments (Controlled)

- Agent runs bounded experiments like:
  - Inject latency/timeouts for selected API calls
  - Simulate flaky network / offline
  - Force partial backend errors (via a test fault-injection endpoint or mock layer)
  - Rate-limit simulation (in staging)
- Output:
  - “Resilience scorecard” with symptoms, user impact, and suggested mitigations

## 7) Core Features (MVP → V1)

### MVP (must-have)

1. **Browser-based E2E runner**
   - Login flow support
   - Navigate, click, type, submit
   - Assertions: page contains text, URL pattern, element visible, no uncaught console errors, network response codes thresholds
2. **Test case format**
   - Human-editable YAML/JSON with steps + assertions
3. **Autonomous exploration mode**
   - “Crawl + sanity-check” critical pages (no destructive actions unless allowed)
4. **Reporting**
   - Failure triage, steps to reproduce, artifacts bundle
5. **CI integration**
   - GitHub Actions (or generic webhook)
   - Exit codes, PR comment summary

### V1 (strong differentiators)

1. **Spec-to-tests**
   - Convert user stories / acceptance criteria into test suites
2. **Self-healing selectors**
   - When selectors break, agent re-finds elements based on semantics + surrounding context
3. **Chaos module**
   - Fault injection via explicit mechanisms (feature flags, proxy, or test endpoints)
4. **Coverage insights**
   - “Which flows are covered?” + “What changed and what did we re-test?”
5. **Ticketing integrations**
   - Jira/Linear/GitHub issues with rich artifacts

## 8) Requirements (Detailed)

### 8.1 Functional Requirements

**R1: Scope & Safety Controls**

- Must enforce an explicit allowlist of domains/URLs.
- Must have environment modes: `staging`, `preview`, `production`.
- Default denies destructive operations (delete, payment, irreversible state changes) unless explicitly enabled.
- Must sanitize/avoid entering real PII; encourage seed data.

**R2: Test Authoring**

- Support:
  - Step types: `goto`, `click`, `type`, `select`, `upload`, `waitFor`, `assert`
  - Assertions: `textPresent`, `elementVisible`, `urlMatches`, `noConsoleErrors`, `httpStatusOk`, `performanceBudget`
- Parameterization: environment variables, secrets, test data fixtures.

**R3: Execution Engine**

- Browser automation with:
  - Screenshots per step
  - Video recording for failed tests
  - Console log capture
  - Network capture (HAR)
  - Deterministic retries (configurable)

**R4: Planner (Gemini reasoning)**

- Convert goals → concrete steps
- Detect flakiness and propose stabilization
- Triage failures:
  - test bug vs product bug vs environment issue

**R5: Reporting**

- Must output:
  - Summary (pass/fail, duration, key failures)
  - Per-failure reproduction steps
  - Severity + impact estimate
  - Artifacts links
  - Suggested suspected root cause

**R6: Chaos Testing**

- Only via explicit, safe mechanisms:
  - Proxy-based network shaping (latency, packet loss simulation)
  - Fault injection endpoints in staging
  - Feature-flag toggles
- Must not exceed configured rate limits or cause uncontrolled load.

### 8.2 Non-functional Requirements

- **Reliability:** Runs must be reproducible; record seeds and environment details.
- **Security:** Secrets stored securely; no logging of credentials; redaction in artifacts.
- **Cost controls:** Hard caps on test runtime, browser sessions, and chaos intensity.
- **Observability:** Traces, run IDs, metadata, artifact retention policies.
- **Speed:** Fast smoke suite for PRs; deeper suites scheduled.

## 9) Architecture (Conceptual)

### Components

1. **Orchestrator (Gemini Agent)**
   - Plans, schedules, triages
2. **Browser Runner**
   - Playwright/Selenium-like executor
3. **Artifact Collector**
   - Screenshots, video, logs, HAR, traces
4. **Test Repository**
   - Suites + fixtures + environment configs
5. **Chaos Controller**
   - Proxy / fault injection toggles
6. **Integrations**
   - GitHub/GitLab CI, Slack, Jira/Linear, webhook API

### Data Flow

Trigger → Orchestrator selects suite → Runner executes → Collector stores artifacts → Orchestrator summarizes + files tickets.

## 10) Metrics (Success Criteria)

- **Regression catch rate:** % of deploys/PRs where agent catches issues before users.
- **Mean time to detect (MTTD):** from commit to first detection.
- **Mean time to reproduce (MTTRp):** time for dev to reproduce from report.
- **Flake rate:** % tests failing intermittently.
- **Coverage:** # critical flows covered / total critical flows.
- **User trust:** “Would you ship if SentinelQA is green?” survey signal.

## 11) Risks + Mitigations

- **Flaky tests** → retries + stabilization heuristics + self-healing selectors.
- **Over-aggressive exploration** → destructive-action denylist + allowlist gating.
- **Cost blowups** → concurrency caps + runtime budgets + adaptive suite selection.
- **False confidence** → coverage reporting + explicit “known untested areas.”

## 12) “Ridiculous but useful” product framing

Treat the app like a living organism: SentinelQA becomes the **immune system**. It pokes, prods, stresses, and checks reflexes so your product doesn’t faint dramatically in front of users.
