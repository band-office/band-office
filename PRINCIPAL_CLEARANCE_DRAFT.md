# Principal Clearance Draft

Subject: Request to pilot local asset-tracking tool for band inventory

Hi [Principal Name],

I would like to pilot a local inventory tool called BandOS for the band program's school-owned instruments, uniforms, and equipment.

What it stores:

- student first and last name
- grade
- band section/instrument
- optional school student ID if needed for reconciliation
- assigned school-owned assets
- checkout and check-in dates
- expected return dates
- asset condition snapshots
- whether the paper checkout agreement is on file
- repair records for school-owned assets

What it does not store:

- parent or guardian contact information in the initial version
- home addresses
- birthdates
- medical information
- allergy or medication information
- disciplinary records
- grades, GPA, eligibility, IEP, or 504 information
- student photos
- payment information

Where it runs:

- locally on a district-managed, disk-encrypted machine
- with the database stored as a local SQLite file
- with backups stored only on district-approved storage

What it does not do:

- it does not send email or text messages
- it does not collect payments
- it does not provide parent or student portals
- it does not make external network calls during normal runtime
- it does not send student records to AI tools or outside services

Purpose:

The goal is to replace the current band-room asset spreadsheet with a clearer checkout, check-in, repair, and year-end inventory record for school-owned property.

Please let me know if you are comfortable with me piloting this locally for band inventory, or if there is a district approval step I should complete first.

Thank you,

Joshua
