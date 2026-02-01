import { Save, Check } from 'lucide-react';

interface ProfileTabProps {
  clerkUser: {
    imageUrl?: string;
  } | null | undefined;
  username: string;
  setUsername: (value: string) => void;
  displayName: string;
  setDisplayName: (value: string) => void;
  bio: string;
  setBio: (value: string) => void;
  usernameError: string;
  checkUsername: (value: string) => void;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
}

export default function ProfileTab({
  clerkUser,
  username,
  setUsername,
  displayName,
  setDisplayName,
  bio,
  setBio,
  usernameError,
  checkUsername,
  saving,
  saved,
  onSave,
}: ProfileTabProps) {
  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center space-x-4">
        {clerkUser?.imageUrl ? (
          <img
            src={clerkUser.imageUrl}
            alt="Avatar"
            className="w-20 h-20 rounded-full object-cover"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-ink-700 flex items-center justify-center">
            <span className="text-ink-400 font-bold text-2xl">
              {displayName.charAt(0) || '?'}
            </span>
          </div>
        )}
        <div>
          <p className="text-sm text-ink-400">
            Profile picture is managed through Clerk
          </p>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-ink-300 block mb-2">
          Username
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500">
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
          <p className="text-sm text-red-400 mt-1">{usernameError}</p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-ink-300 block mb-2">
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
        <label className="text-sm font-medium text-ink-300 block mb-2">
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
        onClick={onSave}
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
  );
}
