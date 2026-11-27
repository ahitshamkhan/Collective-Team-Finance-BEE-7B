-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL,
    "roster_key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "group_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorized_admins" (
    "slot" SMALLINT NOT NULL,
    "member_id" UUID NOT NULL,
    "email_normalized" VARCHAR(254) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authorized_admins_pkey" PRIMARY KEY ("slot")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email_normalized" VARCHAR(254) NOT NULL,
    "name" VARCHAR(140) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "member_id" UUID,
    "email_verified_at" TIMESTAMPTZ(6),
    "status" VARCHAR(16) NOT NULL,
    "status_before_suspension" VARCHAR(16),
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_reason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "admin_otp_at" TIMESTAMPTZ(6),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "purpose" VARCHAR(24) NOT NULL,
    "flow_secret_hash" BYTEA NOT NULL,
    "code_hmac" BYTEA,
    "generation" INTEGER NOT NULL,
    "attempts" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_sent_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "delivery_state" VARCHAR(16) NOT NULL,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "window_start" TIMESTAMPTZ(6) NOT NULL,
    "count" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key","window_start")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "kind" VARCHAR(8) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "business_date" DATE NOT NULL,
    "member_id" UUID,
    "group_id" UUID,
    "expense_category" VARCHAR(16),
    "title" VARCHAR(160),
    "description" VARCHAR(1000) NOT NULL,
    "member_name_snapshot" VARCHAR(140),
    "group_code_snapshot" VARCHAR(16),
    "group_name_snapshot" VARCHAR(180),
    "recorded_by" UUID NOT NULL,
    "recorded_by_name_snapshot" VARCHAR(140) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(8) NOT NULL,
    "voided_by" UUID,
    "voided_at" TIMESTAMPTZ(6),
    "void_reason" VARCHAR(500),
    "replaces_id" UUID,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_kind" VARCHAR(12) NOT NULL,
    "actor_label" VARCHAR(140) NOT NULL,
    "operation" VARCHAR(64) NOT NULL,
    "entity_type" VARCHAR(32) NOT NULL,
    "entity_id" UUID,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "request_id" UUID NOT NULL,
    "before_values" JSONB,
    "after_values" JSONB,
    "reason" VARCHAR(500),

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_requests" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "operation" VARCHAR(64) NOT NULL,
    "key" UUID NOT NULL,
    "request_hash" BYTEA NOT NULL,
    "response_status" SMALLINT NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "groups_code_key" ON "groups"("code");

-- CreateIndex
CREATE UNIQUE INDEX "members_roster_key_key" ON "members"("roster_key");

