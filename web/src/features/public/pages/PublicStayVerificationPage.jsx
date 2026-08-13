import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle, ShieldCheck, MapPin, Calendar, Bed, User, Building2, ArrowLeft } from "lucide-react";
import { tenantContractApi } from "../../tenant/api/tenantContractApi";

export default function PublicStayVerificationPage() {
  const { referenceId } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!referenceId) {
      setError("No reference code provided.");
      setLoading(false);
      return;
    }

    tenantContractApi.getPublicStayVerification(referenceId)
      .then((res) => {
        if (res?.verified && res.verification) {
          setData(res.verification);
        } else {
          setError(res?.message || "Residency verification record could not be found.");
        }
      })
      .catch((err) => {
        setError(err?.message || "Unable to complete residency verification.");
      })
      .finally(() => setLoading(false));
  }, [referenceId]);

  const formatDate = (val) => {
    if (!val) return "—";
    const d = new Date(val);
    return isNaN(d) ? String(val) : d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-xl w-full mx-auto my-auto">
        
        {/* Top Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-xl mb-3 shadow-sm">
            L
          </div>
          <h1 className="text-xl font-black tracking-tight text-foreground uppercase">
            Lilycrest Dormitory
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Official Public Residency & Stay Verification Portal
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">Verifying stay credentials…</p>
            <p className="text-xs text-muted-foreground mt-1">Cross-referencing active dormitory registry</p>
          </div>
        )}

        {/* Error / Not Found State */}
        {!loading && error && (
          <div className="bg-card border border-error/30 rounded-2xl p-6 sm:p-8 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-error-light text-error flex items-center justify-center mx-auto mb-3">
              <XCircle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-foreground">Verification Failed</h2>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
              {error}
            </p>
            <div className="mt-6 pt-4 border-t border-border/60">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Return to Homepage
              </Link>
            </div>
          </div>
        )}

        {/* Verified Stay Record State */}
        {!loading && data && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            
            {/* Status Header Banner */}
            <div className="bg-success text-success-foreground px-6 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0" />
                <div>
                  <h2 className="text-xs sm:text-sm font-bold tracking-wide uppercase">
                    Verified Active Resident
                  </h2>
                  <p className="text-[11px] text-white/80 font-medium">
                    Valid Lilycrest Tenancy Record
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold bg-white/20 px-2.5 py-1 rounded">
                {data.referenceNumber}
              </span>
            </div>

            {/* Resident Details Body */}
            <div className="p-6 space-y-4">
              
              {/* Resident Name */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/60">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Resident Name
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {data.tenantName}
                  </span>
                </div>
              </div>

              {/* Room & Branch Assignment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-card border border-border/80 flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Branch & Location
                    </span>
                    <span className="text-xs font-semibold text-foreground block">
                      {data.branchName}
                    </span>
                    <span className="text-[11px] text-muted-foreground block line-clamp-1">
                      {data.branchAddress}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-card border border-border/80 flex items-start gap-2.5">
                  <Bed className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                      Room & Bed
                    </span>
                    <span className="text-xs font-semibold text-foreground block">
                      Room {data.roomNumber} &bull; {data.bedLabel}
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      {data.roomType}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tenancy Validity Dates */}
              <div className="p-3.5 rounded-xl bg-card border border-border/80 flex items-start gap-3">
                <Calendar className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Tenancy Validity Window
                  </span>
                  <div className="flex items-center justify-between text-xs font-semibold text-foreground mt-0.5 flex-wrap gap-2">
                    <span>{formatDate(data.leaseStartDate)}</span>
                    <span className="text-muted-foreground font-normal">through</span>
                    <span>{formatDate(data.leaseEndDate)}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground block mt-1">
                    Duration: {data.leaseDurationMonths} months active contract
                  </span>
                </div>
              </div>

              {/* Security & Authenticity Notice */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border/50 flex items-center gap-2.5 text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-success flex-shrink-0" />
                <span className="text-[11px] leading-tight">
                  Digitally validated against Lilycrest Dormitory official tenant directory.
                </span>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-muted/20 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Verified: {formatDate(data.issuedAt || new Date())}</span>
              <Link to="/" className="font-semibold text-primary hover:underline">
                Lilycrest Dormitory
              </Link>
            </div>
          </div>
        )}

      </div>

      {/* Page Footer */}
      <footer className="text-center text-xs text-muted-foreground mt-8">
        &copy; {new Date().getFullYear()} Lilycrest Dormitory Management System. All rights reserved.
      </footer>
    </div>
  );
}
