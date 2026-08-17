import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import AdminSopReferenceModal from "./AdminSopReferenceModal";
import AdminTenantInfoCard from "./AdminTenantInfoCard";
import AdminRoomOccupantsCard from "./AdminRoomOccupantsCard";
import AdminDailyBriefingCard from "./AdminDailyBriefingCard";
import { chatbotApi } from "../../../../shared/api/chatbotApi";
import { useAuth } from "../../../../shared/hooks/useAuth";

const SUGGESTED_PROMPTS = [
  { label: "Today's Shift Briefing", prompt: "Today's Shift Briefing" },
  { label: "Move-out clearance checklist", prompt: "Move-out clearance checklist" },
  { label: "Lost room key policy", prompt: "Lost room key policy" },
  { label: "Utility late penalty rules", prompt: "Utility late penalty rules" },
  { label: "Guest curfew & visitor policy", prompt: "Guest curfew & visitor policy" },
  { label: "Urgent maintenance turnaround times", prompt: "Urgent maintenance turnaround times" },
];

const DEFAULT_SOPS = {
  "Move-out clearance checklist": {
    title: "Move-Out & Deposit Clearance Protocol",
    steps: [
      "Verify that all monthly rent and utility invoices are settled with zero outstanding balance.",
      "Conduct physical room and fixture inspection using the Room Clearance Checklist.",
      "Collect all physical keys, access cards, and dormitory credentials.",
      "Calculate security deposit deductions (if any damage is noted) and initiate refund voucher."
    ],
    policyLink: "Lilycrest Operations Manual §3.1 (Move-Out Governance)"
  },
  "Lost room key policy": {
    title: "Key & Lock Governance Protocol",
    steps: [
      "Verify tenant identity via government ID or system profile photo.",
      "Issue temporary master key for immediate room access and log into Front Desk Key Log.",
      "Assess standard ₱250.00 key replacement fee on the tenant's next billing cycle.",
      "Front desk duplicates the replacement key within 24 hours and updates key inventory."
    ],
    policyLink: "Lilycrest Operations Manual §7.2 (Key & Lock Governance)"
  },
  "Utility late penalty rules": {
    title: "Utility Billing Disputes & Grace Periods",
    steps: [
      "Tenants receive a standard 5-day grace period from the billing generation date.",
      "A 5% late penalty applies on the 6th day past the due date if unaddressed.",
      "If a meter reading is disputed, maintenance must conduct a physical meter re-check within 24 hours.",
      "Billing adjustments are applied as credit adjustments on the subsequent billing statement."
    ],
    policyLink: "Lilycrest Operations Manual §5.4 (Utility Billing Governance)"
  },
  "Guest curfew & visitor policy": {
    title: "Visitor & Overnight Guest Protocol",
    steps: [
      "All visiting guests must sign in at the front desk with a valid government or student ID.",
      "Standard visiting hours conclude promptly at 10:00 PM daily.",
      "Overnight guests must be pre-registered 24 hours in advance with a ₱300.00/night guest surcharge.",
      "Unregistered overnight guests incur a formal house rule violation notice (§8.1)."
    ],
    policyLink: "Lilycrest Operations Manual §8.1 (Visitor Governance)"
  },
  "Urgent maintenance turnaround times": {
    title: "Urgent Maintenance Escalation Turnaround Times",
    steps: [
      "Emergency repairs (major water leak, electrical hazard) require front desk triage within 15 minutes.",
      "On-call certified technician dispatched within 60 minutes for high-severity tickets.",
      "Tenant must be provided regular status updates via admin chat thread every 2 hours until resolution.",
      "Post-repair sign-off signed by tenant and maintenance lead before closing the ticket."
    ],
    policyLink: "Lilycrest Operations Manual §4.2 (Facility Maintenance Turnaround Times)"
  }
};

const INITIAL_MESSAGE = {
  id: "init-1",
  sender: "assistant",
  text: "Hello! I am your Lilycrest Operations Assistant. Click \"Today's Shift Briefing\" for your daily operations standup, search tenant records, or ask about any dormitory procedure.",
  timestamp: new Date(),
};

