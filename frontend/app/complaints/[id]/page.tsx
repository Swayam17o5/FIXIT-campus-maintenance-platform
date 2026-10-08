"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  Send,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Clock,
  UserCheck,
  Building,
  RotateCcw,
  ShieldAlert,
  History,
  XCircle
} from "lucide-react";
import Link from "next/link";
import {
  formatStatus,
  getPriorityBadgeVariant,
  getStatusBadgeVariant,
  LIFECYCLE_STEPS,
  getLifecycleStepIndex
} from "@/lib/helpers";

interface ComplaintResponse {
  created_at?: string;
  date_responded?: string;
  response_id?: number;
  message: string;
  staff_id?: number | null;
  staff_name?: string;
}

interface StaffMember {
  staff_id: number;
  name: string;
  department?: string;
}

interface Department {
  department_id: number;
  name: string;
}

interface AssignmentLog {
  assignment_id: number;
  assigned_at: string;
  department?: string;
  notes?: string;
  staff_name?: string;
}

interface ActivityItem {
  activity_id: number;
  event_type: string;
  message: string;
  actor_name: string;
  actor_role: string;
  created_at: string;
}

interface ComplaintRecord {
  complaint_id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  building?: string;
  floor?: string;
  room?: string;
  location_description?: string;
  department?: string;
  rejection_reason?: string;
  resolution_notes?: string;
  sla_hours?: number;
  sla_due_date?: string;
  sla_remaining_text?: string;
  sla_percentage?: number;
  is_breached?: boolean;
  date_filed?: string;
  assigned_at?: string;
  date_resolved?: string;
  verified_at?: string;
  closed_at?: string;
  student_id: number;
  student_name?: string;
  category?: string;
  staff_id?: number | null;
  assigned_staff?: string | null;
  responses?: ComplaintResponse[];
  assignment_history?: AssignmentLog[];
  activity_timeline?: ActivityItem[];
  feedback?: {
    feedback_id: number;
    rating: number;
    message: string;
    date: string;
  } | null;
}

