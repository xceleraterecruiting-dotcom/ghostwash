'use client';

import { useEffect, useState, useRef } from 'react';

// Animated counter that triggers when parent becomes visible
function AnimatedNumber({
  value,
  isVisible,
  delay = 0,
  prefix = ''
}: {
  value: number;
  isVisible: boolean;
  delay?: number;
  prefix?: string;
}) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (!isVisible || hasAnimated) return;

    const timeout = setTimeout(() => {
      setHasAnimated(true);
      const duration = 1500;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.floor(eased * value));

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setCount(value); // Ensure final value is exact
        }
      };
      requestAnimationFrame(animate);
    }, delay);

    return () => clearTimeout(timeout);
  }, [isVisible, hasAnimated, value, delay]);

  return <>{prefix}{count}</>;
}

// Animated product screenshot showing the daily briefing feature
export function DailyBriefingMock() {
  const [visible, setVisible] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fade in animation
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Intersection observer for counter animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect(); // Only trigger once
        }
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full max-w-md mx-auto transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* Browser chrome */}
      <div className="bg-[#1a1a1a] rounded-t-xl px-4 py-3 flex items-center gap-2 border border-border border-b-0">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-[#0a0a0a] rounded-md px-3 py-1.5 text-xs text-muted text-center">
            app.ghostwash.ai
          </div>
        </div>
      </div>

      {/* App content */}
      <div className="bg-[#0a0a0a] rounded-b-xl border border-border border-t-0 p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted text-xs uppercase tracking-wide">Daily Briefing</p>
            <p className="text-white text-lg font-semibold mt-0.5">Good morning, Mike</p>
          </div>
          <div className="text-right">
            <p className="text-muted text-xs">March 16, 2026</p>
            <p className="text-white text-sm font-medium">7:02 AM</p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-semibold text-white">
              <AnimatedNumber value={4} isVisible={isInView} delay={200} />
            </p>
            <p className="text-xs text-muted mt-1">Members Saved</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-accent">
              <AnimatedNumber value={847} isVisible={isInView} delay={400} prefix="$" />
            </p>
            <p className="text-xs text-muted mt-1">Revenue Recovered</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-white">
              <AnimatedNumber value={12} isVisible={isInView} delay={600} />
            </p>
            <p className="text-xs text-muted mt-1">Cards Retried</p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Activity feed */}
        <div className="space-y-3">
          <p className="text-xs text-muted uppercase tracking-wide">Last Night</p>

          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-white">Sarah M. was about to cancel</p>
              <p className="text-xs text-muted mt-0.5">Sent 20% off next month. She stayed.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-white">3 declined cards recovered</p>
              <p className="text-xs text-muted mt-0.5">Retried on payday. $127/mo recovered.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-white">5 new members onboarded</p>
              <p className="text-xs text-muted mt-0.5">Welcome sequence started automatically.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2">
          <div className="bg-surface border border-border rounded-lg p-3 text-center">
            <p className="text-xs text-muted">That&apos;s it. GhostWash handled everything else.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
