import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { ArrowRight, Check } from 'lucide-react';
import { userApi } from '../services/api';

export default function Onboarding() {
  const navigate = useNavigate();
  const { user: clerkUser } = useUser();

  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(clerkUser?.fullName || '');
  const [bio, setBio] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [loading, setLoading] = useState(false);

  const checkUsername = async (value: string) => {
    if (value.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return false;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      setUsernameError('Username can only contain letters, numbers, and underscores');
      return false;
    }

    try {
      const { available } = await userApi.checkUsername(value);
      if (!available) {
        setUsernameError('Username is already taken');
        return false;
      }
      setUsernameError('');
      return true;
    } catch (error) {
      console.error('Failed to check username:', error);
      return false;
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      const isValid = await checkUsername(username);
      if (isValid) {
        setStep(2);
      }
    } else if (step === 2) {
      setStep(3);
    } else {
      setLoading(true);
      try {
        await userApi.updateMe({
          username,
          displayName,
          bio,
          avatarUrl: clerkUser?.imageUrl,
        });
        navigate('/feed');
      } catch (error) {
        console.error('Failed to create profile:', error);
        alert('Failed to create profile. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-paper-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-ink-900">
            Welcome to Mashboard
          </h1>
          <p className="text-ink-600 mt-2">Let's set up your profile</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step > s
                    ? 'bg-ink-900 text-paper-50'
                    : step === s
                    ? 'bg-ink-900 text-paper-50'
                    : 'bg-paper-200 text-ink-500'
                }`}
              >
                {step > s ? <Check size={16} /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 h-1 ${
                    step > s ? 'bg-ink-900' : 'bg-paper-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="card p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-heading font-semibold text-ink-900 mb-1">
                  Choose your username
                </h2>
                <p className="text-sm text-ink-600">
                  This is how others will find you on Mashboard
                </p>
              </div>
              <div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
                    @
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value.toLowerCase());
                      if (e.target.value.length >= 3) {
                        checkUsername(e.target.value.toLowerCase());
                      }
                    }}
                    className={`input pl-8 ${usernameError ? 'border-red-500' : ''}`}
                    placeholder="username"
                  />
                </div>
                {usernameError && (
                  <p className="text-sm text-red-500 mt-1">{usernameError}</p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-heading font-semibold text-ink-900 mb-1">
                  What should we call you?
                </h2>
                <p className="text-sm text-ink-600">
                  This is the name that will appear on your profile
                </p>
              </div>
              <div>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input"
                  placeholder="Your name"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-heading font-semibold text-ink-900 mb-1">
                  Tell us about yourself
                </h2>
                <p className="text-sm text-ink-600">
                  A short bio to help others get to know you (optional)
                </p>
              </div>
              <div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="input min-h-[100px]"
                  placeholder="Writer, dreamer, coffee enthusiast..."
                />
              </div>
            </div>
          )}

          <button
            onClick={handleNext}
            disabled={
              loading ||
              (step === 1 && (!username || !!usernameError)) ||
              (step === 2 && !displayName)
            }
            className="btn btn-primary w-full mt-6 disabled:opacity-50"
          >
            {loading ? (
              'Creating profile...'
            ) : step === 3 ? (
              'Complete Setup'
            ) : (
              <>
                Continue
                <ArrowRight size={18} className="ml-2" />
              </>
            )}
          </button>

          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="btn btn-ghost w-full mt-2"
            >
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