export default function ComplaintDetailPage() {
  const themedSelectClass = "flex h-9 w-full rounded-md border border-border bg-card px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  const { id } = useParams();
  const { user } = useAuth();
  
  const [complaint, setComplaint] = useState<ComplaintRecord | null>(null);
  const [responses, setResponses] = useState<ComplaintResponse[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Action Forms state
  const [replyMessage, setReplyMessage] = useState("");
  const [statusUpdate, setStatusUpdate] = useState("");
  const [assignStaffId, setAssignStaffId] = useState("");
  const [assignDept, setAssignDept] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [feedbackRating, setFeedbackRating] = useState("5");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const [compRes, respRes] = await Promise.all([
        api.get(`/complaints/${id}`),
        api.get(`/responses/complaint/${id}`)
      ]);
      setComplaint(compRes.data);
      setResponses(Array.isArray(respRes.data) ? respRes.data : respRes.data.data || []);
      setStatusUpdate(compRes.data.status);
      setAssignStaffId(compRes.data.staff_id ? String(compRes.data.staff_id) : "");
      setAssignDept(compRes.data.department || "");

      if (user?.role === 'admin' || user?.role === 'staff') {
        const [staffRes, deptRes] = await Promise.allSettled([
          api.get("/staff"),
          api.get("/departments")
        ]);
        if (staffRes.status === "fulfilled") {
          setStaffList(Array.isArray(staffRes.value.data) ? staffRes.value.data : staffRes.value.data.data || []);
        }
        if (deptRes.status === "fulfilled") {
          setDepartments(Array.isArray(deptRes.value.data) ? deptRes.value.data : []);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, user?.role]);

  useEffect(() => {
    if (id && user) {
      void fetchData();
    }
  }, [id, user, fetchData]);

  const handleSendReply = async () => {
    if (!replyMessage.trim()) return;
    try {
      setActionLoading(true);
      await api.post("/responses", {
        complaint_id: parseInt(id as string),
        staff_id: user?.role === 'staff' || user?.role === 'admin' ? user.id : 1,
        message: replyMessage
      });
      setReplyMessage("");
      fetchData();
    } catch (err) {
      console.error("Failed to send reply", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (targetStatus?: string) => {
    const nextStatus = targetStatus || statusUpdate;
    try {
      setActionLoading(true);
      setErrorMsg("");
      await api.patch(`/complaints/${id}`, {
        status: nextStatus,
        rejection_reason: nextStatus === 'REJECTED' ? rejectionReason : undefined,
        resolution_notes: nextStatus === 'RESOLVED' ? resolutionNotes : undefined
      });
      fetchData();
    } catch (err: unknown) {
      const msg = typeof err === "object" && err !== null && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : "Failed to update status";
      setErrorMsg(msg || "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssign = async () => {
    try {
      setActionLoading(true);
      setErrorMsg("");
      const normalizedStaffId = assignStaffId ? Number(assignStaffId) : null;
      await api.patch(`/complaints/${id}/assign`, {
        staff_id: Number.isInteger(normalizedStaffId) ? normalizedStaffId : null,
        department: assignDept || null
      });
      fetchData();
    } catch (err: unknown) {
      const msg = typeof err === "object" && err !== null && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : "Failed to assign staff";
      setErrorMsg(msg || "Failed to assign staff");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      setActionLoading(true);
      await api.post(`/complaints/${id}/verify`);
      fetchData();
    } catch (err) {
      console.error("Failed to verify", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopen = async () => {
    try {
      setActionLoading(true);
      await api.post(`/complaints/${id}/reopen`, { reason: reopenReason || 'Issue still persists' });
      setReopenReason("");
      fetchData();
    } catch (err) {
      console.error("Failed to reopen", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await api.post("/feedback", {
        complaint_id: parseInt(id as string),
        student_id: user?.id,
        rating: parseInt(feedbackRating),
        message: feedbackMessage
      });
      fetchData();
    } catch (err) {
      console.error("Failed to submit feedback", err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !complaint) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentStep = getLifecycleStepIndex(complaint.status);
  const isResolvedOrClosed = ['RESOLVED', 'VERIFIED', 'CLOSED', 'resolved', 'closed'].includes(complaint.status);
  const isRejected = complaint.status?.toUpperCase() === 'REJECTED';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Operations Dashboard
        </Link>
        <span className="text-xs font-mono text-muted-foreground">Issue ID #{complaint.complaint_id}</span>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4" />
          {errorMsg}
        </div>
      )}

      {/* Visual Lifecycle Stepper */}
      {!isRejected && (
        <Card className="p-4 bg-card/60 backdrop-blur-sm border-border">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Issue Lifecycle Stage
          </div>
          <div className="grid grid-cols-7 gap-1">
            {LIFECYCLE_STEPS.map((step, idx) => {
              const isPassed = idx <= currentStep;
              const isCurrent = idx === currentStep;
              return (
                <div key={step.key} className="flex flex-col items-center text-center">
                  <div
                    className={`h-2 w-full rounded-full transition-colors ${
                      isPassed ? "bg-primary" : "bg-muted"
                    } ${isCurrent ? "ring-2 ring-primary/40" : ""}`}
                  />
                  <span
                    className={`text-[10px] sm:text-xs mt-1.5 truncate max-w-full ${
                      isCurrent
                        ? "font-bold text-primary"
                        : isPassed
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Main Issue Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant={getStatusBadgeVariant(complaint.status)}>
                  {formatStatus(complaint.status)}
                </Badge>
                <Badge variant={getPriorityBadgeVariant(complaint.priority)}>
                  {formatStatus(complaint.priority)} Priority
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {complaint.category || "General"}
                </Badge>
              </div>
              <CardTitle className="text-2xl mt-1">{complaint.title}</CardTitle>
              <CardDescription className="mt-1">
                Reported {complaint.date_filed ? new Date(complaint.date_filed).toLocaleString() : ""} by {complaint.student_name || "Student"}
              </CardDescription>
            </div>

            {/* SLA Badge Pill */}
            <div className={`p-3 rounded-lg border text-right whitespace-nowrap ${
              complaint.is_breached 
                ? "bg-destructive/10 border-destructive/40 text-destructive"
                : "bg-muted/40 border-border"
            }`}>
              <div className="flex items-center gap-1.5 justify-end text-xs font-semibold">
                <Clock className="w-3.5 h-3.5" />
                {complaint.is_breached ? "SLA Breached" : "Resolution SLA"}
              </div>
              <div className="text-xs font-mono mt-0.5 font-medium">
                {complaint.sla_remaining_text || `${complaint.sla_hours || 24}h target`}
              </div>
              {complaint.sla_due_date && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Due: {new Date(complaint.sla_due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <h3 className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</h3>
            <p className="whitespace-pre-wrap text-sm text-foreground bg-muted/20 p-3 rounded-md border border-border">
              {complaint.description}
            </p>
          </div>

          {/* Location Badge Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Location</span>
                <span className="text-sm font-medium">
                  {complaint.building || "Academic Complex"} {complaint.room ? `• Room ${complaint.room}` : ""} {complaint.floor ? `(Floor ${complaint.floor})` : ""}
                </span>
                {complaint.location_description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{complaint.location_description}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <UserCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Assigned Staff</span>
                <span className="text-sm font-medium">
                  {complaint.assigned_staff || "Unassigned"}
                </span>
                {complaint.department && (
                  <p className="text-xs text-muted-foreground mt-0.5">Department: {complaint.department}</p>
                )}
              </div>
            </div>
          </div>

          {complaint.rejection_reason && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <strong>Rejection Reason:</strong> {complaint.rejection_reason}
            </div>
          )}

          {complaint.resolution_notes && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
              <strong>Resolution Notes:</strong> {complaint.resolution_notes}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student Verification / Reopen Action Card */}
      {user?.role === 'student' && complaint.status?.toUpperCase() === 'RESOLVED' && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-bold text-primary">Student Resolution Verification</CardTitle>
            <CardDescription className="text-xs">
              Staff has marked this issue as resolved. Please verify if the issue has indeed been fixed.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 space-y-3">
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={handleVerify} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle className="w-4 h-4 mr-1.5" />
                Confirm & Verify Fixed
              </Button>
            </div>

            <div className="pt-2 border-t border-border/60">
              <Label className="text-xs font-semibold text-destructive block mb-1">Issue Still Not Fixed?</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Reason why this is still unresolved..."
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="destructive" onClick={handleReopen} disabled={actionLoading}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Reopen
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin / Staff Operations Management Card */}
      {(user?.role === 'admin' || user?.role === 'staff') && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Operations Controls</CardTitle>
            <CardDescription className="text-xs">
              Update issue lifecycle, assign maintenance staff, or resolve issues.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Staff Assignment (Admin Only) */}
            {user?.role === 'admin' && (
              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Staff & Department Assignment
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="assignDept" className="text-xs mb-1 block">Department</Label>
                    <select
                      id="assignDept"
                      value={assignDept}
                      onChange={(e) => setAssignDept(e.target.value)}
                      className={themedSelectClass}
                    >
                      <option value="">Select Department</option>
                      {departments.map((d) => (
                        <option key={d.department_id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="assignStaffId" className="text-xs mb-1 block">Assignee Staff</Label>
                    <select
                      id="assignStaffId"
                      value={assignStaffId}
                      onChange={(e) => setAssignStaffId(e.target.value)}
                      className={themedSelectClass}
                    >
                      <option value="">Unassigned</option>
                      {staffList.map((s) => (
                        <option key={s.staff_id} value={s.staff_id}>
                          {s.name} ({s.department || "Staff"})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button size="sm" onClick={handleAssign} disabled={actionLoading}>
                  Save Assignment
                </Button>
              </div>
            )}

            {/* Lifecycle Quick Status Updates */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Update Issue Status
              </Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateStatus('IN_PROGRESS')}
                  disabled={actionLoading || complaint.status === 'IN_PROGRESS'}
                >
                  Start Progress
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateStatus('RESOLVED')}
                  disabled={actionLoading || isResolvedOrClosed}
                  className="text-emerald-600 hover:text-emerald-700"
                >
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                  Mark Resolved
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateStatus('CLOSED')}
                  disabled={actionLoading || complaint.status === 'CLOSED'}
                >
                  Close Issue
                </Button>
              </div>

              {/* Resolution Notes field */}
              <div className="space-y-1">
                <Label htmlFor="resolutionNotes" className="text-xs">Resolution Notes (Optional)</Label>
                <Input
                  id="resolutionNotes"
                  placeholder="Describe how the issue was resolved..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* Rejection Field */}
              <div className="pt-2 border-t border-border flex items-center gap-2">
                <Input
                  placeholder="Reason for rejection (required to reject)..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleUpdateStatus('REJECTED')}
                  disabled={actionLoading || !rejectionReason.trim()}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Reject
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Production Audit & Activity Timeline */}
      {complaint.activity_timeline && complaint.activity_timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              Audit Trail & Activity Timeline
            </CardTitle>
            <CardDescription className="text-xs">
              Chronological log of issue creation, assignments, status updates, and verification events.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {complaint.activity_timeline.map((event) => (
                <div key={event.activity_id} className="relative">
                  <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-background" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      {event.message}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(event.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span className="capitalize font-medium text-foreground/80">{event.actor_name}</span>
                    <span>•</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase">
                      {event.actor_role}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Discussion Thread */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            Activity & Discussion Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {responses.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">No notes or responses recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {responses.map((resp) => (
                <div key={resp.response_id || Math.random()} className="rounded-lg p-3 bg-muted/40 border border-border">
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="text-xs font-semibold text-foreground">
                      {resp.staff_name || (resp.staff_id ? 'Maintenance Staff' : 'Student')}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(resp.date_responded || resp.created_at || "").toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs whitespace-pre-wrap text-foreground">{resp.message}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-2 border-t border-border pt-3">
            <Textarea 
              placeholder="Add response or operational note..."
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              rows={2}
              className="text-xs"
            />
            <Button onClick={handleSendReply} disabled={actionLoading || !replyMessage.trim()} className="self-end h-9">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Section (if resolved) */}
      {isResolvedOrClosed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student Satisfaction & Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            {complaint.feedback ? (
              <div className="rounded-lg bg-muted/40 p-3 border border-border space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">Rating:</span>
                  <span className="text-amber-500 font-bold text-sm">{"★".repeat(complaint.feedback.rating)}</span>
                </div>
                {complaint.feedback.message && (
                  <p className="text-xs text-muted-foreground mt-1">"{complaint.feedback.message}"</p>
                )}
              </div>
            ) : user?.role === 'student' ? (
              <form onSubmit={handleFeedback} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="rating" className="text-xs">Rating (1 to 5 Stars)</Label>
                  <select 
                    id="rating"
                    value={feedbackRating}
                    onChange={(e) => setFeedbackRating(e.target.value)}
                    className={themedSelectClass}
                  >
                    <option value="5">★★★★★ - Excellent</option>
                    <option value="4">★★★★☆ - Good</option>
                    <option value="3">★★★☆☆ - Average</option>
                    <option value="2">★★☆☆☆ - Poor</option>
                    <option value="1">★☆☆☆☆ - Terrible</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="message" className="text-xs">Comments (Optional)</Label>
                  <Textarea
                    id="message"
                    placeholder="Share feedback on resolution quality and timeliness..."
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                </div>
                <Button type="submit" size="sm" disabled={actionLoading}>
                  Submit Feedback
                </Button>
              </form>
            ) : (
              <p className="text-xs italic text-muted-foreground">Feedback has not been submitted by the student yet.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
