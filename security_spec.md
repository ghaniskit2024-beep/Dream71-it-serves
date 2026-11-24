# Security Specification — Dream-71 IT Service Nangalkot

## 1. Data Invariants
1. **Admin Authority**: Only verified Google users whose email matches `ghaniskit2024@gmail.com` (`email_verified == true`) or whose UID exists in `/admins/{uid}` may read or mutate sensitive records (`/students`, `/payments`, `/attendance`, `/inquiries`, `/instructors/{id}/private`, and writes to `/courses`, `/batches`, `/certificates`).
2. **PII Isolation**:
   - `/students` (phone, email, address) is strictly unreadable to non-admins.
   - `/inquiries` (applicant phone, email) allows public `create` with strict schema & initial status `'অপেক্ষমাণ'`, while `get`, `list`, `update`, and `delete` are admin-only.
   - `/instructors` public documents contain only `name`, `designation`, `specialty`, `experienceYears`, `active`; contact PII lives under `/instructors/{id}/private/contact` (admin-only).
   - `/certificates/{certificateId}` allows single-document `get` by exact certificate ID for public verification without exposing bulk `list` scraping.
3. **Referential & Boundary Integrity**:
   - All document IDs are validated with `^[a-zA-Z0-9_\-]+$` and `.size() <= 128`.
   - All strings enforce explicit `.size()` upper bounds.
   - `AdmissionInquiry` requires `createdAt == request.time`, valid existing `courseId`, and `status == 'অপেক্ষমাণ'` on creation.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated read on `/students/stu-1` -> DENIED (PII protection)
2. Unauthenticated list on `/inquiries` -> DENIED (Applicant PII scraping blocked)
3. Unauthenticated list on `/certificates` -> DENIED (Bulk certificate scraping blocked)
4. Public inquiry create with `status: "ভর্তি সম্পন্ন"` -> DENIED (State shortcutting blocked)
5. Public inquiry create with ghost field `isAdmin: true` -> DENIED (`keys().hasOnly()` blocks shadow fields)
6. Public inquiry create with non-existent `courseId: "fake-999"` -> DENIED (`exists()` relational check)
7. Public inquiry create with forged `createdAt` timestamp != `request.time` -> DENIED (Temporal integrity)
8. Unauthenticated write to `/courses/crs-1` -> DENIED (Admin only)
9. Non-admin verified user write to `/admins/{uid}` -> DENIED (Self-assigned privilege escalation blocked)
10. Unverified email spoofing `email: "ghaniskit2024@gmail.com"` with `email_verified: false` -> DENIED
11. Resource poisoning with 2KB document ID `/inquiries/<2000_chars>` -> DENIED (`isValidId`)
12. Instructor public document read exposing `phone`/`email` -> DENIED (Split collection isolation)
