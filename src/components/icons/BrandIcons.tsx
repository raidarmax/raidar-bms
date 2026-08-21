import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
  strokeWidth?: number;
};

function withDefaults(props: IconProps) {
  const {
    size = 24,
    strokeWidth = 1.6,
    className,
    ...rest
  } = props;
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    ...rest,
  };
}

export function PoliceStationIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M3 21h18" />
      <path d="M4 21V11l8-5 8 5v10" />
      <path d="M9 21v-5.5A1.5 1.5 0 0 1 10.5 14h3a1.5 1.5 0 0 1 1.5 1.5V21" />
      <path d="M7 11.5h1.5M15.5 11.5H17" />
      <path d="M12 3v3" />
      <path d="m12 7.6 .7 1.5 1.6.2-1.15 1.1.27 1.6L12 11.25l-1.42.75.27-1.6L9.7 9.3l1.6-.2z" fill="currentColor" strokeWidth="0.8" />
    </svg>
  );
}

export function PoliceBadgeIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M12 2.5 4.5 5v6.5c0 4.5 3 8 7.5 10 4.5-2 7.5-5.5 7.5-10V5z" />
      <path d="m12 8.4 .95 2 2.2.3-1.6 1.55.4 2.2L12 13.4l-1.95 1.05.4-2.2-1.6-1.55 2.2-.3z" fill="currentColor" strokeWidth="0.8" />
    </svg>
  );
}

export function PoliceOfficerIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M7 8.5V7a5 5 0 0 1 10 0v1.5" />
      <path d="M6 8.5h12l-.5 2.5H6.5z" />
      <path d="M8.5 8.5V6.8" />
      <circle cx="12" cy="14" r="3" />
      <path d="M5 21v-1a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v1" />
      <circle cx="12" cy="7.8" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function MotorcycleIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <circle cx="5.5" cy="16.5" r="3.5" />
      <circle cx="18.5" cy="16.5" r="3.5" />
      <path d="M5.5 16.5 9 10h4.5" />
      <path d="M13.5 10 16 6h2.5" />
      <path d="M9 10h6.5l3 6.5" />
      <path d="M10 8h5" />
      <path d="M18.5 6.5V4h1.5" />
    </svg>
  );
}

export function BodaRiderIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M4 14a8 8 0 0 1 16 0v2H4z" />
      <path d="M4 16h16" />
      <path d="M8 16v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2" />
      <path d="M8.5 11h7" />
      <rect x="9" y="9" width="6" height="3" rx="0.6" fill="currentColor" opacity="0.2" strokeWidth="0" />
    </svg>
  );
}

export function TrafficFineIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M4.5 4.5h11l4 4V19a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z" />
      <path d="M15.5 4.5V8.5h4" />
      <path d="M7 12h6" />
      <path d="M7 15h9" />
      <path d="M7 18h5" />
      <circle cx="17" cy="17.5" r="0.7" fill="currentColor" />
    </svg>
  );
}

export function IncidentAlertIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M12 3.5 21 20H3z" />
      <path d="M12 10v4.5" />
      <path d="M9.5 13h5" />
      <path d="M8 16h8" />
      <circle cx="12" cy="17.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function QrVerifyIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
      <path d="M5.75 5.75h1.5v1.5h-1.5z" fill="currentColor" strokeWidth="0" />
      <path d="M16.75 5.75h1.5v1.5h-1.5z" fill="currentColor" strokeWidth="0" />
      <path d="M5.75 16.75h1.5v1.5h-1.5z" fill="currentColor" strokeWidth="0" />
      <path d="M14 15.5l2 2 4.5-4.5" />
    </svg>
  );
}

export function IdentityCardIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11.5" r="2.2" />
      <path d="M5.8 16.5c.5-1.6 1.9-2.5 3.2-2.5s2.7.9 3.2 2.5" />
      <path d="M14.5 9.5h4" />
      <path d="M14.5 12.5h4" />
      <path d="M14.5 15.5h2.5" />
    </svg>
  );
}

export function InsuranceShieldIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M12 2.5 4.5 5v6.5c0 4.5 3 8 7.5 10 4.5-2 7.5-5.5 7.5-10V5z" />
      <path d="M8.5 12l2.2 2.2L15.5 9.4" />
    </svg>
  );
}

export function GpsBeaconIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <circle cx="12" cy="10" r="3" />
      <path d="M12 21c-4-4.5-6-7.7-6-11a6 6 0 1 1 12 0c0 3.3-2 6.5-6 11z" />
      <path d="M6 6.5C4.8 7.9 4 9.4 4 11" opacity="0.6" />
      <path d="M18 6.5C19.2 7.9 20 9.4 20 11" opacity="0.6" />
    </svg>
  );
}

