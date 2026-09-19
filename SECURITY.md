# Security Policy

Do not report vulnerabilities using public issues when a report contains real conversation content, vault paths, credentials, or personal data.

## Security properties

- Real conversation exports and vault contents stay local.
- Writes remain contained within the configured real vault root.
- Proposals require explicit approval and a matching base hash.
- Snapshots precede writes and support rollback.
- Providers never run unless selected explicitly.

## Out of scope for v0.1

- Multi-user or remote service deployment.
- Automatic background writes.
- Deleting, moving, or renaming vault content.
- Treating model output as trusted input.

See `docs/security/security-model.md` for the implementation boundary.
