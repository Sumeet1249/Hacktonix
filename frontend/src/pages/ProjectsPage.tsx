import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Eye, FolderOpen, Zap } from "lucide-react";
import { useProjects } from "../hooks/useProject";
import { createProject, deleteProject } from "../api/client";
import { StatusBadge, Card, Button, EmptyState, ProgressBar } from "../components/ui";

export default function ProjectsPage() {
  const { projects, loading, refetch } = useProjects();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const project = await createProject(name.trim(), description.trim() || undefined);
      setShowForm(false);
      setName("");
      setDescription("");
      navigate(`/projects/${project.id}`);
    } catch (e) {
      alert("Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Delete this project and all its data?")) return;
    await deleteProject(id);
    refetch();
  };

  return (
    <div className="min-h-screen bg-[#0a0c0f] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.07] bg-[#111318]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Zap size={14} className="text-emerald-400" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">BlindSpot<span className="text-emerald-400">.AI</span></span>
          </div>
          <Button onClick={() => setShowForm(true)} variant="primary" size="sm">
            <Plus size={14} /> New Project
          </Button>
        </div>
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#13161c] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="font-display font-bold text-xl mb-1">New Project</h2>
            <p className="text-sm text-gray-500 mb-5">Create a synthetic data generation project</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1.5">Project Name *</label>
                <input
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
                  placeholder="e.g. Autonomous Drone Perception"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-gray-400 mb-1.5">Description (optional)</label>
                <textarea
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none"
                  placeholder="Describe the target object or use case..."
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handleCreate} disabled={!name.trim()} loading={creating} className="flex-1">
                  Create Project
                </Button>
                <Button onClick={() => setShowForm(false)} variant="secondary">Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p className="text-xs font-mono text-emerald-400 uppercase tracking-[0.15em] mb-1">Workspace</p>
          <h1 className="font-display font-bold text-3xl">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
        </div>

        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white/[0.03] rounded-xl border border-white/[0.05] animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={48} />}
            title="No projects yet"
            description="Create your first BlindSpot.AI project to start generating synthetic training data."
            action={<Button onClick={() => setShowForm(true)} variant="primary"><Plus size={14} /> Create First Project</Button>}
          />
        ) : (
          <div className="grid gap-3">
            {projects.map((project) => (
              <Card
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="group"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-display font-semibold text-base truncate group-hover:text-emerald-300 transition-colors">
                        {project.name}
                      </h3>
                      <StatusBadge status={project.status} />
                    </div>
                    {project.description && (
                      <p className="text-xs text-gray-500 truncate mb-2">{project.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs font-mono text-gray-600">
                      <span>{project.seed_images.length} seed images</span>
                      <span>{project.image_count} generated</span>
                      <span>{project.label_count} labels</span>
                      {project.vulnerability_vector && (
                        <span className="text-amber-600">
                          {Object.keys(project.vulnerability_vector).length} blind spots
                        </span>
                      )}
                    </div>
                    {["training_lora", "generating", "labeling", "scanning"].includes(project.status) && (
                      <div className="mt-2">
                        <ProgressBar progress={project.progress} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      onClick={(e) => { e?.stopPropagation(); navigate(`/projects/${project.id}`); }}
                      variant="ghost" size="sm"
                    >
                      <Eye size={14} />
                    </Button>
                    <Button
                      onClick={(e) => handleDelete(e as any, project.id)}
                      variant="danger" size="sm"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
