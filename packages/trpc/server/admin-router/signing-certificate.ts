import {
  deleteSigningCertificate,
  getSigningCertificateMeta,
  setSigningCertificate,
} from '@documenso/lib/server-only/cert/signing-certificate';
import { z } from 'zod';

import { adminProcedure } from '../trpc';

const ZGetResponse = z
  .object({
    fileName: z.string(),
    hasPassword: z.boolean(),
    updatedAt: z.date(),
  })
  .nullable();

const ZUploadRequest = z.object({
  fileName: z.string().min(1),
  /** Base64 of the .p12/.pfx bytes. */
  dataBase64: z.string().min(1),
  password: z.string().default(''),
});

export const getSigningCertificateRoute = adminProcedure
  .output(ZGetResponse)
  .query(async () => getSigningCertificateMeta());

export const uploadSigningCertificateRoute = adminProcedure
  .input(ZUploadRequest)
  .output(z.void())
  .mutation(async ({ input, ctx }) => {
    ctx.logger.info({ msg: 'Uploading default signing certificate', fileName: input.fileName });

    await setSigningCertificate({
      fileName: input.fileName,
      dataBase64: input.dataBase64,
      password: input.password,
    });
  });

export const deleteSigningCertificateRoute = adminProcedure.output(z.void()).mutation(async ({ ctx }) => {
  ctx.logger.info({ msg: 'Deleting default signing certificate' });

  await deleteSigningCertificate();
});
