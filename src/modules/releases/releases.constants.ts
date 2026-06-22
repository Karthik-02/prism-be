export const RELEASE_RESPONSE_MESSAGE = {
  RELEASE_CREATED: "Release created successfully",
  RELEASES_FETCHED: "Releases fetched successfully",
  RELEASE_UPDATED: "Release updated successfully",
  RELEASE_DELETED: "Release deleted successfully",
  RELEASE_PR_ADDED: "PR linked to release successfully",
  RELEASE_PR_REMOVED: "PR removed from release successfully",
  RELEASE_DATE_SET: "Release date updated successfully"
} as const;

export const RELEASE_ERROR_MESSAGE = {
  RELEASE_NOT_FOUND: "Release not found",
  RELEASE_ENV_MISMATCH: "Release environment not eligible for this action",
  PR_ALREADY_LINKED: "PR already linked to this release",
  PR_NOT_LINKED: "PR not linked to this release",
  PR_NOT_ELIGIBLE: "PR is not eligible for this release",
  CUTOFF_REQUIRED: "Cutoff time is required for releases",
  CUTOFF_EXCEEDED: "Release cutoff time has passed"
} as const;
