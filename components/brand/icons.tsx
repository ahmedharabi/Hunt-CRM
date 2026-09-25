import type { SVGProps } from "react";

/** lucide v1 dropped brand glyphs; this matches its 24px grid and stroke. */
export function LinkedInIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M8 10.5V16M8 7.75v.01M12 16v-3.25a2.25 2.25 0 0 1 4.5 0V16M12 10.5V16" />
    </svg>
  );
}
