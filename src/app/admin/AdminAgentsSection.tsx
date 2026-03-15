"use client";

import { addAgent, mergeAgents, setAgentActive, updateAgent } from "./actions";
import { useState } from "react";

type Agent = {
  id: string;
  name: string;
  emails: string[] | null;
  is_active?: boolean;
};

type Props = {
  agents: Agent[];
};

export function AdminAgentsSection({ agents }: Props) {
  const [name, setName] = useState("");
  const [emailsInput, setEmailsInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [mergePrimary, setMergePrimary] = useState("");
  const [mergeSecondary, setMergeSecondary] = useState("");
  const [isMerging, setIsMerging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmailsInput, setEditEmailsInput] = useState("");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    const emails = emailsInput
      .split(/[,\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const result = await addAgent(name.trim(), emails);
    setIsSubmitting(false);
    if (result.error) {
      alert(result.error);
    } else {
      setName("");
      setEmailsInput("");
    }
  };

  const startEdit = (agent: Agent) => {
    setEditingId(agent.id);
    setEditName(agent.name);
    setEditEmailsInput(
      Array.isArray(agent.emails) && agent.emails.length > 0
        ? agent.emails.join(", ")
        : ""
    );
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditEmailsInput("");
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!editName.trim()) {
      alert("Name is required");
      return;
    }
    const emails = editEmailsInput
      .split(/[,\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (emails.length === 0) {
      alert("At least one email is required");
      return;
    }
    const result = await updateAgent(editingId, {
      name: editName.trim(),
      emails,
    });
    if (result.error) {
      alert(result.error);
    } else {
      cancelEdit();
    }
  };

  const handleToggle = async (agentId: string, isActive: boolean) => {
    setTogglingId(agentId);
    const result = await setAgentActive(agentId, isActive);
    setTogglingId(null);
    if (result.error) alert(result.error);
  };

  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergePrimary || !mergeSecondary) {
      alert("Select both agents to merge");
      return;
    }
    if (mergePrimary === mergeSecondary) {
      alert("Select two different agents");
      return;
    }
    setIsMerging(true);
    const result = await mergeAgents(mergePrimary, mergeSecondary);
    setIsMerging(false);
    if (result.error) {
      alert(result.error);
    } else {
      setMergePrimary("");
      setMergeSecondary("");
    }
  };

  const activeAgents = agents.filter((a) => a.is_active !== false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900">Agents</h3>
        <p className="text-sm text-slate-500">Add agents and manage active status</p>
      </div>
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap gap-6">
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Agent name"
              className="rounded border border-slate-300 px-3 py-2 text-sm w-48"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Emails (comma-separated)
            </label>
            <input
              type="text"
              value={emailsInput}
              onChange={(e) => setEmailsInput(e.target.value)}
              placeholder="agent@example.com, backup@example.com"
              className="rounded border border-slate-300 px-3 py-2 text-sm w-72"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isSubmitting ? "Adding…" : "Add agent"}
          </button>
        </form>

        <form onSubmit={handleMerge} className="flex flex-wrap items-end gap-4 border-l border-slate-200 pl-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Merge agents
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Keep the first, merge the second into it
            </p>
          </div>
          <select
            value={mergePrimary}
            onChange={(e) => setMergePrimary(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2 text-sm w-48"
            required
          >
            <option value="">Keep this agent</option>
            {activeAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <span className="text-slate-500 text-sm">← merge from</span>
          <select
            value={mergeSecondary}
            onChange={(e) => setMergeSecondary(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2 text-sm w-48"
            required
          >
            <option value="">This agent</option>
            {activeAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isMerging}
            className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isMerging ? "Merging…" : "Merge"}
          </button>
        </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="pb-2 font-medium text-slate-700">Name</th>
                <th className="pb-2 font-medium text-slate-700">Emails</th>
                <th className="pb-2 font-medium text-slate-700">Status</th>
                <th className="pb-2 font-medium text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => {
                const isActive = agent.is_active !== false;
                const isToggling = togglingId === agent.id;
                const isEditing = editingId === agent.id;
                const emailsDisplay =
                  Array.isArray(agent.emails) && agent.emails.length > 0
                    ? agent.emails.join(", ")
                    : "—";

                return (
                  <tr
                    key={agent.id}
                    className={`border-b border-slate-100 ${
                      !isActive ? "bg-slate-50 text-slate-500" : ""
                    } ${isEditing ? "bg-blue-50/50" : ""}`}
                  >
                    <td className="py-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="rounded border border-slate-300 px-2 py-1 text-sm w-40 font-medium"
                          placeholder="Agent name"
                        />
                      ) : (
                        <span className="font-medium">{agent.name}</span>
                      )}
                    </td>
                    <td className="py-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editEmailsInput}
                          onChange={(e) => setEditEmailsInput(e.target.value)}
                          className="rounded border border-slate-300 px-2 py-1 text-sm w-64"
                          placeholder="email@example.com, other@example.com"
                        />
                      ) : (
                        <span className="text-slate-600">{emailsDisplay}</span>
                      )}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 flex flex-wrap gap-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="text-sm text-green-700 hover:text-green-900 font-medium"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="text-sm text-slate-500 hover:text-slate-700"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(agent)}
                            className="text-sm text-slate-600 hover:text-slate-900 underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggle(agent.id, !isActive)}
                            disabled={isToggling}
                            className="text-sm text-slate-600 hover:text-slate-900 underline disabled:opacity-50"
                          >
                            {isToggling
                              ? "…"
                              : isActive
                                ? "Set inactive"
                                : "Set active"}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
