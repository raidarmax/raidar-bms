import { useEffect, useState } from 'react';
import { ShieldCheck, Star, AlertTriangle, Phone, CreditCard, TrendingDown, FileWarning, DollarSign, ArrowUpRight } from 'lucide-react';
import { supabase, type Rider, type Motorcycle, type Owner } from '../../lib/supabase';
import PartyAvatar from './PartyAvatar';
import type { EntityRef } from './EntityProfileDrawer';

type Props = {
  rider: Rider | null;
  owner: Owner | null;
  motorcycleId: string | null;
  onOpenProfile?: (ref: EntityRef) => void;
};

const daysUntil = (iso: string | null | undefined) => {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((then - Date.now()) / (24 * 60 * 60 * 1000));
};

const expiryBadge = (iso: string | null | undefined, label: string) => {
  const days = daysUntil(iso);
  if (days === null) return null;
  if (days < 0) {
    return (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-0.5">
        <FileWarning className="h-2.5 w-2.5" /> {label} expired {Math.abs(days)}d
      </span>
    );
  }
  if (days <= 30) {
    return (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
        {label} in {days}d
      </span>
    );
  }
  return null;
};

export default function InvolvedParties({ rider, owner, motorcycleId, onOpenProfile }: Props) {
  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [riderPriorCount, setRiderPriorCount] = useState(0);
  const [riderUnpaidFines, setRiderUnpaidFines] = useState(0);
  const [motoPriorCount, setMotoPriorCount] = useState(0);

  useEffect(() => {
    (async () => {
      if (motorcycleId) {
        const { data } = await supabase.from('motorcycles').select('*').eq('id', motorcycleId).maybeSingle();
        setMotorcycle(data as Motorcycle | null);
        const { count } = await supabase
          .from('incidents')
          .select('id', { count: 'exact', head: true })
          .eq('motorcycle_id', motorcycleId);
        setMotoPriorCount(Math.max(0, (count || 0) - 1));
      } else {
        setMotorcycle(null);
        setMotoPriorCount(0);
      }
      if (rider?.id) {
        const [{ count }, { data: unpaid }] = await Promise.all([
          supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('rider_id', rider.id),
          supabase.from('fines').select('id').eq('rider_id', rider.id).neq('status', 'paid'),
        ]);
        setRiderPriorCount(Math.max(0, (count || 0) - 1));
        setRiderUnpaidFines((unpaid || []).length);
      } else {
        setRiderPriorCount(0);
        setRiderUnpaidFines(0);
      }
    })();
  }, [rider?.id, motorcycleId]);

  const ratingTone = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'bg-slate-100 text-slate-600';
    if (score < 2.5) return 'bg-red-100 text-red-700';
    if (score < 3.5) return 'bg-amber-100 text-amber-700';
    return 'bg-emerald-100 text-emerald-700';
  };

  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {/* Rider Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-3">
          {rider && onOpenProfile ? (
            <button
              onClick={() => onOpenProfile({ kind: 'rider', id: rider.id })}
              className="flex items-center gap-2 min-w-0 flex-1 -m-1 p-1 rounded-lg hover:bg-blue-50 transition-colors group text-left"
              title="View rider profile"
            >
              <PartyAvatar kind="rider" photoUrl={rider?.photo_url} name={rider?.name} size="lg" rounded="xl" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Rider</p>
                <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                  {rider.name}
                </p>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-500 transition-colors" />
            </button>
          ) : (
            <>
              <PartyAvatar kind="rider" photoUrl={rider?.photo_url} name={rider?.name} size="lg" rounded="xl" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Rider</p>
                <p className="text-sm font-bold text-slate-900 truncate">
                  {rider?.name || 'Not linked'}
                </p>
              </div>
            </>
          )}
        </div>

        {rider ? (
          <div className="space-y-2 text-xs">
            {rider.rating_score !== null && rider.rating_score !== undefined && (
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${ratingTone(rider.rating_score)}`}>
                <Star className="h-3 w-3 fill-current" />
                {Number(rider.rating_score).toFixed(1)}/5
                {rider.rating_tier && <span className="ml-0.5 opacity-70">· {rider.rating_tier}</span>}
              </div>
            )}
            {rider.phone_number && (
              <p className="text-slate-600 flex items-center gap-1.5">
                <Phone className="h-3 w-3 text-slate-400" />
                {rider.phone_number}
              </p>
            )}
            {rider.id_number && (
              <p className="text-slate-600 flex items-center gap-1.5">
                <CreditCard className="h-3 w-3 text-slate-400" />
                {rider.id_number}
              </p>
            )}
            <div className="flex flex-wrap gap-1 pt-1">
              {riderPriorCount > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 flex items-center gap-0.5">
                  <TrendingDown className="h-2.5 w-2.5" /> {riderPriorCount} prior case{riderPriorCount === 1 ? '' : 's'}
                </span>
              )}
              {riderUnpaidFines > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-0.5">
                  <DollarSign className="h-2.5 w-2.5" /> {riderUnpaidFines} unpaid fine{riderUnpaidFines === 1 ? '' : 's'}
                </span>
              )}
              {expiryBadge(rider.license_expiry, 'Licence')}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">
            No rider on this case yet. Consider adding a person of interest if a rider is known.
          </p>
        )}
      </div>

      {/* Motorcycle Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-3">
          {motorcycle && onOpenProfile ? (
            <button
              onClick={() => onOpenProfile({ kind: 'motorcycle', id: motorcycle.id })}
              className="flex items-center gap-2 min-w-0 flex-1 -m-1 p-1 rounded-lg hover:bg-emerald-50 transition-colors group text-left"
              title="View motorcycle profile"
            >
              <PartyAvatar kind="motorcycle" photoUrl={motorcycle?.bike_photo_url} name={motorcycle?.registration_number} size="lg" rounded="xl" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Motorcycle</p>
                <p className="text-sm font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
                  {motorcycle.registration_number || 'Unregistered'}
                </p>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
            </button>
          ) : (
            <>
              <PartyAvatar kind="motorcycle" photoUrl={motorcycle?.bike_photo_url} name={motorcycle?.registration_number} size="lg" rounded="xl" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Motorcycle</p>
                <p className="text-sm font-bold text-slate-900 truncate">
                  {motorcycle?.registration_number || 'Unregistered'}
                </p>
              </div>
            </>
          )}
        </div>

        {motorcycle ? (
          <div className="space-y-2 text-xs">
            {(motorcycle.make || motorcycle.model) && (
              <p className="text-slate-700 font-medium">
                {motorcycle.make} {motorcycle.model}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {motorcycle.is_compliant ? (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 flex items-center gap-0.5">
                  <ShieldCheck className="h-2.5 w-2.5" /> Compliant
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" /> Non-compliant
                </span>
              )}
              {motoPriorCount > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                  {motoPriorCount} prior
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {expiryBadge(motorcycle.insurance_expiry, 'Insurance')}
              {expiryBadge(motorcycle.inspection_expiry, 'Inspection')}
            </div>
            {motorcycle.insurance_provider && (
              <p className="text-[11px] text-slate-500 truncate" title={motorcycle.insurance_provider}>
                Insurance: {motorcycle.insurance_provider}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">
            No registered motorcycle linked. Only the reporter's description is available.
          </p>
        )}
      </div>

      {/* Owner Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-3">
          {owner && onOpenProfile ? (
            <button
              onClick={() => onOpenProfile({ kind: 'owner', id: owner.id })}
              className="flex items-center gap-2 min-w-0 flex-1 -m-1 p-1 rounded-lg hover:bg-slate-100 transition-colors group text-left"
              title="View owner profile"
            >
              <PartyAvatar kind="owner" photoUrl={owner?.profile_photo_url} name={owner?.full_name} size="lg" rounded="xl" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Owner</p>
                <p className="text-sm font-bold text-slate-900 truncate group-hover:text-slate-700 transition-colors">
                  {owner.full_name}
                </p>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
            </button>
          ) : (
            <>
              <PartyAvatar kind="owner" photoUrl={owner?.profile_photo_url} name={owner?.full_name} size="lg" rounded="xl" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Owner</p>
                <p className="text-sm font-bold text-slate-900 truncate">
                  {owner?.full_name || 'Unknown'}
                </p>
              </div>
            </>
          )}
        </div>

        {owner ? (
          <div className="space-y-2 text-xs">
            {owner.phone_number && (
              <p className="text-slate-600 flex items-center gap-1.5">
                <Phone className="h-3 w-3 text-slate-400" />
                {owner.phone_number}
              </p>
            )}
            {owner.national_id && (
              <p className="text-slate-600 flex items-center gap-1.5">
                <CreditCard className="h-3 w-3 text-slate-400" />
                {owner.national_id}
              </p>
            )}
            <div className="flex items-center gap-1 flex-wrap">
              {owner.id_verified && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                  ID verified
                </span>
              )}
              {rider && owner.national_id && rider.id_number && rider.id_number !== owner.national_id && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                  Different person
                </span>
              )}
            </div>
            {owner.next_of_kin_name && (
              <p className="text-[11px] text-slate-500">
                Kin: {owner.next_of_kin_name}
                {owner.next_of_kin_phone && ` (${owner.next_of_kin_phone})`}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">Owner not linked to this case.</p>
        )}
      </div>
    </div>
  );
}
