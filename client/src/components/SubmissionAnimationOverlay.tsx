import { useEffect, useState } from "react";
import { CheckCircle, PartyPopper, Star } from "lucide-react";

interface SubmissionAnimationOverlayProps {
  isVisible: boolean;
  onAnimationComplete: () => void;
}

export function SubmissionAnimationOverlay({
  isVisible,
  onAnimationComplete,
}: SubmissionAnimationOverlayProps) {
  const [showContent, setShowContent] = useState(false);
  // Phase 0: hidden  1: scaled-in  2: checkmark  3: fading out
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    if (isVisible) {
      setShowContent(true);
      setAnimationPhase(0);

      // Phase 1: Show animation container (100ms)
      const timer1 = setTimeout(() => setAnimationPhase(1), 100);

      // Phase 2: Trigger checkmark + celebration (800ms)
      const timer2 = setTimeout(() => setAnimationPhase(2), 800);

      // Phase 3: Begin fade-out — 2 extra seconds of approved screen (3800ms vs old 2400ms)
      const timer3 = setTimeout(() => setAnimationPhase(3), 3800);

      // Phase 4: Complete — hand off to success page after fade-out (4500ms)
      const timer4 = setTimeout(() => {
        onAnimationComplete();
      }, 4500);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        clearTimeout(timer4);
      };
    } else {
      setShowContent(false);
      setAnimationPhase(0);
    }
  }, [isVisible, onAnimationComplete]);

  if (!showContent) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-black/60 to-black/40 backdrop-blur-sm"
      style={{
        opacity: animationPhase >= 3 ? 0 : animationPhase >= 1 ? 1 : 0,
        transition: animationPhase >= 3 ? "opacity 700ms ease-out" : "opacity 300ms ease-in",
      }}
    >
      <div className="relative w-full max-w-2xl px-4">
        {/* Main Animation Container */}
        <div className={`transition-all duration-500 ${animationPhase >= 1 ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
          {/* Gradient Background Circle */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-blue-500/20 rounded-full blur-3xl" />

            {/* Main Success Indicator */}
            <div className="relative flex justify-center">
              <div className="relative w-44 h-44 flex items-center justify-center">
                {/* Animated Rings */}
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-pulse" />
                <div
                  className={`absolute inset-0 rounded-full border-2 border-emerald-400/50 transition-transform duration-700 ${
                    animationPhase >= 2 ? 'scale-125 opacity-0' : 'scale-100 opacity-100'
                  }`}
                />
                {/* Outer ring that expands on phase 2 */}
                {animationPhase >= 2 && (
                  <div className="absolute inset-[-12px] rounded-full border-2 border-emerald-300/40 animate-ping" style={{ animationDuration: "1.8s" }} />
                )}

                {/* Center Circle */}
                <div
                  className={`relative w-36 h-36 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl transition-transform duration-500 ${
                    animationPhase >= 2 ? 'scale-100' : 'scale-75'
                  }`}
                >
                  {/* Checkmark */}
                  <svg
                    className={`w-20 h-20 text-white transition-all duration-700 ${
                      animationPhase >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                      style={{
                        strokeDasharray: '36',
                        strokeDashoffset: animationPhase >= 2 ? 0 : 36,
                        transition: 'stroke-dashoffset 900ms ease-out',
                      }}
                    />
                  </svg>
                </div>

                {/* Floating Particles */}
                {animationPhase >= 2 && (
                  <>
                    <div className="absolute w-3 h-3 bg-emerald-400 rounded-full animate-ping" style={{ top: '8%', left: '12%', animationDuration: '0.9s' }} />
                    <div className="absolute w-2 h-2 bg-blue-400 rounded-full animate-ping" style={{ top: '12%', right: '8%', animationDuration: '1.1s', animationDelay: '0.2s' }} />
                    <div className="absolute w-3 h-3 bg-emerald-300 rounded-full animate-ping" style={{ bottom: '8%', left: '8%', animationDuration: '1.0s', animationDelay: '0.15s' }} />
                    <div className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-ping" style={{ bottom: '12%', right: '12%', animationDuration: '0.85s', animationDelay: '0.3s' }} />
                    <div className="absolute w-2 h-2 bg-pink-400 rounded-full animate-ping" style={{ top: '50%', left: '2%', animationDuration: '1.2s', animationDelay: '0.1s' }} />
                    <div className="absolute w-2 h-2 bg-purple-400 rounded-full animate-ping" style={{ top: '50%', right: '2%', animationDuration: '0.95s', animationDelay: '0.25s' }} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status Message */}
          <div
            className={`text-center space-y-4 transition-all duration-700 ${
              animationPhase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <PartyPopper className="h-7 w-7 text-amber-500" />
              <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
                Application Submitted!
              </h2>
              <PartyPopper className="h-7 w-7 text-amber-500" />
            </div>

            <p className="text-lg text-gray-700 font-medium">
              Your application has been received and is being processed
            </p>

            {/* Approved badge — appears slightly after the checkmark */}
            <div
              className={`inline-flex items-center gap-2 bg-emerald-100 border border-emerald-300 rounded-full px-5 py-2 transition-all duration-700 delay-300 ${
                animationPhase >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
              }`}
            >
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-800">Successfully Received</span>
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>We'll send updates to your email</span>
            </div>

            {/* Progress dots - visual loading indication for the 2-second linger */}
            {animationPhase >= 2 && animationPhase < 3 && (
              <div className="flex items-center justify-center gap-1.5 pt-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>

          {/* Glow effect */}
          <div
            className={`absolute top-1/4 left-1/2 -translate-x-1/2 transition-all duration-1000 pointer-events-none ${
              animationPhase >= 2 ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="w-40 h-40 bg-emerald-400/20 rounded-full blur-3xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
