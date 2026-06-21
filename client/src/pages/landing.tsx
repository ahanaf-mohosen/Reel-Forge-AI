import { Link } from "wouter";
import {
  ArrowRight,
  Briefcase,
  Captions,
  CheckCircle2,
  Clock,
  CreditCard,
  Film,
  HelpCircle,
  Layers,
  Library,
  LogOut,
  PenLine,
  Play,
  Share2,
  Sparkles,
  TrendingUp,
  Upload,
  User,
  Users,
  Wand2,
  Zap,
} from "lucide-react";
import { SiFacebook, SiInstagram, SiYoutube } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import logoImage from "@assets/logo.png";

const STATS = [
  { value: "~7 min", label: "Average time per project" },
  { value: "3–5", label: "Reels per long video" },
  { value: "1 GB", label: "Max upload size" },
  { value: "500", label: "Free credits on signup" },
];

const FEATURES = [
  {
    icon: Wand2,
    title: "AI highlight detection",
    description:
      "Scans your full video and surfaces the strongest hooks, peaks, and story beats — no manual scrubbing.",
  },
  {
    icon: Sparkles,
    title: "9:16 reel output",
    description:
      "Vertical format with cinematic blurred backgrounds. Your subject stays centered, never awkwardly cropped.",
  },
  {
    icon: Captions,
    title: "Smart captions",
    description:
      "Add a style prompt for AI-written captions, or skip it for fast local processing with zero API cost.",
  },
  {
    icon: Share2,
    title: "Publish everywhere",
    description:
      "Connect Instagram, Facebook, and YouTube in Settings and push finished reels without re-uploading.",
  },
  {
    icon: PenLine,
    title: "Edit before you ship",
    description:
      "Tweak captions on any reel after processing. Regenerate removed — you stay in control of the final copy.",
  },
  {
    icon: Library,
    title: "Project library",
    description:
      "Every upload is saved to your library with status, reels, and download links — pick up where you left off.",
  },
];

const USE_CASES = [
  {
    icon: TrendingUp,
    title: "YouTubers & podcasters",
    description: "Turn hour-long episodes into Shorts and Reels that drive traffic back to the full video.",
  },
  {
    icon: Users,
    title: "Social media managers",
    description: "Batch-process client footage and publish across Instagram, Facebook, and YouTube from one place.",
  },
  {
    icon: Briefcase,
    title: "Brands & small business",
    description: "Repurpose webinars, demos, and ads into snackable clips without hiring an editor.",
  },
  {
    icon: Film,
    title: "Independent creators",
    description: "Spend less time in Premiere and more time creating — upload once, get multiple reels back.",
  },
];

const CAPABILITIES = [
  "Upload MP4, MOV, and other common video formats up to 1 GB",
  "Choose clip count (1–10) and duration range (15–60 seconds per reel)",
  "Optional advanced style prompt for AI captions and tone",
  "Real-time processing progress with step-by-step status updates",
  "Download individual reels or manage them from your dashboard",
  "Credit-based billing — pay only for what you process",
];

const PLATFORMS = [
  { name: "Instagram", icon: SiInstagram, color: "from-purple-500 to-pink-500" },
  { name: "Facebook", icon: SiFacebook, color: "bg-blue-600" },
  { name: "YouTube", icon: SiYoutube, color: "bg-red-600" },
];

const STEPS = [
  {
    step: "01",
    title: "Upload",
    description:
      "Drag and drop a file or use the Create page. Set clip count, duration, and an optional style prompt.",
  },
  {
    step: "02",
    title: "Forge",
    description:
      "AI detects highlights, cuts clips, formats to 9:16, and adds captions. Track progress live on screen.",
  },
  {
    step: "03",
    title: "Ship",
    description:
      "Review reels, edit captions, download, or publish to connected social accounts in a few clicks.",
  },
];

import { FAQ_ITEMS } from "@shared/faq";

const OLD_WAY = [
  "Watch the full video to find moments",
  "Manually cut in editing software",
  "Reformat each clip for vertical",
  "Add captions by hand",
  "Upload to each platform separately",
];

const NEW_WAY = [
  "Upload once — AI finds the best parts",
  "Automatic 9:16 formatting",
  "Optional AI captions in your tone",
  "Edit copy, then download or publish",
  "Instagram, Facebook & YouTube in one flow",
];

