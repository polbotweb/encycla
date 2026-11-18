import type { ReactElement, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: ReactElement | ReactElement[] }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Base>
);

export const CrossIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
);

export const HeartIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" fill="currentColor" />
  </Base>
);

export const FlameIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3s5 4 5 9a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8z" />
  </Base>
);

export const SoundOnIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 10v4h4l5 4V6L8 10H4z" />
    <path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" />
  </Base>
);

export const SoundOffIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 10v4h4l5 4V6L8 10H4z" />
    <path d="M17 9l4 6M21 9l-4 6" />
  </Base>
);

export const ClockIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Base>
);

export const VoiceOnIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M9 4a4 4 0 110 8 4 4 0 010-8z" />
    <path d="M3 20a6 6 0 0112 0" />
    <path d="M17.5 7.5a4 4 0 010 5M20 5a7.5 7.5 0 010 10" />
  </Base>
);

export const VoiceOffIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M9 4a4 4 0 110 8 4 4 0 010-8z" />
    <path d="M3 20a6 6 0 0112 0" />
    <path d="M17 8l4 4M21 8l-4 4" />
  </Base>
);
