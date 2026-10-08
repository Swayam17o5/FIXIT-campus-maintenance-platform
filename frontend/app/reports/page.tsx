"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Loader2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  MapPin,
  Building,
  ShieldCheck,
  UserCheck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface OperationsDashboardData {
  kpis: {
    totalIssues: number;
    openIssues: number;
    inProgressIssues: number;
    resolvedIssues: number;
    slaBreachedIssues: number;
    avgResolutionTimeHours: number;
    resolutionRate: number;
    slaCompliance: number;
  };
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byLocation: { building: string; count: number }[];
}

interface StaffWorkloadItem {
  staff_name?: string;
  department?: string;
  total_assigned?: number;
  resolved?: number;
  pending_open?: number;
  avg_feedback_rating?: number;
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [opsData, setOpsData] = useState<OperationsDashboardData | null>(null);
  const [staffWorkload, setStaffWorkload] = useState<StaffWorkloadItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== "admin" && user.role !== "staff"))) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const [opsRes, staffRes] = await Promise.allSettled([
          api.get("/reports/operations-dashboard"),
          api.get("/reports/staff-performance")
        ]);

        if (opsRes.status === "fulfilled") {
          setOpsData(opsRes.value.data);
        }

        if (staffRes.status === "fulfilled") {
          setStaffWorkload(Array.isArray(staffRes.value.data) ? staffRes.value.data : []);
        }
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === "admin" || user?.role === "staff") {
      fetchAnalytics();
    }
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kpis = opsData?.kpis || {
    totalIssues: 0,
    openIssues: 0,
    inProgressIssues: 0,
    resolvedIssues: 0,
    slaBreachedIssues: 0,
    avgResolutionTimeHours: 0,
    resolutionRate: 0,
    slaCompliance: 100
  };

  const byCategory = opsData?.byCategory || [];
  const byLocation = opsData?.byLocation || [];
  const byStatus = opsData?.byStatus || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Analytics & Operational Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Real-time performance metrics, SLA compliance, location hotspots, and resolution efficiency.
        </p>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-card/60 border-border">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Volume</span>
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold">{kpis.totalIssues}</div>
          <p className="text-xs text-muted-foreground mt-0.5">Lifetime campus issues</p>
        </Card>

        <Card className="p-4 bg-card/60 border-border">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Resolution Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-500">{kpis.resolutionRate}%</div>
          <p className="text-xs text-muted-foreground mt-0.5">{kpis.resolvedIssues} of {kpis.totalIssues} resolved</p>
        </Card>

        <Card className="p-4 bg-card/60 border-border">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">SLA Compliance</span>
            <ShieldCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-500">{kpis.slaCompliance}%</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {kpis.slaBreachedIssues === 0 ? "Zero SLA breaches" : `${kpis.slaBreachedIssues} breached deadlines`}
          </p>
        </Card>

        <Card className="p-4 bg-card/60 border-border">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Resolution Time</span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div className="text-2xl font-bold text-warning">{kpis.avgResolutionTimeHours} hrs</div>
          <p className="text-xs text-muted-foreground mt-0.5">From reporting to resolution</p>
        </Card>
      </div>

      {/* Visual Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Issues by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issues by Category</CardTitle>
            <CardDescription className="text-xs">Distribution across infrastructure categories</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {byCategory.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">No category data recorded yet.</p>
            ) : (
              byCategory.map((c) => {
                const pct = kpis.totalIssues > 0 ? Math.round((c.count / kpis.totalIssues) * 100) : 0;
                return (
                  <div key={c.category} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{c.category}</span>
                      <span className="text-muted-foreground">{c.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Issues by Location / Building */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary" />
              Issues by Campus Building
            </CardTitle>
            <CardDescription className="text-xs">Location hotspots and facility volume</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {byLocation.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">No location data recorded yet.</p>
            ) : (
              byLocation.map((loc) => {
                const pct = kpis.totalIssues > 0 ? Math.round((loc.count / kpis.totalIssues) * 100) : 0;
                return (
                  <div key={loc.building} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{loc.building}</span>
                      <span className="text-muted-foreground">{loc.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Staff Resolution & Workload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" />
            Maintenance Staff Workload & Performance
          </CardTitle>
          <CardDescription className="text-xs">Staff resolution volume and department assignments</CardDescription>
        </CardHeader>
        <CardContent>
          {staffWorkload.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">No staff workload history available yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground bg-muted/40 font-semibold">
                    <th className="py-2 px-3">Staff Member</th>
                    <th className="py-2 px-3">Department</th>
                    <th className="py-2 px-3 text-right">Resolved Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {staffWorkload.map((s, idx) => (
                    <tr key={idx} className="hover:bg-muted/20">
                      <td className="py-2.5 px-3 font-medium text-foreground">{s.staff_name || "Staff"}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{s.department || "Maintenance"}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-500">
                        {s.resolved ?? (s as { resolved_count?: number }).resolved_count ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
