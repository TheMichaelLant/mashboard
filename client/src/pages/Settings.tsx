import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { User, CreditCard, Shield, Save, Check } from 'lucide-react';
import { userApi } from '../services/api';
import type { User as UserType } from '../types';

type Tab = 'profile' | 'subscriptions' | 'creator';

export default function Settings() {
  const { user: clerkUser } = useUser();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [profile, setProfile] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile form state
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [usernameError, setUsernameError] = useState('');

  // Creator settings
  const [acceptsSubscriptions, setAcceptsSubscriptions] = useState(false);
  const [subscriptionPrice, setSubscriptionPrice] = useState(0);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await userApi.getMe();
        setProfile(data);
        setUsername(data.username);
        setDisplayName(data.displayName);
        setBio(data.bio || '');
        setAcceptsSubscriptions(data.creatorSettings?.acceptsSubscriptions || false);
        setSubscriptionPrice(data.creatorSettings?.subscriptionPrice || 0);
      } catch (error) {
        // User might not have a profile yet
        if (clerkUser) {
          setDisplayName(clerkUser.fullName || '');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [clerkUser]);

  const checkUsername = async (value: string) => {
    if (value === profile?.username) {
      setUsernameError('');
      return;
    }

    if (value.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      setUsernameError('Username can only contain letters, numbers, and underscores');
      return;
    }

    try {
      const { available } = await userApi.checkUsername(value);
      if (!available) {
        setUsernameError('Username is already taken');
      } else {
        setUsernameError('');
      }
    } catch (error) {
      console.error('Failed to check username:', error);
    }
  };

  const handleSaveProfile = async () => {
    if (usernameError) return;

    setSaving(true);
    try {
      await userApi.updateMe({
        username,
        displayName,
        bio,
        avatarUrl: clerkUser?.imageUrl,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCreatorSettings = async () => {
    setSaving(true);
    try {
      await userApi.updateCreatorSettings({
        acceptsSubscriptions,
        subscriptionPrice,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save creator settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse">
        <div className="h-8 bg-paper-200 rounded w-1/4 mb-8" />
        <div className="space-y-4">
          <div className="h-12 bg-paper-200 rounded" />
          <div className="h-12 bg-paper-200 rounded" />
          <div className="h-24 bg-paper-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-display font-bold text-ink-900 mb-6">
        Settings
      </h1>

      {/* Tabs */}
      <div className="flex items-center space-x-1 border-b border-paper-100 mb-6">
        <TabButton
          active={activeTab === 'profile'}
          onClick={() => setActiveTab('profile')}
          icon={User}
          label="Profile"
        />
        <TabButton
          active={activeTab === 'creator'}
          onClick={() => setActiveTab('creator')}
          icon={CreditCard}
          label="Creator"
        />
        <TabButton
          active={activeTab === 'subscriptions'}
          onClick={() => setActiveTab('subscriptions')}
          icon={Shield}
          label="Account"
        />
      </div>

      {/* Profile Settings */}
      {activeTab === 'profile' && (
        <div className="card p-6 space-y-6">
          <div className="flex items-center space-x-4">
            {clerkUser?.imageUrl ? (
              <img
                src={clerkUser.imageUrl}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-ink-200 flex items-center justify-center">
                <span className="text-ink-600 font-bold text-2xl">
                  {displayName.charAt(0) || '?'}
                </span>
              </div>
            )}
            <div>
              <p className="text-sm text-ink-500">
                Profile picture is managed through Clerk
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-ink-700 block mb-2">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  checkUsername(e.target.value);
                }}
                className={`input pl-8 ${usernameError ? 'border-red-500' : ''}`}
                placeholder="username"
              />
            </div>
            {usernameError && (
              <p className="text-sm text-red-500 mt-1">{usernameError}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-ink-700 block mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-ink-700 block mb-2">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="input min-h-[100px]"
              placeholder="Tell us about yourself..."
            />
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving || !!usernameError}
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
                {saving ? 'Saving...' : 'Save Profile'}
              </>
            )}
          </button>
        </div>
      )}

      {/* Creator Settings */}
      {activeTab === 'creator' && (
        <div className="card p-6 space-y-6">
          <div>
            <h2 className="text-xl font-heading font-semibold text-ink-900 mb-2">
              Creator Settings
            </h2>
            <p className="text-ink-600">
              Enable subscriptions to monetize your content. Subscribers get access to your paid posts.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-ink-700">
                Accept Subscriptions
              </label>
              <p className="text-sm text-ink-500">
                Allow readers to subscribe to your content
              </p>
            </div>
            <button
              onClick={() => setAcceptsSubscriptions(!acceptsSubscriptions)}
              className={`w-12 h-6 rounded-full transition-colors ${
                acceptsSubscriptions ? 'bg-ink-900' : 'bg-paper-300'
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
              <label className="text-sm font-medium text-ink-700 block mb-2">
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
            onClick={handleSaveCreatorSettings}
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
      )}

      {/* Account Settings */}
      {activeTab === 'subscriptions' && (
        <div className="card p-6 space-y-6">
          <div>
            <h2 className="text-xl font-heading font-semibold text-ink-900 mb-2">
              Account Settings
            </h2>
            <p className="text-ink-600">
              Manage your account security and preferences.
            </p>
          </div>

          <div className="border-t border-paper-100 pt-6">
            <h3 className="font-medium text-ink-700 mb-2">Email</h3>
            <p className="text-ink-900">{clerkUser?.primaryEmailAddress?.emailAddress}</p>
            <p className="text-sm text-ink-500 mt-1">
              Managed through Clerk authentication
            </p>
          </div>

          <div className="border-t border-paper-100 pt-6">
            <h3 className="font-medium text-ink-700 mb-2">Security</h3>
            <p className="text-sm text-ink-600">
              Account security settings are managed through Clerk.
              Click the user menu in the top right to access security settings.
            </p>
          </div>

          <div className="border-t border-paper-100 pt-6">
            <h3 className="font-medium text-red-600 mb-2">Danger Zone</h3>
            <p className="text-sm text-ink-600 mb-4">
              Deleting your account will remove all your posts, bookmarks, and data permanently.
            </p>
            <button className="btn bg-red-600 text-white hover:bg-red-700">
              Delete Account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}

function TabButton({ active, onClick, icon: Icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
        active
          ? 'border-ink-900 text-ink-900'
          : 'border-transparent text-ink-500 hover:text-ink-700'
      }`}
    >
      <Icon size={18} />
      <span className="font-medium">{label}</span>
    </button>
  );
}
