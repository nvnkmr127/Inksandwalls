export type AuditAction =
  | "AUTH_LOGIN"
  | "AUTH_LOGOUT"
  | "AUTH_OTP_REQUESTED"
  | "AUTH_OTP_VERIFIED"
  | "AUTH_OTP_FAILED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_ROLE_CHANGED"
  | "USER_SUSPENDED"
  | "USER_REACTIVATED";

export type AuditResourceType =
  | "AUTHENTICATION"
  | "USER"
  | "CUSTOMER";

export interface RequestContextInput {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface RecordAuditEventInput {
  actorUserId?: string | null;
  action: AuditAction | string;
  resourceType: AuditResourceType | string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}
