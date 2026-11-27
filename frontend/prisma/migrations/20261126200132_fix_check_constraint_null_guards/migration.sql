-- Fix 3-valued SQL NULL predicates in CHECK constraints so NULL values
-- evaluate to FALSE instead of UNKNOWN.

ALTER TABLE "users"
  DROP CONSTRAINT "users_suspension_state_check",
  ADD CONSTRAINT "users_suspension_state_check" CHECK (
    ("status" = 'suspended' AND "status_before_suspension" IS NOT NULL AND "status_before_suspension" IN ('unverified', 'pending', 'approved', 'rejected'))
    OR
    ("status" <> 'suspended' AND "status_before_suspension" IS NULL)
  );

ALTER TABLE "transactions"
  DROP CONSTRAINT "transactions_expense_fields_check",
  ADD CONSTRAINT "transactions_expense_fields_check" CHECK (
    "kind" <> 'expense'
    OR (
      "title" IS NOT NULL AND length(btrim("title")) BETWEEN 1 AND 160
      AND "expense_category" IS NOT NULL AND "expense_category" IN ('group', 'collective')
      AND (
        ("expense_category" = 'group'
          AND "group_id" IS NOT NULL
          AND "group_code_snapshot" IS NOT NULL AND length(btrim("group_code_snapshot")) BETWEEN 1 AND 16
          AND "group_name_snapshot" IS NOT NULL AND length(btrim("group_name_snapshot")) BETWEEN 1 AND 180)
        OR
        ("expense_category" = 'collective'
          AND "group_id" IS NULL
          AND "group_code_snapshot" IS NULL
          AND "group_name_snapshot" IS NULL)
      )
      AND (
        ("member_id" IS NULL AND "member_name_snapshot" IS NULL)
        OR
        ("member_id" IS NOT NULL AND "member_name_snapshot" IS NOT NULL AND length(btrim("member_name_snapshot")) BETWEEN 1 AND 140)
      )
    )
  );
