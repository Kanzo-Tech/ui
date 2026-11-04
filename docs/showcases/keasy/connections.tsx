"use client";

import {
  Badge,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionRoot,
  SectionTitle,
  SectionTitleGroup,
  ShellMain,
  Show,
} from "@kanzo-tech/ui";
import { ScreenHeader } from "./header";
import { CONNECTIONS } from "./studio-data";
import { KIND_ICON, KIND_LABEL } from "./studio-panels";

/** The workspace's connections: what a graph's program can reference as `@name`. */
export function Connections() {
  return (
    <>
      <ScreenHeader crumbs={[{ label: "Connections" }]} />
      <ShellMain className="bg-background">
        <SectionRoot>
          <SectionHeader scale="page">
            <SectionTitleGroup>
              <SectionTitle level={1} scale="page">
                Connections
              </SectionTitle>
              <SectionDescription>
                Every source and vocabulary a graph can read, and where it may write.
              </SectionDescription>
            </SectionTitleGroup>
          </SectionHeader>
          <SectionBody scale="page">
            <ItemGroup className="max-w-3xl gap-2">
              {CONNECTIONS.map((c) => {
                const Icon = KIND_ICON[c.kind];
                return (
                  <Item key={c.id} variant="outline">
                    <ItemMedia variant="icon">
                      <Icon />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="font-mono">
                        @{c.name}
                        <Show when={c.writable === true}>
                          <Badge size="xs" variant="secondary">
                            writable
                          </Badge>
                        </Show>
                      </ItemTitle>
                      <ItemDescription className="line-clamp-1 break-all">{c.url}</ItemDescription>
                      <span className="text-faint text-xs">{KIND_LABEL[c.kind]}</span>
                    </ItemContent>
                  </Item>
                );
              })}
            </ItemGroup>
          </SectionBody>
        </SectionRoot>
      </ShellMain>
    </>
  );
}
