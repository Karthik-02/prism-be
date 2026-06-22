declare module "@prisma/client" {
  export class PrismaClient {
    constructor(config?: { log?: Array<{ emit: "event"; level: "warn" | "error" }> });

    $transaction<T>(fn: (client: Prisma.TransactionClient) => Promise<T>): Promise<T>;
    $executeRaw<T = any>(query: string, ...values: any[]): Promise<T>;
    $executeRaw<T = any>(template: TemplateStringsArray, ...values: any[]): Promise<T>;
    $queryRaw<T = any>(query: string, ...values: any[]): Promise<T>;
    $queryRaw<T = any>(template: TemplateStringsArray, ...values: any[]): Promise<T>;
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $on(event: "warn" | "error", callback: (event: { level: string; message: string; target?: string }) => void): void;
    readonly __private: symbol;
    [key: string]: any;

    user: any;
    emailDomain: any;
    otpToken: any;
    authSession: any;
    role: any;
    permission: any;
    rolePermission: any;
    userRole: any;
    pr: any;
    release: any;
    releasePrMap: any;
    releaseNote: any;
    auditLog: any;
    notificationLog: any;
  }

  export namespace Prisma {
    export type TransactionClient = PrismaClient;
    export type JsonValue = any;
    export type InputJsonValue = JsonValue;
    export type PrismaPromise<T> = Promise<T>;
    export type UserUpdateInput = Partial<User>;
    export type RoleUpdateInput = Partial<Role>;
    export type PrWhereInput = any;
  }

  export enum UserStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    PENDING_VERIFICATION = "PENDING_VERIFICATION",
    DISAPPROVED = "DISAPPROVED"
  }

  export enum DomainStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE"
  }

  export enum PrStatus {
    SUBMITTED = "SUBMITTED",
    UNDER_REVIEW = "UNDER_REVIEW",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    REREVIEW = "REREVIEW",
    DEPLOYED = "DEPLOYED"
  }

  export enum PrType {
    FEATURE = "FEATURE",
    ENHANCEMENT = "ENHANCEMENT",
    BUG = "BUG"
  }

  export enum ReleaseEnvironment {
    STAGING = "STAGING",
    PRODUCTION = "PRODUCTION",
    UAT = "UAT"
  }

  export enum ReleaseStatus {
    CREATED = "CREATED",
    SCHEDULED = "SCHEDULED",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED"
  }

  export enum ReleaseLinkMode {
    MANUAL = "MANUAL",
    AUTO = "AUTO"
  }

  export enum ReleasePrSource {
    MANUAL = "MANUAL",
    AUTO = "AUTO"
  }

  export enum ReleaseNoteScope {
    FULL = "FULL",
    OWN = "OWN"
  }

  export enum NotificationStatus {
    SENT = "SENT",
    FAILED = "FAILED"
  }

  export interface UserRole {
    userId: string;
    roleId: string;
    createdAt: Date;
    user?: User;
    role?: Role;
  }

  export interface RolePermission {
    roleId: string;
    permissionId: string;
    createdAt: Date;
    permission?: Permission;
    role?: Role;
  }

  export interface Permission {
    id: string;
    key: string;
    description?: string | null;
    createdAt: Date;
    rolePermissions?: RolePermission[];
  }

  export interface Role {
    id: string;
    name: string;
    description?: string | null;
    createdBy: string;
    createdAt: Date;
    creator?: User;
    rolePermissions?: RolePermission[];
    userRoles?: UserRole[];
  }

  export interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    githubUserId: string;
    status: UserStatus;
    createdAt: Date;
    updatedAt: Date;
    createdRoles?: Role[];
    userRoles?: UserRole[];
    ownedPrs?: Pr[];
    reviewAssignedPrs?: Pr[];
    createdReleases?: Release[];
    authSessions?: AuthSession[];
    performedAuditLogs?: AuditLog[];
    receivedLogs?: NotificationLog[];
    createdEmailDomains?: EmailDomain[];
    addedReleasePrMaps?: ReleasePrMap[];
    ownedReleaseNotes?: ReleaseNote[];
    createdReleaseNotes?: ReleaseNote[];
    updatedReleaseNotes?: ReleaseNote[];
  }

  export interface EmailDomain {
    id: string;
    domain: string;
    status: DomainStatus;
    createdBy: string;
    createdAt: Date;
    creator?: User;
  }

  export interface OtpToken {
    id: string;
    email: string;
    otp: string;
    expiresAt: Date;
    used: boolean;
    createdAt: Date;
  }

  export interface AuthSession {
    id: string;
    userId: string;
    tokenId: string;
    expiresAt: Date;
    revokedAt?: Date | null;
    revokedReason?: string | null;
    createdAt: Date;
    updatedAt: Date;
    user?: User;
  }

  export interface Pr {
    id: string;
    ownerId: string;
    repo: string;
    branch: string;
    prLink: string;
    reviewerId?: string | null;
    status: PrStatus;
    type: PrType;
    zohoLink?: string | null;
    deployedFlag: boolean;
    comments: string;
    releaseMode: ReleaseLinkMode;
    createdAt: Date;
    updatedAt: Date;
    owner?: User;
    reviewer?: User | null;
    releasePrMap?: ReleasePrMap[];
  }

  export interface Release {
    id: string;
    environment: ReleaseEnvironment;
    status: ReleaseStatus;
    name: string;
    releaseDate?: Date | null;
    cutoffAt?: Date | null;
    createdBy: string;
    createdAt: Date;
    creator?: User;
    releasePrMap?: ReleasePrMap[];
    releaseNotes?: ReleaseNote[];
  }

  export interface ReleasePrMap {
    releaseId: string;
    prId: string;
    addedBy?: string | null;
    source: ReleasePrSource;
    createdAt: Date;
    release?: Release;
    pr?: Pr;
    addedByUser?: User | null;
  }

  export interface ReleaseNote {
    id: string;
    releaseId: string;
    ownerId?: string | null;
    scope: ReleaseNoteScope;
    content: string;
    other?: Prisma.JsonValue | null;
    version: number;
    createdBy: string;
    updatedBy: string;
    createdAt: Date;
    updatedAt: Date;
    release?: Release;
    owner?: User | null;
    creator?: User;
    updater?: User;
  }

  export interface AuditLog {
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    performedBy: string;
    metadata?: Prisma.JsonValue | null;
    createdAt: Date;
    performer?: User;
  }

  export interface NotificationLog {
    id: string;
    eventType: string;
    recipientId: string;
    status: NotificationStatus;
    createdAt: Date;
    recipient?: User;
  }
}
