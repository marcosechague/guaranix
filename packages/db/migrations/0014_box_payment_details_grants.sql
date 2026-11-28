-- Owners and admins set where members pay; the service checks the role.
GRANT UPDATE (
  payment_bank_name, payment_account_number, payment_alias, payment_holder_name,
  payment_holder_document, payment_qr_file_key, payment_note
) ON boxes TO guaranix_app;
