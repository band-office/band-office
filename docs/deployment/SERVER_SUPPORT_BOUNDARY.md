# Server Ownership and Support Boundary

Band Office is free, open-source application software. A public family portal still requires operated infrastructure.

The Server channel distributes alpha application images and operator runbooks. A district may activate real family accounts after completing its acceptance and approval process, but this does not convert open-source software into a hosted or guaranteed service.

## District or hosting operator

The operator owns:

- approval of the server and data location;
- Linux, Docker, firewall, DNS, and HTTPS availability;
- SMTP authorization and credential rotation;
- disk encryption, backup scheduling, restore drills, and retention;
- operating-system and container updates;
- incident response and staff-offboarding access;
- monitoring that the application, worker, and certificate remain healthy.

## Band director

The director owns:

- program records and staff-account administration;
- student and guardian data quality;
- guardian/student relationship accuracy;
- portal account activation and deactivation;
- email audiences, content, and approval;
- encrypted program exports at rollover and other required checkpoints;
- escalation to IT instead of attempting infrastructure workarounds.

## Band Office project

For each Server release, the open-source project provides:

- application source and reviewed release artifacts;
- deployment templates and operating documentation;
- migration behavior and release notes;
- issue intake under the repository's published support posture.

The project does not operate a school's server, guarantee email delivery, hold district credentials, monitor an installation, sign a district agreement, or provide emergency response unless a separate hosting and support organization is established.

## Required handoff

Every installation must record:

- public hostname;
- infrastructure owner and backup owner;
- director owner;
- deployment directory and approved backup location;
- installed Band Office image tag and digest;
- SMTP account owner;
- date of the last successful restore drill;
- procedure for transferring access when the director or IT owner leaves.

If no person accepts the infrastructure and backup responsibilities, deploy Band Office Desktop without public portals. Do not quietly make the director the server administrator.
