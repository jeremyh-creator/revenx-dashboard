"use client";

import {
  createEnterprise,
  addEnterpriseAgent,
  removeEnterpriseAgent,
  createEnterpriseUser,
  deleteEnterpriseUser,
} from "./actions";
import { useState } from "react";

type Agent = {
  id: string;
  name: string;
  is_active?: boolean;
};

type EnterpriseUser = {
  id: string;
  email: string;
};

type Enterprise = {
  id: string;
  name: string;
  agents: { agent_id: string }[];
  users: EnterpriseUser[];
};

type Props = {
  enterprises: Enterprise[];
  agents: Agent[];
};

export function AdminEnterprisesSection({ enterprises, agents }: Props) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addAgentId, setAddAgentId] = useState<Record<string, string>>({});
  const [addUserEmail, setAddUserEmail] = useState<Record<string, string>>({});
  const [addUserPassword, setAddUserPassword] = useState<Record<string, string>>({});
  const [isCreatingUser, setIsCreatingUser] = useState<string | null>(null);
  const [isAddingAgent, setIsAddingAgent] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    const result = await createEnterprise(name.trim());
    setIsSubmitting(false);
    if (result.error) {
      alert(result.error);
    } else {
      setName("");
    }
  };

  const handleAddAgent = async (enterpriseId: string) => {
    const agentId = addAgentId[enterpriseId];
    if (!agentId) return;
    setIsAddingAgent(enterpriseId);
    const result = await addEnterpriseAgent(enterpriseId, agentId);
    setIsAddingAgent(null);
    if (result.error) alert(result.error);
    else setAddAgentId((p) => ({ ...p, [enterpriseId]: "" }));
  };

  const handleRemoveAgent = async (enterpriseId: string, agentId: string) => {
    const result = await removeEnterpriseAgent(enterpriseId, agentId);
    if (result.error) alert(result.error);
  };

  const handleDeleteUser = async (enterpriseUserId: string) => {
    if (!confirm("Delete this enterprise login? The user will no longer be able to sign in.")) return;
    setDeletingUserId(enterpriseUserId);
    const result = await deleteEnterpriseUser(enterpriseUserId);
    setDeletingUserId(null);
    if (result.error) alert(result.error);
  };

  const handleCreateUser = async (enterpriseId: string) => {
    const email = addUserEmail[enterpriseId]?.trim().toLowerCase();
    const password = addUserPassword[enterpriseId];
    if (!email || !password) {
      alert("Email and password are required");
      return;
    }
    if (password.length < 8) {
      alert("Password must be at least 8 characters");
      return;
    }
    setIsCreatingUser(enterpriseId);
    const result = await createEnterpriseUser(enterpriseId, email, password);
    setIsCreatingUser(null);
    if (result.error) {
      alert(result.error);
    } else {
      setAddUserEmail((p) => ({ ...p, [enterpriseId]: "" }));
      setAddUserPassword((p) => ({ ...p, [enterpriseId]: "" }));
    }
  };

  const assignedAgentIds = new Map<string, Set<string>>();
  enterprises.forEach((e) => {
    assignedAgentIds.set(e.id, new Set(e.agents.map((a) => a.agent_id)));
  });
  const activeAgents = agents.filter((a) => a.is_active !== false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900">Enterprises / IMOs</h3>
        <p className="text-sm text-slate-500">
          Create enterprises, assign agents, and create logins for enterprise users
        </p>
      </div>
      <div className="p-6 space-y-6">
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              New enterprise
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enterprise name"
              className="rounded border border-slate-300 px-3 py-2 text-sm w-64"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isSubmitting ? "Creating…" : "Create enterprise"}
          </button>
        </form>

        <div className="space-y-4">
          {enterprises.length === 0 ? (
            <p className="text-slate-500 text-sm">No enterprises yet. Create one above.</p>
          ) : (
            enterprises.map((ent) => {
              const isExpanded = expandedId === ent.id;
              const assigned = assignedAgentIds.get(ent.id) ?? new Set<string>();
              const availableAgents = activeAgents.filter((a) => !assigned.has(a.id));

              return (
                <div
                  key={ent.id}
                  className="border border-slate-200 rounded-lg overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : ent.id)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 text-left"
                  >
                    <span className="font-medium text-slate-900">{ent.name}</span>
                    <span className="text-slate-500 text-sm">
                      {ent.agents.length} agents · {ent.users.length} user{ent.users.length !== 1 ? "s" : ""}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="p-4 border-t border-slate-200 space-y-6 bg-white">
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2">
                          Assigned agents
                        </h4>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {ent.agents.map((ea) => {
                            const agent = agents.find((a) => a.id === ea.agent_id);
                            return (
                              <span
                                key={ea.agent_id}
                                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-sm"
                              >
                                {agent?.name ?? ea.agent_id}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAgent(ent.id, ea.agent_id)}
                                  className="text-slate-500 hover:text-red-600"
                                  title="Remove"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                        {availableAgents.length > 0 && (
                          <div className="flex items-center gap-2">
                            <select
                              value={addAgentId[ent.id] ?? ""}
                              onChange={(e) =>
                                setAddAgentId((p) => ({ ...p, [ent.id]: e.target.value }))
                              }
                              className="rounded border border-slate-300 px-2 py-1.5 text-sm w-48"
                            >
                              <option value="">Add agent…</option>
                              {availableAgents.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleAddAgent(ent.id)}
                              disabled={!addAgentId[ent.id] || isAddingAgent === ent.id}
                              className="rounded bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-600 disabled:opacity-50"
                            >
                              Add
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2">
                          Enterprise logins
                        </h4>
                        <ul className="text-sm text-slate-600 space-y-1 mb-4">
                          {ent.users.map((u) => (
                            <li key={u.id} className="flex items-center gap-2">
                              {u.email}
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={deletingUserId === u.id}
                                className="text-xs text-red-600 hover:text-red-800 underline disabled:opacity-50"
                              >
                                {deletingUserId === u.id ? "Deleting…" : "Delete"}
                              </button>
                            </li>
                          ))}
                          {ent.users.length === 0 && (
                            <li className="text-slate-500">No users yet</li>
                          )}
                        </ul>
                        <div className="flex flex-wrap items-end gap-2">
                          <div>
                            <label className="block text-xs text-slate-500 mb-0.5">
                              Email
                            </label>
                            <input
                              type="email"
                              value={addUserEmail[ent.id] ?? ""}
                              onChange={(e) =>
                                setAddUserEmail((p) => ({ ...p, [ent.id]: e.target.value }))
                              }
                              placeholder="user@example.com"
                              className="rounded border border-slate-300 px-2 py-1.5 text-sm w-48"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-0.5">
                              Password (min 8 chars)
                            </label>
                            <input
                              type="password"
                              value={addUserPassword[ent.id] ?? ""}
                              onChange={(e) =>
                                setAddUserPassword((p) => ({
                                  ...p,
                                  [ent.id]: e.target.value,
                                }))
                              }
                              placeholder="••••••••"
                              className="rounded border border-slate-300 px-2 py-1.5 text-sm w-40"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCreateUser(ent.id)}
                            disabled={isCreatingUser === ent.id}
                            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            {isCreatingUser === ent.id ? "Creating…" : "Create login"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
