import { Save, Check } from 'lucide-react';

interface CreatorTabProps {
  acceptsSubscriptions: boolean;
  setAcceptsSubscriptions: (value: boolean) => void;
  subscriptionPrice: number;
  setSubscriptionPrice: (value: number) => void;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
}

export default function CreatorTab({
  acceptsSubscriptions,
  setAcceptsSubscriptions,
  subscriptionPrice,
  setSubscriptionPrice,
  saving,
  saved,
  onSave,
}: CreatorTabProps) {
  return (
    <div className="card p-6 space-y-6">
      <div>
        <h2 className="text-xl font-heading font-semibold text-ink-100 mb-2">
          Creator Settings
        </h2>
        <p className="text-ink-400">
          Enable subscriptions to monetize your content. Subscribers get access to your paid posts.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <label className="font-medium text-ink-200">
            Accept Subscriptions
          </label>
          <p className="text-sm text-ink-400">
            Allow readers to subscribe to your content
          </p>
        </div>
        <button
          onClick={() => setAcceptsSubscriptions(!acceptsSubscriptions)}
          className={`w-12 h-6 rounded-full transition-colors ${
            acceptsSubscriptions ? 'bg-gold-600' : 'bg-ink-600'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
              acceptsSubscriptions ? 'translate-x-6' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {acceptsSubscriptions && (
        <div>
          <label className="text-sm font-medium text-ink-300 block mb-2">
            Monthly Subscription Price ($)
          </label>
          <input
            type="number"
            value={subscriptionPrice}
            onChange={(e) => setSubscriptionPrice(parseFloat(e.target.value) || 0)}
            className="input w-32"
            min="0"
            step="0.01"
          />
          <p className="text-sm text-ink-500 mt-1">
            Set to 0 for free subscriptions (supporters only)
          </p>
        </div>
      )}

      <button
        onClick={onSave}
        disabled={saving}
        className="btn btn-primary disabled:opacity-50"
      >
        {saved ? (
          <>
            <Check size={18} className="mr-2" />
            Saved!
          </>
        ) : (
          <>
            <Save size={18} className="mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </>
        )}
      </button>
    </div>
  );
}
