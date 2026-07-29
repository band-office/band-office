# Band Office brand guide

Band Office is an open-source operations project for school music programs. Its identity should feel capable, practical, welcoming, and accountable to the educators and communities it serves.

This guide extends the approved Band Office mark into repository and contributor surfaces. It does not redesign the logo.

## Identity

### Name

- Product: **Band Office**
- Repository and package: **`band-office`**
- Descriptor: **Open-source operations for school music programs.**

Use “Band Office” in prose. Use `band-office` only where a repository, package, command, or technical identifier requires it.

### Logo

The approved mark is a dark navy rounded square containing the white stylized B. Use the existing source files without redrawing, stretching, rotating, outlining, recoloring, or adding effects.

- Primary mark: [`public/brand/band-office-mark.png`](../../public/brand/band-office-mark.png)
- Reverse mark: [`public/brand/band-office-mark-reverse.png`](../../public/brand/band-office-mark-reverse.png)
- GitHub avatar: [`github/avatar-1024.png`](./github/avatar-1024.png)

The reverse mark is only for dark application surfaces where the primary navy tile would lose its edge. GitHub avatars and general project identification should use the primary mark.

### Clear space and minimum size

- Keep clear space around the mark equal to at least one eighth of its displayed width.
- Do not display the primary mark below 32 × 32 pixels.
- At small sizes, use the mark without the wordmark or descriptor.

## Visual system

| Token | Hex | Use |
| --- | --- | --- |
| Midnight | `#08172B` | Identity backgrounds and dark navigation |
| Deep midnight | `#04101F` | Depth and large background fields |
| Operational blue | `#2563EB` | Actions, links, and active states |
| Light blue | `#93C5FD` | Supporting type and restrained highlights |
| Paper | `#F8FAFC` | Light surfaces |
| Slate | `#A9B8CC` | Secondary type on dark surfaces |
| White | `#FFFFFF` | Primary type and the B symbol |

Green remains a status color for success, availability, and completion. It is not a primary identity color.

Band Office uses Inter Variable in the application, with system sans-serif fallbacks. GitHub artwork uses a bold sans-serif wordmark and a clear supporting hierarchy.

The quiet horizontal-line motif in GitHub artwork is a structural reference to both music staff lines and operational ledgers. Keep it subtle. Do not add stock instrument illustrations, marching-band silhouettes, gradients in school colors, or decorative music notes.

## Voice

Write for working educators first and technical contributors second.

- Be specific about what the software does.
- State release and support boundaries plainly.
- Prefer “school music programs” when the point applies beyond marching or concert band.
- Use “local-first” and “self-hosted” accurately; do not imply that either removes the need for district security, backups, or approval.
- Avoid disruption language, commercial comparison copy, and claims that Band Office replaces every incumbent workflow.

Good:

> Keep people, property, events, forms, and program records under your program’s control.

Avoid:

> The all-in-one revolutionary platform transforming the future of band management.

## GitHub assets

| File | Intended use |
| --- | --- |
| [`github/readme-hero.png`](./github/readme-hero.png) | Main repository README |
| [`github/social-preview.png`](./github/social-preview.png) | Repository social preview upload |
| [`github/organization-banner.png`](./github/organization-banner.png) | Organization profile README |
| [`github/avatar-1024.png`](./github/avatar-1024.png) | Organization avatar |

Editable SVG compositions sit beside the PNG exports. They reference the adjacent exact-mark avatar raster rather than tracing or reinterpreting it.

Regenerate all GitHub artwork and optimized product screenshots with:

```bash
npx playwright install chromium
npm run brand:github
```

The generator intentionally reads the approved production mark and creates an isolated `data/brand.db` from deterministic fictional Ridgeline records. If the source mark changes through an approved brand process, rerunning the command updates every GitHub surface consistently.
