import { sanitizeMetadata, logger } from "../logger";
import { getCorrelationId, generateCorrelationId } from "../correlation";
import {
  ValidationError,
  AuthError,
  NotFoundError,
  createErrorResponse,
} from "../errors";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runObservabilitySelfTest() {
  console.log("--> Running Observability self-tests...");

  // 1. Test correlation ID generation and extraction
  const randomId = generateCorrelationId();
  assert(typeof randomId === "string" && randomId.length > 0, "Correlation ID generation failed");

  const headers = new Headers();
  headers.set("x-request-id", "test-req-123");
  const extractedId = getCorrelationId(headers);
  assert(extractedId === "test-req-123", "Extraction of x-request-id header failed");

  // 2. Test metadata redaction
  const dirtyMeta = {
    user: "John",
    password: "secretpassword123",
    auth: "Bearer abc123token",
    nested: {
      otp: "123456",
      r2_secret_access_key: "r2secret",
      safe: "public-value",
    },
  };

  const cleanMeta = sanitizeMetadata(dirtyMeta) as {
    user: string;
    password: string;
    auth: string;
    nested: {
      otp: string;
      r2_secret_access_key: string;
      safe: string;
    };
  };
  assert(cleanMeta.password === "[REDACTED]", "Password key was not redacted");
  assert(cleanMeta.auth === "[REDACTED]", "Auth key was not redacted");
  assert(cleanMeta.nested.otp === "[REDACTED]", "Nested OTP key was not redacted");
  assert(cleanMeta.nested.r2_secret_access_key === "[REDACTED]", "Nested R2 secret key was not redacted");
  assert(cleanMeta.nested.safe === "public-value", "Safe metadata key was altered");

  // 3. Test AppError subclasses
  const valErr = new ValidationError("Invalid payload");
  assert(valErr.code === "VALIDATION_ERROR" && valErr.statusCode === 400, "ValidationError hierarchy error");

  const authErr = new AuthError("Unauthorized");
  assert(authErr.code === "UNAUTHENTICATED" && authErr.statusCode === 401, "AuthError hierarchy error");

  const nfErr = new NotFoundError("Not found");
  assert(nfErr.code === "NOT_FOUND" && nfErr.statusCode === 404, "NotFoundError hierarchy error");

  // 4. Test error response creator
  const response = createErrorResponse(valErr, "corr-456", "TestComponent");
  assert(response.status === 400, "createErrorResponse status code mismatch");
  
  const body = await response.json();
  assert(body.error.code === "VALIDATION_ERROR", "Response body error code mismatch");
  assert(body.error.message === "Invalid payload", "Response body message mismatch");
  assert(body.error.correlationId === "corr-456", "Response body correlation ID mismatch");

  // 5. Test logger execution without throw
  logger.info("Observability self-test info", { component: "SelfTest", password: "secret" });
  logger.warn("Observability self-test warn", { component: "SelfTest" });
  logger.error("Observability self-test error", { component: "SelfTest" }, new Error("Test err"));

  console.log("✓ All Observability self-tests passed cleanly!");
}

runObservabilitySelfTest().catch((err) => {
  console.error("Observability self-test failed:", err);
  process.exit(1);
});
