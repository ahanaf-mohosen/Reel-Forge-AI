import { Check, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@shared/schema";

interface ProcessingStepsProps {
  currentStatus: ProjectStatus;
  progress: number;
}

const steps = [
  { id: 'uploading', label: 'Uploading video', description: 'Receiving and storing your video file' },
  { id: 'transcribing', label: 'Transcribing audio', description: 'Converting speech to text with AI' },
  { id: 'analyzing', label: 'Finding highlights', description: 'AI analyzing content for best moments' },
  { id: 'cutting', label: 'Cutting clips', description: 'Extracting the selected highlights' },
  { id: 'formatting', label: 'Formatting reels', description: 'Converting to vertical 9:16 format' },
];

const statusOrder = ['uploading', 'transcribing', 'analyzing', 'cutting', 'formatting', 'completed'];

export function ProcessingSteps({ currentStatus, progress }: ProcessingStepsProps) {
  const currentIndex = statusOrder.indexOf(currentStatus);
  const isCompleted = currentStatus === 'completed';
  const isFailed = currentStatus === 'failed';

  return (
    <div className="space-y-4" data-testid="processing-steps">
      {steps.map((step, index) => {
        const stepIndex = statusOrder.indexOf(step.id);
        const isActive = currentStatus === step.id;
        const isDone = currentIndex > stepIndex || isCompleted;
        const isPending = !isDone && !isActive;

        return (
          <div
            key={step.id}
            className={cn(
              "flex gap-4 p-4 rounded-lg transition-colors",
              isActive && "bg-primary/5 border border-primary/20",
              isDone && "bg-green-50 dark:bg-green-950/20",
              isPending && "opacity-50"
            )}
            data-testid={`step-${step.id}`}
          >
            <div className="flex-shrink-0">
              {isDone ? (
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              ) : isActive ? (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center animate-pulse-soft">
                  <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-medium",
                isDone && "text-green-600 dark:text-green-400",
                isActive && "text-primary"
              )}>
                {step.label}
              </p>
              <p className="text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>

            {isActive && (
              <div className="flex items-center text-sm font-medium text-primary">
                {Math.round(progress)}%
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
