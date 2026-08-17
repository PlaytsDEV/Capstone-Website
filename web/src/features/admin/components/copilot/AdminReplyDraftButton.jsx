import React, { useState } from "react";
import { Sparkles, LoaderCircle } from "lucide-react";
import { chatbotApi } from "../../../../shared/api/chatbotApi";

const TONES = ["Formal", "Empathetic", "Firm", "Concise"];

export default function AdminReplyDraftButton({
  onDraftGenerated,
  disabled,
  conversationId,
  ticketCategory,
  urgency,
  recentMessages,
  tenantContext,
  branch,
}) {
  const [loading, setLoading] = useState(false);
  const [activeTone, setActiveTone] = useState("Formal");

  const handleGenerate = async () => {
    if (disabled || loading) return;
    setLoading(true);

    try {
      const response = await chatbotApi.suggestAdminReply({
        conversationId,
        ticketCategory,
        urgency,
        recentMessages,
        tenantContext,
        tone: activeTone,
        branch,
      });

      if (response?.success && response?.data?.suggestedReply) {
        onDraftGenerated(response.data.suggestedReply, response.data.recommendedActions || []);
      } else {
        throw new Error(response?.message || "Failed to generate reply draft");
      }
    } catch (err) {
      console.warn("AI draft generation fallback triggered:", err?.message);
      // Fallback drafts based on tone
      const fallbackDrafts = {
        Formal: "Dear Tenant, thank you for reaching out. We have received your concern and our administrative team is actively attending to it. We will keep you posted shortly.",
        Empathetic: "Hi there! We understand how important this is and apologize for any inconvenience caused. Our team is looking into this right now and will update you soon.",
        Firm: "Please note the dormitory policies regarding this matter. We request your prompt cooperation so we can resolve this matter accordingly.",
        Concise: "Received. Our team is currently reviewing and taking action."
      };
      onDraftGenerated(fallbackDrafts[activeTone] || fallbackDrafts.Formal, []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 mb-2 p-2 bg-card border border-border rounded-lg shadow-2xs">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={disabled || loading}
        className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary/90 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
      >
        {loading ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
        Auto-Draft Reply
      </button>

      <div className="flex items-center gap-1 border-l border-border pl-3">
        {TONES.map((tone) => (
          <button
            key={tone}
            type="button"
            onClick={() => setActiveTone(tone)}
            className={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
              activeTone === tone
                ? "bg-muted text-foreground border-border font-bold shadow-2xs"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            {tone}
          </button>
        ))}
      </div>
    </div>
  );
}

