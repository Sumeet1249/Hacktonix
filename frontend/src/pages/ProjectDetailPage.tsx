import React, { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { ArrowLeft, Upload, Scan, Play, Download, Zap, Image, AlertTriangle, Database, Settings } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import { useProject } from "../hooks/useProject";
import {
  uploadSeedImages, setModelEndpoint, runAdversarialScan, triggerGeneration,
  trainLora, getDataset,
} from "../api/client";
import {
  StatusBadge, Card, Button, SectionLabel, ProgressBar, ConfidenceBar, StatCard, EmptyState,
} from "../components/ui";

type Tab = "seeds" | "vulnerability" | "generate" | "dataset";

const STRESSOR_LABELS: Record<string, string> = {
  occlusion_20: "20% Occlusion",
  occlusion_50: "50% Occlusion",
  occlusion_80: "80% Occlusion",
  rain_heavy: "Heavy Rain",
  fog_dense: "Dense Fog",
  night_low: "Night / Low Contrast",
  lens_flare: "Lens Flare",
  motion_blur: "Motion Blur",
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { project, status, loading, error, refetch } = useProject(id!, 3000);
  const [tab, setTab] = useState<Tab>("seeds");
  const [actionLoading, setActionLoading] = useState(false);
  const [modelUrl, setModelUrl] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [datasetInfo, setDatasetInfo] = useState<any>(null);

  const isActive = ["training_lora", "scanning", "generating", "labeling"].includes(project?.status || "");

  const handleUploadSeeds = async () => {
    if (!uploadedFiles.length || !id) return;
    setActionLoading(true);
    try {
      await uploadSeedImages(id, uploadedFiles);
      setUploadedFiles([]);
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Upload failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleScanVulnerabilities = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      if (modelUrl) await setModelEndpoint(id, modelUrl);
      await runAdversarialScan(id);
      await refetch();
      setTab("vulnerability");
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Scan failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await triggerGeneration(id);
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Generation failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadDataset = async () => {
    if (!id) return;
    try {
      const data = await getDataset(id);
      setDatasetInfo(data);
      window.open(data.download_url, "_blank");
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Dataset not ready");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 10,
    onDrop: (files) => setUploadedFiles((prev) => [...prev, ...files].slice(0, 10)),
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0c0f] flex items-center justify-center">
        <div className="text-gray-500 font-mono text-sm">Loading project...</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#0a0c0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || "Project not found"}</p>
          <Button onClick={() => navigate("/")} variant="secondary"><ArrowLeft size={14} /> Back</Button>
        </div>
      </div>
    );
  }

  const vulnData = project.vulnerability_vector
    ? Object.entries(project.vulnerability_vector).map(([key, val]) => ({
        name: STRESSOR_LABELS[key] || key,
        confidence: Math.round(val * 100),
        key,
      }))
    : [];

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "seeds", label: "Seed Images", icon: <Image size={14} /> },
    { key: "vulnerability", label: "Vulnerability Map", icon: <AlertTriangle size={14} /> },
    { key: "generate", label: "Generation", icon: <Play size={14} /> },
    { key: "dataset", label: "Dataset", icon: <Database size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-[#0a0c0f] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.07] bg-[#111318]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={() => navigate("/")} className="text-gray-500 hover:text-white transition-colors flex-shrink-0">
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-7 h-7 rounded bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <Zap size={14} className="text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display font-bold text-lg truncate">{project.name}</h1>
                {project.description && <p className="text-xs text-gray-500 truncate">{project.description}</p>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <StatusBadge status={project.status} />
          </div>
        </div>

        {/* Progress bar for active states */}
        {isActive && (
          <div className="max-w-5xl mx-auto px-6 pb-3">
            <ProgressBar
              progress={project.progress || 0}
              label={project.current_stage || status?.current_stage || "Processing..."}
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.07] bg-[#111318]/50">
        <div className="max-w-5xl mx-auto px-6 flex gap-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3.5 text-xs font-mono border-b-2 transition-all whitespace-nowrap ${
                tab === t.key
                  ? "border-emerald-400 text-emerald-300"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── SEED IMAGES TAB ── */}
        {tab === "seeds" && (
          <div>
            <div className="flex items-end justify-between mb-6">
              <div>
                <SectionLabel>Step 1 · Seed & Learn</SectionLabel>
                <h2 className="font-display font-bold text-2xl">Seed Images</h2>
                <p className="text-sm text-gray-500 mt-1">Upload 5–10 images of your target object. The LoRA adapter will learn its visual identity.</p>
              </div>
              {project.seed_images.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    onClick={handleScanVulnerabilities}
                    variant="primary"
                    loading={actionLoading}
                    disabled={isActive}
                  >
                    <Scan size={14} /> Run Adversarial Scan
                  </Button>
                </div>
              )}
            </div>

            {/* Model URL input */}
            <Card className="mb-5">
              <p className="text-xs font-mono text-gray-400 mb-2 flex items-center gap-1.5">
                <Settings size={12} /> Target AI Model Endpoint (optional)
              </p>
              <div className="flex gap-3">
                <input
                  className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 font-mono"
                  placeholder="https://your-model-endpoint.com/predict"
                  value={modelUrl || project.model_endpoint || ""}
                  onChange={(e) => setModelUrl(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1.5">If provided, the adversarial agent will probe this endpoint. Leave blank for simulated scan.</p>
            </Card>

            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer mb-5 ${
                isDragActive
                  ? "border-emerald-400/60 bg-emerald-500/5"
                  : "border-white/10 hover:border-white/20 bg-white/[0.01]"
              }`}
            >
              <input {...getInputProps()} />
              <Upload size={32} className="mx-auto mb-3 text-gray-600" />
              <p className="text-sm text-gray-400 mb-1">
                {isDragActive ? "Drop images here..." : "Drag & drop images here, or click to browse"}
              </p>
              <p className="text-xs font-mono text-gray-600">JPG, PNG, WEBP · Max 10 images · 5–10 recommended</p>
            </div>

            {/* Preview of to-be-uploaded files */}
            {uploadedFiles.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-mono text-gray-400">{uploadedFiles.length} files ready to upload</p>
                  <Button onClick={handleUploadSeeds} loading={actionLoading} variant="primary" size="sm">
                    <Upload size={12} /> Upload {uploadedFiles.length} Image{uploadedFiles.length > 1 ? "s" : ""}
                  </Button>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {uploadedFiles.map((f, i) => (
                    <div key={i} className="aspect-square rounded-lg bg-white/[0.04] border border-white/10 overflow-hidden">
                      <img
                        src={URL.createObjectURL(f)}
                        alt={f.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Already uploaded seeds */}
            {project.seed_images.length > 0 && (
              <div>
                <p className="text-xs font-mono text-gray-500 mb-3 uppercase tracking-wider">
                  {project.seed_images.length} uploaded seed image{project.seed_images.length > 1 ? "s" : ""}
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {project.seed_images.map((si) => (
                    <div key={si.id} className="aspect-square rounded-lg bg-white/[0.04] border border-white/10 overflow-hidden group relative">
                      <img src={si.url} alt={si.filename} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                        <p className="text-[9px] text-white font-mono truncate">{si.filename}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {project.seed_images.length === 0 && uploadedFiles.length === 0 && (
              <EmptyState
                icon={<Image size={36} />}
                title="No seed images yet"
                description="Upload 5–10 images of your target object to get started."
              />
            )}
          </div>
        )}

        {/* ── VULNERABILITY MAP TAB ── */}
        {tab === "vulnerability" && (
          <div>
            <div className="flex items-end justify-between mb-6">
              <div>
                <SectionLabel>Step 2 · Adversarial Scan</SectionLabel>
                <h2 className="font-display font-bold text-2xl">Vulnerability Map</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Model confidence by environmental stressor. Red zones = blind spots that need synthetic data.
                </p>
              </div>
              <Button
                onClick={handleScanVulnerabilities}
                variant="primary"
                loading={actionLoading || project.status === "scanning"}
                disabled={isActive}
              >
                <Scan size={14} /> Re-Run Scan
              </Button>
            </div>

            {vulnData.length === 0 ? (
              <EmptyState
                icon={<Scan size={36} />}
                title="No scan data yet"
                description="Run the adversarial vulnerability scan to identify your model's blind spots."
                action={
                  <Button onClick={handleScanVulnerabilities} loading={actionLoading} variant="primary">
                    <Scan size={14} /> Run Adversarial Scan
                  </Button>
                }
              />
            ) : (
              <>
                {/* Bar Chart */}
                <Card className="mb-5">
                  <p className="text-xs font-mono text-gray-500 mb-4 uppercase tracking-wider">Confidence by Stressor</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={vulnData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: "#6b7280", fontFamily: "monospace" }}
                        angle={-20}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: "#6b7280", fontFamily: "monospace" }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{ background: "#13161c", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                        labelStyle={{ color: "#e5e7eb", fontSize: 12, fontFamily: "monospace" }}
                        formatter={(val: number) => [`${val}%`, "Confidence"]}
                      />
                      <Bar dataKey="confidence" radius={[4, 4, 0, 0]}>
                        {vulnData.map((entry) => (
                          <Cell
                            key={entry.key}
                            fill={entry.confidence < 40 ? "#f87171" : entry.confidence < 60 ? "#fbbf24" : "#34d399"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Individual stressor bars */}
                <Card className="mb-5">
                  <p className="text-xs font-mono text-gray-500 mb-4 uppercase tracking-wider">Detailed Breakdown</p>
                  {vulnData.map((d) => (
                    <ConfidenceBar key={d.key} label={d.name} value={d.confidence / 100} />
                  ))}
                </Card>

                {/* Legend */}
                <div className="flex gap-4 text-xs font-mono text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" /> &lt;40% — Critical blind spot</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> 40–60% — Vulnerable</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> &gt;60% — Robust</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── GENERATION TAB ── */}
        {tab === "generate" && (
          <div>
            <div className="flex items-end justify-between mb-6">
              <div>
                <SectionLabel>Step 3 · Generate & Refine</SectionLabel>
                <h2 className="font-display font-bold text-2xl">Generation Pipeline</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Runs the full 4-stage pipeline: Generation → Physics Refinement → Auto-Labeling → Package.
                </p>
              </div>
              <Button
                onClick={handleGenerate}
                variant="primary"
                loading={actionLoading || isActive}
                disabled={isActive}
              >
                <Play size={14} />
                {isActive ? "Running..." : "Start Generation"}
              </Button>
            </div>

            {/* Pipeline stages */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: "01 · Image Generation", desc: "SDXL + LoRA + ControlNet generates base images targeting each blind spot", icon: "🎨" },
                { label: "02 · Physics Refinement", desc: "Blender/PIL applies physically-accurate rain, fog, night, lens flare", icon: "⚛️" },
                { label: "03 · Auto-Labeling", desc: "Mask R-CNN generates COCO bounding boxes and segmentation masks", icon: "🏷️" },
                { label: "04 · Package & Upload", desc: "Dataset ZIPped with COCO JSON + YOLO labels and uploaded to storage", icon: "📦" },
              ].map((stage) => (
                <Card key={stage.label}>
                  <div className="text-xl mb-2">{stage.icon}</div>
                  <p className="text-xs font-mono text-emerald-400 mb-1">{stage.label}</p>
                  <p className="text-xs text-gray-500">{stage.desc}</p>
                </Card>
              ))}
            </div>

            {/* Live progress */}
            {(isActive || project.progress > 0) && (
              <Card className="mb-4">
                <p className="text-xs font-mono text-gray-400 mb-3">Pipeline Progress</p>
                <ProgressBar
                  progress={status?.progress ?? project.progress}
                  label={status?.current_stage ?? project.current_stage ?? "Queued..."}
                />
                <div className="flex gap-4 mt-3">
                  <StatCard label="Images" value={status?.image_count ?? project.image_count} />
                  <StatCard label="Labels" value={status?.label_count ?? project.label_count} />
                  <StatCard label="Blind Spots" value={Object.keys(project.vulnerability_vector || {}).length} />
                </div>
              </Card>
            )}

            {/* Vulnerability summary going into generation */}
            {project.vulnerability_vector && Object.keys(project.vulnerability_vector).length > 0 ? (
              <Card>
                <p className="text-xs font-mono text-gray-500 mb-3 uppercase tracking-wider">Targeting {Object.keys(project.vulnerability_vector).length} Blind Spots</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(project.vulnerability_vector).map(([key, conf]) => (
                    <span key={key} className="text-xs font-mono px-2.5 py-1 rounded bg-red-950/50 border border-red-800/40 text-red-300">
                      {STRESSOR_LABELS[key] || key} ({Math.round(conf * 100)}%)
                    </span>
                  ))}
                </div>
              </Card>
            ) : (
              <Card>
                <p className="text-xs text-gray-500">No vulnerability scan run yet. Generation will use default stressors (fog, rain, occlusion, night).</p>
              </Card>
            )}
          </div>
        )}

        {/* ── DATASET TAB ── */}
        {tab === "dataset" && (
          <div>
            <div className="flex items-end justify-between mb-6">
              <div>
                <SectionLabel>Step 4 · Export Dataset</SectionLabel>
                <h2 className="font-display font-bold text-2xl">Dataset</h2>
                <p className="text-sm text-gray-500 mt-1">Download your COCO JSON + YOLO ready-to-train dataset package.</p>
              </div>
              <Button
                onClick={handleDownloadDataset}
                variant="primary"
                disabled={project.status !== "ready"}
              >
                <Download size={14} />
                {project.status === "ready" ? "Download Dataset" : "Not Ready"}
              </Button>
            </div>

            {project.status === "ready" ? (
              <>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <StatCard label="Images" value={project.image_count} color="text-emerald-400" />
                  <StatCard label="Annotations" value={project.label_count} color="text-blue-400" />
                  <StatCard label="Stressors" value={Object.keys(project.vulnerability_vector || {}).length} color="text-amber-400" />
                </div>

                <Card className="mb-4">
                  <p className="text-xs font-mono text-gray-500 mb-3 uppercase tracking-wider">Package Contents</p>
                  <div className="space-y-2 font-mono text-xs text-gray-400">
                    {[
                      "dataset/images/ — All generated images",
                      "dataset/annotations/instances_train.json — COCO JSON",
                      "dataset/yolo_labels/ — YOLO .txt label files",
                      "dataset/dataset.yaml — YOLO dataset config",
                    ].map((line) => (
                      <div key={line} className="flex items-center gap-2">
                        <span className="text-emerald-600">›</span> {line}
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <p className="text-xs font-mono text-gray-500 mb-3 uppercase tracking-wider">Stressor Breakdown</p>
                  {project.vulnerability_vector && Object.entries(project.vulnerability_vector).map(([key, conf]) => (
                    <ConfidenceBar key={key} label={STRESSOR_LABELS[key] || key} value={conf} />
                  ))}
                </Card>
              </>
            ) : (
              <EmptyState
                icon={<Database size={36} />}
                title="Dataset not ready"
                description={
                  isActive
                    ? `Pipeline running: ${project.current_stage || "Processing..."} (${project.progress}%)`
                    : "Run the generation pipeline to produce your labeled dataset."
                }
                action={
                  !isActive ? (
                    <Button onClick={() => setTab("generate")} variant="primary">
                      <Play size={14} /> Go to Generation
                    </Button>
                  ) : (
                    <ProgressBar progress={project.progress} />
                  )
                }
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
