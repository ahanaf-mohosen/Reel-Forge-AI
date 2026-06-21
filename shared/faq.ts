export type FaqItem = {
  question: string;
  answer: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "How do credits work?",
    answer:
      "Each video job uses credits based on clip count and video length. New accounts receive 500 free credits. You can buy more anytime in Settings → Billing.",
  },
  {
    question: "When is OpenAI used?",
    answer:
      "Only when you add a reel style prompt in Advanced Options. Leave it blank for free local highlight detection — no API charges for that path.",
  },
  {
    question: "What video formats are supported?",
    answer:
      "Most standard formats including MP4 and MOV. You can also paste a YouTube link on the Create page. Maximum upload size is 1 GB per video.",
  },
  {
    question: "Can I edit reels after processing?",
    answer:
      "Yes. Open any completed project, select a reel, and update the caption before downloading or publishing to social platforms.",
  },
  {
    question: "Can I add branding to my reels?",
    answer:
      "Yes. In Create → Advanced Options you can add top/bottom panels, watermarks, and a logo from Settings → Profile before generating reels.",
  },
  {
    question: "How do I connect Instagram, Facebook, or YouTube?",
    answer:
      "Go to Settings → Social accounts and connect the platforms you want. After processing, publish reels directly from the Results page.",
  },
  {
    question: "I forgot my password. What should I do?",
    answer:
      "On the sign-in page, click Forgot password?, enter your email, and follow the reset link we send you. The link expires after one hour.",
  },
  {
    question: "Will I get a receipt when I buy a credit pack?",
    answer:
      "Yes. After a successful purchase you receive a confirmation email with your plan name, credits added, amount paid, and receipt reference.",
  },
  {
    question: "Are my projects private?",
    answer:
      "Yes. Each account only sees its own projects and reels. Other users cannot access your uploads or generated content.",
  },
  {
    question: "Processing failed or is stuck. What now?",
    answer:
      "Open the project from your Library and try Retry if available. Credits are refunded when processing fails. If it keeps happening, email our support or emergency contact shown in the site footer.",
  },
  {
    question: "How do I contact support?",
    answer:
      "Use the support and emergency email addresses in the footer on every page. Include your account email, project name, and a short description of the issue.",
  },
];