function ReelMockup({ className, delay = "0s" }: { className?: string; delay?: string }) {
  return (
    <div className={cn("landing-float", className)} style={{ animationDelay: delay }}>
      <div className="relative aspect-[9/16] w-[7.5rem] overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-b from-primary/80 to-primary shadow-2xl shadow-primary/25 sm:w-[8.5rem]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--secondary)/0.45),transparent_55%)]" />
        <div className="absolute inset-x-3 top-3 h-1.5 rounded-full bg-white/25" />
        <div className="absolute inset-x-4 bottom-16 space-y-2">
          <div className="h-2 w-3/4 rounded-full bg-white/30" />
          <div className="h-2 w-1/2 rounded-full bg-white/20" />
        </div>
        <div className="absolute inset-x-3 bottom-3 rounded-lg bg-black/40 px-2 py-1.5 backdrop-blur-sm">
          <p className="text-[9px] font-medium leading-tight text-white/90">Your next viral moment ✨</p>
        </div>
        <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
          <Play className="h-4 w-4 fill-white text-white" />
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user, isAuthenticated, isLoading } = useAuth();

  const primaryCta = isAuthenticated
    ? { href: "/create", label: "Create a reel" }
    : { href: "/auth", label: "Get started free" };

  const secondaryCta = isAuthenticated
    ? { href: "/dashboard", label: "Open dashboard" }
    : { href: "#how-it-works", label: "See how it works", scroll: true };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-secondary/25 blur-3xl" />
        <div className="absolute -right-24 top-32 h-[22rem] w-[22rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-[18rem] w-[36rem] -translate-x-1/2 rounded-full bg-secondary/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <img src={logoImage} alt="ReelForge AI" className="h-8 w-auto" />
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground lg:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#use-cases" className="transition-colors hover:text-foreground">
              Use cases
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="/faq" className="transition-colors hover:text-foreground">
              FAQ
            </a>
            <a href="#pricing" className="transition-colors hover:text-foreground">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            {isLoading ? (
              <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
            ) : isAuthenticated && user ? (
              <>
                <Link
                  href="/dashboard"
                  className="hidden items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted sm:flex"
                >
                  <Avatar className="h-8 w-8 ring-2 ring-secondary/30">
                    <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{user.firstName || "User"}</span>
                </Link>
                <Button variant="ghost" size="sm" asChild>
                  <a href="/api/logout">
                    <LogOut className="mr-1 h-4 w-4" />
                    <span className="hidden sm:inline">Log out</span>
                  </a>
                </Button>
              </>
            ) : (
              <Button size="sm" asChild>
                <Link href="/auth">Sign up / Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 md:pb-28 md:pt-24">
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-10">
            <div className="space-y-8">
              <Badge
                variant="secondary"
                className="rounded-full px-3 py-1 text-xs font-medium tracking-wide"
              >
                AI-powered short-form video studio
              </Badge>

              <div className="space-y-5">
                <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                  Turn long videos into{" "}
                  <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
                    scroll-stopping reels
                  </span>
                </h1>
                <p className="max-w-xl text-lg text-muted-foreground">
                  ReelForge AI finds your best moments, formats them for vertical platforms, and
                  adds captions — so you can publish faster without an editing team.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/20" asChild>
                  <Link href={primaryCta.href}>
                    {primaryCta.label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                {secondaryCta.scroll ? (
                  <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
                    <a href={secondaryCta.href}>{secondaryCta.label}</a>
                  </Button>
                ) : (
                  <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
                    <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
                  </Button>
                )}
              </div>

              {!isAuthenticated && (
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link href="/auth" className="font-medium text-foreground underline-offset-4 hover:underline">
                    Sign in
                  </Link>
                </p>
              )}

              <div className="flex flex-wrap gap-6 pt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-secondary-foreground" />
                  Minutes, not hours
                </span>
                <span className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-secondary-foreground" />
                  Up to 1 GB uploads
                </span>
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-secondary-foreground" />
                  500 free credits on signup
                </span>
              </div>
            </div>

            <div className="relative mx-auto flex h-[22rem] w-full max-w-md items-end justify-center sm:h-[26rem]">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 via-secondary/10 to-transparent ring-1 ring-border/50" />
              <ReelMockup className="z-10 -rotate-6 translate-x-[-2.5rem] opacity-90" delay="0s" />
              <ReelMockup className="z-20 scale-110" delay="0.5s" />
              <ReelMockup className="z-10 rotate-6 translate-x-[2.5rem] opacity-90" delay="1s" />
              <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border/60 bg-background/90 px-4 py-2 text-xs font-medium shadow-lg backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-secondary" />
                </span>
                AI processing live preview
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-muted/20 py-10">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 sm:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold text-primary sm:text-3xl">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need to go viral
              </h2>
              <p className="mt-3 text-muted-foreground">
                From raw footage to platform-ready reels — one streamlined workflow built for creators
                and teams.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="group rounded-2xl border border-border/60 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
                  >
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="use-cases" className="border-y border-border/60 bg-muted/30 py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Built for every creator</h2>
              <p className="mt-3 text-muted-foreground">
                Whether you run a channel, an agency, or a growing brand — ReelForge fits your workflow.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {USE_CASES.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex gap-4 rounded-2xl border border-border/60 bg-card p-6 shadow-sm"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary/30 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
              <p className="mt-3 text-muted-foreground">
                Three steps from upload to publish. No timeline scrubbing required.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {STEPS.map((item, index) => (
                <div key={item.step} className="relative text-center md:text-left">
                  {index < STEPS.length - 1 && (
                    <div className="absolute left-[calc(50%+2.5rem)] top-8 hidden h-px w-[calc(100%-5rem)] bg-border md:block" />
                  )}
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-lg font-bold text-primary-foreground shadow-lg shadow-primary/20 md:mx-0">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-muted/30 py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <Badge variant="outline" className="mb-4">
                  <Layers className="mr-1 h-3 w-3" />
                  Full pipeline
                </Badge>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  More than clipping — a complete reel studio
                </h2>
                <p className="mt-4 text-muted-foreground leading-relaxed">
                  ReelForge handles detection, formatting, captions, storage, and publishing so you
                  can focus on content strategy instead of timeline work.
                </p>
                <ul className="mt-8 space-y-3">
                  {CAPABILITIES.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                {PLATFORMS.map((platform) => {
                  const Icon = platform.icon;
                  return (
                    <div
                      key={platform.name}
                      className="flex items-center gap-4 rounded-xl border border-border/60 bg-card px-5 py-4"
                    >
                      <div
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg text-white",
                          platform.color.startsWith("from")
                            ? `bg-gradient-to-br ${platform.color}`
                            : platform.color,
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{platform.name}</p>
                        <p className="text-xs text-muted-foreground">Direct publishing supported</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Hours of editing → minutes of forging
              </h2>
              <p className="mt-3 text-muted-foreground">
                See how ReelForge replaces a manual post-production workflow.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8">
                <div className="mb-6 flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-5 w-5" />
                  <span className="font-semibold text-foreground">The old way</span>
                  <Badge variant="secondary" className="ml-auto">~3 hours</Badge>
                </div>
                <ul className="space-y-3">
                  {OLD_WAY.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-sm md:p-8">
                <div className="mb-6 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <span className="font-semibold">With ReelForge AI</span>
                  <Badge className="ml-auto">~7 minutes</Badge>
                </div>
                <ul className="space-y-3">
                  {NEW_WAY.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="border-y border-border/60 bg-muted/30 py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <div className="mb-3 flex justify-center">
                <HelpCircle className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Frequently asked questions</h2>
              <p className="mt-3 text-muted-foreground">
                Quick answers about credits, AI usage, formats, and editing.
              </p>
            </div>
            <div className="mx-auto grid max-w-3xl gap-4">
              {FAQ_ITEMS.slice(0, 4).map((item) => (
                <div
                  key={item.question}
                  className="rounded-xl border border-border/60 bg-card p-5 shadow-sm"
                >
                  <h3 className="font-semibold">{item.question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center">
              <Link
                href="/faq"
                className="text-sm font-medium text-primary hover:underline underline-offset-4"
              >
                View all questions →
              </Link>
            </p>
          </div>
        </section>

        <section id="pricing" className="py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <div className="mb-3 flex justify-center">
                <CreditCard className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple credit-based pricing</h2>
              <p className="mt-3 text-muted-foreground">
                Start free, then buy credit packs when you need more. No subscription required.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                {
                  name: "Free trial",
                  price: "$0",
                  credits: "500 credits",
                  description: "Included when you sign up — enough for several test runs.",
                  popular: false,
                },
                {
                  name: "Creator Pack",
                  price: "From $9.99",
                  credits: "500–5,000 credits",
                  description: "Flexible packs in Settings → Billing. Pay only for processing.",
                  popular: true,
                },
                {
                  name: "Pay as you go",
                  price: "Per job",
                  credits: "Based on clips & length",
                  description: "Each upload costs credits by clip count and video duration.",
                  popular: false,
                },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className={cn(
                    "relative rounded-2xl border bg-card p-6 shadow-sm",
                    plan.popular ? "border-primary/40 ring-1 ring-primary/20" : "border-border/60",
                  )}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px]">
                      Most popular
                    </Badge>
                  )}
                  <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
                  <p className="mt-2 text-3xl font-bold">{plan.price}</p>
                  <p className="mt-1 text-sm font-medium text-primary">{plan.credits}</p>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{plan.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {!isAuthenticated && (
        <section className="pb-20 md:pb-28">
          <div className="mx-auto max-w-6xl px-6">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/90 px-8 py-14 text-center text-primary-foreground shadow-2xl shadow-primary/25 md:px-16 md:py-16">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-secondary/30 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="relative z-10 mx-auto max-w-2xl space-y-6">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Ready to forge your first reel?
                </h2>
                <p className="text-primary-foreground/80">
                  Join creators who ship more short-form content in less time. Start with 500 free
                  credits — no credit card required.
                </p>
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-12 px-8 text-base font-semibold text-secondary-foreground"
                  asChild
                >
                  <Link href={primaryCta.href}>
                    {primaryCta.label}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
        )}
      </main>
    </div>
  );
}
