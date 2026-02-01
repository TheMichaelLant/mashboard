interface AccountTabProps {
  email: string | undefined;
}

export default function AccountTab({ email }: AccountTabProps) {
  return (
    <div className="card p-6 space-y-6">
      <div>
        <h2 className="text-xl font-heading font-semibold text-ink-100 mb-2">
          Account Settings
        </h2>
        <p className="text-ink-400">
          Manage your account security and preferences.
        </p>
      </div>

      <div className="border-t border-ink-700 pt-6">
        <h3 className="font-medium text-ink-200 mb-2">Email</h3>
        <p className="text-ink-100">{email}</p>
        <p className="text-sm text-ink-500 mt-1">
          Managed through Clerk authentication
        </p>
      </div>

      <div className="border-t border-ink-700 pt-6">
        <h3 className="font-medium text-ink-200 mb-2">Security</h3>
        <p className="text-sm text-ink-400">
          Account security settings are managed through Clerk.
          Click the user menu in the top right to access security settings.
        </p>
      </div>

      <div className="border-t border-ink-700 pt-6">
        <h3 className="font-medium text-red-400 mb-2">Danger Zone</h3>
        <p className="text-sm text-ink-400 mb-4">
          Deleting your account will remove all your posts, bookmarks, and data permanently.
        </p>
        <button className="btn bg-red-600 text-white hover:bg-red-700">
          Delete Account
        </button>
      </div>
    </div>
  );
}
