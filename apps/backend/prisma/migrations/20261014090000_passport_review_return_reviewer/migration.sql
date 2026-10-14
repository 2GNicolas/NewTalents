-- Rename in place so existing review-return records and their identity references survive.
ALTER TABLE "PassportReviewReturn"
  RENAME COLUMN "analystIdentityId" TO "reviewerIdentityId";

ALTER TABLE "PassportReviewReturn"
  RENAME CONSTRAINT "PassportReviewReturn_analystIdentityId_fkey" TO "PassportReviewReturn_reviewerIdentityId_fkey";
