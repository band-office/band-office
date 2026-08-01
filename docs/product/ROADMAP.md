# Band Office roadmap

This roadmap describes direction, not a delivery promise. Release truth lives in [CURRENT_STATUS.md](../release/CURRENT_STATUS.md).

## Now: harden the public alphas

- Complete clean-machine Desktop install, backup, restore, upgrade, and uninstall acceptance, including normal launch of the notarized Mac apps and the SmartScreen flow on Windows.
- Confirm that a nondeveloper can follow the current platform and recovery instructions without assistance.
- Complete the first district-owned Server public-edge, SMTP, portal, upgrade, rollback, and restore acceptance record.
- Keep CodeQL, dependency audits, container scanning, release attestations, and required pull-request checks green.
- Turn public issues and pilot findings into bounded reliability, accessibility, and documentation work.
- Maintain Developer ID signing and Apple notarization for each Mac alpha. Defer Microsoft signing until adoption warrants its recurring cost; Windows remains unsigned in the current alpha.

## Next: make adoption repeatable

- Turn pilot findings into bounded reliability and usability work.
- Tighten install, upgrade, rollback, and backup documentation from operator evidence.
- Improve accessibility and keyboard acceptance across core workflows.
- Establish a repeatable issue-triage and contributor-onboarding cadence.
- Publish stable releases only after desktop and server gates are reproducible.
- Add small integrations only where credentials, data ownership, and failure behavior are explicit.

## Later: deepen school music workflows

Potential work includes more capable family form submission, carefully bounded guardian permissions, household accounting, and provider adapters for school communication environments.

Each proposal still requires issue-first scope, privacy analysis, permission rules, migration and backup behavior, and real workflow evidence.

## Not on the current roadmap

- Payment processing or storage of card or bank credentials
- Medical, disciplinary, birthdate, address, or student-photo records
- A casual expansion into drill-design or Pyware replacement
- Unreviewed public hosting shortcuts
- A claim to replace every CutTime or Charms workflow
- Commercial SaaS positioning
