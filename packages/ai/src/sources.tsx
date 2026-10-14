import type React from "react";
import {
  Badge,
  cn,
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
} from "@kanzo-tech/ui";

/** Every word `SourcesTrigger` draws when given none of its own. English by default. */
export interface SourcesTranslations {
  sources: string;
}

const ENGLISH: SourcesTranslations = {
  sources: "Sources",
};

/**
 * What the conversation rests on, folded away: the sources it reads and whatever the host says
 * about them. AI Elements' `Sources`, the collapsible under an answer — here pinned above the
 * transcript, as the thread's details.
 */
export const Sources = (props: React.ComponentProps<typeof Collapsible>) => {
  const { className, slot, ...rest } = props;
  return <Collapsible className={cn("w-full text-sm", className)} {...rest} slot={slot ?? "sources"} />;
};

export interface SourcesTriggerProps extends React.ComponentProps<typeof CollapsibleTrigger> {
  /** How many sources there are, drawn as a pill beside the word. */
  count: number;
  translations?: Partial<SourcesTranslations>;
}

/** The row that folds the block: *Sources*, their count, and the chevron. `children` for other words. */
export const SourcesTrigger = (props: SourcesTriggerProps) => {
  const { count, translations, className, children, slot, ...rest } = props;
  const t = { ...ENGLISH, ...translations };

  return (
    <CollapsibleTrigger
      className={cn("flex w-full items-center gap-2 font-medium", className)}
      {...rest}
      slot={slot ?? "sources-trigger"}
    >
      <span>{children ?? t.sources}</span>
      <Badge pill size="sm" variant="secondary">
        {count}
      </Badge>
      <CollapsibleIndicator className="ms-auto shrink-0 text-muted-foreground" />
    </CollapsibleTrigger>
  );
};

/** What the block holds when open: the host's words, then the sources, wrapping. */
export const SourcesContent = (props: React.ComponentProps<typeof CollapsibleContent>) => {
  const { className, slot, ...rest } = props;
  return (
    <CollapsibleContent
      className={cn("flex flex-wrap items-center gap-2 pt-2", className)}
      {...rest}
      slot={slot ?? "sources-content"}
    />
  );
};

/**
 * One source, as a pill whose words are its children — *Contracts · 3*. Not AI Elements' link with
 * a title: a source here is a connection or a file the host names, and one that opens somewhere is
 * `asChild` over the host's link.
 */
export const Source = (props: React.ComponentProps<typeof Badge>) => {
  const { slot, ...rest } = props;
  return <Badge pill variant="outline" {...rest} slot={slot ?? "source"} />;
};
