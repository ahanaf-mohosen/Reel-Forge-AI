import { LegalPageLayout } from "@/components/legal-page-layout";

export default function Privacy() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="June 11, 2026">
      <p>
        ReelForge AI (&quot;we&quot;, &quot;us&quot;) respects your privacy. This policy explains what
        information we collect, how we use it, and the choices you have.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> name, email address, password (stored hashed), and profile
          details you provide.
        </li>
        <li>
          <strong>Content:</strong> videos you upload, generated reels, captions, and project
          metadata needed to process and store your work.
        </li>
        <li>
          <strong>Usage data:</strong> credit balance, billing transactions, processing logs, and
          feature usage for service operation and support.
        </li>
        <li>
          <strong>Social connections:</strong> OAuth tokens and account identifiers when you connect
          Instagram, Facebook, or YouTube for publishing.
        </li>
        <li>
          <strong>Technical data:</strong> browser type, IP address, session cookies, and device
          information for security and authentication.
        </li>
      </ul>

      <h2>2. How we use your information</h2>
      <ul>
        <li>Provide video processing, storage, billing, and publishing features</li>
        <li>Authenticate your account and maintain session security</li>
        <li>Send service-related communications (e.g. processing status, receipts)</li>
        <li>Improve reliability, prevent abuse, and debug issues</li>
        <li>Comply with legal obligations</li>
      </ul>

      <h2>3. AI processing</h2>
      <p>
        When you enable AI caption or style features, relevant video metadata and prompts may be
        sent to third-party AI providers (such as OpenAI) solely to generate output you request. If
        you leave advanced prompts empty, local processing is used instead where possible.
      </p>

      <h2>4. Data sharing</h2>
      <p>We do not sell your personal information. We may share data with:</p>
      <ul>
        <li>Infrastructure and hosting providers that operate our platform</li>
        <li>Payment processors when you purchase credits</li>
        <li>Social platforms you choose to publish to</li>
        <li>Law enforcement when required by valid legal process</li>
      </ul>

      <h2>5. Data retention</h2>
      <p>
        We retain account and project data while your account is active. You may delete projects from
        your library. Upon account deletion, we remove or anonymize personal data within a reasonable
        period, except where retention is required for legal, billing, or security purposes.
      </p>

      <h2>6. Security</h2>
      <p>
        We use industry-standard measures including encrypted passwords, secure sessions, and access
        controls. No method of transmission over the internet is 100% secure; use a strong unique
        password for your account.
      </p>

      <h2>7. Your rights</h2>
      <p>Depending on your location, you may have the right to:</p>
      <ul>
        <li>Access, correct, or delete your personal data</li>
        <li>Export your account information</li>
        <li>Withdraw consent for optional processing</li>
        <li>Object to certain uses of your data</li>
      </ul>
      <p>
        Update profile details in Settings or contact{" "}
        <a href="mailto:privacy@reelforge.ai" className="text-foreground underline">
          privacy@reelforge.ai
        </a>
        .
      </p>

      <h2>8. Cookies</h2>
      <p>
        We use essential cookies for authentication and session management. Theme preferences may be
        stored locally in your browser. You can control cookies through your browser settings.
      </p>

      <h2>9. Children</h2>
      <p>
        ReelForge AI is not directed at children under 13. We do not knowingly collect data from
        children. Contact us if you believe a child has provided personal information.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be posted on this
        page with an updated date. Continued use of the service after changes means you accept the
        revised policy.
      </p>
    </LegalPageLayout>
  );
}
