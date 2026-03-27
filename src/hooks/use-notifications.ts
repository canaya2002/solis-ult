"use client";
import { useState, useEffect, useCallback } from "react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string;
  actionLabel: string;
  priority: string;
  data: unknown;
  status: string;
  createdAt: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async (status?: string, type?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (type) params.set("type", type);
      params.set("limit", "20");

      const res = await fetch(`/api/notifications?${params}`);
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data.notifications);
        setPendingCount(json.data.pendingCount);
      }
    } catch {
      // Silently fail — will retry on next poll
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?countOnly=true");
      const json = await res.json();
      if (json.success) {
        setPendingCount(json.data.count);
      }
    } catch {
      // Silently fail
    }
  }, []);

  const markSeen = useCallback(async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id, action: "seen" }),
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: "SEEN" } : n));
      setPendingCount(prev => Math.max(0, prev - 1));
    } catch { /* non-critical */ }
  }, []);

  const markActed = useCallback(async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id, action: "acted" }),
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: "ACTED" } : n));
      setPendingCount(prev => Math.max(0, prev - 1));
    } catch { /* non-critical */ }
  }, []);

  const dismissNotification = useCallback(async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id, action: "dismissed" }),
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
      setPendingCount(prev => Math.max(0, prev - 1));
    } catch { /* non-critical */ }
  }, []);

  // Initial load + poll every 30s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications, fetchCount]);

  return {
    notifications,
    pendingCount,
    loading,
    fetchNotifications,
    markSeen,
    markActed,
    dismiss: dismissNotification,
  };
}
