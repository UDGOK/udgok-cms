'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addVendorPaymentMethodAction,
  toggleVendorPaymentMethodAction,
  setDefaultVendorPaymentMethodAction,
  deleteVendorPaymentMethodAction,
} from '@/lib/procurement/vendor-payment-method-actions';

interface MethodDto {
  id: string;
  methodType: 'ACH' | 'CARD' | 'CHECK';
  isDefault: boolean;
  nickname: string | null;
  last4: string | null;
  achBankName: string | null;
  achAccountLast4: string | null;
  cardBrand: string | null;
  isActive: boolean;
}

interface VendorDto {
  id: string;
  name: string;
  methods: MethodDto[];
}

export function VendorPaymentMethodsTable({
  workspaceSlug,
  vendors,
}: {
  workspaceSlug: string;
  vendors: VendorDto[];
}) {
  return (
    <div className="space-y-2">
      {vendors.length === 0 ? (
        <div className="text-[12px] text-ink-50 text-center py-6 border border-dashed border-line">
          No vendors yet. Add one in Procurement → Vendors.
        </div>
      ) : (
        vendors.map((v) => <VendorCard key={v.id} workspaceSlug={workspaceSlug} vendor={v} />)
      )}
    </div>
  );
}

function VendorCard({ workspaceSlug, vendor }: { workspaceSlug: string; vendor: VendorDto }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="bg-paper border border-line">
      <div className="px-3 py-2 flex items-center justify-between border-b border-line">
        <div>
          <div className="text-[12px] font-extrabold">{vendor.name}</div>
          <div className="text-[10px] text-ink-50 font-mono">
            {vendor.methods.length === 0
              ? 'no payment methods on file'
              : vendor.methods.length === 1
                ? '1 method'
                : `${vendor.methods.length} methods`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink hover:text-orange-d"
        >
          {adding ? '✕ Cancel' : '+ Add method'}
        </button>
      </div>
      {vendor.methods.length > 0 ? (
        <ul className="divide-y divide-line">
          {vendor.methods.map((m) => (
            <MethodRow
              key={m.id}
              workspaceSlug={workspaceSlug}
              vendorId={vendor.id}
              method={m}
              canDelete={vendor.methods.length > 1}
            />
          ))}
        </ul>
      ) : null}
      {adding ? (
        <AddMethodForm
          workspaceSlug={workspaceSlug}
          vendorId={vendor.id}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}

function MethodRow({
  workspaceSlug,
  vendorId,
  method,
  canDelete,
}: {
  workspaceSlug: string;
  vendorId: string;
  method: MethodDto;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const desc =
    method.methodType === 'ACH'
      ? `ACH${method.achBankName ? ` · ${method.achBankName}` : ''}${method.achAccountLast4 ? ` ending ${method.achAccountLast4}` : ''}`
      : method.methodType === 'CARD'
        ? `${method.cardBrand ?? 'Card'}${method.last4 ? ` ending ${method.last4}` : ''}`
        : `Check${method.last4 ? ` #${method.last4}` : ''}`;

  function setDefault() {
    startTransition(async () => {
      const res = await setDefaultVendorPaymentMethodAction({ workspaceSlug, methodId: method.id, vendorId });
      if (res.ok) router.refresh();
    });
  }
  function toggle() {
    startTransition(async () => {
      const res = await toggleVendorPaymentMethodAction({ workspaceSlug, methodId: method.id, isActive: !method.isActive });
      if (res.ok) router.refresh();
    });
  }
  function del() {
    if (!confirm('Delete this payment method?')) return;
    startTransition(async () => {
      const res = await deleteVendorPaymentMethodAction({ workspaceSlug, methodId: method.id });
      if (res.ok) router.refresh();
    });
  }

  return (
    <li className="px-3 py-2 flex items-center gap-2 text-[12px]">
      <span
        className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.1em] ${
          method.isActive ? 'bg-success/15 text-success' : 'bg-ink-50/15 text-ink-50'
        }`}
      >
        {method.isActive ? 'Active' : 'Inactive'}
      </span>
      {method.isDefault ? (
        <span className="px-1.5 py-0.5 bg-orange/15 text-orange text-[9px] font-extrabold uppercase tracking-[0.1em]">
          Default
        </span>
      ) : null}
      <span className="font-mono text-ink-70">{desc}</span>
      {method.nickname ? (
        <span className="text-ink-50 text-[11px]">· {method.nickname}</span>
      ) : null}
      <span className="ml-auto flex items-center gap-2">
        {!method.isDefault && method.isActive ? (
          <button
            type="button"
            onClick={setDefault}
            disabled={pending}
            className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 hover:text-ink disabled:opacity-50"
          >
            Set default
          </button>
        ) : null}
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 hover:text-ink disabled:opacity-50"
        >
          {method.isActive ? 'Deactivate' : 'Reactivate'}
        </button>
        {canDelete ? (
          <button
            type="button"
            onClick={del}
            disabled={pending}
            className="text-[10px] font-mono uppercase tracking-[0.1em] text-error hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        ) : null}
      </span>
    </li>
  );
}

function AddMethodForm({
  workspaceSlug,
  vendorId,
  onClose,
}: {
  workspaceSlug: string;
  vendorId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [methodType, setMethodType] = useState<'ACH' | 'CARD' | 'CHECK'>('ACH');
  const [nickname, setNickname] = useState('');
  const [last4, setLast4] = useState('');
  const [achBankName, setAchBankName] = useState('');
  const [achRoutingLast4, setAchRoutingLast4] = useState('');
  const [achAccountLast4, setAchAccountLast4] = useState('');
  const [cardBrand, setCardBrand] = useState('');

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await addVendorPaymentMethodAction({
        workspaceSlug,
        vendorId,
        methodType,
        nickname: nickname.trim() || undefined,
        last4: last4.trim() || undefined,
        achBankName: achBankName.trim() || undefined,
        achRoutingLast4: achRoutingLast4.trim() || undefined,
        achAccountLast4: achAccountLast4.trim() || undefined,
        cardBrand: cardBrand.trim() || undefined,
      });
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="px-3 py-2 border-t border-line space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className="block">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">Type</div>
          <select
            value={methodType}
            onChange={(ev) => setMethodType(ev.target.value as 'ACH' | 'CARD' | 'CHECK')}
            className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
          >
            <option value="ACH">ACH</option>
            <option value="CARD">Credit card</option>
            <option value="CHECK">Check</option>
          </select>
        </label>
        <label className="block md:col-span-2">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">Nickname</div>
          <input
            value={nickname}
            onChange={(ev) => setNickname(ev.target.value)}
            placeholder="e.g. Locke ACH — primary"
            className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
          />
        </label>
      </div>
      {methodType === 'ACH' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <label className="block">
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">Bank name</div>
            <input
              value={achBankName}
              onChange={(ev) => setAchBankName(ev.target.value)}
              className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
            />
          </label>
          <label className="block">
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">Routing last 4</div>
            <input
              value={achRoutingLast4}
              onChange={(ev) => setAchRoutingLast4(ev.target.value)}
              maxLength={4}
              className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
            />
          </label>
          <label className="block">
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">Account last 4 *</div>
            <input
              value={achAccountLast4}
              onChange={(ev) => setAchAccountLast4(ev.target.value)}
              maxLength={4}
              className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
            />
          </label>
        </div>
      ) : null}
      {methodType === 'CARD' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <label className="block">
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">Brand</div>
            <select
              value={cardBrand}
              onChange={(ev) => setCardBrand(ev.target.value)}
              className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
            >
              <option value="">—</option>
              <option value="Visa">Visa</option>
              <option value="Mastercard">Mastercard</option>
              <option value="Amex">Amex</option>
              <option value="Discover">Discover</option>
            </select>
          </label>
          <label className="block md:col-span-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">Card last 4 *</div>
            <input
              value={last4}
              onChange={(ev) => setLast4(ev.target.value)}
              maxLength={4}
              className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
            />
          </label>
        </div>
      ) : null}
      {methodType === 'CHECK' ? (
        <label className="block">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-0.5">Check # (last 4) *</div>
          <input
            value={last4}
            onChange={(ev) => setLast4(ev.target.value)}
            maxLength={4}
            className="w-full px-2 py-1.5 border border-line text-[12px] font-mono"
          />
        </label>
      ) : null}
      <p className="text-[10px] text-ink-50">
        We never store the full account or card number. Only the last 4 digits.
      </p>
      {error ? <div className="text-[11px] text-error">⚠ {error}</div> : null}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="px-3 py-1.5 bg-orange text-paper text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-orange-d disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save method'}
        </button>
      </div>
    </div>
  );
}
