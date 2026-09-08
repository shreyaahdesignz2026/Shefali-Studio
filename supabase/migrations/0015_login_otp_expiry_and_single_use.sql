

alter table member_otp_requests add column code_hash text;
alter table member_otp_requests add column expires_at timestamptz;
alter table member_otp_requests add column consumed_at timestamptz;
