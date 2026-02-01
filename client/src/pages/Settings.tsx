import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { User, CreditCard, Shield } from 'lucide-react';
import { userApi } from '../services/api';
import PageHeader from '../components/PageHeader';
import Tabs from '../components/Tabs';
import Switch from '../components/Switch';
import ProfileTab from '../components/settings/ProfileTab';
import CreatorTab from '../components/settings/CreatorTab';
import AccountTab from '../components/settings/AccountTab';
import { SiteMap, SettingsRoute } from '@/types/SiteMapEnum';
import type { User as UserType } from '../types';

const TABS = [
  { value: SiteMap.SETTINGS.PROFILE, to: SiteMap.SETTINGS.PROFILE, icon: User, label: 'Profile' },
  { value: SiteMap.SETTINGS.CREATOR, to: SiteMap.SETTINGS.CREATOR, icon: CreditCard, label: 'Creator' },
  { value: SiteMap.SETTINGS.SUBSCRIPTIONS, to: SiteMap.SETTINGS.SUBSCRIPTIONS, icon: Shield, label: 'Account' },
];

export default function Settings() {
  const { tab } = useParams<{ tab?: string }>();
  const tabPath = `/settings/${tab ?? 'profile'}` as SettingsRoute;
  const activeTab: SettingsRoute = Object.values(SiteMap.SETTINGS).includes(tabPath)
    ? tabPath
    : SiteMap.SETTINGS.PROFILE;

  const { user: clerkUser } = useUser();
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
      <div className="max-w-3xl mx-auto px-8 py-12 animate-pulse">
        <div className="h-8 bg-ink-700 rounded w-1/4 mb-8" />
        <div className="space-y-4">
          <div className="h-12 bg-ink-700 rounded" />
          <div className="h-12 bg-ink-700 rounded" />
          <div className="h-24 bg-ink-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <PageHeader title="Settings" />
      <Tabs.Navigation tabs={TABS} activeTab={activeTab} />

      <Switch expression={activeTab}>
        <Switch.CASE value={SiteMap.SETTINGS.PROFILE}>
          <ProfileTab
            clerkUser={clerkUser}
            username={username}
            setUsername={setUsername}
            displayName={displayName}
            setDisplayName={setDisplayName}
            bio={bio}
            setBio={setBio}
            usernameError={usernameError}
            checkUsername={checkUsername}
            saving={saving}
            saved={saved}
            onSave={handleSaveProfile}
          />
        </Switch.CASE>
        <Switch.CASE value={SiteMap.SETTINGS.CREATOR}>
          <CreatorTab
            acceptsSubscriptions={acceptsSubscriptions}
            setAcceptsSubscriptions={setAcceptsSubscriptions}
            subscriptionPrice={subscriptionPrice}
            setSubscriptionPrice={setSubscriptionPrice}
            saving={saving}
            saved={saved}
            onSave={handleSaveCreatorSettings}
          />
        </Switch.CASE>
        <Switch.CASE value={SiteMap.SETTINGS.SUBSCRIPTIONS}>
          <AccountTab email={clerkUser?.primaryEmailAddress?.emailAddress} />
        </Switch.CASE>
      </Switch>
    </div>
  );
}
