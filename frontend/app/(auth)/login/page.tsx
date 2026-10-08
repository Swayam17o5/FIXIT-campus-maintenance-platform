"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function LoginPage() {
  const roleToggleBaseClass = "flex-1 rounded-sm py-1.5 text-sm font-medium transition-colors";
  const roleToggleActiveClass = "bg-card text-foreground shadow-sm";
  const roleToggleInactiveClass = "text-muted-foreground hover:text-foreground";

  const [roleMode, setRoleMode] = useState<"student" | "staff">("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (roleMode === "student") {
        const { data } = await api.post("/students/login", { email, password });
        
        const userData = data.student || data.user;
        const normalizedUser = {
          id: userData.student_id || userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role || 'student'
        };

        login(data.token, normalizedUser);
        router.push("/dashboard");
      } else {
        const { data } = await api.post("/staff/login", { email, password });

        const userData = data.staff || data.user;
        const normalizedUser = {
          id: userData.staff_id || userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role || 'staff'
        };

        login(data.token, normalizedUser);
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      const responseMessage =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      const fallbackMessage = err instanceof Error ? err.message : "Invalid credentials or server error";
      setError(responseMessage || fallbackMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl text-center">Welcome Back</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex rounded-md bg-muted p-1">
            <button
              onClick={() => { setRoleMode("student"); setError(""); }}
              className={`${roleToggleBaseClass} ${roleMode === "student" ? roleToggleActiveClass : roleToggleInactiveClass}`}
            >
              Student
            </button>
            <button
              onClick={() => { setRoleMode("staff"); setError(""); }}
              className={`${roleToggleBaseClass} ${roleMode === "staff" ? roleToggleActiveClass : roleToggleInactiveClass}`}
            >
              Staff / Admin
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-error-border bg-error-bg p-3 text-sm text-error-foreground">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder={roleMode === "student" ? "student@student.edu" : "staff@college.edu"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input 
                id="password" 
                type="password" 
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-foreground hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

