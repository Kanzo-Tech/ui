import {
  Accordion,
  AccordionItem,
  AccordionItemContent,
  AccordionItemTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Accordion className="w-full max-w-md" collapsible defaultValue={["item-1"]}>
      <AccordionItem value="item-1">
        <AccordionItemTrigger>Is it accessible?</AccordionItemTrigger>
        <AccordionItemContent>
          Yes. It follows the WAI-ARIA accordion pattern, with full keyboard support
          from the Ark machine.
        </AccordionItemContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionItemTrigger>Is it animated?</AccordionItemTrigger>
        <AccordionItemContent>
          Yes. Each panel animates its height open and closed, and respects reduced
          motion.
        </AccordionItemContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionItemTrigger>Can multiple stay open?</AccordionItemTrigger>
        <AccordionItemContent>
          Not here — this accordion is single-open and collapsible. Pass `multiple`
          on the root to let more than one panel expand at once.
        </AccordionItemContent>
      </AccordionItem>
    </Accordion>
  );
}
