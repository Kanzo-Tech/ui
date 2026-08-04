import {
  Accordion,
  AccordionItem,
  AccordionItemContent,
  AccordionItemTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Accordion className="w-full max-w-md" collapsible defaultValue={["terms"]}>
      <AccordionItem value="terms">
        <AccordionItemTrigger>Terms</AccordionItemTrigger>
        <AccordionItemContent>
          Grade 5 — a writ, which requires a hall&apos;s seal and a written heir. Posted
          by Ash &amp; Company, out of Ashfall Reach, and six days overdue.
        </AccordionItemContent>
      </AccordionItem>
      <AccordionItem value="party">
        <AccordionItemTrigger>Party</AccordionItemTrigger>
        <AccordionItemContent>
          Dagfinn Roe, warden, and Solveig Marsh, sapper. Two names on a contract that
          wants four, and neither of them a cantor.
        </AccordionItemContent>
      </AccordionItem>
      <AccordionItem value="notes">
        <AccordionItemTrigger>Field notes</AccordionItemTrigger>
        <AccordionItemContent>
          Basilisks keep to quarries and cut stone. This is the second attempt, and the
          thing knows the route.
        </AccordionItemContent>
      </AccordionItem>
    </Accordion>
  );
}