export function SirenIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M6 14a6 6 0 0 1 12 0v2H6z" />
      <path d="M4 16h16" />
      <path d="M4 19h16" />
      <path d="M12 8V4" />
      <path d="M8.5 5 7 3.5" />
      <path d="M15.5 5 17 3.5" />
    </svg>
  );
}

export function HelmetIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M4 15a8 8 0 0 1 16 0v1.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5z" />
      <path d="M8 12.5h8" />
      <path d="M4 18h16" opacity="0.5" />
    </svg>
  );
}

export function RevenueVaultIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="14" cy="12" r="3.5" />
      <path d="M14 10v4" />
      <path d="M12.5 12h3" />
      <path d="M5.5 8.5v7" />
      <path d="M3 19l1.5 2M21 19l-1.5 2" />
    </svg>
  );
}

export function AuditLogIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 3.5v2h6v-2" />
      <path d="M8.5 10l1.2 1.2 2.5-2.5" />
      <path d="M8.5 15l1.2 1.2 2.5-2.5" />
      <path d="M14 10h2.5" />
      <path d="M14 15h2.5" />
    </svg>
  );
}

export function SettingsGearIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

export function SmsBroadcastIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <rect x="8" y="3.5" width="8" height="17" rx="2" />
      <path d="M11 17.5h2" />
      <path d="M4 8c-1 1.5-1 5 0 6.5" opacity="0.7" />
      <path d="M6 10c-.5.8-.5 3 0 4" opacity="0.5" />
      <path d="M20 8c1 1.5 1 5 0 6.5" opacity="0.7" />
      <path d="M18 10c.5.8.5 3 0 4" opacity="0.5" />
    </svg>
  );
}

export function ComplianceCheckIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M5.5 4.5h9l4 4V19.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z" />
      <path d="M14.5 4.5v4h4" />
      <path d="M8 13.5l2.5 2.5 4.5-5" />
    </svg>
  );
}

export function LiveMapIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M9 3.5 3.5 5.5v15L9 18.5l6 2 5.5-2v-15L15 5.5z" />
      <path d="M9 3.5v15" />
      <path d="M15 5.5v15" />
      <circle cx="12" cy="11" r="1.6" fill="currentColor" strokeWidth="0" />
    </svg>
  );
}

export function CommandCenterIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
      <path d="M6.5 9 8.5 11 6.5 13" />
      <path d="M11 13h4" />
    </svg>
  );
}

export function PaymentCardIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9.5h18" />
      <path d="M6.5 15.5h4" />
      <path d="M15.5 14.5l1.2 1.2 2.3-2.3" />
    </svg>
  );
}

export function BellAlertIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M6 15c0-1 .8-1.5.8-3.5V10a5 5 0 0 1 10.4 0v1.5c0 2 .8 2.5.8 3.5z" />
      <path d="M4.5 15.5h15" />
      <path d="M10 19a2 2 0 0 0 4 0" />
      <path d="M19 5.5l1.5-1M4 5.5 2.5 4.5" opacity="0.7" />
    </svg>
  );
}

export function CommunityIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <circle cx="12" cy="8" r="2.5" />
      <circle cx="5.5" cy="10" r="2" />
      <circle cx="18.5" cy="10" r="2" />
      <path d="M8 20v-2a4 4 0 0 1 8 0v2" />
      <path d="M2.5 20v-1a3 3 0 0 1 3-3h1" />
      <path d="M21.5 20v-1a3 3 0 0 0-3-3h-1" />
    </svg>
  );
}

export function BikeFleetIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <circle cx="6" cy="16" r="3" />
      <circle cx="18" cy="16" r="3" />
      <path d="M6 16 9 10.5h4.5" />
      <path d="M13.5 10.5 15.5 7.5H18" />
      <path d="M9 10.5h5l3.5 5.5" />
      <path d="M10 8.5h4.5" />
      <path d="M4.5 6h2l1 2" opacity="0.6" />
      <path d="M20 6h-1.5l-.5 1" opacity="0.6" />
    </svg>
  );
}

export function DocumentValidatedIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
      <path d="M14 3.5v4h4" />
      <path d="M8 13.5l2 2 4-4.5" />
      <path d="M8 18h5" />
    </svg>
  );
}

export function LicenseCardIcon(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="11" r="2.2" />
      <path d="M5.5 16.5c.4-1.5 1.7-2.4 3-2.4s2.6.9 3 2.4" />
      <path d="M14 8.5h5" />
      <path d="M14 11.5h5" />
      <path d="M14 14.5h3" />
      <path d="M15.5 17l1 1 2-2" />
    </svg>
  );
}

