-- The login-OTP flow (api/members/request-otp.js) previously handed the
-- code entirely to Supabase's own built-in email-OTP (generateLink's
-- email_otp + client.auth.verifyOtp) -- its expiry and single-use
-- behavior are controlled by the project's Auth settings, not by our own
-- code, and there's no Management API token configured in this project
-- to change that setting programmatically. Instead, member_otp_requests
-- (already used for request throttling) now also stores our own hashed,
-- explicitly-expiring, single-use code -- mirroring
-- member_email_change_requests exactly.
alter table member_otp_requests add column code_hash text;
alter table member_otp_requests add column expires_at timestamptz;
alter table member_otp_requests add column consumed_at timestamptz;
