import type { SVGProps } from "react";

export type IconName = "search" | "bookmark" | "arrow" | "copy" | "plus" | "sun" | "moon" | "coffee" | "close";

const paths: Record<IconName, React.ReactNode> = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  bookmark: <path d="M6.5 4.5A1.5 1.5 0 0 1 8 3h8a1.5 1.5 0 0 1 1.5 1.5V21L12 17.5 6.5 21Z" />,
  arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
  copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  sun: <><circle cx="12" cy="12" r="3.6" /><path d="M12 4v1.6M12 18.4V20M6.34 6.34l1.13 1.13M16.53 16.53l1.13 1.13M4 12h1.6M18.4 12H20M6.34 17.66l1.13-1.13M16.53 7.47l1.13-1.13" /></>,
  moon: <path d="M19 14.4A7.4 7.4 0 1 1 9.6 5 5.8 5.8 0 0 0 19 14.4Z" />,
  coffee: <><path d="M6 8h10.5v7.2A3.8 3.8 0 0 1 12.7 19h-2.4A3.8 3.8 0 0 1 6.5 15.2V8Z" /><path d="M16.5 10.2h1.6a2.4 2.4 0 0 1 0 4.8h-1.6" /><path d="M9 4.2c.35.7.35 1.5 0 2.2M12.2 4.2c.35.7.35 1.5 0 2.2" /></>,
  close: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
