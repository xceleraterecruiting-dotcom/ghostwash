'use client';

import { useState, useTransition } from 'react';
import { ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import { submitWaitlist, type WaitlistFormData } from '@/app/actions/waitlist';

const LOCATION_OPTIONS = ['1', '2-5', '6-15', '15+'];
const POS_OPTIONS = ['Washify', 'DRB', "Sonny's", 'ICS', 'Other'];

export function WaitlistForm() {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<WaitlistFormData>({
    name: '',
    email: '',
    washName: '',
    locationCount: '',
    posType: '',
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.washName.trim()) {
      newErrors.washName = 'Car wash name is required';
    }

    if (!formData.locationCount) {
      newErrors.locationCount = 'Please select number of locations';
    }

    if (!formData.posType) {
      newErrors.posType = 'Please select your POS';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    startTransition(async () => {
      const result = await submitWaitlist(formData);
      setMessage(result.message);
      if (result.success) {
        setSubmitted(true);
      }
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  if (submitted) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-xl font-semibold mb-3">You&apos;re on the list</h3>
        <p className="text-muted max-w-md mx-auto">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-8">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Your Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="John Smith"
            className={`w-full bg-black border rounded-lg px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent transition ${
              errors.name ? 'border-red-500' : 'border-border focus:border-accent'
            }`}
          />
          {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="john@carwash.com"
            className={`w-full bg-black border rounded-lg px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent transition ${
              errors.email ? 'border-red-500' : 'border-border focus:border-accent'
            }`}
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
        </div>

        {/* Car Wash Name */}
        <div>
          <label htmlFor="washName" className="block text-sm font-medium mb-2">
            Car Wash Name
          </label>
          <input
            type="text"
            id="washName"
            name="washName"
            value={formData.washName}
            onChange={handleChange}
            placeholder="Sparkle Clean Car Wash"
            className={`w-full bg-black border rounded-lg px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent transition ${
              errors.washName ? 'border-red-500' : 'border-border focus:border-accent'
            }`}
          />
          {errors.washName && <p className="text-red-500 text-sm mt-1">{errors.washName}</p>}
        </div>

        {/* Number of Locations */}
        <div>
          <label htmlFor="locationCount" className="block text-sm font-medium mb-2">
            Number of Locations
          </label>
          <select
            id="locationCount"
            name="locationCount"
            value={formData.locationCount}
            onChange={handleChange}
            className={`w-full bg-black border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent transition appearance-none cursor-pointer ${
              errors.locationCount ? 'border-red-500' : 'border-border focus:border-accent'
            } ${!formData.locationCount ? 'text-muted' : ''}`}
          >
            <option value="" disabled>
              Select...
            </option>
            {LOCATION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt} {opt === '1' ? 'location' : 'locations'}
              </option>
            ))}
          </select>
          {errors.locationCount && (
            <p className="text-red-500 text-sm mt-1">{errors.locationCount}</p>
          )}
        </div>

        {/* POS Type */}
        <div className="md:col-span-2">
          <label htmlFor="posType" className="block text-sm font-medium mb-2">
            Current POS System
          </label>
          <select
            id="posType"
            name="posType"
            value={formData.posType}
            onChange={handleChange}
            className={`w-full bg-black border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent transition appearance-none cursor-pointer ${
              errors.posType ? 'border-red-500' : 'border-border focus:border-accent'
            } ${!formData.posType ? 'text-muted' : ''}`}
          >
            <option value="" disabled>
              Select your POS...
            </option>
            {POS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {errors.posType && <p className="text-red-500 text-sm mt-1">{errors.posType}</p>}
        </div>
      </div>

      {message && !submitted && (
        <p className="text-red-500 text-sm mt-4 text-center">{message}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full mt-8 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            Join the Waitlist
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}
