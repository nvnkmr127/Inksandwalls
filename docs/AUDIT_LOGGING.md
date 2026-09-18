# Audit Logging Architecture

## 1. Overview & Purpose

The Audit Logging system provides centralized, server-side, tamper-evident recording of security, authentication, and administrative actions across INKs & Walls.

It answers the key operational questions:
- **Who** performed the action? (`actorUserId`)
- **What** action occurred? (`action`)
- **Which** resource was affected? (`resourceType`, `resourceId`)
- **When** did it happen? (`createdAt` server UTC timestamp)
- **What request/context** was associated? (`ipAddress`, `userAgent`, `metadata`)

---

## 2. Audit vs Application Logs

| Dimension | Application Logs (`src/lib/logger.ts`) | Audit Logs (`AuditLog` Prisma Model) |
|---|---|---|
| **Purpose** | Debugging, system operational health, stack traces, errors | Accountability, security history, compliance, state-change traceability |
| **Storage** | `stdout`/`stderr` JSON logs (Railway/Sentry) | Persistent PostgreSQL `audit_logs` database table |
| **Audience** | Developers and DevOps engineers | System administrators, security teams, compliance officers |
| **Retention** | Ephemeral / Log aggregator rotation | Indexed database table with long-term retention |

---

## 3. Database Schema

The `AuditLog` model is defined in `prisma/schema.prisma`:

```prisma
model AuditLog {
  id           String   @id @default(cuid())
  actorUserId  String?  @map("actor_user_id")
  action       String
  resourceType String   @map("resource_type")
  resourceId   String?  @map("resource_id")
  metadata     Json?
  ipAddress    String?  @map("ip_address")
  userAgent    String?  @map("user_agent")
  createdAt    DateTime @default(now()) @map("created_at")

  actorUser User? @relation(fields: [actorUserId], references: [id], onDelete: SetNull)

  @@index([createdAt])
  @@index([actorUserId])
  @@index([action])
  @@index([resourceType])
  @@index([resourceType, resourceId])
  @@map("audit_logs")
}
```

---

## 4. Action & Resource Naming Conventions

Actions use structured, uppercase, snake-case identifiers defined in `src/lib/audit/actions.ts`:

### Actions (`AUDIT_ACTIONS`)
- `AUTH_LOGIN`
- `AUTH_LOGOUT`
- `AUTH_OTP_REQUESTED`
- `AUTH_OTP_VERIFIED`
- `AUTH_OTP_FAILED`
- `USER_CREATED`
- `USER_UPDATED`
- `USER_ROLE_CHANGED`
- `USER_SUSPENDED`
- `USER_REACTIVATED`

### Resource Types (`AUDIT_RESOURCE_TYPES`)
- `AUTHENTICATION`
- `USER`
- `CUSTOMER`

---

## 5. Actor Resolution & Security

- **Server-Derived Identity**: The `actorUserId` field is populated exclusively on the server from authenticated Auth.js sessions or trusted database operations.
- **Client Spoofing Protection**: The audit service NEVER accepts an `actorUserId` submitted from the client browser.
- **System Events**: Automated background operations or pre-authentication steps log `actorUserId: null`. System actions are distinct from user actions.

---

## 6. Metadata Security & Denylist Sanitization

All metadata passed to `recordAuditEvent` undergoes defensive recursive sanitization (`sanitizeAuditMetadata`).

### Automatically Redacted Keys:
`otp`, `otpCode`, `otpHash`, `password`, `accessToken`, `refreshToken`, `clientSecret`, `apiKey`, `authorization`, `cookie`, `secret`, `credentials`, `creditCard`, `cvv`.

Values matching these keys are automatically redacted to `"[REDACTED]"` before writing to PostgreSQL.

---

## 7. IP Address & User-Agent Handling

- **IP Address**: Extracted from proxy headers (`x-forwarded-for` first hop or `x-real-ip`).
- **User-Agent**: Captured from `user-agent` request header and truncated to a maximum length of 512 characters.

---

## 8. Transaction & Failure Policy

- **Transactional Integrity**: When an audited database mutation occurs (such as creating a user or updating a user role), `recordAuditEvent` accepts the active Prisma transaction client (`tx`). If the underlying mutation fails, the audit record write rolls back automatically.
- **Error Handling**: Audit logging failures outside transactions write technical error details to `logger.error` without exposing raw database errors or crashing public API responses.

---

## 9. Indexes & Future Retention

- **Indexes**: Indexed on `createdAt`, `actorUserId`, `action`, `resourceType`, and composite `[resourceType, resourceId]` for fast administrative filtering.
- **Retention**: Current phase stores all audit logs indefinitely. Automated archive/pruning jobs will be specified in future operational phases.

---

## 10. Server-Only Boundary

The audit module is marked with `import "server-only";` and is never exported to client-side bundles.
