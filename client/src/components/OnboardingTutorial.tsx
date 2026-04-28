import React, { useState, useEffect } from "react";
import { ChevronRight, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position?: "top" | "bottom" | "left" | "right";
  action?: () => void;
  actionLabel?: string;
}

interface OnboardingTutorialProps {
  isOpen: boolean;
  onClose: () => void;
  steps: TutorialStep[];
  onComplete?: () => void;
}

export function OnboardingTutorial({
  isOpen,
  onClose,
  steps,
  onComplete,
}: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const updateHighlight = () => {
      const step = steps[currentStep];
      if (step?.targetSelector) {
        const element = document.querySelector(step.targetSelector);
        if (element) {
          setHighlightRect(element.getBoundingClientRect());
        }
      } else {
        setHighlightRect(null);
      }
    };

    updateHighlight();
    window.addEventListener("resize", updateHighlight);
    return () => window.removeEventListener("resize", updateHighlight);
  }, [currentStep, isOpen, steps]);

  if (!isOpen || steps.length === 0) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (step.action) {
      step.action();
    }

    if (isLastStep) {
      onComplete?.();
      onClose();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40" onClick={onClose}>
        {/* Dark background */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Highlight box */}
        {highlightRect && (
          <div
            className="absolute border-4 border-yellow-400 rounded-lg shadow-lg"
            style={{
              top: `${highlightRect.top - 4}px`,
              left: `${highlightRect.left - 4}px`,
              width: `${highlightRect.width + 8}px`,
              height: `${highlightRect.height + 8}px`,
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Tutorial card */}
      <div
        className="fixed z-50 bg-white rounded-lg shadow-2xl max-w-sm p-6 animate-in fade-in slide-in-from-bottom-4"
        style={{
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded"
          aria-label="Close tutorial"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Content */}
        <div className="pr-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h2>
          <p className="text-gray-600 mb-4">{step.description}</p>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            <div className="flex gap-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all ${
                    index === currentStep ? "w-8 bg-[#0A2540]" : "w-2 bg-gray-300"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500 ml-auto">
              {currentStep + 1} / {steps.length}
            </span>
          </div>

          {/* Action button */}
          {step.actionLabel && (
            <Button
              onClick={handleNext}
              className="w-full mb-3 bg-green-600 hover:bg-green-700"
            >
              {step.actionLabel}
            </Button>
          )}

          {/* Navigation */}
          <div className="flex gap-3">
            {currentStep > 0 && (
              <Button
                onClick={handlePrev}
                variant="outline"
                className="flex-1"
              >
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              className="flex-1 bg-[#0A2540] hover:bg-[#002080]"
            >
              {isLastStep ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Finish
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>

          {/* Skip option */}
          <button
            onClick={onClose}
            className="w-full mt-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Skip Tutorial
          </button>
        </div>
      </div>
    </>
  );
}

interface OnboardingChecklistProps {
  items: Array<{
    id: string;
    label: string;
    completed: boolean;
    icon: React.ReactNode;
  }>;
}

export function OnboardingChecklist({ items }: OnboardingChecklistProps) {
  const completedCount = items.filter((i) => i.completed).length;
  const progress = Math.round((completedCount / items.length) * 100);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900 mb-2">Get Started Checklist</h3>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-2">
          {completedCount} of {items.length} completed
        </p>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
              item.completed
                ? "bg-green-50 border border-green-200"
                : "bg-white border border-gray-200 hover:border-blue-300"
            }`}
          >
            <div
              className={`flex-shrink-0 ${
                item.completed ? "text-green-600" : "text-gray-400"
              }`}
            >
              {item.completed ? (
                <Check className="w-5 h-5" />
              ) : (
                item.icon
              )}
            </div>
            <span
              className={`text-sm font-medium ${
                item.completed ? "text-green-700" : "text-gray-700"
              }`}
            >
              {item.label}
            </span>
            {item.completed && (
              <span className="ml-auto text-xs text-green-600 font-semibold">
                ✓
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Hook for tutorial management
export function useOnboarding(storageKey: string = "onboarding_completed") {
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    if (!completed) {
      // Small delay to ensure page is fully loaded
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [storageKey]);

  const markAsCompleted = () => {
    localStorage.setItem(storageKey, "true");
    setIsOpen(false);
  };

  const skipTutorial = () => {
    // Persist the skip decision so the tour does not reopen on every visit.
    localStorage.setItem(storageKey, "true");
    setIsOpen(false);
  };

  const resetTutorial = () => {
    localStorage.removeItem(storageKey);
    setIsOpen(true);
  };

  return {
    isOpen,
    markAsCompleted,
    skipTutorial,
    resetTutorial,
    setIsOpen,
  };
}
