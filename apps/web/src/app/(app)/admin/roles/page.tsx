"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { TopBar } from "@/components/topbar";
import type { PermissionAction, RoleName } from "@keyvantic/types";

interface RoleRow {
  id: string;
  name: RoleName;
  permissions: { action: PermissionAction }[];
  _count: { users: number };
}

export default function RolesAdminPage() {
  const queryClient = useQueryClient();
  const { data: roles, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api.get<RoleRow[]>("/roles"),
  });
  const { data: actions } = useQuery({
    queryKey: ["roles", "permission-actions"],
    queryFn: () => api.get<PermissionAction[]>("/roles/permission-actions"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ role, nextActions }: { role: RoleName; nextActions: PermissionAction[] }) =>
      api.put(`/roles/${role}/permissions`, { actions: nextActions }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });

  function toggle(role: RoleRow, action: PermissionAction) {
    const current = role.permissions.map((p) => p.action);
    const next = current.includes(action) ? current.filter((a) => a !== action) : [...current, action];
    updateMutation.mutate({ role: role.name, nextActions: next });
  }

  return (
    <>
      <TopBar title="Roles & Permissions" />
      <div className="flex-1 overflow-y-auto p-6">
        <p className="mb-4 text-sm text-kv-slate">
          Configure exactly what each role can do across the Master Library. Changes apply immediately to all users
          holding that role.
        </p>
        {isLoading || !roles || !actions ? (
          <p className="text-sm text-kv-slate">Loading roles…</p>
        ) : (
          <div className="kv-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-kv-border">
                  <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-kv-slate">Permission</th>
                  {roles.map((role) => (
                    <th key={role.id} className="p-3 text-center text-xs font-semibold uppercase tracking-wide text-kv-slate">
                      {role.name}
                      <span className="block font-normal text-[10px] text-kv-slate">{role._count.users} users</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {actions.map((action) => (
                  <tr key={action} className="border-b border-kv-border">
                    <td className="p-3 font-mono text-xs text-kv-slate">{action}</td>
                    {roles.map((role) => {
                      const checked = role.permissions.some((p) => p.action === action);
                      return (
                        <td key={role.id} className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={role.name === "ADMINISTRATOR"}
                            onChange={() => toggle(role, action)}
                            className="h-4 w-4 accent-kv-gold"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
