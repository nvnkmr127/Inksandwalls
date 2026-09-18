import assert from "node:assert";
import { recordAuditEvent, sanitizeAuditMetadata, extractRequestContext } from "../audit";
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "../actions";

async function runAuditTests() {
  console.log("Running Audit Log System Tests...");

  // 1. Test Metadata Sanitization & Security Denylist
  const sensitiveInput = {
    otp: "123456",
    otpHash: "abc123hash",
    password: "SuperSecretPassword123!",
    accessToken: "bearer_token_xyz",
    refreshToken: "refresh_token_abc",
    apiKey: "key_live_12345",
    secret: "top_secret_key",
    authorization: "Bearer secret_header",
    cookie: "session_cookie=abc",
    user: {
      name: "John Doe",
      email: "john@example.com",
      credentials: "user_pass",
    },
    safeField: "this_is_safe",
    role: "STORE_ADMIN",
  };

  const sanitized = sanitizeAuditMetadata(sensitiveInput) as Record<string, unknown>;

  assert.strictEqual(sanitized.otp, "[REDACTED]", "OTP should be redacted");
  assert.strictEqual(sanitized.otpHash, "[REDACTED]", "otpHash should be redacted");
  assert.strictEqual(sanitized.password, "[REDACTED]", "Password should be redacted");
  assert.strictEqual(sanitized.accessToken, "[REDACTED]", "accessToken should be redacted");
  assert.strictEqual(sanitized.refreshToken, "[REDACTED]", "refreshToken should be redacted");
  assert.strictEqual(sanitized.apiKey, "[REDACTED]", "apiKey should be redacted");
  assert.strictEqual(sanitized.secret, "[REDACTED]", "secret should be redacted");
  assert.strictEqual(sanitized.authorization, "[REDACTED]", "authorization should be redacted");
  assert.strictEqual(sanitized.cookie, "[REDACTED]", "cookie should be redacted");
  
  const nestedUser = sanitized.user as Record<string, unknown>;
  assert.strictEqual(nestedUser.credentials, "[REDACTED]", "Nested credentials should be redacted");
  assert.strictEqual(nestedUser.name, "John Doe", "Nested safe name should be preserved");
  assert.strictEqual(sanitized.safeField, "this_is_safe", "Safe metadata field should be preserved");
  assert.strictEqual(sanitized.role, "STORE_ADMIN", "Role metadata field should be preserved");

  console.log("✔ Metadata sanitization test passed");

  // 2. Test Request Context Extraction & User-Agent Truncation
  const headers = new Headers();
  headers.set("x-forwarded-for", "203.0.113.195, 70.41.3.18");
  const longUserAgent = "Mozilla/5.0 ".repeat(60); // > 512 chars
  headers.set("user-agent", longUserAgent);

  const context = extractRequestContext(headers);
  assert.strictEqual(context.ipAddress, "203.0.113.195", "Should extract first client IP from x-forwarded-for");
  assert.strictEqual(context.userAgent?.length, 512, "User agent should be truncated to max 512 characters");

  console.log("✔ Request context extraction test passed");

  // 3. Test Mock Audit Record Persistence API Call
  const mockCreatedRecords: Array<Record<string, unknown>> = [];
  const mockDbClient = {
    auditLog: {
      async create(args: { data: Record<string, unknown> }) {
        mockCreatedRecords.push(args.data);
        return { id: "audit_123", ...args.data };
      },
    },
  };

  const auditRecord = await recordAuditEvent(
    {
      actorUserId: "usr_actor_1",
      action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: "usr_target_2",
      metadata: { previousRole: "CUSTOMER", newRole: "STORE_ADMIN", secretCode: "1234" },
      ipAddress: "192.168.1.1",
      userAgent: "TestAgent/1.0",
    },
    mockDbClient as unknown as Parameters<typeof recordAuditEvent>[1]
  );

  assert.ok(auditRecord, "Audit record should be created");
  assert.strictEqual(mockCreatedRecords.length, 1, "Should push 1 record to mock DB");
  const created = mockCreatedRecords[0];
  assert.strictEqual(created.actorUserId, "usr_actor_1");
  assert.strictEqual(created.action, "USER_ROLE_CHANGED");
  assert.strictEqual(created.resourceType, "USER");
  assert.strictEqual(created.resourceId, "usr_target_2");
  assert.strictEqual(created.ipAddress, "192.168.1.1");
  assert.strictEqual(created.userAgent, "TestAgent/1.0");
  assert.ok(created.createdAt instanceof Date, "Timestamp should be server generated Date instance");

  const meta = created.metadata as Record<string, unknown>;
  assert.strictEqual(meta.previousRole, "CUSTOMER");
  assert.strictEqual(meta.newRole, "STORE_ADMIN");
  assert.strictEqual(meta.secretCode, "[REDACTED]", "secretCode in metadata must be redacted");

  console.log("✔ Audit record creation and mock persistence test passed");

  // 4. Test Transactional Error Handling
  const failingTxClient = {
    auditLog: {
      async create() {
        throw new Error("DB Transaction Constraint Violation");
      },
    },
  };

  let threwInTx = false;
  try {
    await recordAuditEvent(
      {
        actorUserId: "usr_123",
        action: AUDIT_ACTIONS.USER_CREATED,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
      },
      failingTxClient as unknown as Parameters<typeof recordAuditEvent>[1]
    );
  } catch (err) {
    threwInTx = true;
    assert.strictEqual((err as Error).message, "DB Transaction Constraint Violation");
  }

  assert.strictEqual(threwInTx, true, "Failure during transactional audit log creation must rethrow to roll back transaction");

  console.log("✔ Transactional error handling test passed");

  console.log("ALL AUDIT LOG SYSTEM TESTS PASSED SUCCESSFULLY!");
}

runAuditTests().catch((err) => {
  console.error("Audit System Test Failure:", err);
  process.exit(1);
});
