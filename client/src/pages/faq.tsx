import { LegalPageLayout } from "@/components/legal-page-layout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_ITEMS } from "@shared/faq";

export default function Faq() {
  return (
    <LegalPageLayout title="Frequently Asked Questions" lastUpdated="June 11, 2026">
      <p>
        Quick answers about credits, uploads, billing, privacy, and getting help. Can&apos;t find
        what you need? See the support details in the footer below.
      </p>

      <div className="not-prose mt-8 rounded-xl border border-border/60 bg-card px-4 shadow-sm">
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, index) => (
            <AccordionItem key={item.question} value={`item-${index}`}>
              <AccordionTrigger className="text-left text-foreground hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </LegalPageLayout>
  );
}
