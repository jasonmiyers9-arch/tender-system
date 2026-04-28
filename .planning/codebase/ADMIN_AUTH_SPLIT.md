# Admin Auth Split

Date: 2026-04-28

Goal:
- Treat admin users as internal platform staff, not external self-service users.

Decisions:
- Public `/login` accepts company and tender-provider users only.
- New `/admin/login` is the dedicated internal admin entry point.
- Public `/register` no longer exposes or accepts the `admin` role.
- Admin moderation pages focus on external accounts and exclude internal admins.
- `robots.txt` blocks indexing for admin and auth entry points.

Current limitation:
- Internal admin account provisioning is still out-of-band; this change separates access but does not add an in-product admin creation workflow.
