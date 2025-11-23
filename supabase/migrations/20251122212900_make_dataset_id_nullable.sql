-- Make dataset_id nullable since we've moved to shared_dataset_id
ALTER TABLE public.entitlements 
  ALTER COLUMN dataset_id DROP NOT NULL;

-- Add a check constraint to ensure at least one dataset reference exists
ALTER TABLE public.entitlements
  ADD CONSTRAINT entitlements_has_dataset_check 
  CHECK (dataset_id IS NOT NULL OR shared_dataset_id IS NOT NULL);

COMMENT ON CONSTRAINT entitlements_has_dataset_check ON public.entitlements 
  IS 'Ensures entitlement references either a user dataset or shared dataset';
