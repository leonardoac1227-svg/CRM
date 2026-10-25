"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";
import type { Me, Pipeline, TeamUser } from "@/lib/types";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/api/auth/me"), staleTime: 60_000 });
}

export function useTeam() {
  return useQuery({ queryKey: ["users"], queryFn: () => api<TeamUser[]>("/api/users"), staleTime: 60_000 });
}

export function usePipelines() {
  return useQuery({ queryKey: ["pipelines"], queryFn: () => api<Pipeline[]>("/api/pipelines"), staleTime: 30_000 });
}

export function useCan() {
  const { data } = useMe();
  return {
    me: data,
    can: (m: string) => !!data?.modules.includes(m),
    isManager: !!data && ["MANAGER", "AGENCY_ADMIN", "SUPER_ADMIN"].includes(data.user.role),
    isBroker: data?.user.role === "BROKER",
  };
}
