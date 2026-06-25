import LogoImage from '@documenso/assets/logo.png';
import type { ImgHTMLAttributes } from 'react';

export type LogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  alt?: string;
};

/**
 * CapivaSign brand logo, rendered from `packages/assets/logo.png`.
 *
 * Callers size it by height (e.g. `className="h-6 w-auto"`); `object-contain`
 * preserves the wordmark's aspect ratio. Previously an inline Documenso SVG
 * wordmark — swapped to the CapivaSign logo as part of the rebrand.
 */
export const BrandingLogo = ({ alt = 'CapivaSign', className, ...props }: LogoProps) => {
  return (
    <img src={LogoImage} alt={alt} className={['object-contain', className].filter(Boolean).join(' ')} {...props} />
  );
};
