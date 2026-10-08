"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Zap, Clock, Wrench, MapPin, CheckCircle2, LayoutDashboard, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] text-center space-y-12 py-10">
      <div className="space-y-6 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary">
          <Wrench className="w-3.5 h-3.5" />
          <span>FIXIT Platform • Production Operations</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[var(--hero-from)] to-[var(--hero-to)]">
          Campus Maintenance & Resolution
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          An operations platform for intelligent maintenance dispatch, dynamic SLA tracking, location mapping, and student resolution verification.
        </p>
        
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          {!loading && user ? (
            <>
              <Link href="/dashboard">
                <Button size="lg" className="h-11 px-8 shadow-sm">
                  <LayoutDashboard className="mr-2 w-4 h-4" /> Open Dashboard
                </Button>
              </Link>
              {user.role === 'student' ? (
                <Link href="/complaints/new">
                  <Button variant="outline" size="lg" className="h-11 px-8">
                    <PlusCircle className="mr-2 w-4 h-4" /> Report Issue
                  </Button>
                </Link>
              ) : (
                <Link href="/reports">
                  <Button variant="outline" size="lg" className="h-11 px-8">
                    View Analytics & SLA
                  </Button>
                </Link>
              )}
            </>
          ) : (
            <>
              <Link href="/register">
                <Button size="lg" className="h-11 px-8 shadow-sm">
                  Get Started <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg" className="h-11 px-8">
                  Login to Account
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mt-12 pt-12 border-t border-border">
        <div className="flex flex-col items-center text-center space-y-2.5 p-5 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
          <div className="w-11 h-11 rounded-lg border border-primary/20 bg-primary/10 flex items-center justify-center text-primary mb-1">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base">Dynamic SLA Management</h3>
          <p className="text-xs text-muted-foreground">
            Strict resolution timers (Critical: 2h, High: 6h, Medium: 24h, Low: 72h) with live breach alerts and compliance scoring.
          </p>
        </div>

        <div className="flex flex-col items-center text-center space-y-2.5 p-5 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
          <div className="w-11 h-11 rounded-lg border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-1">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base">Student Verification Loop</h3>
          <p className="text-xs text-muted-foreground">
            7-stage issue lifecycle with dual verification: students confirm fixes before issues close or reopen them with one click.
          </p>
        </div>

        <div className="flex flex-col items-center text-center space-y-2.5 p-5 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
          <div className="w-11 h-11 rounded-lg border border-blue-500/20 bg-blue-500/10 flex items-center justify-center text-blue-500 mb-1">
            <MapPin className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base">Granular Campus Locations</h3>
          <p className="text-xs text-muted-foreground">
            Pinpoint maintenance requests down to specific buildings, floors, rooms, and labs for swift dispatch.
          </p>
        </div>
      </div>
    </div>
  );
}