export default function AdminCopilotDrawer({ isOpen, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeSop, setActiveSop] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState(SUGGESTED_PROMPTS);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  const fetchDynamicSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const res = await chatbotApi.getAdminDynamicSuggestions({ branch: user?.branch || "all" });
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        setSuggestedPrompts(res.data);
      }
    } catch (err) {
      console.warn("Could not fetch dynamic suggestions:", err?.message);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Initialize Web Speech API for voice dictation
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0].transcript)
            .join("");
          setInputMessage(transcript);
        };

        recognition.onerror = (event) => {
          console.warn("Speech recognition error:", event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchDynamicSuggestions();
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!isOpen) return null;

  const toggleVoiceListening = () => {
    if (!speechSupported || !recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn("Could not start speech recognition:", err);
      }
    }
  };

  const handleSendMessage = async (customPrompt) => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const rawQuery = (customPrompt || inputMessage).trim();
    if (!rawQuery || loading) return;

    // Clean leading emojis or symbols for robust backend regex matching
    const queryText = rawQuery.replace(/^[^\w\s]+/, "").trim() || rawQuery;

    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: rawQuery,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInputMessage("");
    setLoading(true);

    const isBriefing = /(?:briefing|standup|morning standup|daily overview|shift briefing)/i.test(queryText);

    const matchedKey = Object.keys(DEFAULT_SOPS).find(
      (k) =>
        k.toLowerCase().includes(queryText.toLowerCase()) ||
        queryText.toLowerCase().includes(k.toLowerCase())
    );

    try {
      const response = await chatbotApi.queryAdminSop({
        query: queryText,
        branch: user?.branch || "all",
      });

      if (response?.success && response?.data) {
        const data = response.data;
        const steps =
          Array.isArray(data.checklist) && data.checklist.length > 0
            ? data.checklist
            : data.answer && !data.isTenantLookup && !data.isDailyBriefing
            ? data.answer.split("\n").filter((l) => l.trim().length > 0)
            : [];

        const botMsg = {
          id: `bot-${Date.now()}`,
          sender: "assistant",
          title: data.title || (data.isDailyBriefing ? "Daily Operations Briefing" : data.isTenantLookup ? "Tenant Information" : `SOP Guidance: "${rawQuery}"`),
          steps: steps,
          text: data.answer || null,
          isDailyBriefing: data.isDailyBriefing || false,
          briefing: data.briefing || null,
          isTenantLookup: data.isTenantLookup || false,
          tenant: data.tenant || null,
          candidates: data.candidates || null,
          isRoomSearch: data.isRoomSearch || false,
          roomDetails: data.roomDetails || null,
          occupants: data.occupants || [],
          policyLink: data.policyReference || (data.isTenantLookup || data.isDailyBriefing ? null : "Lilycrest Operations Manual"),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMsg]);
      } else if (isBriefing) {
        // Safe graceful briefing fallback
        const branchTitle = user?.branch === "guadalupe" ? "Guadalupe Branch" : user?.branch === "gil-puyat" ? "Gil Puyat Branch" : "Consolidated Operations";
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: "assistant",
            title: `Today's Operations Briefing · ${branchTitle}`,
            isDailyBriefing: true,
            briefing: {
              title: `Today's Operations Briefing · ${branchTitle}`,
              dateString: new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
              branch: branchTitle,
              stats: {
                moveInsCount: 0,
                urgentMaintenanceCount: 0,
                paymentsCollectedYesterday: 0,
                upcomingDueInvoicesCount: 0,
                overdueInvoicesCount: 0,
              },
              moveIns: [],
              moveOuts: [],
              maintenance: [],
              announcements: [],
            },
            timestamp: new Date(),
          },
        ]);
      } else if (matchedKey) {
        const fallbackSop = DEFAULT_SOPS[matchedKey];
        const botMsg = {
          id: `bot-${Date.now()}`,
          sender: "assistant",
          title: fallbackSop.title,
          steps: fallbackSop.steps,
          policyLink: fallbackSop.policyLink,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        throw new Error(response?.message || "No specific SOP or operational record found");
      }
    } catch (err) {
      console.warn("Assistant query fallback triggered:", err?.message);
      if (isBriefing) {
        const branchTitle = user?.branch === "guadalupe" ? "Guadalupe Branch" : user?.branch === "gil-puyat" ? "Gil Puyat Branch" : "Consolidated Operations";
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: "assistant",
            title: `Today's Operations Briefing · ${branchTitle}`,
            isDailyBriefing: true,
            briefing: {
              title: `Today's Operations Briefing · ${branchTitle}`,
              dateString: new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
              branch: branchTitle,
              stats: {
                moveInsCount: 0,
                urgentMaintenanceCount: 0,
                paymentsCollectedYesterday: 0,
                upcomingDueInvoicesCount: 0,
                overdueInvoicesCount: 0,
              },
              moveIns: [],
              moveOuts: [],
              maintenance: [],
              announcements: [],
            },
            timestamp: new Date(),
          },
        ]);
      } else if (matchedKey) {
        const fallbackSop = DEFAULT_SOPS[matchedKey];
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: "assistant",
            title: fallbackSop.title,
            steps: fallbackSop.steps,
            policyLink: fallbackSop.policyLink,
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: "assistant",
            title: `Operations Guidance: "${rawQuery}"`,
            steps: [
              "Review the standard Lilycrest Dormitory Operations Manual on file.",
              "Verify tenant identity, room assignment, and current contract status in the Tenants tab.",
              "If the concern involves an active dispute or maintenance urgency, coordinate with the branch supervisor."
            ],
            policyLink: "Lilycrest Operations Manual §General Protocols",
            timestamp: new Date(),
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (msgId, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetChat = () => {
    setMessages([INITIAL_MESSAGE]);
  };

  const content = (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-card h-full shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3.5 border-b border-border bg-card shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">
                {user?.role === "owner" ? "Owner Operations Assistant" : "Admin Operations Assistant"}
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                SOP & Briefings
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">Instant briefings, tenant lookups & SOP answers</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleResetChat}
              title="Reset conversation"
              className="px-2 py-1 hover:bg-muted rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 hover:bg-muted rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border"
            >
              Close
            </button>
          </div>
        </header>

        {/* Message Thread (Scrollable Body) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/15">
          {messages.map((msg) => {
            const isUser = msg.sender === "user";

            if (isUser) {
              return (
                <div key={msg.id} className="flex justify-end items-start gap-2.5">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-primary text-primary-foreground p-3 text-xs leading-relaxed shadow-xs">
                    {msg.text}
                  </div>
                  <div className="h-7 w-7 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                    You
                  </div>
                </div>
              );
            }

            // If assistant returned Daily Shift Briefing Card
            if (msg.briefing) {
              return (
                <div key={msg.id} className="flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-muted border border-border flex items-center justify-center text-primary text-xs font-bold shrink-0 mt-0.5" aria-hidden="true">
                    AI
                  </div>
                  <div className="max-w-[90%] flex-1 space-y-2">
                    <AdminDailyBriefingCard briefing={msg.briefing} onCloseDrawer={onClose} />
                  </div>
                </div>
              );
            }

            // If assistant returned a Single Tenant Card
            if (msg.tenant) {
              return (
                <div key={msg.id} className="flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-muted border border-border flex items-center justify-center text-primary text-xs font-bold shrink-0 mt-0.5" aria-hidden="true">
                    AI
                  </div>
                  <div className="max-w-[90%] flex-1 space-y-2">
                    <AdminTenantInfoCard tenant={msg.tenant} onCloseDrawer={onClose} />
                  </div>
                </div>
              );
            }

            // If assistant returned Room Occupants Card
            if (msg.roomDetails) {
              return (
                <div key={msg.id} className="flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-muted border border-border flex items-center justify-center text-primary text-xs font-bold shrink-0 mt-0.5" aria-hidden="true">
                    AI
                  </div>
                  <div className="max-w-[90%] flex-1 space-y-2">
                    <AdminRoomOccupantsCard
                      roomDetails={msg.roomDetails}
                      occupants={msg.occupants}
                      onSelectTenant={(t) => handleSendMessage(`show info for ${t.fullName}`)}
                      onCloseDrawer={onClose}
                    />
                  </div>
                </div>
              );
            }

            // If assistant returned Multiple Candidate Choices
            if (msg.candidates && msg.candidates.length > 0) {
              return (
                <div key={msg.id} className="flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-muted border border-border flex items-center justify-center text-primary text-xs font-bold shrink-0 mt-0.5" aria-hidden="true">
                    AI
                  </div>
                  <div className="max-w-[90%] space-y-2">
                    <div className="rounded-2xl rounded-tl-xs bg-card border border-border p-3.5 text-xs text-foreground leading-relaxed shadow-xs space-y-2.5">
                      <div className="font-bold text-foreground pb-1.5 border-b border-border">
                        <span>{msg.title || "Matching Tenants"}</span>
                      </div>
                      <p className="text-muted-foreground">{msg.text}</p>

                      <div className="space-y-1.5 pt-1">
                        {msg.candidates.map((cand) => (
                          <button
                            key={cand._id}
                            type="button"
                            onClick={() => handleSendMessage(`show info for ${cand.fullName}`)}
                            className="w-full flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border hover:bg-muted transition-colors cursor-pointer text-left"
                          >
                            <div>
                              <div className="font-bold text-foreground text-xs">{cand.fullName}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {cand.roomNumber !== "Unassigned" ? `Room ${cand.roomNumber}` : "Unassigned"} · {cand.branch}
                              </div>
                            </div>
                            <span className="text-[11px] font-semibold text-primary">
                              View
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Standard Assistant SOP Message
            const copyableText = msg.steps
              ? `${msg.title ? `${msg.title}\n\n` : ""}${msg.steps
                  .map((step, idx) => `${idx + 1}. ${step}`)
                  .join("\n")}${msg.policyLink ? `\n\nReference: ${msg.policyLink}` : ""}`
              : msg.text || "";

            return (
              <div key={msg.id} className="flex items-start gap-2.5">
                <div className="h-7 w-7 rounded-full bg-muted border border-border flex items-center justify-center text-primary text-xs font-bold shrink-0 mt-0.5" aria-hidden="true">
                  AI
                </div>
                <div className="max-w-[90%] space-y-2">
                  <div className="rounded-2xl rounded-tl-xs bg-card border border-border p-3.5 text-xs text-foreground leading-relaxed shadow-xs space-y-2.5">
                    {msg.title && (
                      <h4 className="font-bold text-xs text-foreground pb-1.5 border-b border-border">
                        {msg.title}
                      </h4>
                    )}

                    {msg.steps && msg.steps.length > 0 ? (
                      <div className="space-y-2">
                        {msg.steps.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
                            <span className="font-bold text-primary shrink-0">{idx + 1}.</span>
                            <span className="text-foreground">{step}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}

                    {/* Footer Actions (Policy Link & Copy) */}
                    {(msg.policyLink || msg.steps) && (
                      <div className="pt-2.5 border-t border-border flex items-center justify-between text-[11px] gap-2">
                        {msg.policyLink ? (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveSop({
                                title: msg.title || "Policy Reference",
                                steps: msg.steps || [],
                                policyLink: msg.policyLink,
                              })
                            }
                            className="text-primary font-semibold hover:underline cursor-pointer truncate max-w-[70%]"
                          >
                            <span className="truncate">{msg.policyLink}</span>
                          </button>
                        ) : (
                          <span />
                        )}

                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, copyableText)}
                          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0 font-medium"
                        >
                          {copiedId === msg.id ? (
                            <span className="text-emerald-600 font-semibold">Copied!</span>
                          ) : (
                            <span>Copy Steps</span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-full bg-muted border border-border flex items-center justify-center text-primary text-xs font-bold shrink-0 mt-0.5" aria-hidden="true">
                AI
              </div>
              <div className="rounded-2xl rounded-tl-xs bg-card border border-border p-3 text-xs text-muted-foreground shadow-xs">
                <span>Generating operational briefing...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Quick Topic Chips (Above Composer) */}
        <div className="px-3.5 py-2 border-t border-border bg-card flex items-center gap-1.5 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1 shrink-0 mr-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Live Suggestions:
            </span>
            <button
              type="button"
              onClick={fetchDynamicSuggestions}
              disabled={loadingSuggestions}
              title="Refresh suggestions from live system data"
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border"
            >
              {loadingSuggestions ? "Loading..." : "Refresh"}
            </button>
          </div>

          {suggestedPrompts.map((item, idx) => {
            const label = item.label || item;
            const prompt = item.prompt || item;
            const category = item.category || "sop";

            let colorClasses = "bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:border-primary";
            if (category === "standup" || label.includes("Today's Shift Briefing")) {
              colorClasses = "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-bold";
            } else if (category === "maintenance") {
              colorClasses = "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-semibold";
            } else if (category === "move_in") {
              colorClasses = "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-semibold";
            } else if (category === "billing") {
              colorClasses = "bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800 font-semibold";
            } else if (category === "contracts") {
              colorClasses = "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 font-semibold";
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                disabled={loading}
                className={`px-2.5 py-1 text-[11px] font-medium border rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 ${colorClasses}`}
              >
                {label}
              </button>
            );
          })}
        </div>


        {/* Bottom Message Composer with Voice Dictation */}
        <footer className="p-3 border-t border-border bg-card shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={
                  isListening
                    ? "Listening... Speak your question now..."
                    : "Ask SOP, search tenant name, or click Shift Briefing..."
                }
                disabled={loading}
                className={`w-full pl-3.5 pr-14 py-2.5 bg-background border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors ${
                  isListening
                    ? "border-rose-500 ring-2 ring-rose-500/20 animate-pulse"
                    : "border-border focus:border-primary"
                } disabled:opacity-50`}
              />

              {/* Voice Dictation Button inside Input */}
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleVoiceListening}
                  title={isListening ? "Stop voice dictation" : "Start voice dictation (hands-free)"}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                    isListening
                      ? "bg-rose-500 text-white animate-bounce"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted border border-border"
                  }`}
                >
                  {isListening ? "Stop" : "Voice"}
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !inputMessage.trim()}
              className="h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-xs"
            >
              <span>{loading ? "Sending..." : "Send"}</span>
            </button>
          </form>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground px-1">
            <span>Press Enter to send</span>
            <span>Lilycrest Ground Operations Advisor</span>
          </div>
        </footer>
      </div>

      {activeSop && (
        <AdminSopReferenceModal sop={activeSop} onClose={() => setActiveSop(null)} />
      )}
    </div>
  );

  return createPortal(content, document.body);
}


