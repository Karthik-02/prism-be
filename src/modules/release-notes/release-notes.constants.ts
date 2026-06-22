export const RELEASE_NOTES_RESPONSE_MESSAGE = {
  RELEASE_NOTES_FETCHED: "Release notes fetched successfully",
  RELEASE_NOTES_GENERATED: "Release notes generated successfully",
  RELEASE_NOTES_UPDATED: "Release notes updated successfully"
} as const;

export const RELEASE_NOTES_ERROR_MESSAGE = {
  RELEASE_NOT_FOUND: "Release not found",
  RELEASE_NOTE_NOT_FOUND: "Release note not found",
  VERSION_CONFLICT: "Release note version conflict",
  SCOPE_OWNER_REQUIRED: "Owner is required for own release notes"
} as const;