-- CreateIndex
CREATE INDEX "members_group_id_idx" ON "members"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "authorized_admins_member_id_key" ON "authorized_admins"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "authorized_admins_email_normalized_key" ON "authorized_admins"("email_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("email_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "users_member_id_key" ON "users"("member_id");

-- CreateIndex
CREATE INDEX "users_status_created_at_id_idx" ON "users"("status", "created_at", "id");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "otp_challenges_expires_at_idx" ON "otp_challenges"("expires_at");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_expires_at_idx" ON "rate_limit_buckets"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_replaces_id_key" ON "transactions"("replaces_id");

-- CreateIndex
CREATE INDEX "transactions_business_date_created_at_id_idx" ON "transactions"("business_date" DESC, "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "transactions_recorded_by_idx" ON "transactions"("recorded_by");

-- CreateIndex
CREATE INDEX "audit_events_occurred_at_id_idx" ON "audit_events"("occurred_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "audit_events_entity_type_entity_id_occurred_at_idx" ON "audit_events"("entity_type", "entity_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_requests_actor_user_id_operation_key_key" ON "idempotency_requests"("actor_user_id", "operation", "key");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorized_admins" ADD CONSTRAINT "authorized_admins_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_replaces_id_fkey" FOREIGN KEY ("replaces_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_requests" ADD CONSTRAINT "idempotency_requests_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ======================================================
-- CUSTOM POSTGRESQL INTEGRITY CONSTRAINTS & TRIGGERS
-- ======================================================

-- 1. Organizational Identity (groups, members, authorized_admins)
ALTER TABLE "groups"
  ADD CONSTRAINT "groups_code_nonempty_check" CHECK (length(btrim("code")) BETWEEN 1 AND 16),
  ADD CONSTRAINT "groups_name_nonempty_check" CHECK (length(btrim("name")) BETWEEN 1 AND 180),
  ADD CONSTRAINT "groups_version_positive_check" CHECK ("version" >= 1);

ALTER TABLE "members"
  ADD CONSTRAINT "members_roster_key_nonempty_check" CHECK (length(btrim("roster_key")) BETWEEN 1 AND 64),
  ADD CONSTRAINT "members_name_nonempty_check" CHECK (length(btrim("name")) BETWEEN 1 AND 140),
  ADD CONSTRAINT "members_version_positive_check" CHECK ("version" >= 1);

ALTER TABLE "authorized_admins"
  ADD CONSTRAINT "authorized_admins_slot_range_check" CHECK ("slot" BETWEEN 1 AND 3),
  ADD CONSTRAINT "authorized_admins_email_normalized_check" CHECK (
    "email_normalized" = lower(btrim("email_normalized"))
    AND length("email_normalized") BETWEEN 1 AND 254
  );

-- 2. User Accounts (users)
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_normalized_check" CHECK (
    "email_normalized" = lower(btrim("email_normalized"))
    AND length("email_normalized") BETWEEN 1 AND 254
  ),
  ADD CONSTRAINT "users_name_nonempty_check" CHECK (length(btrim("name")) BETWEEN 1 AND 140),
  ADD CONSTRAINT "users_version_positive_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "users_status_valid_check" CHECK (
    "status" IN ('unverified', 'pending', 'approved', 'rejected', 'suspended')
  ),
  ADD CONSTRAINT "users_suspension_state_check" CHECK (
    ("status" = 'suspended' AND "status_before_suspension" IN ('unverified', 'pending', 'approved', 'rejected'))
    OR
    ("status" <> 'suspended' AND "status_before_suspension" IS NULL)
  ),
  ADD CONSTRAINT "users_verified_email_for_pending_rejected_check" CHECK (
    ("status" NOT IN ('pending', 'rejected') AND COALESCE("status_before_suspension", '') NOT IN ('pending', 'rejected'))
    OR "email_verified_at" IS NOT NULL
  ),
  ADD CONSTRAINT "users_member_link_for_approved_check" CHECK (
    ("status" <> 'approved' AND COALESCE("status_before_suspension", '') <> 'approved')
    OR "member_id" IS NOT NULL
  );

-- 3. Authentication, Sessions, OTP & Rate Limits
ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_kind_valid_check" CHECK ("kind" IN ('full', 'status')),
  ADD CONSTRAINT "sessions_expiry_after_creation_check" CHECK ("expires_at" > "created_at"),
  ADD CONSTRAINT "sessions_status_no_admin_otp_check" CHECK (
    "kind" <> 'status' OR "admin_otp_at" IS NULL
  );

ALTER TABLE "otp_challenges"
  ADD CONSTRAINT "otp_challenges_purpose_valid_check" CHECK (
    "purpose" IN ('registration', 'admin_login', 'recovery')
  ),
  ADD CONSTRAINT "otp_challenges_attempts_range_check" CHECK ("attempts" BETWEEN 0 AND 5),
  ADD CONSTRAINT "otp_challenges_generation_positive_check" CHECK ("generation" >= 1),
  ADD CONSTRAINT "otp_challenges_delivery_state_valid_check" CHECK (
    "delivery_state" IN ('pending', 'sent', 'failed', 'dummy')
  ),
  ADD CONSTRAINT "otp_challenges_expiry_after_creation_check" CHECK ("expires_at" > "created_at");

CREATE UNIQUE INDEX "otp_challenges_active_user_purpose_key"
  ON "otp_challenges" ("user_id", "purpose")
  WHERE "consumed_at" IS NULL AND "revoked_at" IS NULL AND "user_id" IS NOT NULL;

ALTER TABLE "rate_limit_buckets"
  ADD CONSTRAINT "rate_limit_buckets_count_nonnegative_check" CHECK ("count" >= 0),
  ADD CONSTRAINT "rate_limit_buckets_expiry_check" CHECK ("expires_at" >= "window_start");

-- 4. Financial Transactions (transactions)
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_kind_valid_check" CHECK ("kind" IN ('deposit', 'expense')),
  ADD CONSTRAINT "transactions_status_valid_check" CHECK ("status" IN ('active', 'voided')),
  ADD CONSTRAINT "transactions_amount_positive_finite_check" CHECK (
    "amount" <> 'NaN'::numeric
    AND "amount" <> 'Infinity'::numeric
    AND "amount" <> '-Infinity'::numeric
    AND "amount" > 0
    AND "amount" <= 999999999999.99
  ),
  ADD CONSTRAINT "transactions_description_trimmed_check" CHECK (
    length(btrim("description")) BETWEEN 1 AND 1000
  ),
  ADD CONSTRAINT "transactions_title_trimmed_check" CHECK (
    "title" IS NULL OR length(btrim("title")) BETWEEN 1 AND 160
  ),
  ADD CONSTRAINT "transactions_recorded_by_snapshot_check" CHECK (
    length(btrim("recorded_by_name_snapshot")) BETWEEN 1 AND 140
  ),
  ADD CONSTRAINT "transactions_deposit_fields_check" CHECK (
    "kind" <> 'deposit'
    OR (
      "member_id" IS NOT NULL
      AND "group_id" IS NOT NULL
      AND "member_name_snapshot" IS NOT NULL AND length(btrim("member_name_snapshot")) BETWEEN 1 AND 140
      AND "group_code_snapshot" IS NOT NULL AND length(btrim("group_code_snapshot")) BETWEEN 1 AND 16
      AND "group_name_snapshot" IS NOT NULL AND length(btrim("group_name_snapshot")) BETWEEN 1 AND 180
      AND "expense_category" IS NULL
      AND "title" IS NULL
    )
  ),
  ADD CONSTRAINT "transactions_expense_fields_check" CHECK (
    "kind" <> 'expense'
    OR (
      "title" IS NOT NULL AND length(btrim("title")) BETWEEN 1 AND 160
      AND "expense_category" IN ('group', 'collective')
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
  ),
  ADD CONSTRAINT "transactions_void_metadata_check" CHECK (
    ("status" = 'active' AND "voided_by" IS NULL AND "voided_at" IS NULL AND "void_reason" IS NULL)
    OR
    ("status" = 'voided' AND "voided_by" IS NOT NULL AND "voided_at" IS NOT NULL AND "void_reason" IS NOT NULL AND length(btrim("void_reason")) BETWEEN 5 AND 500)
  ),
  ADD CONSTRAINT "transactions_no_self_replacement_check" CHECK (
    "replaces_id" IS NULL OR "replaces_id" <> "id"
  );

CREATE INDEX "transactions_active_deposits_member_date_idx"
  ON "transactions" ("member_id", "business_date")
  WHERE "status" = 'active' AND "kind" = 'deposit';

CREATE INDEX "transactions_active_group_date_idx"
  ON "transactions" ("group_id", "business_date")
  WHERE "status" = 'active' AND "group_id" IS NOT NULL;

-- 5. Transaction Immutability Trigger
CREATE OR REPLACE FUNCTION "enforce_transactions_immutability"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Financial transactions cannot be deleted (id=%)', OLD."id";
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" <> 'active' OR NEW."status" <> 'voided' THEN
      RAISE EXCEPTION 'Only a single active-to-voided transition is permitted on transactions (id=%)', OLD."id";
    END IF;

    IF NEW."id" IS DISTINCT FROM OLD."id"
       OR NEW."kind" IS DISTINCT FROM OLD."kind"
       OR NEW."amount" IS DISTINCT FROM OLD."amount"
       OR NEW."business_date" IS DISTINCT FROM OLD."business_date"
       OR NEW."member_id" IS DISTINCT FROM OLD."member_id"
       OR NEW."group_id" IS DISTINCT FROM OLD."group_id"
       OR NEW."expense_category" IS DISTINCT FROM OLD."expense_category"
       OR NEW."title" IS DISTINCT FROM OLD."title"
       OR NEW."description" IS DISTINCT FROM OLD."description"
       OR NEW."member_name_snapshot" IS DISTINCT FROM OLD."member_name_snapshot"
       OR NEW."group_code_snapshot" IS DISTINCT FROM OLD."group_code_snapshot"
       OR NEW."group_name_snapshot" IS DISTINCT FROM OLD."group_name_snapshot"
       OR NEW."recorded_by" IS DISTINCT FROM OLD."recorded_by"
       OR NEW."recorded_by_name_snapshot" IS DISTINCT FROM OLD."recorded_by_name_snapshot"
       OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
       OR NEW."replaces_id" IS DISTINCT FROM OLD."replaces_id" THEN
      RAISE EXCEPTION 'Historical transaction fields are immutable and cannot be modified (id=%)', OLD."id";
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "transactions_immutability_trg"
  BEFORE UPDATE OR DELETE ON "transactions"
  FOR EACH ROW
  EXECUTE FUNCTION "enforce_transactions_immutability"();

-- 6. Audit Events & Idempotency Requests
ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_actor_check" CHECK (
    ("actor_kind" = 'user' AND "actor_user_id" IS NOT NULL)
    OR
    ("actor_kind" = 'operator' AND "actor_user_id" IS NULL AND length(btrim("actor_label")) BETWEEN 1 AND 140)
  ),
  ADD CONSTRAINT "audit_events_actor_label_nonempty_check" CHECK (length(btrim("actor_label")) BETWEEN 1 AND 140),
  ADD CONSTRAINT "audit_events_operation_nonempty_check" CHECK (length(btrim("operation")) BETWEEN 1 AND 64),
  ADD CONSTRAINT "audit_events_entity_type_nonempty_check" CHECK (length(btrim("entity_type")) BETWEEN 1 AND 32);

ALTER TABLE "idempotency_requests"
  ADD CONSTRAINT "idempotency_requests_operation_nonempty_check" CHECK (length(btrim("operation")) BETWEEN 1 AND 64),
  ADD CONSTRAINT "idempotency_requests_response_status_check" CHECK ("response_status" BETWEEN 100 AND 599);
