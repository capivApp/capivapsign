import { msg } from '@lingui/core/macro';

/**
 * Matches the synthetic recipient emails a template uses before real signers are
 * assigned (generated as `recipient.<n>@capivapp.com.br`). Recognising one is
 * what makes the UI show "Recipient 1" instead of leaking a fake address.
 *
 * `documenso.com` stays in the pattern for templates created before the rebrand:
 * their placeholders are already persisted, and dropping the alternative would
 * make those rows render as if they were real recipients.
 */
export const TEMPLATE_RECIPIENT_EMAIL_PLACEHOLDER_REGEX = /recipient\.\d+@(capivapp\.com\.br|documenso\.com)/i;
export const TEMPLATE_RECIPIENT_NAME_PLACEHOLDER_REGEX = /Recipient \d+/i;

export const isTemplateRecipientEmailPlaceholder = (email: string) => {
  return TEMPLATE_RECIPIENT_EMAIL_PLACEHOLDER_REGEX.test(email);
};

export const DIRECT_TEMPLATE_DOCUMENTATION = [
  {
    title: msg`Enable Direct Link Signing`,
    description: msg`Once enabled, you can select any active recipient to be a direct link signing recipient, or create a new one. This recipient type cannot be edited or deleted.`,
  },
  {
    title: msg`Configure Direct Recipient`,
    description: msg`Update the role and add fields as required for the direct recipient. The individual who uses the direct link will sign the document as the direct recipient.`,
  },
  {
    title: msg`Share the Link`,
    description: msg`Once your template is set up, share the link anywhere you want. The person who opens the link will be able to enter their information in the direct link recipient field and complete any other fields assigned to them.`,
  },
  {
    title: msg`Document Creation`,
    description: msg`After submission, a document will be automatically generated and added to your documents page. You will also receive a notification via email.`,
  },
];
