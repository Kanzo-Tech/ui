---
"@kanzo-tech/ui": minor
---

`SidebarProvider` no longer binds ⌘B / Ctrl+B by itself: pass the key as `hotkey`, in the grammar
`CommandDialog` and `PreferencesRoot` take (`<SidebarProvider hotkey="mod+b">` keeps what you had).
The mobile sheet's width is now `--sidebar-width-mobile`, set through the provider's `style` like
`--sidebar-width` and `--sidebar-width-icon`; it was fixed at 18rem.
