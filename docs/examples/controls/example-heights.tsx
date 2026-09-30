"use client";

import {
  Badge,
  Button,
  Checkbox,
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  createListCollection,
  DatePicker,
  DatePickerContent,
  DatePickerInput,
  DatePickerTimer,
  CalendarTable,
  CalendarTableDays,
  CalendarView,
  CalendarWeekDays,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  LanguagePicker,
  NativeSelect,
  NativeSelectOption,
  NumberInput,
  NumberInputControl,
  NumberInputDecrementTrigger,
  NumberInputIncrementTrigger,
  NumberInputInput,
  PasswordInput,
  PasswordInputGroup,
  PasswordInputInput,
  PasswordInputTrigger,
  PinInput,
  PinInputControl,
  PinInputInput,
  RadioGroup,
  RadioGroupItem,
  SegmentGroup,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  TagsInput,
  TagsInputContext,
  TagsInputControl,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDeleteTrigger,
  TagsInputItemPreview,
  TagsInputItemText,
  Textarea,
} from "@kanzo-tech/ui";
import { SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";

type Size = "sm" | "md" | "lg";
const SIZES: Size[] = ["sm", "md", "lg"];

const fruit = createListCollection({
  items: ["Fig", "Quince", "Medlar"].map((value) => ({ label: value, value })),
});

const SEGMENTS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
];

/**
 * Every single-line control at one size. `ruler` is a bar as tall as the size token says a control
 * is (`h-(--size)`), so a control that drifts from the shared height is visible against it.
 */
function Controls({ size }: { size: Size }) {
  const [language, setLanguage] = useState("es");
  return (
    <>
      <Input placeholder="Input" size={size} />
      <Input placeholder="Number" size={size} type="number" />
      <NativeSelect size={size}>
        <NativeSelectOption value="">Native select</NativeSelectOption>
        <NativeSelectOption value="a">Alpha</NativeSelectOption>
      </NativeSelect>
      <Select collection={fruit}>
        <SelectTrigger size={size}>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {fruit.items.map((item) => (
            <SelectItem item={item} key={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Combobox collection={fruit}>
        <ComboboxInput placeholder="Combobox" size={size} />
        <ComboboxContent>
          {fruit.items.map((item) => (
            <ComboboxItem item={item} key={item.value}>
              {item.label}
            </ComboboxItem>
          ))}
        </ComboboxContent>
      </Combobox>
      <TagsInput defaultValue={["one"]}>
        <TagsInputControl size={size}>
          <TagsInputContext>
            {(api) =>
              api.value.map((value, index) => (
                <TagsInputItem index={index} key={`${value}-${index}`} value={value}>
                  <TagsInputItemPreview>
                    <TagsInputItemText>{value}</TagsInputItemText>
                    <TagsInputItemDeleteTrigger />
                  </TagsInputItemPreview>
                </TagsInputItem>
              ))
            }
          </TagsInputContext>
          <TagsInputInput placeholder="Tags" />
        </TagsInputControl>
      </TagsInput>
      <NumberInput defaultValue="3">
        <NumberInputControl size={size}>
          <NumberInputInput />
          <NumberInputIncrementTrigger />
          <NumberInputDecrementTrigger />
        </NumberInputControl>
      </NumberInput>
      <PasswordInput size={size}>
        <PasswordInputGroup>
          <PasswordInputInput placeholder="Password" />
          <PasswordInputTrigger />
        </PasswordInputGroup>
      </PasswordInput>
      <InputGroup size={size}>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput placeholder="Input group" size={size} />
        <InputGroupAddon align="inline-end">
          <InputGroupButton aria-label="Clear" size="icon-sm">
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <DatePicker>
        <DatePickerInput placeholder="Date" size={size} />
        <DatePickerContent>
          <CalendarView view="day">
            <CalendarTable>
              <CalendarWeekDays />
              <CalendarTableDays />
            </CalendarTable>
          </CalendarView>
        </DatePickerContent>
      </DatePicker>
      <DatePickerTimer aria-label="Time" size={size} />
      <LanguagePicker onValueChange={setLanguage} size={size} value={language} />
      <InputGroup size={size}>
        <InputGroupInput placeholder="Inline language" size={size} />
        <InputGroupAddon align="inline-end">
          <LanguagePicker inline onValueChange={setLanguage} value={language} />
        </InputGroupAddon>
      </InputGroup>
      <SegmentGroup options={SEGMENTS} size={size} defaultValue="day" />
      <SegmentGroup options={SEGMENTS} size={size} defaultValue="day" variant="solid" />
      <Button size={size} variant="outline">
        Button
      </Button>
      <Button aria-label="Icon button" size={`icon-${size}`} variant="outline">
        <SearchIcon />
      </Button>
      <PinInput>
        <PinInputControl>
          {[0, 1, 2].map((index) => (
            <PinInputInput index={index} key={index} size={size} />
          ))}
        </PinInputControl>
      </PinInput>
      <Textarea className="resize-none" placeholder="Textarea, minimum" rows={1} />
      <Switch>Switch</Switch>
      <Checkbox>Checkbox</Checkbox>
      <RadioGroup defaultValue="a">
        <RadioGroupItem value="a">Radio</RadioGroupItem>
      </RadioGroup>
      <Badge asChild size={size}>
        <button type="button">Badge</button>
      </Badge>
    </>
  );
}

export default function Example() {
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-10" data-heights-example>
      {SIZES.map((size) => (
        <section className="flex min-w-0 flex-col gap-4" data-size-group={size} key={size}>
          <h4 className="font-semibold text-sm">{size}</h4>
          <div className="flex w-72 flex-col gap-2" data-layout="column">
            <Controls size={size} />
          </div>
          <div className="flex flex-wrap items-start gap-x-4 gap-y-2" data-layout="form-row">
            <Input className="w-40" placeholder="Input" size={size} />
            <Switch>Switch</Switch>
            <Checkbox>Checkbox</Checkbox>
            <RadioGroup defaultValue="a">
              <RadioGroupItem value="a">Radio</RadioGroupItem>
            </RadioGroup>
          </div>
          <div className="overflow-x-auto pb-2">
            <div
              className="flex w-max items-start gap-2 [&>*]:w-40 [&>*]:shrink-0"
              data-layout="row"
            >
              <Controls size={size} />
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
