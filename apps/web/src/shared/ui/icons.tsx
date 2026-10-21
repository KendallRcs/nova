import type { SVGProps } from 'react';

export type IconName =
  'home' | 'sales' | 'inventory' | 'customers' | 'more' | 'search' | 'arrow' | 'help';

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <path d="M3 10.8 12 3l9 7.8V21h-6v-6H9v6H3V10.8Z" />,
    sales: (
      <>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
        <path d="M9 8h6M9 12h6" />
      </>
    ),
    inventory: (
      <>
        <path d="m4 7 8-4 8 4-8 4-8-4Z" />
        <path d="m4 7 8 4v10l-8-4V7Zm16 0-8 4v10l8-4V7Z" />
      </>
    ),
    customers: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 15a5 5 0 0 1 3.5 5" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    search: <path d="m21 21-4.4-4.4M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.8 9a2.4 2.4 0 1 1 3.1 2.3c-.9.4-.9 1.1-.9 1.7M12 17h.01" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
