import { Check } from 'lucide-react';
import { clsx } from 'clsx';

export default function WorkflowStepper({ stages, currentStage }) {
  const currentIndex = currentStage 
    ? stages.findIndex(s => s.toLowerCase() === currentStage.toLowerCase())
    : -1;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        {stages.map((stage, index) => {
          const isComplete = currentIndex > index;
          const isCurrent = currentIndex === index;
          const isPending = currentIndex < index || currentIndex === -1;

          return (
            <div key={stage} className="stepper-item flex-1">
              <div className="flex items-center">
                {/* Circle */}
                <div
                  className={clsx(
                    'stepper-circle',
                    isComplete && 'stepper-circle-complete',
                    isCurrent && 'stepper-circle-active',
                    isPending && !isCurrent && 'stepper-circle-pending'
                  )}
                >
                  {isComplete ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Line */}
                {index < stages.length - 1 && (
                  <div
                    className={clsx(
                      'stepper-line',
                      isComplete ? 'stepper-line-complete' : 'stepper-line-pending'
                    )}
                  />
                )}
              </div>

              {/* Label */}
              <p
                className={clsx(
                  'mt-2 text-xs font-medium',
                  isCurrent ? 'text-primary-600' : isComplete ? 'text-success-600' : 'text-neutral-500'
                )}
              >
                {stage}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
