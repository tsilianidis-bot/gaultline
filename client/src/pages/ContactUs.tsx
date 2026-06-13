import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useSEO, PAGE_SEO } from "@/hooks/useSEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Mail, MessageSquare, Send, CheckCircle2, ArrowLeft, MapPin } from "lucide-react";
import { Link } from "wouter";

const CATEGORIES = [
  "General Inquiry",
  "Technical Support",
  "Access Request",
  "Partnership",
  "Press",
  "Feedback",
  "Bug Report",
  "Other",
] as const;

export default function ContactUs() {
  useSEO(PAGE_SEO.contact);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    category: "" as typeof CATEGORIES[number] | "",
  });

  const submitMutation = trpc.contact.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err) => {
      toast.error("Failed to send message", {
        description: err.message || "Please try again or email us directly at jt@getfaultline.live",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category) {
      toast.error("Please select a category");
      return;
    }
    submitMutation.mutate({
      name: form.name,
      email: form.email,
      subject: form.subject,
      message: form.message,
      category: form.category as typeof CATEGORIES[number],
    });
  };

  const isLoading = submitMutation.isPending;

  return (
    <div className="min-h-screen bg-[#050A0F] text-slate-200">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#050A0F]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <span className="font-['Rajdhani'] text-xl font-bold tracking-widest text-cyan-400 cursor-pointer">
              FAULT<span className="text-slate-200">LINE</span>
            </span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-200 gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Site
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-cyan-400/10 border border-cyan-400/20 rounded-full px-4 py-1.5 text-xs font-mono tracking-widest text-cyan-400 uppercase mb-6">
            ⬡ Contact
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-100 mb-4 font-['Rajdhani'] tracking-wide">
            Get In Touch
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Have a question about FAULTLINE? We respond to every inquiry within 24–48 hours.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Info Cards */}
          <div className="space-y-4">
            <div className="bg-[#0A1520] border border-white/5 rounded-xl p-6">
              <div className="w-10 h-10 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center mb-4">
                <Mail className="w-5 h-5 text-cyan-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Email</h3>
              <p className="text-xs text-slate-500 mb-2">Direct line to the team</p>
              <a href="mailto:jt@getfaultline.live" className="text-cyan-400 text-sm font-mono hover:underline">
                jt@getfaultline.live
              </a>
            </div>

            <div className="bg-[#0A1520] border border-white/5 rounded-xl p-6">
              <div className="w-10 h-10 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mb-4">
                <MessageSquare className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Response Time</h3>
              <p className="text-xs text-slate-500 mb-2">We're fast</p>
              <p className="text-amber-400 text-sm font-mono">24–48 hours</p>
            </div>

            <div className="bg-[#0A1520] border border-white/5 rounded-xl p-6">
              <div className="w-10 h-10 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center mb-4">
                <MapPin className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Platform</h3>
              <p className="text-xs text-slate-500 mb-2">Live and operational</p>
              <a href="https://getfaultline.live" className="text-emerald-400 text-sm font-mono hover:underline">
                getfaultline.live
              </a>
            </div>

            {/* FAQ quick links */}
            <div className="bg-[#0A1520] border border-white/5 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">Common Topics</h3>
              <div className="space-y-2">
                {["Founding Access", "Platform Features", "Data Sources", "Pricing & Plans", "Technical Issues"].map((t) => (
                  <div key={t} className="text-xs text-slate-400 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-cyan-400/60 flex-shrink-0" />
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            {submitted ? (
              <div className="bg-[#0A1520] border border-emerald-400/20 rounded-xl p-12 text-center h-full flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-100 mb-3 font-['Rajdhani'] tracking-wide">
                  Message Sent
                </h2>
                <p className="text-slate-400 mb-2 max-w-sm">
                  Your inquiry has been received. We've also sent a confirmation to your email.
                </p>
                <p className="text-slate-500 text-sm mb-8">
                  Expect a reply within 24–48 hours.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSubmitted(false);
                      setForm({ name: "", email: "", subject: "", message: "", category: "" });
                    }}
                    className="border-white/10 text-slate-300 hover:bg-white/5"
                  >
                    Send Another
                  </Button>
                  <Link href="/">
                    <Button className="bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/20">
                      Back to FAULTLINE
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-[#0A1520] border border-white/5 rounded-xl p-8 space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-100 mb-1 font-['Rajdhani'] tracking-wide">
                    Send a Message
                  </h2>
                  <p className="text-slate-500 text-sm">All fields are required.</p>
                </div>

                {/* Name + Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono tracking-widest text-slate-400 uppercase">Name</Label>
                    <Input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Your full name"
                      className="bg-black/30 border-white/10 text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono tracking-widest text-slate-400 uppercase">Email</Label>
                    <Input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="your@email.com"
                      className="bg-black/30 border-white/10 text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/50"
                    />
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono tracking-widest text-slate-400 uppercase">Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm({ ...form, category: v as typeof CATEGORIES[number] })}
                  >
                    <SelectTrigger className="bg-black/30 border-white/10 text-slate-200 focus:border-cyan-400/50">
                      <SelectValue placeholder="Select a category..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0A1520] border-white/10">
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c} className="text-slate-200 focus:bg-white/5">
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subject */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono tracking-widest text-slate-400 uppercase">Subject</Label>
                  <Input
                    required
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Brief summary of your inquiry"
                    className="bg-black/30 border-white/10 text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/50"
                  />
                </div>

                {/* Message */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono tracking-widest text-slate-400 uppercase">
                    Message
                    <span className="ml-2 text-slate-600 normal-case font-normal">
                      ({form.message.length}/5000)
                    </span>
                  </Label>
                  <Textarea
                    required
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Describe your inquiry in detail..."
                    rows={6}
                    maxLength={5000}
                    className="bg-black/30 border-white/10 text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/50 resize-none"
                  />
                </div>

                {/* Submit */}
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-slate-600">
                    You'll receive a confirmation email immediately.
                  </p>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/20 gap-2 min-w-[140px]"
                  >
                    {isLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Message
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
