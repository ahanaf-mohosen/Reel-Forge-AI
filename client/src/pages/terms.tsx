import { LegalPageLayout } from "@/components/legal-page-layout";

export default function Terms() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="June 11, 2026">
      <p>
        Welcome to ReelForge AI. By creating an account or using our services, you agree to these
        Terms of Service. Please read them carefully.
      </p>

      <h2>1. Service description</h2>
      <p>
        ReelForge AI provides tools to upload long-form videos, generate short vertical reels using
        automated processing and optional AI features, manage projects, purchase credits, and publish
        content to connected social platforms.
      </p>

      <h2>2. Account responsibilities</h2>
      <ul>
        <li>You must provide accurate registration information and keep your credentials secure.</li>
        <li>You are responsible for all activity under your account.</li>
        <li>You must be at least 13 years old (or the minimum age required in your jurisdiction).</li>
        <li>One person or entity may not maintain multiple accounts to abuse free credits or promotions.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree not to upload or process content that:</p>
      <ul>
        <li>Violates copyright, trademark, or other intellectual property rights</li>
        <li>Contains illegal, harmful, harassing, or explicit material without proper rights</li>
        <li>Attempts to disrupt, reverse engineer, or overload the platform</li>
        <li>Misrepresents your identity or affiliation</li>
      </ul>
      <p>
        You retain ownership of videos you upload. You grant ReelForge AI a limited license to
        process your content solely to provide the service.
      </p>

      <h2>4. Credits and billing</h2>
      <ul>
        <li>Processing jobs consume credits based on clip count, duration, and features used.</li>
        <li>Purchased credits are non-refundable except where required by law.</li>
        <li>We may change pricing or credit costs with reasonable notice.</li>
        <li>Promotional credits may expire or be modified at our discretion.</li>
      </ul>

      <h2>5. AI and third-party services</h2>
      <p>
        Some features use third-party AI or social APIs. Output quality may vary. You are responsible
        for reviewing generated captions and clips before publishing. Optional OpenAI features run
        only when you provide a style prompt.
      </p>

      <h2>6. Availability and changes</h2>
      <p>
        We strive for reliable service but do not guarantee uninterrupted access. We may update,
        suspend, or discontinue features with or without notice. Continued use after changes
        constitutes acceptance of updated terms.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        ReelForge AI is provided &quot;as is&quot; to the fullest extent permitted by law. We are not
        liable for indirect, incidental, or consequential damages arising from your use of the
        service, including lost revenue or content.
      </p>

      <h2>8. Termination</h2>
      <p>
        You may stop using the service at any time. We may suspend or terminate accounts that violate
        these terms or pose security or legal risk.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about these terms? Contact us at{" "}
        <a href="mailto:support@reelforge.ai" className="text-foreground underline">
          support@reelforge.ai
        </a>
        .
      </p>
    </LegalPageLayout>
  );
}
