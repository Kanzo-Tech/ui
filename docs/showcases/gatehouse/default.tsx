"use client";

import { useMemo, useState } from "react";
import { AuthProvider, Gate, useOrganization, useSession } from "@kanzo-tech/auth";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertTitle,
  AvatarFallback,
  Badge,
  Button,
  ButtonGroup,
  ButtonGroupText,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardMedia,
  CardTitle,
  Link,
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  SectionActions,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionRoot,
  SectionTitle,
  SectionTitleGroup,
  Separator,
  ShellHeader,
  ShellMain,
  ShellRoot,
  Show,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarIdentity,
  SidebarIdentityAvatar,
  SidebarIdentityDescription,
  SidebarIdentityIcon,
  SidebarIdentityLabel,
  SidebarIdentityText,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  Spinner,
  Status,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Toaster,
  toast,
  useSidebar,
} from "@kanzo-tech/ui";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  KeyRoundIcon,
  LandmarkIcon,
  LockIcon,
  LogOutIcon,
  SettingsIcon,
  ShieldAlertIcon,
  StampIcon,
  UserIcon,
} from "lucide-react";
import { initialsOf } from "@/example/people";
import { grade, type HallId, HOME_HALL, hall, questStatus } from "@/example/world";
import { boardOf, gatehouseAuth, HALL_OPTIONS, NAV, roleLabel } from "./data";

/**
 * The gatehouse: who may pass, and as which hall.
 *
 * Two screens and one session. Outside, a sign-in card the library does not ship — a mark, a
 * sentence, a button and a legal line, and every product answers those four differently. Inside,
 * the shell that screen leads to: a hall switcher driven by `useOrganization`, a nav column and a
 * board that `Gate` draws differently for a warden, and a log out that is an ordinary menu item
 * owning its own confirmation.
 *
 * The one thing to carry away is drawn on the screen rather than written only here: **what the
 * client knows about its roles is for drawing, never for deciding.**
 */
export function GatehouseShowcase() {
  // Memoised: the provider subscribes to this object, so a new `Auth` per render is a new
  // subscription per render — and a session that is re-read forever.
  const auth = useMemo(() => gatehouseAuth(), []);

  return (
    <AuthProvider auth={auth}>
      <Gatehouse />
      <Toaster />
    </AuthProvider>
  );
}

