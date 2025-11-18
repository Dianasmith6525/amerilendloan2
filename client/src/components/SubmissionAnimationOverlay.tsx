import { useEffect, useState } from "react";
import { CheckCircle, PartyPopper } from "lucide-react";

interface SubmissionAnimationOverlayProps {
  isVisible: boolean;
  onAnimationComplete: () => void;
}

export function SubmissionAnimationOverlay({
  isVisible,
  onAnimationComplete,
}: SubmissionAnimationOverlayProps) {
  const [showContent, setShowContent] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    if (isVisible) {
      setShowContent(true);
      setAnimationPhase(0);
      
      // Phase 1: Show animation container (0ms)
      const timer1 = setTimeout(() => setAnimationPhase(1), 100);
      
      // Phase 2: Trigger checkmark animation (800ms)
      const timer2 = setTimeout(() => setAnimationPhase(2), 800);
      
      // Phase 3: Complete animation (2400ms)
      const timer3 = setTimeout(() => {
        onAnimationComplete();
      }, 2400);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    } else {
      setShowContent(false);
      setAnimationPhase(0);
    }
  }, [isVisible, onAnimationComplete]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-black/60 to-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-2xl px-4">
        {/* Main Animation Container */}
        <div className={`transition-all duration-500 ${animationPhase >= 1 ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
          {/* Gradient Background Circle */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-blue-500/20 rounded-full blur-3xl" />
            
            {/* Main Success Indicator */}
            <div className="relative flex justify-center">
              <div className="relative w-40 h-40 flex items-center justify-center">
                {/* Animated Rings */}
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-pulse" />
                <div className={`absolute inset-0 rounded-full border-2 border-emerald-400/50 transition-transform duration-700 ${animationPhase >= 2 ? 'scale-125 opacity-0' : 'scale-100 opacity-100'}`} />
                
                {/* Center Circle */}
                <div className={`relative w-32 h-32 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl transition-transform duration-500 ${animationPhase >= 2 ? 'scale-100' : 'scale-75'}`}>
                  {/* Checkmark */}
                  <svg
                    className={`w-20 h-20 text-white transition-all duration-700 ${animationPhase >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                      className={`transition-all duration-1000 ${animationPhase >= 2 ? 'opacity-100 stroke-dashoffset-0' : 'opacity-0'}`}
                      style={{
                        strokeDasharray: '36',
                        strokeDashoffset: animationPhase >= 2 ? 0 : 36,
                      }}
                    />
                  </svg>
                </div>

                {/* Floating Particles */}
                {animationPhase >= 2 && (
                  <>
                    <div className="absolute w-3 h-3 bg-emerald-400 rounded-full animate-ping" style={{ top: '10%', left: '15%', animationDuration: '0.8s' }} />
                    <div className="absolute w-2 h-2 bg-blue-400 rounded-full animate-ping" style={{ top: '15%', right: '10%', animationDuration: '1s', animationDelay: '0.2s' }} />
                    <div className="absolute w-3 h-3 bg-emerald-400 rounded-full animate-ping" style={{ bottom: '10%', left: '10%', animationDuration: '0.9s', animationDelay: '0.1s' }} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Status Message */}
          <div className={`text-center space-y-4 transition-all duration-700 ${animationPhase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="flex items-center justify-center gap-2">
              <PartyPopper className="h-6 w-6 text-amber-500" />
              <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
                Application Submitted!
              </h2>
              <PartyPopper className="h-6 w-6 text-amber-500" />
            </div>
            
            <p className="text-lg text-gray-700 font-medium">
              Your application has been received and is being processed
            </p>
            
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>We'll send updates to your email</span>
            </div>
          </div>

          {/* Success Icon Glow */}
          <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 transition-all duration-1000 pointer-events-none ${animationPhase >= 2 ? 'opacity-100' : 'opacity-0'}`}>
            <div className="w-32 h-32 bg-emerald-400/20 rounded-full blur-2xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
