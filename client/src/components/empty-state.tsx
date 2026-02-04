import { Video, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function EmptyState({
  icon: Icon = Video,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center" data-testid="empty-state">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2" data-testid="empty-state-title">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-sm" data-testid="empty-state-description">{description}</p>
      {action && (
        action.href ? (
          <Button asChild data-testid="empty-state-action">
            <Link href={action.href}>
              <Plus className="w-4 h-4 mr-2" />
              {action.label}
            </Link>
          </Button>
        ) : (
          <Button onClick={action.onClick} data-testid="empty-state-action">
            <Plus className="w-4 h-4 mr-2" />
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}
