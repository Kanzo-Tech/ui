"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@kanzo-tech/ui";
import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PreviewIframeTabsProps {
  iframe: ReactNode;
  /** The showcase source; when absent, the Code tab is hidden. */
  source?: ReactNode;
  /** Standalone `/view/showcases/<name>` URL for the full-size link. */
  fullUrl: string;
}

export const PreviewIframeTabs = ({ iframe, source, fullUrl }: PreviewIframeTabsProps) => (
  <Tabs className="group relative mt-4 mb-12 flex flex-col gap-2" defaultValue="preview">
    <div className="flex items-center justify-between gap-2">
      <TabsList>
        <TabsTrigger value="preview">Preview</TabsTrigger>
        {source && <TabsTrigger value="code">Code</TabsTrigger>}
      </TabsList>
      <a
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
        href={fullUrl}
        rel="noreferrer"
        target="_blank"
      >
        Open full size
        <ExternalLinkIcon className="size-3.5" />
      </a>
    </div>

    <div className="relative overflow-hidden rounded-2xl border">
      <TabsContent slot="tab-preview" value="preview">
        {iframe}
      </TabsContent>
      {source && (
        <TabsContent slot="tab-code" value="code">
          {source}
        </TabsContent>
      )}
    </div>
  </Tabs>
);
