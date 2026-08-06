import { env } from '../utils/env';

export const CAPIVASIGN_ENCRYPTION_KEY = env('NEXT_PRIVATE_ENCRYPTION_KEY');

export const CAPIVASIGN_ENCRYPTION_SECONDARY_KEY = env('NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY');

// if (typeof window === 'undefined') {
//   if (!CAPIVASIGN_ENCRYPTION_KEY || !CAPIVASIGN_ENCRYPTION_SECONDARY_KEY) {
//     throw new Error('Missing CAPIVASIGN_ENCRYPTION_KEY or CAPIVASIGN_ENCRYPTION_SECONDARY_KEY keys');
//   }

//   if (CAPIVASIGN_ENCRYPTION_KEY === CAPIVASIGN_ENCRYPTION_SECONDARY_KEY) {
//     throw new Error(
//       'CAPIVASIGN_ENCRYPTION_KEY and CAPIVASIGN_ENCRYPTION_SECONDARY_KEY cannot be equal',
//     );
//   }
// }

// if (CAPIVASIGN_ENCRYPTION_KEY === 'CAFEBABE') {
//   console.warn('*********************************************************************');
//   console.warn('*');
//   console.warn('*');
//   console.warn('Please change the encryption key from the default value of "CAFEBABE"');
//   console.warn('*');
//   console.warn('*');
//   console.warn('*********************************************************************');
// }
