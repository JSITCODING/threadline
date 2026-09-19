# Security model

## Protected assets

- Conversation exports and attachments.
- Markdown vault contents.
- Provider credentials.
- Normalized local database.
- Proposals, snapshots, and audit history.

## Trust boundaries

- Imported data is untrusted input.
- Model output is untrusted input.
- A proposal is not authorization.
- An approval authorizes one exact target and base hash.
- The configured real vault root is the only writable boundary.

## Enforced properties

- Targets must be existing relative `.md` files.
- Absolute paths, `.`/`..` segments, and symbolic-link targets are rejected.
- The resolved real target must remain inside the resolved real vault root.
- Apply requires `approved` status and matching content hash.
- A private snapshot is written before the atomic target replacement.
- Rollback requires the post-apply hash to remain unchanged.
- Optional providers fail closed and never run implicitly.

## Known limitations

- Sensitivity detection is a conservative keyword heuristic, not a privacy guarantee.
- Manual proposal content must still be reviewed for names and private detail.
- Application-storage encryption is delegated to the operating system in v0.1.
- Zip extraction is not supported; users point Threadline at the exported `conversations.json` file.
