import axios from "axios";
import { supabase } from "./supabase";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: "created" | "training_lora" | "scanning" | "generating" | "labeling" | "ready" | "failed";
  progress: number;
  current_stage?: string;
  model_endpoint?: string;
  vulnerability_vector?: Record<string, number>;
  dataset_url?: string;
  image_count: number;
  label_count: number;
  seed_images: { id: string; filename: string; url: string }[];
  created_at?: string;
  updated_at?: string;
}

export interface StatusResponse {
  project_id: string;
  status: string;
  progress: number;
  current_stage?: string;
  celery_state?: string;
  image_count: number;
  label_count: number;
  error_message?: string;
}

export interface VulnerabilityResponse {
  vulnerability_vector: Record<string, number>;
  blind_spots_found: number;
  stressor_details: Record<string, { label: string; confidence: number }>;
}

export interface DatasetResponse {
  project_id: string;
  download_url: string;
  image_count: number;
  label_count: number;
  vulnerability_vector: Record<string, number>;
  format: string;
  expires_in_seconds: number;
}

// ─── Project API ─────────────────────────────────────────────────────────────

export const createProject = async (name: string, description?: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('projects')
    .insert([{ 
      name, 
      description, 
      owner_id: user?.id,
      status: "created",
      progress: 0
    }])
    .select()
    .single();
  
  if (error) throw error;
  return data as Project;
};

export const listProjects = async () => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Project[];
};

export const getProject = async (id: string) => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Project;
};

export const deleteProject = async (id: string) => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return { deleted: true };
};

export const uploadSeedImages = async (projectId: string, files: File[]) => {
  const uploadedImages: { id: string; filename: string; url: string }[] = [];

  for (const file of files) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${projectId}/${fileName}`;

    // 1. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('project-seeds')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // 2. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from('project-seeds')
      .getPublicUrl(filePath);

    uploadedImages.push({
      id: Math.random().toString(36).substring(7),
      filename: file.name,
      url: publicUrl
    });
  }

  // 3. Update Project metadata in DB
  // First get existing images to append
  const { data: project } = await supabase
    .from('projects')
    .select('seed_images')
    .eq('id', projectId)
    .single();

  const currentImages = project?.seed_images || [];
  const { error: updateError } = await supabase
    .from('projects')
    .update({ 
      seed_images: [...currentImages, ...uploadedImages],
      image_count: currentImages.length + uploadedImages.length
    })
    .eq('id', projectId);

  if (updateError) throw updateError;
  
  return { success: true };
};

export const setModelEndpoint = (projectId: string, endpoint: string) =>
  api.post(`/api/projects/${projectId}/model-endpoint`, { endpoint }).then((r) => r.data);

export const trainLora = (projectId: string) =>
  api.post(`/api/projects/${projectId}/train-lora`).then((r) => r.data);

export const runAdversarialScan = (projectId: string) =>
  api.post<VulnerabilityResponse>(`/api/projects/${projectId}/run-adversarial-scan`).then((r) => r.data);

export const triggerGeneration = (projectId: string) =>
  api.post(`/api/projects/${projectId}/generate`).then((r) => r.data);

export const getStatus = async (projectId: string): Promise<StatusResponse> => {
  const { data, error } = await supabase
    .from('projects')
    .select('id, status, progress, current_stage, image_count, label_count, error_message')
    .eq('id', projectId)
    .single();
  
  if (error) throw error;
  return {
    project_id: data.id,
    status: data.status,
    progress: data.progress,
    current_stage: data.current_stage,
    image_count: data.image_count || 0,
    label_count: data.label_count || 0,
    error_message: data.error_message
  };
};

export const getDataset = (projectId: string) =>
  api.get<DatasetResponse>(`/api/projects/${projectId}/dataset`).then((r) => r.data);

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<string, string> = {
  created: "Created",
  training_lora: "Training LoRA",
  scanning: "Scanning",
  generating: "Generating",
  labeling: "Labeling",
  ready: "Ready",
  failed: "Failed",
};

export const STATUS_COLORS: Record<string, string> = {
  created: "text-gray-400 bg-gray-900 border-gray-700",
  training_lora: "text-blue-300 bg-blue-950 border-blue-700",
  scanning: "text-amber-300 bg-amber-950 border-amber-700",
  generating: "text-purple-300 bg-purple-950 border-purple-700",
  labeling: "text-cyan-300 bg-cyan-950 border-cyan-700",
  ready: "text-emerald-300 bg-emerald-950 border-emerald-700",
  failed: "text-red-300 bg-red-950 border-red-700",
};
