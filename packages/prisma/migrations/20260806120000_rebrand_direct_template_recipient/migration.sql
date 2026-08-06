-- Rebrand: rewrite the synthetic recipient addresses that carried the old
-- product's domain. Both values are sentinels the application matches on, never
-- real mailboxes — but they surface in the recipient list, so they have to move
-- with the brand.

-- Direct-link recipient sentinel (DIRECT_TEMPLATE_RECIPIENT_EMAIL).
UPDATE "Recipient"
SET "email" = 'direct.link@capivapp.com.br'
WHERE lower("email") = 'direct.link@documenso.com';

-- Unassigned template recipient placeholders (recipient.<n>@...), matched by
-- TEMPLATE_RECIPIENT_EMAIL_PLACEHOLDER_REGEX.
UPDATE "Recipient"
SET "email" = regexp_replace("email", '@documenso\.com$', '@capivapp.com.br')
WHERE "email" ~* '^recipient\.\d+@documenso\.com$';
