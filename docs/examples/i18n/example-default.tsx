"use client";

import {
  FormatByte,
  FormatNumber,
  LocaleProvider,
  useLocale,
} from "@kanzo-tech/ui";

function Readout() {
  const { locale } = useLocale();

  return (
    <p className="text-sm">
      <code>{locale}</code>: <FormatNumber value={1234567.891} /> · <FormatByte value={4_200_000} />
    </p>
  );
}

export default function Example() {
  return (
    <div className="flex flex-col gap-2">
      <LocaleProvider locale="en-US">
        <Readout />
      </LocaleProvider>
      <LocaleProvider locale="es-ES">
        <Readout />
      </LocaleProvider>
      <LocaleProvider locale="de-CH">
        <Readout />
      </LocaleProvider>
    </div>
  );
}
