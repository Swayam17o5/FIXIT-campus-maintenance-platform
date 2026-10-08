"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStatusBadgeVariant, getPriorityBadgeVariant, formatStatus } from "@/lib/helpers";
import Link from "next/link";
import {
  Plus,
  Search,
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Hourglass,
  Layers,
  MapPin,
  TrendingUp,
  UserCheck,
  ShieldAlert
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface ComplaintItem {
  complaint_id: number;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  building?: string;
  floor?: string;
  room?: string;
  category?: string;
  assigned_staff?: string;
  student_name?: string;
  date_filed?: string;
  sla_hours?: number;
  sla_due_date?: string;
  sla_remaining_text?: string;
  sla_percentage?: number;
  is_breached?: boolean;
}

interface OperationsKPIs {
  totalIssues: number;
  openIssues: number;
  inProgressIssues: number;
  resolvedIssues: number;
  slaBreachedIssues: number;
  avgResolutionTimeHours: number;
  resolutionRate: number;
  slaCompliance: number;
}

interface OperationsDashboardData {
  kpis: OperationsKPIs;
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byLocation: { building: string; count: number }[];
  recentHighPriority: ComplaintItem[];
  immediateAttention: ComplaintItem[];
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [opsData, setOpsData] = useState<OperationsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        setLoading(true);

        // Fetch complaints list
        let endpoint = "/complaints";
        if (user.role === "student") {
          endpoint = `/students/${user.id}/complaints`;
        } else if (user.role === "staff") {
          endpoint = `/staff/${user.id}/complaints`;
        }

        const [complaintsRes, opsRes] = await Promise.allSettled([
          api.get(endpoint),
          user.role === "admin" || user.role === "staff"
            ? api.get("/reports/operations-dashboard")
            : Promise.resolve(null)
        ]);

        if (complaintsRes.status === "fulfilled") {
          const resData = complaintsRes.value?.data;
          setComplaints(Array.isArray(resData) ? resData : resData?.data || []);
        }

        if (opsRes.status === "fulfilled" && opsRes.value?.data) {
          setOpsData(opsRes.value.data);
        }
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (authLoading || (loading && complaints.length === 0 && !opsData)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filteredComplaints = complaints.filter((c) => {
    const matchesSearch =
      c.title?.toLowerCase().includes(search.toLowerCase()) ||
      c.complaint_id?.toString().includes(search) ||
      c.building?.toLowerCase().includes(search.toLowerCase()) ||
      c.category?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && !["RESOLVED", "VERIFIED", "CLOSED", "resolved", "closed"].includes(c.status || "")) ||
      (statusFilter === "breached" && c.is_breached) ||
      c.status?.toUpperCase() === statusFilter.toUpperCase();

    const matchesPriority =
      priorityFilter === "all" || c.priority?.toLowerCase() === priorityFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const kpis = opsData?.kpis || {
    totalIssues: complaints.length,
    openIssues: complaints.filter((c) => ["REPORTED", "UNDER_REVIEW", "ASSIGNED", "pending", "open"].includes(c.status || "")).length,
    inProgressIssues: complaints.filter((c) => ["IN_PROGRESS", "in_progress"].includes(c.status || "")).length,
    resolvedIssues: complaints.filter((c) => ["RESOLVED", "VERIFIED", "CLOSED", "resolved", "closed"].includes(c.status || "")).length,
    slaBreachedIssues: complaints.filter((c) => c.is_breached).length,
    avgResolutionTimeHours: 0,
    resolutionRate: complaints.length > 0 ? Math.round((complaints.filter((c) => ["RESOLVED", "VERIFIED", "CLOSED", "resolved", "closed"].includes(c.status || "")).length / complaints.length) * 100) : 0,
    slaCompliance: 100
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight">FIXIT Operations</h1>
            <Badge variant="outline" className="text-xs uppercase font-mono">
              {user?.role} portal
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time campus maintenance triage, SLA tracking, and resolution workflow.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === "student" && (
            <Link href="/complaints/new">
              <Button className="shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Report New Issue
              </Button>
            </Link>
          )}
          {(user?.role === "admin" || user?.role === "staff") && (
            <Link href="/reports">
              <Button variant="outline" size="sm">
                <TrendingUp className="w-4 h-4 mr-2" />
                Full Analytics
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Operations KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-4 bg-card/60 backdrop-blur-sm border-border hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total</span>
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold tracking-tight">{kpis.totalIssues}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Reported maintenance</p>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm border-border hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Open / Review</span>
            <Hourglass className="w-4 h-4 text-warning" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-warning">{kpis.openIssues}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Awaiting resolution</p>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm border-border hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">In Progress</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-blue-500">{kpis.inProgressIssues}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Active investigation</p>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm border-border hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-500">{kpis.resolvedIssues}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{kpis.resolutionRate}% resolution rate</p>
        </Card>

        <Card className={`p-4 bg-card/60 backdrop-blur-sm border-border transition-colors ${kpis.slaBreachedIssues > 0 ? "border-destructive/60 bg-destructive/5" : ""}`}>
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">SLA Breached</span>
            <AlertTriangle className={`w-4 h-4 ${kpis.slaBreachedIssues > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </div>
          <div className={`text-2xl font-bold tracking-tight ${kpis.slaBreachedIssues > 0 ? "text-destructive" : ""}`}>
            {kpis.slaBreachedIssues}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {kpis.slaBreachedIssues > 0 ? "Urgent attention" : "All within SLA"}
          </p>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm border-border hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Time</span>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold tracking-tight">
            {kpis.avgResolutionTimeHours}h
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Avg resolution time</p>
        </Card>
      </div>

      {/* Immediate Attention Callout (For Admin & Staff) */}
      {opsData && opsData.immediateAttention && opsData.immediateAttention.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive animate-pulse" />
              <CardTitle className="text-sm font-semibold text-destructive">
                Immediate Attention Required ({opsData.immediateAttention.length} urgent issues)
              </CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">Critical priority or SLA deadline breached</span>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="divide-y divide-border/60">
              {opsData.immediateAttention.slice(0, 3).map((item) => (
                <div key={item.complaint_id} className="py-2.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">#{item.complaint_id}</span>
                      <Link href={`/complaints/${item.complaint_id}`} className="text-sm font-medium hover:underline truncate">
                        {item.title}
                      </Link>
                      <Badge variant={getPriorityBadgeVariant(item.priority)} className="text-[10px] uppercase">
                        {item.priority}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                      {item.building && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {item.building} {item.room ? `• ${item.room}` : ""}
                        </span>
                      )}
                      <span>Category: {item.category}</span>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <span className="text-xs font-semibold text-destructive block">
                      {item.sla_remaining_text || "Breached"}
                    </span>
                    <Link href={`/complaints/${item.complaint_id}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs mt-1">
                        Triage Now
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search, Filter Bar and Issues List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <CardTitle className="text-lg">Maintenance Issues Stream</CardTitle>
              <CardDescription>
                {filteredComplaints.length} {filteredComplaints.length === 1 ? "issue" : "issues"} matched
              </CardDescription>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search title, building, ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              <select
                aria-label="Filter issues by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-border bg-card px-2.5 text-xs focus:ring-1 focus:ring-ring"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="breached">SLA Breached</option>
                <option value="REPORTED">Reported</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="VERIFIED">Verified</option>
                <option value="CLOSED">Closed</option>
                <option value="REJECTED">Rejected</option>
              </select>

              <select
                aria-label="Filter issues by priority"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-9 rounded-md border border-border bg-card px-2.5 text-xs focus:ring-1 focus:ring-ring"
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical (2h SLA)</option>
                <option value="high">High (6h SLA)</option>
                <option value="medium">Medium (24h SLA)</option>
                <option value="low">Low (72h SLA)</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredComplaints.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-lg">
              <Layers className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No maintenance issues found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search || statusFilter !== "all"
                  ? "Try adjusting your search filters"
                  : "Everything on campus is currently in good order!"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground uppercase bg-muted/40 font-semibold">
                    <th className="py-2.5 px-3">Issue</th>
                    <th className="py-2.5 px-3">Location</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">SLA Status</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Assignee</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredComplaints.map((c) => (
                    <tr key={c.complaint_id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3 max-w-[280px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-muted-foreground">#{c.complaint_id}</span>
                          <Link
                            href={`/complaints/${c.complaint_id}`}
                            className="font-medium hover:underline text-foreground truncate block"
                          >
                            {c.title}
                          </Link>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Reported {c.date_filed ? new Date(c.date_filed).toLocaleDateString() : ""} {c.student_name ? `by ${c.student_name}` : ""}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-xs whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <MapPin className="w-3 h-3 text-primary" />
                          {c.building || "Campus Complex"}
                        </span>
                        {c.room && (
                          <div className="text-[11px] text-muted-foreground/80 pl-4">
                            Room {c.room} {c.floor ? `(Fl ${c.floor})` : ""}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-xs whitespace-nowrap">
                        <Badge variant="outline" className="font-normal text-[11px]">
                          {c.category || "General"}
                        </Badge>
                      </td>

                      <td className="py-3 px-3 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={getPriorityBadgeVariant(c.priority)} className="text-[10px] uppercase">
                            {c.priority}
                          </Badge>
                          <span className={`text-[11px] font-mono ${c.is_breached ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                            {c.sla_remaining_text || `${c.sla_hours || 24}h`}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <Badge variant={getStatusBadgeVariant(c.status)} className="capitalize text-xs">
                          {formatStatus(c.status)}
                        </Badge>
                      </td>

                      <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <UserCheck className="w-3 h-3 opacity-60" />
                          {c.assigned_staff || "Unassigned"}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <Link href={`/complaints/${c.complaint_id}`}>
                          <Button size="sm" variant="ghost" className="h-8 text-xs">
                            View &rarr;
                          </Button>
                        </Link>
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
