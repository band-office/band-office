# Contributing to Band Office

Thank you for helping build practical, open-source operations software for school music programs.

Band Office welcomes contributions from educators, students, developers, self-hosters, accessibility reviewers, documentation writers, and school technology teams. You do not need to be a professional software developer to improve the project.

## Before you begin

Read:

- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Current status](./CURRENT_STATUS.md)
- [Roadmap](./ROADMAP.md)
- [Security policy](./SECURITY.md)
- [Product decisions](./DECISIONS.md)

For a bug or bounded improvement, open an issue using the relevant template. For a large feature, data-model change, new external service, or change to a privacy boundary, discuss the proposal before writing code.

## Local development

Requires Node.js 20.9 or newer.

```bash
npm install
npm run db:deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To load the deterministic Ridgeline demo into a new empty database:

```bash
npm run db:init
```

`db:init` is destructive. Never run it against a database containing real program data.

## Test data and privacy

Do not use real student, guardian, staff, payment, contact, or school records in issues, screenshots, fixtures, recordings, or pull requests.

Use the deterministic demo data or clearly fictional records. Remove secrets, local paths, tokens, email credentials, and backup files before attaching evidence.

Changes that affect permissions, exports, uploads, authentication, backups, family access, email, or audit history should include tests for the relevant boundary.

## Making a change

1. Create a focused branch from `main`.
2. Keep the change as small as the issue allows.
3. Add or update tests and documentation.
4. Run the relevant local checks.
5. Open a pull request using the template and link the issue.

For most code changes:

```bash
npm run lint
npm test
npm run build
```

For workflow, UI, permissions, migration, backup, packaging, or deployment changes, also run the applicable browser, desktop, server, or release checks described in the pull request template.

The full release gate is:

```bash
npm run release:verify
```

## Pull request expectations

A strong pull request:

- explains the school-program problem being solved;
- states what changed and what deliberately did not;
- includes verification evidence;
- calls out schema, privacy, permission, migration, backup, or deployment effects;
- updates user-facing documentation when behavior changes;
- avoids unrelated formatting or dependency churn.

Maintainers may ask for a smaller change, more evidence, or an issue-first design discussion. That is a scope and stewardship decision, not a judgment of the contributor.

## Ways to contribute without code

- Reproduce a bug with fictional data.
- Improve setup or operator documentation.
- Review language for band-director clarity.
- Test keyboard, screen-reader, print, and mobile behavior.
- Suggest bounded reports or workflows grounded in a real school music task.
- Help classify issues or verify a fix.

By contributing, you agree that your contribution is submitted under the repository’s Apache-2.0 license.
