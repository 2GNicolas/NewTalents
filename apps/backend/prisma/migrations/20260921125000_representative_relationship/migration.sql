-- Keep the declared legal relationship private while retaining the confirmation fact.
ALTER TABLE "RepresentativeConfirmation"
  ADD COLUMN "encryptedRelationship" TEXT;
