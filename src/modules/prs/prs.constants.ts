export const PRS_RESPONSE_MESSAGE = {
  PR_CREATED: "PR created successfully",
  PRS_FETCHED: "PRs fetched successfully",
  PR_STATUS_UPDATED: "PR status updated successfully",
  PR_ASSIGNED: "PR reviewer assigned successfully",
  PR_RELEASE_MODE_UPDATED: "PR release mode updated successfully"
} as const;

export const PRS_ERROR_MESSAGE = {
  PR_NOT_FOUND: "PR not found",
  REVIEWER_NOT_FOUND: "Reviewer not found",
  REVIEWER_MUST_BE_ACTIVE: "Reviewer must be an active user",
  REVIEWER_MUST_HAVE_REVIEW_PERMISSION: "Reviewer must have CAN_REVIEW_PR permission",
  INVALID_STATUS_TRANSITION: "Invalid PR status transition",
  FORBIDDEN_PR_ACCESS: "You are not allowed to modify this PR"
} as const;
