"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button } from "./ui/button";
import { LogOut, Wrench, Shield, Briefcase, GraduationCap } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Badge } from "./ui/badge";

export function Navbar() {
  const { user, logout, loading } = useAuth();

  const getRoleIcon = (role?: string) => {
    switch (role?.toLowerCase()) {
      case "admin":
        return <Shield className="w-3.5 h-3.5 mr-1 text-primary" />;
      case "staff":
        return <Briefcase className="w-3.5 h-3.5 mr-1 text-warning" />;
      default:
        return <GraduationCap className="w-3.5 h-3.5 mr-1 text-muted-foreground" />;
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-foreground group">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 group-hover:scale-105 transition-transform">
              <Wrench className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="leading-none text-base">FIXIT</span>
              <span className="text-[10px] text-muted-foreground tracking-normal font-normal hidden sm:inline">
                Campus Maintenance
              </span>
            </div>
          </Link>
          {user && !loading && (
            <div className="hidden md:flex items-center gap-4 text-sm font-medium text-muted-foreground">
              <Link href="/dashboard" className="transition-colors hover:text-foreground">
                Operations
              </Link>
              {user.role === 'admin' || user.role === 'staff' ? (
                <Link href="/reports" className="transition-colors hover:text-foreground">
                  Analytics & SLA
                </Link>
              ) : null}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {user && !loading ? (
            <>
              <div className="hidden sm:flex items-center gap-2 border-r border-border pr-3">
                <span className="text-sm font-medium text-foreground">{user.name}</span>
                <Badge variant="outline" className="capitalize text-xs font-normal flex items-center">
                  {getRoleIcon(user.role)}
                  {user.role}
                </Badge>
              </div>
              <Button
                id="logout-button"
                type="button"
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-muted-foreground hover:text-destructive cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">Login</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
