# GitHub launch checklist

This checklist separates changes already represented in the repository from GitHub settings that require organization-owner access.

## Organization profile

- [ ] Set display name to `Band Office`.
- [ ] Set description to `Open-source operations for school music programs.`
- [ ] Upload `docs/brand/github/avatar-1024.png` as the organization avatar.
- [ ] Create a public repository named `.github`.
- [ ] Publish the prepared `profile/README.md` and organization banner in that repository.
- [ ] Pin `band-office/band-office` to the organization overview.
- [ ] Add a public contact method only when someone is committed to monitoring it.

## Main repository metadata

- [x] Description: `Open-source operations for school music programs.`
- [ ] Upload `docs/brand/github/social-preview.png` as the social preview.
- [ ] Add repository topics:
  - `band-director`
  - `school-music`
  - `music-education`
  - `education-technology`
  - `self-hosted`
  - `local-first`
  - `open-source`
  - `student-information`
  - `inventory-management`
  - `nextjs`
  - `typescript`
  - `sqlite`
  - `electron`
- [ ] Leave the homepage blank until a maintained public project site exists.
- [ ] Disable the wiki unless the project adopts it as an actively maintained documentation surface.
- [ ] Enable Discussions only after categories, moderation expectations, and a response owner are defined.
- [ ] Enable private vulnerability reporting.

## Repository trust and maintenance

- [ ] Add a default-branch ruleset requiring pull requests and the `quality` check from the pull-request workflow.
- [ ] Require dismissal or re-review after material changes.
- [ ] Block force pushes and branch deletion on `main`.
- [ ] Enable secret scanning and push protection where the organization plan supports them.
- [ ] Create the initial `good first issue`, `help wanted`, `documentation`, `security`, `release`, `dependencies`, and `github-actions` labels.
- [ ] Create at least three bounded contributor issues before actively recruiting contributors.
- [ ] Publish a reviewed release tag only after the gates in `CURRENT_STATUS.md` are complete.

## Final visual check

- [ ] Organization avatar is legible at 20, 40, and 80 pixels.
- [ ] Organization profile banner is not cropped on desktop or mobile.
- [ ] Repository social preview is readable in link unfurls.
- [ ] README hero and screenshots load without authentication.
- [ ] No README link points to a feature or support channel that is not live.
- [ ] Release-candidate language remains visible above download or deployment instructions.
