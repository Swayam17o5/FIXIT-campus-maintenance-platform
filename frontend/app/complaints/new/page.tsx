"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, ArrowLeft, Building2, MapPin, Clock, Wrench } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface Category {
  category_id: number;
  name: string;
}

interface Department {
  department_id: number;
  name: string;
}

export default function NewComplaintPage() {
  const themedSelectClass = "flex h-9 w-full rounded-md border border-border bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  const { user } = useAuth();
  const router = useRouter();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category_id: "",
    priority: "medium",
    building: "Academic Block A",
    floor: "3",
    room: "304",
    location_description: "",
    department: "Maintenance"
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, deptRes] = await Promise.allSettled([
          api.get("/categories"),
          api.get("/departments")
        ]);

        if (catRes.status === "fulfilled") {
          const cData = catRes.value?.data;
          setCategories(Array.isArray(cData) ? cData : cData?.data || []);
        }

        if (deptRes.status === "fulfilled") {
          const dData = deptRes.value?.data;
          setDepartments(Array.isArray(dData) ? dData : dData?.data || []);
        }
      } catch (err) {
        console.error("Failed to load metadata:", err);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setError("");
    setLoading(true);

    try {
      await api.post("/complaints", {
        ...formData,
        student_id: user.id,
        staff_id: null,
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      const responseMessage =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(responseMessage || "Failed to submit issue report.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard" className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Wrench className="w-4 h-4" />
            </div>
            <CardTitle className="text-2xl">Report Maintenance Issue</CardTitle>
          </div>
          <CardDescription>
            Submit an infrastructure or facility issue. Target SLA resolution is assigned based on priority.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-error-border bg-error-bg p-3 text-sm text-error-foreground">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="title">Issue Title</Label>
              <Input 
                id="title" 
                placeholder="e.g. AC cooling failure in Lecture Hall 201" 
                value={formData.title} 
                onChange={handleChange} 
                required 
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="category_id">Category</Label>
                <select
                  id="category_id"
                  value={formData.category_id}
                  onChange={handleChange}
                  className={themedSelectClass}
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="priority">Urgency & SLA</Label>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Dynamic SLA
                  </span>
                </div>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className={themedSelectClass}
                >
                  <option value="critical">Critical — 2 Hours SLA</option>
                  <option value="high">High — 6 Hours SLA</option>
                  <option value="medium">Medium — 24 Hours SLA</option>
                  <option value="low">Low — 72 Hours SLA</option>
                </select>
              </div>
            </div>

            {/* Location Section */}
            <div className="rounded-lg border border-border p-3.5 bg-muted/20 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                Campus Location Details
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="building" className="text-xs">Building / Block</Label>
                  <Input
                    id="building"
                    placeholder="e.g. Academic Block A"
                    value={formData.building}
                    onChange={handleChange}
                    className="h-8 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="floor" className="text-xs">Floor</Label>
                  <Input
                    id="floor"
                    placeholder="e.g. 2nd Floor"
                    value={formData.floor}
                    onChange={handleChange}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="room" className="text-xs">Room / Lab No.</Label>
                  <Input
                    id="room"
                    placeholder="e.g. Room 204"
                    value={formData.room}
                    onChange={handleChange}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="location_description" className="text-xs">Specific Landmark / Location Details</Label>
                <Input
                  id="location_description"
                  placeholder="e.g. Near west staircase, next to water cooler"
                  value={formData.location_description}
                  onChange={handleChange}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Detailed Description</Label>
              <Textarea 
                id="description" 
                placeholder="Describe the issue, symptoms, and impact on operations..." 
                rows={4}
                value={formData.description}
                onChange={handleChange}
                required 
              />
            </div>

            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? "Submitting Report..." : "Submit Maintenance Issue"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
