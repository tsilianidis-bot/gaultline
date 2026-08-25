import { useState } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, LockKeyhole, ArrowRight } from "lucide-react";
import { CANONICAL_HOME } from "@shared/routeRegistry";

export default function QaAccess() {
  const [, navigate] = useLocation();
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("submitting");
    try {
      const response = await fetch("/api/qa/access", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ secret }) });
      if (!response.ok) throw new Error("invalid");
      setSecret("");
      navigate(CANONICAL_HOME);
    } catch {
      setStatus("error");
    }
  };

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "radial-gradient(circle at 50% 15%, #08202c 0%, #050608 46%)", color: "#E6EDF3", fontFamily: "'IBM Plex Sans', sans-serif" }}>
    <form onSubmit={submit} style={{ width: "min(100%, 430px)", border: "1px solid rgba(0,212,255,0.25)", borderRadius: 10, background: "rgba(9,15,20,0.96)", padding: "32px 28px", boxShadow: "0 22px 70px rgba(0,0,0,0.4)" }}>
      <div style={{ color: "#00D4FF", marginBottom: 16 }}><ShieldCheck size={28} /></div>
      <div style={{ color: "#00D4FF", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.16em", marginBottom: 8 }}>OWNER-CONTROLLED QA ACCESS</div>
      <h1 style={{ margin: "0 0 10px", fontSize: 26, letterSpacing: "-0.02em" }}>Read-only validation</h1>
      <p style={{ margin: "0 0 22px", color: "#8FA3B5", fontSize: 14, lineHeight: 1.55 }}>This permanent QA session is limited to protected intelligence rendering. It cannot modify accounts, billing, schedules, settings, or application data.</p>
      <label style={{ display: "block", color: "#A9B9C7", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.12em", marginBottom: 8 }}>QA ACCESS SECRET</label>
      <div style={{ position: "relative" }}><LockKeyhole size={14} style={{ position: "absolute", left: 12, top: 13, color: "#5E7285" }} /><input autoFocus type="password" autoComplete="current-password" value={secret} onChange={event => { setSecret(event.target.value); setStatus("idle"); }} style={{ width: "100%", boxSizing: "border-box", background: "#071016", color: "#E6EDF3", border: "1px solid rgba(145,170,190,0.28)", borderRadius: 5, padding: "12px 12px 12px 35px", outline: "none" }} /></div>
      {status === "error" && <p role="alert" style={{ margin: "10px 0 0", color: "#FF6B6B", fontSize: 12 }}>Access could not be established. Check the secret and try again.</p>}
      <button disabled={!secret || status === "submitting"} type="submit" style={{ width: "100%", marginTop: 18, border: 0, borderRadius: 5, padding: "12px 14px", background: "#00D4FF", color: "#031016", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", opacity: !secret || status === "submitting" ? 0.55 : 1 }}>ENTER READ-ONLY QA <ArrowRight size={13} style={{ display: "inline", verticalAlign: "-2px", marginLeft: 4 }} /></button>
      <p style={{ margin: "15px 0 0", color: "#647788", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, lineHeight: 1.55 }}>The secret is submitted only to the server and is never retained in the URL, browser storage, or client bundle.</p>
    </form>
  </main>;
}
