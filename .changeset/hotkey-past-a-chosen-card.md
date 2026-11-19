---
"@kanzo-tech/ui": patch
---

A bare-key `hotkey` — `PreferencesRoot`'s, `CommandDialog`'s — keeps working after a radio or checkbox has been clicked. Ark keeps focus on the control's hidden `<input>`, and that counted as typing in a field, so `<PreferencesRoot hotkey="t">` stopped toggling the panel the moment a density card was chosen. A key pressed in a text field, a textarea, a select or an editable region is still the field's.
