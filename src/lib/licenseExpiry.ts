export type LicenseExpiryStatus = {
  daysUntilExpiry: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
  label: string;
  className: string;
};

export function getLicenseExpiryStatus(expiryDate: string | null): LicenseExpiryStatus | null {
  if (!expiryDate) return null;
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) {
    return {
      daysUntilExpiry: days,
      isExpired: true,
      isExpiringSoon: false,
      label: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`,
      className: 'bg-red-100 text-red-800 border-red-200',
    };
  }
  if (days <= 30) {
    return {
      daysUntilExpiry: days,
      isExpired: false,
      isExpiringSoon: true,
      label: `Expires in ${days} day${days === 1 ? '' : 's'}`,
      className: 'bg-amber-100 text-amber-800 border-amber-200',
    };
  }
  return {
    daysUntilExpiry: days,
    isExpired: false,
    isExpiringSoon: false,
    label: `Valid (${days} days)`,
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  };
}