function Gatehouse() {
  const { status } = useSession();

  // `status`, not `session === null`: one value is the same answer for "anonymous" and "we have not
  // looked yet", and a sign-in card drawn during the second is a flicker on every reload. Neither
  // screen is known to be right while it is loading, so neither is drawn.
  if (status === "loading") {
    return (
      <ShellRoot>
        <ShellMain className="items-center justify-center">
          <Spinner className="size-5 text-muted-foreground" />
        </ShellMain>
      </ShellRoot>
    );
  }

  return (
    <Show fallback={<SignIn />} when={status === "authenticated"}>
      <Board />
    </Show>
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* Outside the gate                                                                                 */
/* ---------------------------------------------------------------------------------------------- */

/**
 * The screen the library ships none of.
 *
 * Nothing below is an auth component: a `Card`, a `Button`, two `Link`s and a square brand tile
 * written out in Tailwind. That is the argument for the absence — there is no shared shape here
 * to extract, only a mark, a sentence, a button and a legal line that every product words itself.
 */
function SignIn() {
  const { signIn } = useSession();

  return (
    <ShellRoot className="bg-background">
      <ShellMain className="items-center justify-center gap-6 p-6">
        <Card className="w-full max-w-sm">
          {/* The mark is `CardMedia`, not a div inside `CardHeader`: the header is a two-row grid
              and `CardDescription` is pinned to its second row, so a third child there pushes the
              title under the description. */}
          <CardMedia variant="icon">
            <div className="flex size-10 items-center justify-center rounded-box bg-primary text-primary-foreground">
              <LandmarkIcon className="size-5" />
            </div>
          </CardMedia>
          <CardHeader>
            <CardTitle>The Gatehouse</CardTitle>
            <CardDescription>
              The board, the roster and the ledger of the five halls. The porter checks the
              register; charters are held by the halls.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-3">
            <Button className="w-full" onClick={() => void signIn()} size="lg">
              <KeyRoundIcon />
              Continue to the register
            </Button>
            <p className="text-center text-muted-foreground text-xs">
              You are sent to <span className="font-mono">register.guild.example</span> and returned
              here. The gatehouse never sees a passphrase.
            </p>
          </CardContent>

          <CardFooter className="flex-col items-stretch gap-2 border-t pt-4">
            <p className="text-center text-muted-foreground text-xs">
              Passing the gate accepts the <Link href="#charter">charter</Link> and the{" "}
              <Link href="#privacy">privacy notice</Link>.
            </p>
          </CardFooter>
        </Card>

        <p className="max-w-sm text-balance text-center text-muted-foreground text-xs">
          <span className="font-mono">@kanzo-tech/auth</span> ships no sign-in screen, and this is why: everything above is a logo, a
          sentence, a button and a legal line, and no two products answer those the same way. What
          is shared sits underneath — reading a token into one session, asking a role inside an
          organization, and keeping a <span className="font-mono">fetch</span> authenticated.
        </p>
      </ShellMain>
    </ShellRoot>
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* Inside                                                                                           */
/* ---------------------------------------------------------------------------------------------- */

/**
 * The hall being looked at is held here, and in a product it is read off the URL.
 *
 * It is deliberately not on the session: membership is stable and comes from the token, while
 * *which* organization you are in is a property of the request. Keeping them apart is what lets two
 * tabs sit in two halls at once — a stored active organization is one value they would fight over.
 */
function Board() {
  const [alias, setAlias] = useState<HallId>(HOME_HALL);

  return (
    <SidebarProvider className="h-dvh min-h-0 overflow-hidden">
      {/* Its own component because the switcher, the nav and the footer all read `useSidebar()`,
          and that context is only readable below the provider. */}
      <Rail alias={alias} onAlias={setAlias} />

      <SidebarInset>
        <ShellHeader className="h-12 flex-row items-center gap-2 px-3">
          <SidebarTrigger />
          <Separator className="h-4" orientation="vertical" />
          <span className="truncate font-medium text-sm">{hall(alias).short}</span>
          <div className="ms-auto">
            <HallStanding alias={alias} />
          </div>
        </ShellHeader>

        <ShellMain className="bg-background">
          <HallView alias={alias} onAlias={setAlias} />
        </ShellMain>
      </SidebarInset>
    </SidebarProvider>
  );
}

/** What the token says the viewer is *here*, read back out of the session rather than assumed. */
function HallStanding({ alias }: { alias: HallId }) {
  const { isMember, organization } = useOrganization(alias);

  return (
    <Badge variant="outline">
      <Show
        fallback={
          <>
            <Status className="size-1.5" variant="destructive" />
            No charter
          </>
        }
        when={isMember}
      >
        <Status className="size-1.5" variant="success" />
        {organization?.roles.map(roleLabel).join(" · ")}
      </Show>
    </Badge>
  );
}

function Rail({ alias, onAlias }: { alias: HallId; onAlias: (alias: HallId) => void }) {
  const { isMobile, setOpenMobile, state } = useSidebar();
  const { isMember, organization } = useOrganization(alias);
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Menu
              positioning={{ gutter: 4, placement: isMobile ? "bottom-start" : "right-start" }}
            >
              <MenuTrigger asChild>
                <SidebarMenuButton
                  aria-label={hall(alias).short}
                  className="group-data-[collapsible=icon]:justify-center data-[state=open]:bg-sidebar-accent"
                  size="lg"
                >
                  <SidebarIdentity collapsed={collapsed} responsive>
                    <SidebarIdentityIcon>
                      <LandmarkIcon />
                    </SidebarIdentityIcon>
                    <SidebarIdentityText>
                      <SidebarIdentityLabel>{hall(alias).short}</SidebarIdentityLabel>
                      <SidebarIdentityDescription>
                        {/* The derived answer, drawn where a product usually hard-codes the
                            organization's own name: a hall with no charter says so here. */}
                        {isMember
                          ? organization?.roles.map(roleLabel).join(" · ")
                          : "Not a member"}
                      </SidebarIdentityDescription>
                    </SidebarIdentityText>
                  </SidebarIdentity>
                  <ChevronsUpDownIcon className="ms-auto group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </MenuTrigger>

              <MenuContent className="w-(--reference-width) min-w-64">
                <MenuGroup heading="Halls">
                  {/* Every hall, including the two the session carries no charter in. A switcher
                      that lists only your memberships cannot show what happens when you address an
                      organization you do not belong to, and that case is the one worth seeing. */}
                  {HALL_OPTIONS.map((entry) => (
                    <MenuItem
                      key={entry.id}
                      onClick={() => {
                        onAlias(entry.id);
                        setOpenMobile(false);
                      }}
                      value={entry.id}
                    >
                      <SidebarIdentity>
                        <SidebarIdentityIcon>
                          <LandmarkIcon />
                        </SidebarIdentityIcon>
                        <SidebarIdentityText>
                          <SidebarIdentityLabel>{entry.short}</SidebarIdentityLabel>
                          <SidebarIdentityDescription>
                            {entry.chartered ? entry.seat : "No charter"}
                          </SidebarIdentityDescription>
                        </SidebarIdentityText>
                      </SidebarIdentity>
                      <Show when={entry.id === alias}>
                        <CheckIcon className="ms-auto" />
                      </Show>
                    </MenuItem>
                  ))}
                </MenuGroup>
              </MenuContent>
            </Menu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label="Hall">
          <SidebarGroup>
            <SidebarGroupLabel>Hall</SidebarGroupLabel>
            <SidebarMenu>
              {NAV.map((entry) => {
                const row = (
                  <SidebarMenuItem key={entry.title}>
                    <SidebarMenuButton
                      isActive={entry.title === "Board"}
                      onClick={() => setOpenMobile(false)}
                      tooltip={entry.title}
                    >
                      {entry.icon}
                      <span className="truncate">{entry.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );

                // A gated row simply is not there for a member — no disabled control, no
                // explanation. What the row leads to is refused by the server either way.
                return entry.role ? (
                  <Gate key={entry.title} organization={alias} role={entry.role}>
                    {row}
                  </Gate>
                ) : (
                  row
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      <SidebarFooter>
        <UserMenu collapsed={collapsed} isMobile={isMobile} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/**
 * The footer identity row, and the only place the session is left.
 *
 * Log out is an ordinary `MenuItem` with `variant="destructive"` — the library ships no logout
 * affordance, because an auth flow does not belong in a library whose admission rules exclude auth.
 * The confirmation below, its wording and the fact that there is one at all are this product's.
 */
function UserMenu({ collapsed, isMobile }: { collapsed: boolean; isMobile: boolean }) {
  const { session, signOut } = useSession();
  const [confirming, setConfirming] = useState(false);

  // A deref guard stays `&&`: `Show`'s children are an ordinary eager prop, so the fallback branch
  // would still evaluate `session.user` here.
  if (!session) return null;
  const name = session.user.name ?? session.user.username ?? session.user.id;

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <Menu positioning={{ gutter: 4, placement: isMobile ? "bottom-end" : "right-end" }}>
            <MenuTrigger asChild>
              {/* Collapsed the button is a 32px square the avatar fills, so round the button too —
                  otherwise its `overflow-hidden` clips the circle square. */}
              <SidebarMenuButton
                aria-label={name}
                className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full data-[state=open]:bg-sidebar-accent"
                size="lg"
              >
                <SidebarIdentity collapsed={collapsed} responsive>
                  <SidebarIdentityAvatar>
                    <AvatarFallback>{initialsOf(name)}</AvatarFallback>
                  </SidebarIdentityAvatar>
                  <SidebarIdentityText>
                    <SidebarIdentityLabel>{name}</SidebarIdentityLabel>
                    <SidebarIdentityDescription>{session.user.email}</SidebarIdentityDescription>
                  </SidebarIdentityText>
                </SidebarIdentity>
                <ChevronsUpDownIcon className="ms-auto group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </MenuTrigger>

            <MenuContent className="w-(--reference-width) min-w-60">
              <div className="px-2 py-1.5">
                <SidebarIdentity>
                  <SidebarIdentityAvatar>
                    <AvatarFallback>{initialsOf(name)}</AvatarFallback>
                  </SidebarIdentityAvatar>
                  <SidebarIdentityText>
                    <SidebarIdentityLabel>{name}</SidebarIdentityLabel>
                    <SidebarIdentityDescription>
                      {/* The realm roles: global to the person, and never merged with what she is
                          inside a hall. */}
                      {session.roles.map(roleLabel).join(" · ")}
                    </SidebarIdentityDescription>
                  </SidebarIdentityText>
                </SidebarIdentity>
              </div>
              <MenuSeparator />
              <MenuItem onClick={() => toast.create({ title: "Profile", type: "info" })} value="profile">
                <UserIcon />
                Profile
              </MenuItem>
              <MenuItem onClick={() => toast.create({ title: "Settings", type: "info" })} value="settings">
                <SettingsIcon />
                Settings
              </MenuItem>
              <MenuSeparator />
              <MenuItem onClick={() => setConfirming(true)} value="log-out" variant="destructive">
                <LogOutIcon />
                Log out
              </MenuItem>
            </MenuContent>
          </Menu>
        </SidebarMenuItem>
      </SidebarMenu>

      {/* Controlled, and outside the menu: the menu closes on select, and a dialog mounted inside it
          would be unmounted in the same tick it was asked to open. */}
      <AlertDialog onOpenChange={(details) => setConfirming(details.open)} open={confirming}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader
            description="You will be sent back to the register and returned to the gatehouse."
            title="Leave the gatehouse?"
          />
          <AlertDialogBody>
            Anything unsigned is lost. Your charters are held by the halls, not by this session, so
            signing back in restores all three.
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            {/* No `AlertDialogClose` around it: the action wraps itself in one. */}
            <AlertDialogAction onClick={() => void signOut()} variant="destructive">
              Log out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* One hall                                                                                         */
/* ---------------------------------------------------------------------------------------------- */

function HallView({ alias, onAlias }: { alias: HallId; onAlias: (alias: HallId) => void }) {
  const { isMember } = useOrganization(alias);

  return (
    <SectionRoot>
      <SectionHeader scale="page">
        <SectionTitleGroup>
          <SectionTitle level={1} scale="page">
            {hall(alias).name}
          </SectionTitle>
          <SectionDescription>{hall(alias).motto}</SectionDescription>
        </SectionTitleGroup>
        <SectionActions>
          {/* One cluster for the board's controls, and what the viewer may do in it is the whole
              difference between the two branches: anyone chartered claims work, only a warden
              posts it. `Gate` renders a fragment, so the button it draws is still a direct child
              of the group and takes the shared edge. */}
          <Show when={isMember}>
            <ButtonGroup aria-label="Board">
              <ButtonGroupText>{boardOf(alias).length} posted</ButtonGroupText>
              <Gate organization={alias} role="warden">
                <Button size="sm">
                  <StampIcon />
                  Post a contract
                </Button>
              </Gate>
              <Button size="sm" variant="outline">
                Claim work
              </Button>
            </ButtonGroup>
          </Show>
        </SectionActions>
      </SectionHeader>

      <SectionBody className="gap-4" scale="page">
        <Show fallback={<NotAMember alias={alias} onAlias={onAlias} />} when={isMember}>
          <DrawingNotDeciding alias={alias} />
          <HallBoard alias={alias} />
        </Show>
      </SectionBody>
    </SectionRoot>
  );
}

/**
 * A hall the session carries no charter in resolves to nothing — never to the first one in the
 * list. Falling back is how someone reads another customer's data believing it is their own.
 */
function NotAMember({ alias, onAlias }: { alias: HallId; onAlias: (alias: HallId) => void }) {
  return (
    <Alert variant="destructive">
      <ShieldAlertIcon />
      <AlertTitle>No charter in {hall(alias).short}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <span>
          You are signed in, and you hold nothing here. <span className="font-mono">useOrganization</span> answers{" "}
          <span className="font-mono">isMember: false</span> for a hall the token does not carry —
          it does not quietly resolve to the first one you do belong to, and the package reports the
          same case to a server as{" "}
          <span className="font-mono">organization.not-a-member</span> rather than as "signed out".
          Telling those two apart is the difference between an explanation and a redirect loop.
        </span>
        <Button onClick={() => onAlias(HOME_HALL)} size="sm" variant="outline">
          Back to {hall(HOME_HALL).short}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/** The sentence this whole showcase exists to keep true. It is on the screen, not only in the MDX. */
function DrawingNotDeciding({ alias }: { alias: HallId }) {
  const { organization } = useOrganization(alias);
  const warden = organization?.roles.includes("warden") ?? false;

  return (
    <Alert variant="info">
      <LockIcon />
      <AlertTitle>What the client knows about its roles is for drawing, never for deciding.</AlertTitle>
      <AlertDescription>
        <Show
          fallback={
            <span>
              <strong>Post a contract</strong> and <strong>Charter</strong> are not drawn here
              because you are {organization?.roles.map(roleLabel).join(" and ")} in{" "}
              {hall(alias).short}, not a warden. <span className="font-mono">Gate</span> hid two controls and protected nothing: the
              roles the browser holds are a copy, and a copy is something an attacker owns the
              moment it arrives. The resource server, validating the access token it was sent, is
              what refuses the request behind the button.
            </span>
          }
          when={warden}
        >
          <span>
            You are a warden of {hall(alias).short}, so <strong>Post a contract</strong> and{" "}
            <strong>Charter</strong> are drawn. <span className="font-mono">Gate</span> decided nothing by doing it: the roles the
            browser holds are a copy, and the resource server — validating the access token it was
            sent — is what refuses the posting. Switch halls to watch both controls disappear, and
            remember that a product gated only here is ungated.
          </span>
        </Show>
      </AlertDescription>
    </Alert>
  );
}

function HallBoard({ alias }: { alias: HallId }) {
  const rows = boardOf(alias);

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Contract</TableHead>
            <TableHead>Posting</TableHead>
            <TableHead className="w-28">Grade</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead className="w-20 text-end">Reward</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-xs">{row.id}</TableCell>
              <TableCell className="font-medium">{row.title}</TableCell>
              <TableCell className="text-muted-foreground">{grade(row.grade).label}</TableCell>
              <TableCell>
                <Badge size="xs" variant="outline">
                  <Status className="size-1.5" variant={questStatus(row.status).tone} />
                  {questStatus(row.status).label}
                </Badge>
              </TableCell>
              <TableCell className="text-end tabular-nums">{row.reward}g</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
